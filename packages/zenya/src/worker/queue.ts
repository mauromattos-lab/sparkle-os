// Zenya message queue — persists incoming messages to PostgreSQL
// Prevents message loss and enables serial processing per session

import { getSupabase } from '../db/client.js';

export interface QueuedMessage {
  tenant_id: string;
  phone_number: string;
  message_id: string;
  payload: Record<string, unknown>;
}

export interface PendingMessage {
  message_id: string;
  content: string;
  /** URL of audio attachment, if message has no text content */
  audio_url?: string | undefined;
}

export async function enqueue(msg: QueuedMessage): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('zenya_queue').insert({
    tenant_id: msg.tenant_id,
    phone_number: msg.phone_number,
    message_id: msg.message_id,
    payload: msg.payload,
    status: 'pending',
  });

  if (error) {
    // Duplicate message_id = already enqueued (idempotent)
    if (error.code === '23505') return;
    throw new Error(`Failed to enqueue message: ${error.message}`);
  }
}

/**
 * Fetches all pending messages for a session, ordered by creation time.
 * Used after debounce window to collect burst messages sent in quick succession.
 */
export async function fetchPending(
  tenantId: string,
  phone: string,
): Promise<PendingMessage[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('zenya_queue')
    .select('message_id, payload')
    .eq('tenant_id', tenantId)
    .eq('phone_number', phone)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`fetchPending failed: ${error.message}`);

  return (data ?? []).map((row) => {
    const payload = row['payload'] as Record<string, unknown>;
    const content = String(payload['content'] ?? '');
    // Extract audio URL if message has no text content (voice message)
    const attachments = payload['attachments'] as Array<Record<string, unknown>> | undefined;
    const audioAttachment = attachments?.find(
      (a) => a['file_type'] === 'audio' && a['data_url'],
    );
    return {
      message_id: String(row['message_id']),
      content,
      audio_url: content ? undefined : (audioAttachment?.['data_url'] as string | undefined),
    };
  });
}

export async function markProcessing(messageId: string): Promise<void> {
  const sb = getSupabase();
  await sb
    .from('zenya_queue')
    .update({ status: 'processing' })
    .eq('message_id', messageId);
}

export async function markDone(messageId: string): Promise<void> {
  const sb = getSupabase();
  await sb
    .from('zenya_queue')
    .update({ status: 'done' })
    .eq('message_id', messageId);
}

export async function markFailed(messageId: string): Promise<void> {
  const sb = getSupabase();
  await sb
    .from('zenya_queue')
    .update({ status: 'failed' })
    .eq('message_id', messageId);
}

export async function markAllDone(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  const sb = getSupabase();
  await sb.from('zenya_queue').update({ status: 'done' }).in('message_id', messageIds);
}

export async function markAllFailed(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  const sb = getSupabase();
  await sb.from('zenya_queue').update({ status: 'failed' }).in('message_id', messageIds);
}
