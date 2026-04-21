#!/usr/bin/env node
// Seed do tenant PLAKA Acessórios (Roberta) — SAC exclusivo.
//
// Segue o padrão ADR-001: prompt canônico em
// `docs/zenya/tenants/plaka/prompt.md` com front-matter YAML, carregado em
// runtime via gray-matter. Sem hardcode.
//
// Pré-requisitos (env):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY (Supabase ativo)
//   PLAKA_CHATWOOT_ACCOUNT_ID    — account_id na Chatwoot (reusa conta existente — AD-1)
//   PLAKA_ADMIN_PHONES           — CSV, ex: "+5521993458389"
//   PLAKA_ADMIN_CONTACTS         — JSON, ex: '[{"phone":"+5521993458389","name":"Admin PLAKA"}]'
//
// Opcionais:
//   PLAKA_ACTIVE_TOOLS           — CSV (default: "escalarHumano,enviarTextoSeparado,refletir,marcarFollowUp,alterarPreferenciaAudioTexto,nuvemshop,sheets_kb")
//                                  Nota: as tools base são automáticas; essa lista ativa as opcionais.
//                                  Valor default real do seed = ["nuvemshop","sheets_kb"] (apenas as opcionais).
//   PLAKA_ALLOWED_PHONES         — CSV para modo teste (default: vazio = produção aberta)
//   PLAKA_PROMPT_PATH            — override do path do prompt
//
// Uso:
//   cd packages/zenya && node scripts/seed-plaka-tenant.mjs --dry-run
//   cd packages/zenya && node scripts/seed-plaka-tenant.mjs
//
// Idempotente: upsert por chatwoot_account_id.
// Tenant novo (NÃO existe no banco) — usa applyTenantSeed (não updateTenantPrompt).

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

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'PLAKA_CHATWOOT_ACCOUNT_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = process.env.PLAKA_PROMPT_PATH
  ? path.resolve(process.env.PLAKA_PROMPT_PATH)
  : path.resolve(__dirname, '../../../docs/zenya/tenants/plaka/prompt.md');

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
  adminContacts = parseJsonEnv(process.env.PLAKA_ADMIN_CONTACTS, { name: 'PLAKA_ADMIN_CONTACTS' });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// PLAKA é SAC-only com 2 integrações: Nuvemshop + Sheets KB.
const DEFAULT_ACTIVE_TOOLS = 'nuvemshop,sheets_kb';

const row = {
  name: 'PLAKA Acessórios (Roberta)',
  system_prompt: promptContent,
  active_tools: parseCsvEnv(process.env.PLAKA_ACTIVE_TOOLS, { fallback: DEFAULT_ACTIVE_TOOLS }),
  chatwoot_account_id: process.env.PLAKA_CHATWOOT_ACCOUNT_ID,
  allowed_phones: parseCsvEnv(process.env.PLAKA_ALLOWED_PHONES),
  admin_phones: parseCsvEnv(process.env.PLAKA_ADMIN_PHONES),
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
    console.log('ℹ️  Tenant novo — primeiro seed insere no banco.');
    console.log('ℹ️  Ativa tools: nuvemshop, sheets_kb (opcionais — pressupõem credenciais já seedadas)');
    process.exit(0);
  }

  console.log('✅ Tenant PLAKA Acessórios criado/atualizado');
  console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
  console.log(`   md5 do prompt: ${result.hash}`);
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');
  console.log(`➡️  Próximos passos:`);
  console.log(`    1. Rodar seed-plaka-credentials.mjs com NUVEMSHOP_ACCESS_TOKEN + SHEETS_KB JSON + ZAPI vars`);
  console.log(`    2. Parear Z-API com o número novo (Salvy)`);
  console.log(`    3. pm2 reload zenya-webhook`);
  console.log(`    4. Smoke test (mensagem admin do Mauro)`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
