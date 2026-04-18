// Zenya Admin Agent — responds to messages from admin_phones with metrics and management tools
// Admin mode: messages from Julia's personal number to the Fun Personalize WhatsApp
// Uses Chatwoot API to pull conversation metrics — no customer history involved

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { tool } from 'ai';
import { z } from 'zod';
import {
  setTypingStatus,
  getChatwootParams,
  markConversationRead,
} from '../integrations/chatwoot.js';
import { chunkAndSend } from '../integrations/message-chunker.js';
import type { TenantConfig } from '../tenant/config-loader.js';

const BASE_URL = process.env['CHATWOOT_BASE_URL']!;
const TOKEN = process.env['CHATWOOT_API_TOKEN']!;

function chatwootHeaders(): Record<string, string> {
  return { 'api_access_token': TOKEN, 'Content-Type': 'application/json' };
}

const ADMIN_SYSTEM_PROMPT = `Você é a Zenya em modo admin. Você está falando com Julia, proprietária da Fun Personalize.
Responda de forma objetiva e direta com as métricas e informações solicitadas.
Você tem acesso a ferramentas para consultar dados do Chatwoot (conversas, status, escalações).
Seja concisa — Julia está consultando pelo WhatsApp, não quer respostas longas.
Se não souber algo, diga claramente. Não invente dados.`;

/**
 * Fetches conversation counts from Chatwoot for the given account.
 * Returns today's stats: total incoming, resolved by bot (no agente-off), escalated to human.
 */
async function fetchConversationStats(accountId: string): Promise<{
  today: number;
  resolved: number;
  escalated: number;
  open: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = Math.floor(today.getTime() / 1000);

  // Fetch open conversations
  const openRes = await fetch(
    `${BASE_URL}/api/v1/accounts/${accountId}/conversations?status=open&page=1`,
    { headers: chatwootHeaders() },
  );
  const openData = openRes.ok
    ? ((await openRes.json()) as { data?: { meta?: { all_count?: number } } })
    : null;
  const open = openData?.data?.meta?.all_count ?? 0;

  // Fetch resolved conversations
  const resolvedRes = await fetch(
    `${BASE_URL}/api/v1/accounts/${accountId}/conversations?status=resolved&page=1`,
    { headers: chatwootHeaders() },
  );
  const resolvedData = resolvedRes.ok
    ? ((await resolvedRes.json()) as { data?: { meta?: { all_count?: number } } })
    : null;
  const resolvedTotal = resolvedData?.data?.meta?.all_count ?? 0;

  // Fetch conversations with agente-off label (escalated today)
  const escalatedRes = await fetch(
    `${BASE_URL}/api/v1/accounts/${accountId}/conversations?labels[]=agente-off&page=1`,
    { headers: chatwootHeaders() },
  );
  const escalatedData = escalatedRes.ok
    ? ((await escalatedRes.json()) as { data?: { payload?: unknown[]; meta?: { all_count?: number } } })
    : null;
  const escalated = escalatedData?.data?.meta?.all_count ?? 0;

  // Today's conversations = open + resolved from today (approximate using since filter)
  const todayRes = await fetch(
    `${BASE_URL}/api/v1/accounts/${accountId}/conversations?page=1&since=${since}`,
    { headers: chatwootHeaders() },
  );
  const todayData = todayRes.ok
    ? ((await todayRes.json()) as { data?: { meta?: { all_count?: number } } })
    : null;
  const today_count = todayData?.data?.meta?.all_count ?? open + resolvedTotal;

  return {
    today: today_count,
    resolved: resolvedTotal,
    escalated,
    open,
  };
}

function createAdminTools(accountId: string) {
  return {
    consultar_metricas: tool({
      description: 'Consulta métricas de atendimento: conversas hoje, abertas, resolvidas, escaladas para humano.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const stats = await fetchConversationStats(accountId);
          return {
            hoje: stats.today,
            abertas: stats.open,
            resolvidas: stats.resolved,
            escaladas_para_humano: stats.escalated,
            resumo: `Hoje: ${stats.today} conversas | ${stats.open} abertas | ${stats.resolved} resolvidas | ${stats.escalated} escaladas para humano`,
          };
        } catch (err) {
          return { erro: `Não foi possível buscar métricas: ${String(err)}` };
        }
      },
    }),

    listar_conversas_abertas: tool({
      description: 'Lista as conversas abertas no momento com nome do cliente e tempo de espera.',
      parameters: z.object({
        limite: z.number().optional().describe('Máximo de conversas a retornar (padrão: 10)'),
      }),
      execute: async ({ limite = 10 }) => {
        try {
          const res = await fetch(
            `${BASE_URL}/api/v1/accounts/${accountId}/conversations?status=open&page=1`,
            { headers: chatwootHeaders() },
          );
          if (!res.ok) return { erro: 'Não foi possível buscar conversas' };

          const data = (await res.json()) as {
            data?: {
              payload?: Array<{
                id: number;
                meta?: { sender?: { name?: string } };
                created_at?: number;
                labels?: string[];
              }>;
            };
          };

          const conversations = (data.data?.payload ?? []).slice(0, limite);
          const now = Date.now() / 1000;

          const lista = conversations.map((c) => {
            const name = c.meta?.sender?.name ?? 'Desconhecido';
            const ageMin = c.created_at ? Math.round((now - c.created_at) / 60) : null;
            const labels = c.labels?.join(', ') || 'nenhuma';
            return `#${c.id} — ${name} | ${ageMin != null ? `${ageMin}min` : 'N/A'} | labels: ${labels}`;
          });

          return {
            total: conversations.length,
            conversas: lista.join('\n') || 'Nenhuma conversa aberta',
          };
        } catch (err) {
          return { erro: `Erro ao listar conversas: ${String(err)}` };
        }
      },
    }),

    listar_escaladas: tool({
      description: 'Lista conversas atualmente escaladas para atendimento humano (com label agente-off).',
      parameters: z.object({}),
      execute: async () => {
        try {
          const res = await fetch(
            `${BASE_URL}/api/v1/accounts/${accountId}/conversations?labels[]=agente-off&page=1`,
            { headers: chatwootHeaders() },
          );
          if (!res.ok) return { erro: 'Não foi possível buscar conversas escaladas' };

          const data = (await res.json()) as {
            data?: {
              payload?: Array<{
                id: number;
                meta?: { sender?: { name?: string } };
                created_at?: number;
              }>;
            };
          };

          const conversations = data.data?.payload ?? [];
          const now = Date.now() / 1000;

          const lista = conversations.map((c) => {
            const name = c.meta?.sender?.name ?? 'Desconhecido';
            const ageHr = c.created_at ? Math.round((now - c.created_at) / 3600) : null;
            return `#${c.id} — ${name} | escalada há ${ageHr != null ? `${ageHr}h` : 'N/A'}`;
          });

          return {
            total: conversations.length,
            conversas: lista.join('\n') || 'Nenhuma conversa escalada no momento',
          };
        } catch (err) {
          return { erro: `Erro ao listar escaladas: ${String(err)}` };
        }
      },
    }),
  };
}

export interface AdminAgentParams {
  accountId: string;
  conversationId: string;
  config: TenantConfig;
  message: string;
  phone: string;
}

/**
 * Runs the admin agent for messages from admin_phones.
 * Provides metrics and management info — no customer history, no audio.
 */
export async function runAdminAgent(params: AdminAgentParams): Promise<void> {
  const { accountId, conversationId, config, message } = params;

  const chatwootParams = getChatwootParams(accountId, conversationId);

  await markConversationRead(chatwootParams).catch(() => undefined);
  await setTypingStatus(chatwootParams, 'on').catch(() => undefined);

  try {
    const tools = createAdminTools(accountId);

    const result = await generateText({
      model: openai('gpt-4.1'),
      maxSteps: 5,
      system: ADMIN_SYSTEM_PROMPT,
      messages: [{ role: 'user' as const, content: message }],
      tools,
    });

    const reply = result.text;

    if (reply.trim()) {
      await chunkAndSend(reply, chatwootParams);
    }
  } finally {
    await setTypingStatus(chatwootParams, 'off').catch(() => undefined);
  }
}
