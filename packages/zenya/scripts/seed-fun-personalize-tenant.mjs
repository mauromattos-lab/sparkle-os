#!/usr/bin/env node
// Atualiza o system_prompt do tenant Julia - Fun Personalize no banco a partir
// do `.md` canônico em `docs/zenya/tenants/fun-personalize/prompt.md`.
//
// O tenant já existe no banco desde o seed original. Este script é o ponto
// único de manutenção do prompt: edite o `.md`, commit, rode este script — os
// demais campos (admin_phones, admin_contacts, allowed_phones, active_tools)
// NUNCA são tocados.
//
// Pré-requisitos (env):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY (Supabase ativo — uqpwmygaktkgbknhmknx)
//
// Opcionais:
//   FUN_CHATWOOT_ACCOUNT_ID      — default "5"
//   FUN_PROMPT_PATH              — override do path do prompt
//
// Uso:
//   cd packages/zenya && node scripts/seed-fun-personalize-tenant.mjs --dry-run
//   cd packages/zenya && node scripts/seed-fun-personalize-tenant.mjs

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  isDryRun,
  loadPromptFromMarkdown,
  updateTenantPrompt,
} from './lib/seed-common.mjs';

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const CHATWOOT_ACCOUNT_ID = process.env.FUN_CHATWOOT_ACCOUNT_ID ?? '5';

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

const dryRun = isDryRun();
const sb = dryRun
  ? null
  : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

try {
  const result = await updateTenantPrompt({
    supabase: sb,
    matchBy: 'chatwoot_account_id',
    matchValue: CHATWOOT_ACCOUNT_ID,
    systemPrompt: promptContent,
    dryRun,
  });

  console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
  console.log(`   md5: ${result.hash}`);

  if (result.dryRun) {
    console.log('');
    console.log('🔐 Gate: o md5 acima TEM que bater com o md5 do banco antes de rodar sem --dry-run:');
    console.log(`   SELECT md5(system_prompt) FROM zenya_tenants WHERE chatwoot_account_id = '${CHATWOOT_ACCOUNT_ID}';`);
    console.log('   Expected (Julia - Fun Personalize): 9cc363564a9f128e79fd334045b5e595');
    process.exit(0);
  }

  console.log('');
  console.log('✅ Tenant Julia - Fun Personalize — system_prompt atualizado');
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');
  console.log('   Demais campos (admin_phones, admin_contacts, allowed_phones, active_tools) preservados.');
  console.log('   Cache de 5min expira automaticamente — próxima mensagem já pega o novo prompt.');
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
