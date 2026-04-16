// Conversation history — reads and writes zenya_conversation_history
// Provides a sliding window of the last N messages per session (tenant + phone)
// Kept separate from n8n tables to enable clean parallel operation

import { getSupabase } from '../db/client.js';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface HistoryRow {
  role: string;
  content: string;
}

/**
 * Loads the last `limit` messages for a session, ordered oldest-first.
 * Returns an empty array if no history exists yet.
 */
export async function loadHistory(
  tenantId: string,
  phone: string,
  limit = 50,
): Promise<ConversationMessage[]> {
  const sb = getSupabase();

  // Fetch latest N rows (descending), then reverse for chronological order
  const { data, error } = await sb
    .from('zenya_conversation_history')
    .select('role, content')
    .eq('tenant_id', tenantId)
    .eq('phone_number', phone)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load conversation history: ${error.message}`);
  }

  const rows = (data as HistoryRow[] | null) ?? [];
  return rows
    .reverse()
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

/**
 * Deletes all conversation history for a session (tenant + phone).
 * Used by the /reset command in test mode.
 */
export async function clearHistory(tenantId: string, phone: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('zenya_conversation_history')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('phone_number', phone);

  if (error) {
    throw new Error(`Failed to clear conversation history: ${error.message}`);
  }
}

/**
 * Persists a user message and the agent's response as two separate rows.
 */
export async function saveHistory(
  tenantId: string,
  phone: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  const sb = getSupabase();

  const { error } = await sb.from('zenya_conversation_history').insert([
    {
      tenant_id: tenantId,
      phone_number: phone,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    },
    {
      tenant_id: tenantId,
      phone_number: phone,
      role: 'assistant',
      content: assistantReply,
      created_at: new Date(Date.now() + 1).toISOString(), // +1ms keeps assistant after user
    },
  ]);

  if (error) {
    throw new Error(`Failed to save conversation history: ${error.message}`);
  }
}
