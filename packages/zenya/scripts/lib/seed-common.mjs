// Utilitários compartilhados pelos seeds de tenants Zenya.
//
// Extraído em Story zenya-prompts-02-prime conforme ADR-001.
// Centraliza:
//   - Carregamento do prompt de `docs/zenya/tenants/{slug}/prompt.md` via gray-matter
//   - Parsing de env vars compartilhadas (admin_phones, admin_contacts, allowed_phones, active_tools)
//   - Flag `--dry-run` para validar o conteúdo antes do UPSERT
//   - `applyTenantSeed` — única fonte de verdade do upsert (com suporte a dry-run)
//
// Design enxuto: assinatura única, sem flags mágicas. Se precisar mais de 2 opções,
// revisitar (vide Story 02 — Risco "Utilitário vira complexo e difícil de usar").

import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import matter from 'gray-matter';

export function isDryRun(argv = process.argv) {
  return argv.includes('--dry-run');
}

export function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

export async function loadPromptFromMarkdown(promptPath) {
  const raw = await readFile(promptPath, 'utf-8');
  const parsed = matter(raw);
  const content = parsed.content.trim();
  if (!content) {
    throw new Error(`Prompt vazio após extrair front-matter em ${promptPath}`);
  }
  return { content, meta: parsed.data ?? {} };
}

export function parseCsvEnv(raw, { fallback = '' } = {}) {
  return (raw ?? fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseJsonEnv(raw, { name, fallback = [] } = {}) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${name ?? 'env var'} deve ser JSON válido: ${err.message}`);
  }
}

export async function applyTenantSeed({
  supabase,
  table = 'zenya_tenants',
  row,
  conflict = 'chatwoot_account_id',
  dryRun = false,
  columns = 'id, name, chatwoot_account_id, active_tools',
}) {
  const hash = md5(row.system_prompt);

  if (dryRun) {
    console.log('🧪 DRY RUN — não executando UPSERT');
    console.log(
      JSON.stringify(
        {
          table,
          conflict,
          row: {
            ...row,
            system_prompt: `<${row.system_prompt.length} chars, md5=${hash}>`,
          },
        },
        null,
        2,
      ),
    );
    return { dryRun: true, hash, data: null };
  }

  const { data, error } = await supabase
    .from(table)
    .upsert(row, { onConflict: conflict })
    .select(columns)
    .single();

  if (error) {
    const err = new Error(`Erro ao upsert em ${table}: ${error.message}`);
    err.cause = error;
    throw err;
  }

  return { dryRun: false, hash, data };
}
