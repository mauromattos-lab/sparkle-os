#!/usr/bin/env node
// Seed do tenant Ensina Já Rede de Educação — executar UMA VEZ, no cutover.
//
// Padrão ADR-001: system prompt vive em
// `docs/zenya/tenants/ensinaja/prompt.md` com front-matter YAML,
// carregado em runtime via gray-matter. Sem hardcode.
//
// Diferença do HL: Ensinaja NÃO tem integração custom (zero ERP). Tools
// default são reuso direto do core (calendar/drive/elevenlabs). Asaas
// explicitamente fora do escopo por decisão 2026-04-23.
//
// Pré-requisitos (env):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY  (Supabase ativo)
//   ENSINAJA_CHATWOOT_ACCOUNT_ID         — account_id na Chatwoot (Ensinaja=4)
//   ENSINAJA_ADMIN_PHONES                — CSV, ex: "+5511999999999,+5511888888888"
//   ENSINAJA_ADMIN_CONTACTS              — JSON, ex: '[{"phone":"+55...","name":"Mauro"},{"phone":"+55...","name":"Douglas"}]'
//
// Opcionais:
//   ENSINAJA_ACTIVE_TOOLS                — CSV (default: "google_calendar,google_drive,eleven_labs")
//   ENSINAJA_ALLOWED_PHONES              — CSV p/ modo teste (default: vazio = produção aberta)
//   ENSINAJA_PROMPT_PATH                 — override do path do prompt
//
// Uso:
//   cd packages/zenya && node scripts/seed-ensinaja-tenant.mjs              # upsert real
//   cd packages/zenya && node scripts/seed-ensinaja-tenant.mjs --dry-run    # valida sem escrever
//
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

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ENSINAJA_CHATWOOT_ACCOUNT_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = process.env.ENSINAJA_PROMPT_PATH
  ? path.resolve(process.env.ENSINAJA_PROMPT_PATH)
  : path.resolve(__dirname, '../../../docs/zenya/tenants/ensinaja/prompt.md');

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
  adminContacts = parseJsonEnv(process.env.ENSINAJA_ADMIN_CONTACTS, { name: 'ENSINAJA_ADMIN_CONTACTS' });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const row = {
  name: 'Ensina Já Rede de Educação',
  system_prompt: promptContent,
  active_tools: parseCsvEnv(process.env.ENSINAJA_ACTIVE_TOOLS, {
    fallback: 'google_calendar,google_drive,eleven_labs',
  }),
  chatwoot_account_id: process.env.ENSINAJA_CHATWOOT_ACCOUNT_ID,
  allowed_phones: parseCsvEnv(process.env.ENSINAJA_ALLOWED_PHONES),
  admin_phones: parseCsvEnv(process.env.ENSINAJA_ADMIN_PHONES),
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

  console.log('✅ Tenant Ensina Já Rede de Educação criado/atualizado');
  console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
  console.log(`   md5: ${result.hash}`);
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');
  console.log(`➡️  Próximo passo: configurar webhook do Chatwoot (account_id=${process.env.ENSINAJA_CHATWOOT_ACCOUNT_ID})`);
  console.log(`    → ${process.env.ZENYA_WEBHOOK_URL || 'https://zenya.sparkleai.tech/webhook/chatwoot'}`);
  console.log(`    TENANT_ID=${result.data.id}`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
