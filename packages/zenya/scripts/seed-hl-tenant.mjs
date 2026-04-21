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
//   cd packages/zenya && node scripts/seed-hl-tenant.mjs
//
// Retorna o tenant_id (UUID) pra você colar no seed das credenciais.
// Idempotente: upsert por chatwoot_account_id.

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'HL_CHATWOOT_ACCOUNT_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROMPT_PATH = path.resolve(
  __dirname,
  '../../../docs/zenya/tenants/hl-importados/prompt.md',
);
const PROMPT_PATH = process.env.HL_PROMPT_PATH
  ? path.resolve(process.env.HL_PROMPT_PATH)
  : DEFAULT_PROMPT_PATH;

let SYSTEM_PROMPT;
let promptMeta;
try {
  const raw = await readFile(PROMPT_PATH, 'utf-8');
  const parsed = matter(raw);
  SYSTEM_PROMPT = parsed.content.trim();
  promptMeta = parsed.data;
  if (!SYSTEM_PROMPT) {
    throw new Error('Prompt vazio após extrair front-matter');
  }
} catch (err) {
  console.error(`❌ Erro ao carregar prompt de ${PROMPT_PATH}:`, err.message);
  process.exit(1);
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const ACTIVE_TOOLS = (process.env.HL_ACTIVE_TOOLS ?? 'ultracash,google_calendar')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_PHONES = (process.env.HL_ALLOWED_PHONES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ADMIN_PHONES = (process.env.HL_ADMIN_PHONES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let adminContacts = [];
if (process.env.HL_ADMIN_CONTACTS) {
  try {
    adminContacts = JSON.parse(process.env.HL_ADMIN_CONTACTS);
  } catch (err) {
    console.error('HL_ADMIN_CONTACTS deve ser JSON válido:', err.message);
    process.exit(1);
  }
}

const row = {
  name: 'HL Importados',
  system_prompt: SYSTEM_PROMPT,
  active_tools: ACTIVE_TOOLS,
  chatwoot_account_id: process.env.HL_CHATWOOT_ACCOUNT_ID,
  allowed_phones: ALLOWED_PHONES,
  admin_phones: ADMIN_PHONES,
  admin_contacts: adminContacts,
};

const { data, error } = await sb
  .from('zenya_tenants')
  .upsert(row, { onConflict: 'chatwoot_account_id' })
  .select('id, name, chatwoot_account_id, active_tools')
  .single();

if (error) {
  console.error('❌ Erro ao upsert do tenant HL:', error.message);
  process.exit(1);
}

console.log('✅ Tenant HL Importados criado/atualizado');
console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
console.log(JSON.stringify(data, null, 2));
console.log('');
console.log(`➡️  Próximo passo: exportar ULTRACASH_API_KEY e rodar seed-hl-ultracash.mjs`);
console.log(`    TENANT_ID=${data.id}`);
