// Zenya message queue — persists incoming messages to PostgreSQL
// Prevents message loss and enables serial processing per session

import { getSupabase } from '../db/client.js';

export interface QueuedMessage {
  tenant_id: string;
  phone_number: string;
  message_id: string;
  payload: Record<string, unknown>;
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
