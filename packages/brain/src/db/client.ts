// Supabase client — uses REST API over HTTPS (replaces postgres.js direct connection)
// Reason: direct Postgres port 5432 may be blocked by network/firewall.
// The Supabase JS client communicates via HTTPS/443 which is always open.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_KEY'];
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    }
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

export async function checkDbHealth(): Promise<boolean> {
  try {
    const sb = getSupabase();
    const { error } = await sb.from('insights').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

// Legacy alias — kept so existing imports don't break during transition
// @deprecated use getSupabase() instead
export function getSql(): never {
  throw new Error(
    'getSql() removed — use getSupabase() from db/client.ts. Direct postgres connection replaced by Supabase REST API.',
  );
}
