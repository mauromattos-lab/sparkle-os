// Distributed session lock — ensures only one agent processes a session at a time
// Prevents duplicate responses when multiple messages arrive in quick succession
//
// Pattern: INSERT ON CONFLICT DO NOTHING + pre-acquire cleanup of stale locks
// - Pre-acquire: DELETE locks da mesma sessão com locked_at < NOW - TTL (Story 18.1 / TD-06)
// - Insert succeeds → lock acquired
// - Insert fails (conflict) → session already locked by another execution
// - finally block → lock always released, even on error

import { getSupabase } from '../db/client.js';

// TTL pra detectar lock órfão (crash do processo entre acquire e release no finally).
// Configurável via env; default 5min.
const STALE_LOCK_AGE_MS = parseInt(process.env['ZENYA_LOCK_TTL_MS'] ?? '300000', 10);

export async function acquireLock(tenantId: string, phone: string): Promise<boolean> {
  const sb = getSupabase();

  // Pre-acquire cleanup: remove qualquer lock órfão DESSA sessão antes de tentar acquire.
  // Sem isso, crash do processo entre INSERT e DELETE no finally deixaria a sessão
  // travada indefinidamente. Cleanup só atua em locks com locked_at < NOW - TTL — locks
  // vivos (<TTL) NÃO são afetados (sessão concorrente continua bloqueada corretamente).
  const staleThreshold = new Date(Date.now() - STALE_LOCK_AGE_MS).toISOString();
  await sb
    .from('zenya_session_lock')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('phone_number', phone)
    .lt('locked_at', staleThreshold);

  const { error } = await sb.from('zenya_session_lock').insert({
    tenant_id: tenantId,
    phone_number: phone,
  });

  if (error) {
    // Duplicate key = lock already held (lock vivo, dentro do TTL)
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
