// Supabase client — same pattern as packages/brain/src/db/client.ts
// Uses REST API over HTTPS to avoid direct port 5432 firewall issues

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
