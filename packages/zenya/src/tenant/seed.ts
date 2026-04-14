#!/usr/bin/env tsx
// Seed script — populates zenya_tenants with the 4 current SparkleOS clients
// Run: npx tsx src/tenant/seed.ts
//
// Prerequisites:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ZENYA_MASTER_KEY set in .env
//   Migration 002_zenya_tenants.sql applied

import 'dotenv/config';
import { getSupabase } from '../db/client.js';
import { encryptCredential, getMasterKey } from './crypto.js';

interface TenantSeed {
  name: string;
  /** Chatwoot account ID for this client (body.account.id from webhook) */
  chatwoot_account_id: string;
  /** System prompt / SOP — will be migrated from n8n flow "01. Secretária v3" */
  system_prompt: string;
  /** Tools activated for this client */
  active_tools: string[];
  /** Optional plain-text credentials to encrypt and insert */
  credentials?: Array<{ service: string; value: string }>;
}

// -----------------------------------------------------------------------
// CLIENT DATA
// Fill in the actual values from n8n before running this script.
// system_prompt: copy from n8n node "Configure a Zenya" > field "sop_completo"
// chatwoot_account_id: Chatwoot > Settings > Account > ID
// -----------------------------------------------------------------------
const TENANTS: TenantSeed[] = [
  {
    name: 'Zenya Prime (SparkleOS)',
    chatwoot_account_id: 'FILL_SPARKLE_ACCOUNT_ID',
    system_prompt: 'FILL_SYSTEM_PROMPT_SPARKLE',
    active_tools: ['escalar_humano', 'quebrar_mensagens'],
    credentials: [],
  },
  {
    name: 'FILL_CLIENT_1_NAME',
    chatwoot_account_id: 'FILL_CLIENT_1_ACCOUNT_ID',
    system_prompt: 'FILL_SYSTEM_PROMPT_CLIENT_1',
    active_tools: ['escalar_humano', 'quebrar_mensagens', 'google_calendar'],
    credentials: [],
  },
  {
    name: 'FILL_CLIENT_2_NAME',
    chatwoot_account_id: 'FILL_CLIENT_2_ACCOUNT_ID',
    system_prompt: 'FILL_SYSTEM_PROMPT_CLIENT_2',
    active_tools: ['escalar_humano', 'quebrar_mensagens'],
    credentials: [],
  },
  {
    name: 'FILL_CLIENT_3_NAME',
    chatwoot_account_id: 'FILL_CLIENT_3_ACCOUNT_ID',
    system_prompt: 'FILL_SYSTEM_PROMPT_CLIENT_3',
    active_tools: ['escalar_humano', 'quebrar_mensagens'],
    credentials: [],
  },
];
// -----------------------------------------------------------------------

async function seed(): Promise<void> {
  const sb = getSupabase();
  const masterKey = getMasterKey();

  for (const t of TENANTS) {
    if (t.chatwoot_account_id.startsWith('FILL_')) {
      console.warn(`[seed] Skipping ${t.name} — placeholder values not filled`);
      continue;
    }

    // Upsert tenant (idempotent: update on conflict)
    const { data: tenant, error: tenantErr } = await sb
      .from('zenya_tenants')
      .upsert(
        {
          name: t.name,
          system_prompt: t.system_prompt,
          active_tools: t.active_tools,
          chatwoot_account_id: t.chatwoot_account_id,
        },
        { onConflict: 'chatwoot_account_id', ignoreDuplicates: false },
      )
      .select('id')
      .single();

    if (tenantErr || !tenant) {
      console.error(`[seed] Failed to upsert ${t.name}:`, tenantErr?.message);
      continue;
    }

    console.log(`[seed] Upserted tenant: ${t.name} (${String(tenant['id'])})`);

    // Insert encrypted credentials
    for (const cred of t.credentials ?? []) {
      const encrypted = encryptCredential(cred.value, masterKey);
      const { error: credErr } = await sb
        .from('zenya_tenant_credentials')
        .upsert(
          {
            tenant_id: String(tenant['id']),
            service: cred.service,
            credentials_encrypted: encrypted,
          },
          { onConflict: 'tenant_id,service', ignoreDuplicates: false },
        );

      if (credErr) {
        console.error(`  [seed] Failed credential ${cred.service}:`, credErr.message);
      } else {
        console.log(`  [seed] Upserted credential: ${cred.service}`);
      }
    }
  }

  console.log('[seed] Done.');
}

seed().catch((err: unknown) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
