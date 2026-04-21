#!/usr/bin/env node
// Seed do tenant Fun Personalize (Julia) — HIGH RISK, primeiro cliente comercial.
//
// Este seed segue o padrão definido pelo ADR-001:
// system prompt vive em `docs/zenya/tenants/fun-personalize/prompt.md` com
// front-matter YAML, carregado em runtime via gray-matter. Sem hardcode.
//
// Pré-requisitos (env):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY (Supabase ativo — uqpwmygaktkgbknhmknx)
//   FUN_CHATWOOT_ACCOUNT_ID      — account_id na Chatwoot (atual: 5)
//   FUN_ADMIN_PHONES             — CSV, ex: "+5512981303249,+55..."
//   FUN_ADMIN_CONTACTS           — JSON, ex: '[{"phone":"+5512981303249","name":"Mauro"}]'
//   FUN_ACTIVE_TOOLS             — CSV (default: "loja_integrada")
//
// Opcionais:
//   FUN_ALLOWED_PHONES           — CSV para modo teste (default: vazio = produção aberta)
//   FUN_PROMPT_PATH              — override do path do prompt
//
// Uso:
//   cd packages/zenya && node scripts/seed-fun-personalize-tenant.mjs --dry-run   # SEMPRE rodar primeiro
//   cd packages/zenya && node scripts/seed-fun-personalize-tenant.mjs             # só dentro da janela combinada com Mauro
//
// ⚠️  GATE OBRIGATÓRIO: o md5 impresso no --dry-run TEM que bater com o md5 do banco
// ANTES de rodar sem --dry-run. Se não bater, NÃO prosseguir — investigar primeiro.
// Fun Personalize é produção comercial, primeiro cliente pagante. Regressão afeta receita.

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

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'FUN_CHATWOOT_ACCOUNT_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = process.env.FUN_PROMPT_PATH
  ? path.resolve(process.env.FUN_PROMPT_PATH)
  : path.resolve(__dirname, '../../../docs/zenya/tenants/fun-personalize/prompt.md');

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
  adminContacts = parseJsonEnv(process.env.FUN_ADMIN_CONTACTS, { name: 'FUN_ADMIN_CONTACTS' });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const row = {
  name: 'Julia - Fun Personalize',
  system_prompt: promptContent,
  active_tools: parseCsvEnv(process.env.FUN_ACTIVE_TOOLS, { fallback: 'loja_integrada' }),
  chatwoot_account_id: process.env.FUN_CHATWOOT_ACCOUNT_ID,
  allowed_phones: parseCsvEnv(process.env.FUN_ALLOWED_PHONES),
  admin_phones: parseCsvEnv(process.env.FUN_ADMIN_PHONES),
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
    console.log('');
    console.log('⚠️  Fun Personalize é produção comercial — só rode sem --dry-run na janela combinada,');
    console.log('   com backup em .ai/backups/ e rollback plan pronto.');
    process.exit(0);
  }

  console.log('✅ Tenant Julia - Fun Personalize atualizado');
  console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
  console.log(`   md5: ${result.hash}`);
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');
  console.log(`➡️  Smoke test imediato: mensagem admin → validar resposta dentro do padrão.`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
