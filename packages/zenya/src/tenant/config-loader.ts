// Tenant config loader — loads + caches tenant configuration from Supabase
// tenantId is resolved from chatwoot_account_id (from webhook payload)
// Cache TTL: 5 minutes — balances freshness with DB round-trips

import { getSupabase } from '../db/client.js';

export interface TenantConfig {
  id: string;
  name: string;
  system_prompt: string;
  active_tools: string[];
  chatwoot_account_id: string;
  /** Test mode: if non-empty, only these phone numbers receive responses. */
  allowed_phones: string[];
  /** Admin channel: numbers that receive admin-mode responses (metrics, stats). */
  admin_phones: string[];
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  config: TenantConfig;
  expiresAt: number;
}

// Two caches: one by UUID, one by chatwoot_account_id (webhook lookup)
const byId = new Map<string, CacheEntry>();
const byAccountId = new Map<string, CacheEntry>();

function isValid(entry: CacheEntry | undefined): entry is CacheEntry {
  return entry !== undefined && entry.expiresAt > Date.now();
}

function cacheEntry(config: TenantConfig, now = Date.now()): CacheEntry {
  return { config, expiresAt: now + TTL_MS };
}

function store(config: TenantConfig): void {
  const entry = cacheEntry(config);
  byId.set(config.id, entry);
  byAccountId.set(config.chatwoot_account_id, entry);
}

function rowToConfig(row: Record<string, unknown>): TenantConfig {
  return {
    id: String(row['id']),
    name: String(row['name']),
    system_prompt: String(row['system_prompt'] ?? ''),
    active_tools: Array.isArray(row['active_tools']) ? (row['active_tools'] as string[]) : [],
    chatwoot_account_id: String(row['chatwoot_account_id']),
    allowed_phones: Array.isArray(row['allowed_phones']) ? (row['allowed_phones'] as string[]) : [],
    admin_phones: Array.isArray(row['admin_phones']) ? (row['admin_phones'] as string[]) : [],
  };
}

/**
 * Loads tenant config by UUID. Cached for 5 minutes.
 * Throws if tenant is not found.
 */
export async function loadTenantConfig(tenantId: string): Promise<TenantConfig> {
  const cached = byId.get(tenantId);
  if (isValid(cached)) return cached.config;

  const sb = getSupabase();
  const { data, error } = await sb
    .from('zenya_tenants')
    .select('id, name, system_prompt, active_tools, chatwoot_account_id, allowed_phones')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    throw new Error(`Tenant not found: ${tenantId} — ${error?.message ?? 'no data'}`);
  }

  const config = rowToConfig(data as Record<string, unknown>);
  store(config);
  return config;
}

/**
 * Loads tenant config by Chatwoot account_id (from webhook body.account.id).
 * Cached for 5 minutes.
 * Throws if account_id maps to no tenant.
 */
export async function loadTenantByAccountId(accountId: string): Promise<TenantConfig> {
  const cached = byAccountId.get(accountId);
  if (isValid(cached)) return cached.config;

  const sb = getSupabase();
  const { data, error } = await sb
    .from('zenya_tenants')
    .select('id, name, system_prompt, active_tools, chatwoot_account_id, allowed_phones')
    .eq('chatwoot_account_id', accountId)
    .single();

  if (error || !data) {
    throw new Error(`No tenant for Chatwoot account_id: ${accountId} — ${error?.message ?? 'no data'}`);
  }

  const config = rowToConfig(data as Record<string, unknown>);
  store(config);
  return config;
}

/** Clears all cached entries. Useful in tests and for forced refresh. */
export function clearTenantCache(): void {
  byId.clear();
  byAccountId.clear();
}
