// Distributed session lock — ensures only one agent processes a session at a time
// Prevents duplicate responses when multiple messages arrive in quick succession
//
// Pattern: INSERT ON CONFLICT DO NOTHING
// - Insert succeeds → lock acquired
// - Insert fails (conflict) → session already locked by another execution
// - finally block → lock always released, even on error

import { getSupabase } from '../db/client.js';

export async function acquireLock(tenantId: string, phone: string): Promise<boolean> {
  const sb = getSupabase();
  const { error } = await sb.from('zenya_session_lock').insert({
    tenant_id: tenantId,
    phone_number: phone,
  });

  if (error) {
    // Duplicate key = lock already held
    if (error.code === '23505') return false;
    throw new Error(`Lock acquisition failed: ${error.message}`);
  }

  return true;
}

export async function releaseLock(tenantId: string, phone: string): Promise<void> {
  const sb = getSupabase();
  await sb
    .from('zenya_session_lock')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('phone_number', phone);
}

export async function withSessionLock(
  tenantId: string,
  phone: string,
  fn: () => Promise<void>,
): Promise<{ locked: boolean }> {
  const acquired = await acquireLock(tenantId, phone);

  if (!acquired) {
    // Another execution is processing this session — skip (message already in queue)
    return { locked: false };
  }

  try {
    await fn();
  } finally {
    // Lock MUST be released even if fn() throws
    await releaseLock(tenantId, phone);
  }

  return { locked: true };
}
