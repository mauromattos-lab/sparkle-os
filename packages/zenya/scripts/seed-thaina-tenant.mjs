#!/usr/bin/env node
// Seed do tenant Thainá Micropigmentação — executar no onboarding.
//
// Pré-requisitos (env):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   THAINA_CHATWOOT_ACCOUNT_ID  — account_id na Chatwoot
//   THAINA_ADMIN_PHONES         — CSV, ex: "+5521992093061,+5521968855454"
//   THAINA_ADMIN_CONTACTS       — JSON, ex: '[{"phone":"+5521992093061","name":"Mauro"}]'
//
// Opcionais:
//   THAINA_ACTIVE_TOOLS         — CSV (default: "google_calendar")
//   THAINA_ALLOWED_PHONES       — CSV para modo teste (default: vazio = produção aberta)
//   THAINA_PROMPT_PATH          — override do path do prompt
//
// Uso:
//   cd packages/zenya && node scripts/seed-thaina-tenant.mjs --dry-run
//   cd packages/zenya && node scripts/seed-thaina-tenant.mjs

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  applyTenantSeed,
  isDryRun,
  loadPromptFromMarkdown,
  parseCsvEnv,
  parseJsonEnv,
} from './lib/seed-common.mjs';

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'THAINA_CHATWOOT_ACCOUNT_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = process.env.THAINA_PROMPT_PATH
  ? path.resolve(process.env.THAINA_PROMPT_PATH)
  : path.resolve(__dirname, '../../../docs/zenya/tenants/thaina-micropigmentacao/prompt.md');

let promptContent;
let promptMeta;
try {
  const loaded = await loadPromptFromMarkdown(PROMPT_PATH);
  promptContent = loaded.content;
  promptMeta = loaded.meta;
} catch (err) {
  console.error(`❌ Erro ao carregar prompt de ${PROMPT_PATH}:`, err.message);
  process.exit(1);
}

let adminContacts;
try {
  adminContacts = parseJsonEnv(process.env.THAINA_ADMIN_CONTACTS, { name: 'THAINA_ADMIN_CONTACTS' });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const row = {
  name: 'Thainá Micropigmentação',
  system_prompt: promptContent,
  active_tools: parseCsvEnv(process.env.THAINA_ACTIVE_TOOLS ?? 'google_calendar'),
  chatwoot_account_id: process.env.THAINA_CHATWOOT_ACCOUNT_ID,
  allowed_phones: parseCsvEnv(process.env.THAINA_ALLOWED_PHONES),
  admin_phones: parseCsvEnv(process.env.THAINA_ADMIN_PHONES),
  admin_contacts: adminContacts,
  audio_format: 'ogg_opus',
};

const dryRun = isDryRun();
const sb = dryRun
  ? null
  : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

try {
  const result = await applyTenantSeed({ supabase: sb, row, dryRun });

  if (result.dryRun) {
    console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
    process.exit(0);
  }

  console.log('✅ Tenant Thainá Micropigmentação criado/atualizado');
  console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
  console.log(`   md5: ${result.hash}`);
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');
  console.log(`➡️  Próximos passos:`);
  console.log(`    1. Configurar inbox Z-API na conta Chatwoot (account_id=${row.chatwoot_account_id})`);
  console.log(`    2. Parear Z-API com o WhatsApp +55 21 96885-5454 (QR code via celular da Thainá)`);
  console.log(`    3. Rodar seed-thaina-credentials.mjs para Google Calendar + Z-API`);
  console.log(`    4. pm2 reload zenya-webhook`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
