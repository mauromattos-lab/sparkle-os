// Sheets KB integration — consulta base de conhecimento do tenant (PLAKA)
// Implementa FR-3 do plaka-01 spec + AD-2 (snapshot local).
//
// A tool NÃO consulta Google Sheets em runtime. Ela lê APENAS da tabela local
// zenya_tenant_kb_entries, que é populada pelo worker kb-sync (ver worker/kb-sync.ts).
// Isso garante latência sub-10ms e elimina quota risk do Google Sheets API.
//
// Fluxo:
//   1. Normalizar pergunta do cliente (remover acentos, lowercase, colapsar whitespace)
//   2. Cache in-memory 5min por (tenant + pergunta_normalizada)
//   3. SELECT answer FROM zenya_tenant_kb_entries WHERE tenant_id=? AND question_normalized=?
//   4. Se encontrou: retornar texto literal (LLM instrui a copiar palavra por palavra)
//   5. Se não encontrou: retornar 'sem_match' para o LLM escalar (EC-2)

import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { getSupabase } from '../db/client.js';

interface KbEntry {
  answer: string;
  last_synced_at: string;
}

const CACHE_TTL_MS = 5 * 60 * 1_000;

const cache = new Map<string, { expires: number; value: KbEntry | null }>();

function cacheKey(tenantId: string, normalized: string): string {
  return `${tenantId}:${normalized}`;
}

/** Test-only helper. */
export function __resetCacheForTests(): void {
  cache.clear();
}

/**
 * Normaliza uma pergunta para lookup:
 * - NFD → remove diacríticos (acentos)
 * - lowercase
 * - colapsa whitespace
 * - trim
 * - remove pontuação final repetitiva (? ! .)
 */
export function normalizeQuestion(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.]+$/g, '')
    .trim();
}

export function createSheetsKBTools(tenantId: string): ToolSet {
  return {
    consultarKBSheets: tool({
      description:
        'Consulta a base de conhecimento oficial do tenant (perguntas frequentes e respostas padrão). ' +
        'Use SEMPRE antes de responder qualquer dúvida do cliente. ' +
        'Passe a pergunta do cliente como parâmetro. ' +
        'O texto retornado é a resposta FINAL — copie palavra por palavra, não parafraseie. ' +
        'Se retornar sem_match=true, você não tem resposta oficial — escale para humano.',
      parameters: z.object({
        pergunta: z
          .string()
          .describe('A pergunta do cliente, literal, como ele enviou'),
      }),
      execute: async ({ pergunta }) => {
        const normalized = normalizeQuestion(pergunta);
        if (!normalized) {
          return { sem_match: true, motivo: 'pergunta vazia' };
        }

        const key = cacheKey(tenantId, normalized);
        const cached = cache.get(key);
        if (cached && cached.expires > Date.now()) {
          if (!cached.value) {
            return { sem_match: true, motivo: 'cache: sem match prévio' };
          }
          return {
            sem_match: false,
            resposta: cached.value.answer,
            fonte_sincronizada_em: cached.value.last_synced_at,
          };
        }

        try {
          const sb = getSupabase();
          const { data, error } = await sb
            .from('zenya_tenant_kb_entries')
            .select('answer, last_synced_at')
            .eq('tenant_id', tenantId)
            .eq('question_normalized', normalized)
            .maybeSingle();

          if (error) {
            console.error(
              `[sheets-kb] tenant=${tenantId} consultarKBSheets pergunta="${normalized}" db_error: ${error.message}`,
            );
            // Degradação graciosa: se o banco falhar, LLM escala (EC-2)
            return {
              sem_match: true,
              motivo: 'erro técnico ao consultar base',
              erro: true,
            };
          }

          const entry = (data as KbEntry | null) ?? null;

          if (entry) {
            cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value: entry });
            console.log(
              `[sheets-kb] tenant=${tenantId} consultarKBSheets pergunta_normalizada="${normalized}" result=hit-exact synced=${entry.last_synced_at}`,
            );
            return {
              sem_match: false,
              resposta: entry.answer,
              fonte_sincronizada_em: entry.last_synced_at,
            };
          }

          // Fallback: fuzzy match por palavra-chave (substring word-bounded).
          // Carrega todas as entries do tenant e verifica se alguma keyword
          // aparece como palavra completa na pergunta normalizada do cliente.
          // Heurística: match mais longo ganha (keyword mais específica).
          const { data: allEntries, error: fuzzyErr } = await sb
            .from('zenya_tenant_kb_entries')
            .select('question_normalized, answer, last_synced_at')
            .eq('tenant_id', tenantId);

          if (fuzzyErr) {
            console.error(
              `[sheets-kb] tenant=${tenantId} fuzzy_lookup db_error: ${fuzzyErr.message}`,
            );
            cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value: null });
            return { sem_match: true };
          }

          const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const candidates = (allEntries ?? [])
            .map((row) => ({
              kw: String(row['question_normalized'] ?? '').trim(),
              answer: String(row['answer'] ?? ''),
              last_synced_at: String(row['last_synced_at'] ?? ''),
            }))
            .filter((c) => c.kw.length >= 3 && c.answer)
            .filter((c) => new RegExp(`\\b${escapeRegex(c.kw)}\\b`, 'i').test(normalized))
            .sort((a, b) => b.kw.length - a.kw.length);

          const hit = candidates[0];
          if (hit) {
            const hitEntry: KbEntry = { answer: hit.answer, last_synced_at: hit.last_synced_at };
            cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value: hitEntry });
            console.log(
              `[sheets-kb] tenant=${tenantId} consultarKBSheets pergunta_normalizada="${normalized}" result=hit-fuzzy kw="${hit.kw}" synced=${hit.last_synced_at}`,
            );
            return {
              sem_match: false,
              resposta: hit.answer,
              fonte_sincronizada_em: hit.last_synced_at,
              match_type: 'fuzzy',
              matched_keyword: hit.kw,
            };
          }

          cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value: null });
          console.log(
            `[sheets-kb] tenant=${tenantId} consultarKBSheets pergunta_normalizada="${normalized}" result=no-match`,
          );
          return { sem_match: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            `[sheets-kb] tenant=${tenantId} consultarKBSheets unexpected_error: ${message}`,
          );
          return {
            sem_match: true,
            motivo: 'erro técnico inesperado',
            erro: true,
          };
        }
      },
    }),
  };
}
