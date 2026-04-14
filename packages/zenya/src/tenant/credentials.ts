// Credential loader — decrypts per-tenant service credentials stored in zenya_tenant_credentials
// SECURITY: decrypted values are returned in memory only — never logged, never persisted

import { getSupabase } from '../db/client.js';
import { decryptCredential, getMasterKey } from './crypto.js';

/**
 * Loads and decrypts a credential for a given tenant and service.
 * Returns the plaintext credential string (usually a JSON payload).
 * Throws if no credential exists for the (tenant_id, service) pair.
 */
export async function getDecryptedCredential(
  tenantId: string,
  service: string,
): Promise<string> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from('zenya_tenant_credentials')
    .select('credentials_encrypted')
    .eq('tenant_id', tenantId)
    .eq('service', service)
    .single();

  if (error || !data) {
    throw new Error(
      `No credential found for tenant=${tenantId} service=${service}: ${error?.message ?? 'no data'}`,
    );
  }

  const row = data as { credentials_encrypted: Uint8Array | string };

  // Supabase returns BYTEA as Uint8Array or as a hex string depending on client config
  let encryptedBuf: Buffer;
  if (typeof row.credentials_encrypted === 'string') {
    // Hex string from Supabase REST
    encryptedBuf = Buffer.from(row.credentials_encrypted.replace(/^\\x/, ''), 'hex');
  } else {
    encryptedBuf = Buffer.from(row.credentials_encrypted);
  }

  const masterKey = getMasterKey();
  return decryptCredential(encryptedBuf, masterKey);
}

/**
 * Loads and JSON-parses a credential for a given service.
 * Convenience wrapper around getDecryptedCredential.
 */
export async function getCredentialJson<T = Record<string, unknown>>(
  tenantId: string,
  service: string,
): Promise<T> {
  const raw = await getDecryptedCredential(tenantId, service);
  return JSON.parse(raw) as T;
}
