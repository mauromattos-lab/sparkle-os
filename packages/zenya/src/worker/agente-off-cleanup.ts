// Periodic cleanup: removes 'agente-off' label from conversations idle for 72h
// Runs every hour — prevents conversations from staying blocked if agent forgets to remove label

import { getSupabase } from '../db/client.js';
import { zapiRemoveLabel, type ZApiCredentials } from '../integrations/zapi-labels.js';
import { getCredentialJson } from '../tenant/credentials.js';

const BASE_URL = process.env['CHATWOOT_BASE_URL']!;
const TOKEN = process.env['CHATWOOT_API_TOKEN']!;
const IDLE_THRESHOLD_MS = 72 * 60 * 60 * 1000; // 72 hours
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // every hour

function headers(): Record<string, string> {
  return { 'api_access_token': TOKEN, 'Content-Type': 'application/json' };
}

interface AgenteOffConversation {
  id: number;
  labels: string[];
  last_activity_at: number;
  /** Chatwoot conversation meta — includes sender phone when present */
  meta?: {
    sender?: {
      phone_number?: string | null;
    };
  };
}

async function getAllTenants(): Promise<Array<{ tenantId: string; accountId: string }>> {
  const sb = getSupabase();
  const { data } = await sb.from('zenya_tenants').select('id, chatwoot_account_id');
  return (data ?? []).map((row: Record<string, unknown>) => ({
    tenantId: String(row['id']),
    accountId: String(row['chatwoot_account_id']),
  }));
}

async function getAgenteOffConversations(
  accountId: string,
): Promise<AgenteOffConversation[]> {
  const conversations: AgenteOffConversation[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `${BASE_URL}/api/v1/accounts/${accountId}/conversations?page=${page}&labels[]=agente-off`,
      { headers: headers() },
    );
    if (!res.ok) break;
    const data = (await res.json()) as { data?: { payload?: unknown[] } };
    const items = (data.data?.payload ?? []) as AgenteOffConversation[];
    conversations.push(...items);
    if (items.length < 25) break;
  }
  return conversations;
}

async function getLastAgentMessageAt(accountId: string, conversationId: number): Promise<number | null> {
  const res = await fetch(
    `${BASE_URL}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    { headers: headers() },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { payload?: Array<{ message_type: number; created_at: number }> };
  const messages = data.payload ?? [];
  // message_type 1 = outgoing (agent messages)
  const agentMessages = messages.filter((m) => m.message_type === 1);
  if (agentMessages.length === 0) return null;
  return agentMessages[agentMessages.length - 1]!.created_at * 1000;
}

async function removeAgenteOffLabel(accountId: string, conversationId: number, currentLabels: string[]): Promise<void> {
  const newLabels = currentLabels.filter((l) => l !== 'agente-off');
  const res = await fetch(
    `${BASE_URL}/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ labels: newLabels }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[agente-off-cleanup] Failed to remove label conv=${conversationId}: ${res.status} ${body}`);
  }
}

export async function runCleanup(): Promise<void> {
  const tenants = await getAllTenants().catch(() => [] as Array<{ tenantId: string; accountId: string }>);
  const now = Date.now();

  for (const { tenantId, accountId } of tenants) {
    const conversations = await getAgenteOffConversations(accountId).catch(() => []);

    for (const conv of conversations) {
      // Use last agent message time, fallback to conversation's last_activity_at
      const lastAgentAt = await getLastAgentMessageAt(accountId, conv.id).catch(() => null);
      const referenceTime = lastAgentAt ?? (conv.last_activity_at * 1000);

      if (now - referenceTime >= IDLE_THRESHOLD_MS) {
        const idleHours = Math.round((now - referenceTime) / 3_600_000);
        await removeAgenteOffLabel(accountId, conv.id, conv.labels);
        console.log(
          `[agente-off-cleanup] Removed agente-off — account=${accountId} conv=${conv.id} idle=${idleHours}h`,
        );

        // Remove native WhatsApp Business label — non-critical, degrades gracefully
        const phone = conv.meta?.sender?.phone_number ?? null;
        if (phone) {
          try {
            const zapCreds = await getCredentialJson<ZApiCredentials>(tenantId, 'zapi');
            const labelId = zapCreds.labels?.humano;
            if (labelId) {
              await zapiRemoveLabel(phone, labelId, zapCreds);
            }
          } catch (err) {
            console.warn(
              `[agente-off-cleanup] zapiRemoveLabel falhou (non-critical) — account=${accountId} conv=${conv.id}: ${err}`,
            );
          }
        }
      }
    }
  }
}

export function startAgenteOffCleanup(): void {
  void runCleanup();
  setInterval(() => void runCleanup(), CHECK_INTERVAL_MS);
  console.log('[agente-off-cleanup] Started — checks every hour, removes agente-off after 72h idle');
}
