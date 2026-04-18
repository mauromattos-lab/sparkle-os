// Periodic cleanup: removes 'agente-off' label from conversations idle for 72h
// Runs every hour — prevents conversations from staying blocked if agent forgets to remove label

import { getSupabase } from '../db/client.js';

const BASE_URL = process.env['CHATWOOT_BASE_URL']!;
const TOKEN = process.env['CHATWOOT_API_TOKEN']!;
const IDLE_THRESHOLD_MS = 72 * 60 * 60 * 1000; // 72 hours
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // every hour

function headers(): Record<string, string> {
  return { 'api_access_token': TOKEN, 'Content-Type': 'application/json' };
}

async function getAllAccountIds(): Promise<string[]> {
  const sb = getSupabase();
  const { data } = await sb.from('zenya_tenants').select('chatwoot_account_id');
  return (data ?? []).map((row: Record<string, unknown>) => String(row['chatwoot_account_id']));
}

async function getAgenteOffConversations(
  accountId: string,
): Promise<Array<{ id: number; labels: string[]; last_activity_at: number }>> {
  const conversations: Array<{ id: number; labels: string[]; last_activity_at: number }> = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `${BASE_URL}/api/v1/accounts/${accountId}/conversations?page=${page}&labels[]=agente-off`,
      { headers: headers() },
    );
    if (!res.ok) break;
    const data = (await res.json()) as { data?: { payload?: unknown[] } };
    const items = (data.data?.payload ?? []) as Array<{ id: number; labels: string[]; last_activity_at: number }>;
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

async function runCleanup(): Promise<void> {
  const accountIds = await getAllAccountIds().catch(() => [] as string[]);
  const now = Date.now();

  for (const accountId of accountIds) {
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
      }
    }
  }
}

export function startAgenteOffCleanup(): void {
  void runCleanup();
  setInterval(() => void runCleanup(), CHECK_INTERVAL_MS);
  console.log('[agente-off-cleanup] Started — checks every hour, removes agente-off after 72h idle');
}
