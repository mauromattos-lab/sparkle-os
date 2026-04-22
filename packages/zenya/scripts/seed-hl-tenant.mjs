#!/usr/bin/env node
// Seed do tenant HL Importados — executar UMA VEZ, no momento do cutover.
//
// Este seed segue o padrão definido pelo ADR-001:
// system prompt vive em `docs/zenya/tenants/hl-importados/prompt.md` com
// front-matter YAML, carregado em runtime via gray-matter. Sem hardcode.
//
// Pré-requisitos (env):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY (Supabase ativo — uqpwmygaktkgbknhmknx)
//   HL_CHATWOOT_ACCOUNT_ID       — account_id na Chatwoot
//   HL_ADMIN_PHONES              — CSV, ex: "+5512981303249,+5575998244346"
//   HL_ADMIN_CONTACTS            — JSON, ex: '[{"phone":"+5512981303249","name":"Mauro"}]'
//
// Opcionais:
//   HL_ACTIVE_TOOLS              — CSV (default: "ultracash,google_calendar")
//   HL_ALLOWED_PHONES            — CSV para modo teste (default: vazio = produção aberta)
//   HL_PROMPT_PATH               — override do path do prompt (default: docs/zenya/tenants/hl-importados/prompt.md)
//
// Uso:
//   cd packages/zenya && node scripts/seed-hl-tenant.mjs              # upsert real
//   cd packages/zenya && node scripts/seed-hl-tenant.mjs --dry-run    # valida sem escrever
//
// Retorna o tenant_id (UUID) pra você colar no seed das credenciais.
// Idempotente: upsert por chatwoot_account_id.

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

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'HL_CHATWOOT_ACCOUNT_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = process.env.HL_PROMPT_PATH
  ? path.resolve(process.env.HL_PROMPT_PATH)
  : path.resolve(__dirname, '../../../docs/zenya/tenants/hl-importados/prompt.md');

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
  adminContacts = parseJsonEnv(process.env.HL_ADMIN_CONTACTS, { name: 'HL_ADMIN_CONTACTS' });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const row = {
  name: 'HL Importados',
  system_prompt: promptContent,
  active_tools: parseCsvEnv(process.env.HL_ACTIVE_TOOLS, { fallback: 'ultracash,google_calendar' }),
  chatwoot_account_id: process.env.HL_CHATWOOT_ACCOUNT_ID,
  allowed_phones: parseCsvEnv(process.env.HL_ALLOWED_PHONES),
  admin_phones: parseCsvEnv(process.env.HL_ADMIN_PHONES),
  admin_contacts: adminContacts,
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

  console.log('✅ Tenant HL Importados criado/atualizado');
  console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
  console.log(`   md5: ${result.hash}`);
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');
  console.log(`➡️  Próximo passo: exportar ULTRACASH_API_KEY e rodar seed-hl-ultracash.mjs`);
  console.log(`    TENANT_ID=${result.data.id}`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
