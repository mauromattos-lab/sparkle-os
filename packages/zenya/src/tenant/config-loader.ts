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
  /** Admin contacts with names: [{phone, name}] — used for personalized admin greetings. */
  admin_contacts: Array<{ phone: string; name: string }>;
  /**
   * When true (default), the `escalarHumano` tool posts the LLM-generated
   * `[ATENDIMENTO] ...` summary as a public message on the conversation
   * (customer sees it). When false, the tool omits the `resumo` parameter
   * entirely and the escalation runs silent (labels only). Optional — absent
   * value resolves to true, matching the DB default.
   */
  escalation_public_summary?: boolean;
  /**
   * Audio format for TTS responses. `mp3` (default) works on Z-API tenants.
   * `ogg_opus` is required for WhatsApp Cloud API tenants to render audio
   * as a native voice message (PTT) instead of a downloadable attachment.
   */
  audio_format?: 'mp3' | 'ogg_opus';
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
    admin_contacts: Array.isArray(row['admin_contacts']) ? (row['admin_contacts'] as Array<{ phone: string; name: string }>) : [],
    escalation_public_summary: row['escalation_public_summary'] !== false,
    audio_format: row['audio_format'] === 'ogg_opus' ? 'ogg_opus' : 'mp3',
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
    .select('id, name, system_prompt, active_tools, chatwoot_account_id, allowed_phones, admin_phones, admin_contacts, escalation_public_summary, audio_format')
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
    .select('id, name, system_prompt, active_tools, chatwoot_account_id, allowed_phones, admin_phones, admin_contacts, escalation_public_summary, audio_format')
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
