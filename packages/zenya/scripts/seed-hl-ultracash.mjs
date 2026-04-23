#!/usr/bin/env node
// Seed da credencial UltraCash para o tenant HL Importados.
//
// Complementa seed-hl-tenant.mjs: o tenant HL em si já existe em
// zenya_tenants; aqui inserimos a credencial da API UltraCash
// encriptada (AES-256-GCM) consumida por integrations/ultracash.ts.
//
// Env vars obrigatórias:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY       — admin client
//   ZENYA_MASTER_KEY                          — 64 hex (32 bytes), mesma do core
//   ULTRACASH_API_KEY                         — x-api-key da UltraCash (apihl.ultracash.com.br)
//
// Env var opcional (um dos dois):
//   HL_TENANT_ID          — UUID direto do tenant (retornado por seed-hl-tenant.mjs)
//   HL_CHATWOOT_ACCOUNT_ID — alternativa: resolve tenant via lookup
//
// Opcional:
//   ULTRACASH_FILIAL      — filial numérica (default: 1)
//
// Uso:
//   cd packages/zenya && node scripts/seed-hl-ultracash.mjs --dry-run
//   cd packages/zenya && node scripts/seed-hl-ultracash.mjs
//
// Idempotente: upsert por (tenant_id, service).

import 'dotenv/config';
import { createCipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ZENYA_MASTER_KEY', 'ULTRACASH_API_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

if (!process.env.HL_TENANT_ID && !process.env.HL_CHATWOOT_ACCOUNT_ID) {
  console.error('ERRO: defina HL_TENANT_ID ou HL_CHATWOOT_ACCOUNT_ID');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

function encryptCredential(plaintext, masterKeyHex) {
  const keyBuf = Buffer.from(masterKeyHex, 'hex');
  if (keyBuf.length !== 32) {
    throw new Error('ZENYA_MASTER_KEY deve ter 64 caracteres hex (32 bytes)');
  }
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

const credentialValue = {
  api_key: process.env.ULTRACASH_API_KEY,
  filial: process.env.ULTRACASH_FILIAL ? Number(process.env.ULTRACASH_FILIAL) : 1,
};

const plaintext = JSON.stringify(credentialValue);
const encrypted = encryptCredential(plaintext, process.env.ZENYA_MASTER_KEY);

if (DRY_RUN) {
  console.log('🧪 DRY RUN — nada será gravado');
  console.log(`   shape: { api_key: "<${process.env.ULTRACASH_API_KEY.length} chars>", filial: ${credentialValue.filial} }`);
  console.log(`   plaintext: ${plaintext.length} chars → ${encrypted.length} bytes encrypted`);
  process.exit(0);
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

let tenantId = process.env.HL_TENANT_ID;
let tenantName = 'HL Importados';

if (!tenantId) {
  const { data: tenant, error } = await sb
    .from('zenya_tenants')
    .select('id, name')
    .eq('chatwoot_account_id', process.env.HL_CHATWOOT_ACCOUNT_ID)
    .single();
  if (error || !tenant) {
    console.error(`❌ Tenant com chatwoot_account_id=${process.env.HL_CHATWOOT_ACCOUNT_ID} não encontrado.`);
    console.error(`   Rode seed-hl-tenant.mjs antes deste script.`);
    if (error) console.error(`   (${error.message})`);
    process.exit(1);
  }
  tenantId = tenant.id;
  tenantName = tenant.name;
}

console.log(`✓ Tenant: ${tenantName} (${tenantId})`);

const encryptedHex = `\\x${encrypted.toString('hex')}`;

const { error } = await sb.from('zenya_tenant_credentials').upsert(
  {
    tenant_id: tenantId,
    service: 'ultracash',
    credentials_encrypted: encryptedHex,
    updated_at: new Date().toISOString(),
  },
  { onConflict: 'tenant_id,service' },
);

if (error) {
  console.error(`❌ Falha ao inserir credencial "ultracash": ${error.message}`);
  process.exit(1);
}

console.log(`✅ credencial "ultracash" upserted (${encrypted.length} bytes encrypted)`);
console.log('');
console.log('➡️  Próximo passo: configurar webhook do Chatwoot pra apontar ao core + pm2 reload zenya-webhook');
