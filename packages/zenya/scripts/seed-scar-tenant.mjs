#!/usr/bin/env node
// Seed do tenant Scar AI (GuDesignerPro) — executar no onboarding.
//
// Este seed segue o padrão definido pelo ADR-001:
// system prompt vive em `docs/zenya/tenants/scar-ai/prompt.md` com
// front-matter YAML, carregado em runtime via gray-matter. Sem hardcode.
//
// Pré-requisitos (env):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY (Supabase ativo)
//   SCAR_CHATWOOT_ACCOUNT_ID     — account_id na Chatwoot
//   SCAR_ADMIN_PHONES            — CSV, ex: "+5512981303249,+557481446755"
//   SCAR_ADMIN_CONTACTS          — JSON, ex: '[{"phone":"+5512981303249","name":"Mauro"}]'
//
// Opcionais:
//   SCAR_ACTIVE_TOOLS            — CSV (default: vazio — Scar não usa integrações externas no v1)
//   SCAR_ALLOWED_PHONES          — CSV para modo teste (default: vazio = produção aberta)
//   SCAR_PROMPT_PATH             — override do path do prompt (default: docs/zenya/tenants/scar-ai/prompt.md)
//
// Uso:
//   cd packages/zenya && node scripts/seed-scar-tenant.mjs              # upsert real
//   cd packages/zenya && node scripts/seed-scar-tenant.mjs --dry-run    # valida sem escrever
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

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SCAR_CHATWOOT_ACCOUNT_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = process.env.SCAR_PROMPT_PATH
  ? path.resolve(process.env.SCAR_PROMPT_PATH)
  : path.resolve(__dirname, '../../../docs/zenya/tenants/scar-ai/prompt.md');

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
  adminContacts = parseJsonEnv(process.env.SCAR_ADMIN_CONTACTS, { name: 'SCAR_ADMIN_CONTACTS' });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const row = {
  name: 'Scar AI — GuDesignerPro',
  system_prompt: promptContent,
  active_tools: parseCsvEnv(process.env.SCAR_ACTIVE_TOOLS),
  chatwoot_account_id: process.env.SCAR_CHATWOOT_ACCOUNT_ID,
  allowed_phones: parseCsvEnv(process.env.SCAR_ALLOWED_PHONES),
  admin_phones: parseCsvEnv(process.env.SCAR_ADMIN_PHONES),
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

  console.log('✅ Tenant Scar AI (GuDesignerPro) criado/atualizado');
  console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
  console.log(`   md5: ${result.hash}`);
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');
  console.log(`➡️  Próximos passos:`);
  console.log(`    1. Configurar inbox Z-API na conta Chatwoot (account_id=${row.chatwoot_account_id})`);
  console.log(`    2. Parear Z-API com o WhatsApp +55 74 8144-6755 (QR code via celular do Gustavo)`);
  console.log(`    3. Adicionar credencial Z-API via seed-zapi-credentials.mjs (TENANT_ID=${result.data.id})`);
  console.log(`    4. pm2 reload zenya-webhook`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
