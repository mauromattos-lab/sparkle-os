#!/usr/bin/env node
// Seed das credenciais do tenant PLAKA em zenya_tenant_credentials.
//
// Complementa `seed-plaka-tenant.mjs`: o tenant em si já existe em
// `zenya_tenants` (row canônica via ADR-001); aqui inserimos as credenciais
// encriptadas (AES-256-GCM) que os adapters leem via getCredentialJson().
//
// Serviços seedados:
//   - nuvemshop  → { access_token, user_id } — consumido por integrations/nuvemshop.ts
//   - sheets_kb  → { spreadsheet_id, range, service_account } — consumido por worker/kb-sync.ts
//   - zapi       → { instanceId, token, clientToken, labels } — OPCIONAL, só roda se
//                  PLAKA_ZAPI_INSTANCE_ID estiver definido (pode ser adiado até o chip Salvy chegar)
//
// Env vars (.env ou ambiente):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY       — admin client
//   ZENYA_MASTER_KEY                          — 64 hex chars (32 bytes) — mesma chave usada pelo core
//   PLAKA_CHATWOOT_ACCOUNT_ID                 — pra localizar o tenant_id (UUID) via lookup
//
//   NUVEMSHOP_ACCESS_TOKEN, NUVEMSHOP_USER_ID  — credenciais Nuvemshop/Tiendanube
//                                                (USER_ID do seed é o store_id da loja — nome histórico
//                                                 do parâmetro n8n; o adapter grava como `store_id`)
//   NUVEMSHOP_USER_AGENT                       — header obrigatório do gateway Nuvemshop,
//                                                default: "SparkleOS Zenya (mauro@sparkleai.tech)"
//
//   PLAKA_KB_SPREADSHEET_ID                    — ID da planilha "Roberta_Plaka_BaseConhecimento"
//   PLAKA_KB_RANGES                            — múltiplos ranges A1 separados por `;` (preferido pra KB multi-aba)
//                                                Ex: "'Aba 1'!B4:C;'Aba 2'!B4:C;'Aba 3'!B4:C"
//                                                Se definido, tem precedência sobre PLAKA_KB_RANGE.
//   PLAKA_KB_RANGE                             — range único no formato A1 (ex: "Base!A:B"). Usado só se
//                                                PLAKA_KB_RANGES não estiver definido. Default: "Base!A:B"
//   PLAKA_SHEETS_SA_PATH  *ou*  PLAKA_SHEETS_SA_JSON
//                                              — caminho do JSON da SA ou conteúdo inline
//
//   [OPCIONAL] PLAKA_ZAPI_INSTANCE_ID, PLAKA_ZAPI_TOKEN, PLAKA_ZAPI_CLIENT_TOKEN,
//              PLAKA_ZAPI_LABEL_HUMANO
//
// Uso:
//   cd packages/zenya && node scripts/seed-plaka-credentials.mjs --dry-run
//   cd packages/zenya && node scripts/seed-plaka-credentials.mjs
//
// Idempotente: upsert por (tenant_id, service).

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createCipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'ZENYA_MASTER_KEY',
  'PLAKA_CHATWOOT_ACCOUNT_ID',
  'NUVEMSHOP_ACCESS_TOKEN',
  'NUVEMSHOP_USER_ID',
  'PLAKA_KB_SPREADSHEET_ID',
];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const DRY_RUN = process.argv.includes('--dry-run');

// AES-256-GCM encryption — mirrors packages/zenya/src/tenant/crypto.ts
// Wire format: IV (16 bytes) || authTag (16 bytes) || ciphertext
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

async function loadServiceAccount() {
  const filePath = process.env.PLAKA_SHEETS_SA_PATH;
  const inline = process.env.PLAKA_SHEETS_SA_JSON;

  if (filePath) {
    try {
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`Falha ao ler PLAKA_SHEETS_SA_PATH=${filePath}: ${err.message}`);
    }
  }

  if (inline) {
    try {
      return JSON.parse(inline);
    } catch (err) {
      throw new Error(`PLAKA_SHEETS_SA_JSON não é JSON válido: ${err.message}`);
    }
  }

  throw new Error(
    'Defina PLAKA_SHEETS_SA_PATH (caminho do arquivo JSON) OU PLAKA_SHEETS_SA_JSON (conteúdo inline)',
  );
}

let serviceAccount;
try {
  serviceAccount = await loadServiceAccount();
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

if (!serviceAccount.client_email || !serviceAccount.private_key) {
  console.error('❌ JSON da Service Account inválido: precisa de client_email e private_key');
  process.exit(1);
}

// Shape esperado pelo adapter nuvemshop.ts: { access_token, store_id, user_agent }.
// NUVEMSHOP_USER_ID é o nome histórico do parâmetro do n8n — corresponde ao store_id.
const nuvemshopCred = {
  access_token: process.env.NUVEMSHOP_ACCESS_TOKEN,
  store_id: process.env.NUVEMSHOP_USER_ID,
  user_agent:
    process.env.NUVEMSHOP_USER_AGENT ?? 'SparkleOS Zenya (mauro@sparkleai.tech)',
};

// Ranges: PLAKA_KB_RANGES (plural, CSV com `;`) tem precedência.
// Ex: "'Aba 1'!B4:C;'Aba 2'!B4:C"
const rawRanges = process.env.PLAKA_KB_RANGES;
const rangesArray = rawRanges
  ? rawRanges
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

const sheetsKbCred = {
  spreadsheet_id: process.env.PLAKA_KB_SPREADSHEET_ID,
  service_account: serviceAccount,
};
if (rangesArray && rangesArray.length > 0) {
  sheetsKbCred.ranges = rangesArray;
} else {
  sheetsKbCred.range = process.env.PLAKA_KB_RANGE ?? 'Base!A:B';
}

let zapiCred = null;
if (process.env.PLAKA_ZAPI_INSTANCE_ID) {
  zapiCred = {
    instanceId: process.env.PLAKA_ZAPI_INSTANCE_ID,
    token: process.env.PLAKA_ZAPI_TOKEN,
    clientToken: process.env.PLAKA_ZAPI_CLIENT_TOKEN,
    labels: process.env.PLAKA_ZAPI_LABEL_HUMANO
      ? { humano: process.env.PLAKA_ZAPI_LABEL_HUMANO }
      : {},
  };
}

const credentials = [
  { service: 'nuvemshop', value: JSON.stringify(nuvemshopCred) },
  { service: 'sheets_kb', value: JSON.stringify(sheetsKbCred) },
];
if (zapiCred) {
  credentials.push({ service: 'zapi', value: JSON.stringify(zapiCred) });
}

// ---------------------------------------------------------------------------
// Dry-run mode: não toca o banco, imprime o que faria.
// ---------------------------------------------------------------------------
if (DRY_RUN) {
  console.log('🧪 DRY RUN — nenhuma credencial será gravada');
  console.log(`   chatwoot_account_id: ${process.env.PLAKA_CHATWOOT_ACCOUNT_ID}`);
  console.log('   credenciais a encriptar e inserir:');
  for (const cred of credentials) {
    const encrypted = encryptCredential(cred.value, process.env.ZENYA_MASTER_KEY);
    console.log(
      `     - ${cred.service.padEnd(10)} (${cred.value.length} chars plaintext → ${encrypted.length} bytes encrypted)`,
    );
  }
  console.log('');
  console.log(`   service_account client_email: ${serviceAccount.client_email}`);
  if (sheetsKbCred.ranges) {
    console.log(`   sheets ranges (${sheetsKbCred.ranges.length}):`);
    for (const r of sheetsKbCred.ranges) console.log(`     - ${r}`);
  } else {
    console.log(`   sheets range: ${sheetsKbCred.range}`);
  }
  console.log(`   nuvemshop user_id: ${nuvemshopCred.user_id}`);
  console.log(`   zapi presente: ${zapiCred ? 'sim' : 'não (opcional, pule agora)'}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Real run.
// ---------------------------------------------------------------------------
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data: tenant, error: tenantErr } = await sb
  .from('zenya_tenants')
  .select('id, name')
  .eq('chatwoot_account_id', process.env.PLAKA_CHATWOOT_ACCOUNT_ID)
  .single();

if (tenantErr || !tenant) {
  console.error(
    `❌ Tenant com chatwoot_account_id=${process.env.PLAKA_CHATWOOT_ACCOUNT_ID} não encontrado.`,
  );
  console.error(`   Rode seed-plaka-tenant.mjs antes deste script.`);
  if (tenantErr) console.error(`   (${tenantErr.message})`);
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
console.log('🎉 Credenciais PLAKA seedadas com sucesso.');
console.log('');
console.log('➡️  Próximos passos:');
console.log('    1. Rodar kb-sync manual: npx tsx --eval "import(\'./src/worker/kb-sync.js\').then(m => m.runKbSyncOnce())"');
console.log('    2. Validar: SELECT COUNT(*) FROM zenya_tenant_kb_entries WHERE tenant_id=...');
console.log('    3. Quando chip Salvy chegar: rerun com PLAKA_ZAPI_* env vars populadas');
