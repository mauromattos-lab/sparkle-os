#!/usr/bin/env node
// Seed do tenant Zenya Prime (SparkleOS) — a própria Zenya que vende a Zenya.
//
// Este seed segue o padrão definido pelo ADR-001:
// system prompt vive em `docs/zenya/tenants/zenya-prime/prompt.md` com
// front-matter YAML, carregado em runtime via gray-matter. Sem hardcode.
//
// Pré-requisitos (env):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY (Supabase ativo — uqpwmygaktkgbknhmknx)
//   PRIME_CHATWOOT_ACCOUNT_ID    — account_id na Chatwoot (atual: 1)
//   PRIME_ADMIN_PHONES           — CSV, ex: "+5512981303249"
//   PRIME_ADMIN_CONTACTS         — JSON, ex: '[{"phone":"+5512981303249","name":"Mauro"}]'
//
// Opcionais:
//   PRIME_ACTIVE_TOOLS           — CSV (default: vazio — Prime atual roda sem ferramentas externas)
//   PRIME_ALLOWED_PHONES         — CSV para modo teste (default: vazio = produção aberta)
//   PRIME_PROMPT_PATH            — override do path do prompt (default: docs/zenya/tenants/zenya-prime/prompt.md)
//
// Uso:
//   cd packages/zenya && node scripts/seed-prime-tenant.mjs              # upsert real
//   cd packages/zenya && node scripts/seed-prime-tenant.mjs --dry-run    # valida sem escrever
//
// Idempotente: upsert por chatwoot_account_id.
//
// Gate obrigatório antes do upsert real: o md5 impresso no --dry-run TEM
// que bater com `SELECT md5(system_prompt) FROM zenya_tenants WHERE name='Zenya Prime (SparkleOS)'`.
// Se não bater, NÃO prosseguir — investigar primeiro.

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

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'PRIME_CHATWOOT_ACCOUNT_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = process.env.PRIME_PROMPT_PATH
  ? path.resolve(process.env.PRIME_PROMPT_PATH)
  : path.resolve(__dirname, '../../../docs/zenya/tenants/zenya-prime/prompt.md');

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
  adminContacts = parseJsonEnv(process.env.PRIME_ADMIN_CONTACTS, { name: 'PRIME_ADMIN_CONTACTS' });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const row = {
  name: 'Zenya Prime (SparkleOS)',
  system_prompt: promptContent,
  active_tools: parseCsvEnv(process.env.PRIME_ACTIVE_TOOLS),
  chatwoot_account_id: process.env.PRIME_CHATWOOT_ACCOUNT_ID,
  allowed_phones: parseCsvEnv(process.env.PRIME_ALLOWED_PHONES),
  admin_phones: parseCsvEnv(process.env.PRIME_ADMIN_PHONES),
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
    console.log('');
    console.log('🔐 Gate: o md5 acima TEM que bater com o md5 do banco antes de rodar sem --dry-run:');
    console.log(`   SELECT md5(system_prompt) FROM zenya_tenants WHERE name = '${row.name}';`);
    process.exit(0);
  }

  console.log('✅ Tenant Zenya Prime (SparkleOS) atualizado');
  console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
  console.log(`   md5: ${result.hash}`);
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');
  console.log(`➡️  Smoke test: mande "oi" de um número admin pra validar resposta normal.`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
