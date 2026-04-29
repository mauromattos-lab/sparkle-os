#!/usr/bin/env node
// Seed das credenciais do tenant Thainá Micropigmentação.
//
// Serviços seedados:
//   - google_calendar → { service_account, calendar_id, duration_minutes }
//   - zapi            → { instanceId, token, clientToken } — opcional, aguarda setup Z-API
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   ZENYA_MASTER_KEY                        — 64 hex chars
//   THAINA_CHATWOOT_ACCOUNT_ID
//
//   THAINA_GCAL_CALENDAR_ID                 — ID do calendário Google Calendar
//   THAINA_GCAL_SA_PATH  *ou*  THAINA_GCAL_SA_JSON — service account JSON
//   THAINA_GCAL_DURATION_MINUTES            — duração padrão em minutos (default: 120)
//
//   [OPCIONAL] THAINA_ZAPI_INSTANCE_ID, THAINA_ZAPI_TOKEN, THAINA_ZAPI_CLIENT_TOKEN
//
// Uso:
//   cd packages/zenya && node scripts/seed-thaina-credentials.mjs --dry-run
//   cd packages/zenya && node scripts/seed-thaina-credentials.mjs

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createCipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'ZENYA_MASTER_KEY',
  'THAINA_CHATWOOT_ACCOUNT_ID',
  'THAINA_GCAL_CALENDAR_ID',
];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const DRY_RUN = process.argv.includes('--dry-run');

function encryptCredential(plaintext, masterKeyHex) {
  const keyBuf = Buffer.from(masterKeyHex, 'hex');
  if (keyBuf.length !== 32) throw new Error('ZENYA_MASTER_KEY deve ter 64 caracteres hex (32 bytes)');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

async function loadServiceAccount() {
  const filePath = process.env.THAINA_GCAL_SA_PATH;
  const inline = process.env.THAINA_GCAL_SA_JSON;
  if (filePath) {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  }
  if (inline) return JSON.parse(inline);
  throw new Error('Defina THAINA_GCAL_SA_PATH ou THAINA_GCAL_SA_JSON');
}

let serviceAccount;
try {
  serviceAccount = await loadServiceAccount();
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

const gcalCred = {
  service_account: serviceAccount,
  calendar_id: process.env.THAINA_GCAL_CALENDAR_ID,
  duration_minutes: parseInt(process.env.THAINA_GCAL_DURATION_MINUTES ?? '120', 10),
};

const credentials = [
  { service: 'google_calendar', value: JSON.stringify(gcalCred) },
];

if (process.env.THAINA_ZAPI_INSTANCE_ID) {
  credentials.push({
    service: 'zapi',
    value: JSON.stringify({
      instanceId: process.env.THAINA_ZAPI_INSTANCE_ID,
      token: process.env.THAINA_ZAPI_TOKEN,
      clientToken: process.env.THAINA_ZAPI_CLIENT_TOKEN,
      labels: {},
    }),
  });
}

if (DRY_RUN) {
  console.log('🧪 DRY RUN — nenhuma credencial será gravada');
  console.log(`   chatwoot_account_id: ${process.env.THAINA_CHATWOOT_ACCOUNT_ID}`);
  console.log(`   calendar_id: ${gcalCred.calendar_id}`);
  console.log(`   service_account: ${serviceAccount.client_email}`);
  console.log(`   duration_minutes: ${gcalCred.duration_minutes}`);
  console.log('   credenciais a encriptar:');
  for (const cred of credentials) {
    const enc = encryptCredential(cred.value, process.env.ZENYA_MASTER_KEY);
    console.log(`     - ${cred.service.padEnd(15)} (${enc.length} bytes encrypted)`);
  }
  process.exit(0);
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data: tenant, error: tenantErr } = await sb
  .from('zenya_tenants')
  .select('id, name')
  .eq('chatwoot_account_id', process.env.THAINA_CHATWOOT_ACCOUNT_ID)
  .single();

if (tenantErr || !tenant) {
  console.error(`❌ Tenant com chatwoot_account_id=${process.env.THAINA_CHATWOOT_ACCOUNT_ID} não encontrado.`);
  console.error(`   Rode seed-thaina-tenant.mjs antes deste script.`);
  process.exit(1);
}

console.log(`✓ Tenant localizado: ${tenant.name} (${tenant.id})`);

for (const cred of credentials) {
  const encrypted = encryptCredential(cred.value, process.env.ZENYA_MASTER_KEY);
  const encryptedHex = `\\x${encrypted.toString('hex')}`;

  const { error } = await sb.from('zenya_tenant_credentials').upsert(
    {
      tenant_id: tenant.id,
      service: cred.service,
      credentials_encrypted: encryptedHex,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,service' },
  );

  if (error) {
    console.error(`❌ Falha ao inserir credencial "${cred.service}": ${error.message}`);
    process.exit(1);
  }
  console.log(`✅ credencial "${cred.service}" upserted (${encrypted.length} bytes encrypted)`);
}

console.log('');
console.log('🎉 Credenciais Thainá seedadas com sucesso.');
console.log('');
console.log('➡️  Próximos passos:');
console.log('    1. Verificar acesso ao Calendar: node -e "..." (teste rápido)');
console.log('    2. Se Z-API não seedado ainda: rerun com THAINA_ZAPI_* populados');
console.log('    3. pm2 reload zenya-webhook');
