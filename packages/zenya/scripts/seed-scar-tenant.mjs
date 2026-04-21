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
//   cd packages/zenya && node scripts/seed-scar-tenant.mjs
//
// Idempotente: upsert por chatwoot_account_id. Reexecutar atualiza o
// system_prompt e os metadados sem duplicar o tenant.

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SCAR_CHATWOOT_ACCOUNT_ID'];
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
  '../../../docs/zenya/tenants/scar-ai/prompt.md',
);
const PROMPT_PATH = process.env.SCAR_PROMPT_PATH
  ? path.resolve(process.env.SCAR_PROMPT_PATH)
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

const ACTIVE_TOOLS = (process.env.SCAR_ACTIVE_TOOLS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_PHONES = (process.env.SCAR_ALLOWED_PHONES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ADMIN_PHONES = (process.env.SCAR_ADMIN_PHONES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let adminContacts = [];
if (process.env.SCAR_ADMIN_CONTACTS) {
  try {
    adminContacts = JSON.parse(process.env.SCAR_ADMIN_CONTACTS);
  } catch (err) {
    console.error('SCAR_ADMIN_CONTACTS deve ser JSON válido:', err.message);
    process.exit(1);
  }
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const row = {
  name: 'Scar AI — GuDesignerPro',
  system_prompt: SYSTEM_PROMPT,
  active_tools: ACTIVE_TOOLS,
  chatwoot_account_id: process.env.SCAR_CHATWOOT_ACCOUNT_ID,
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
  console.error('❌ Erro ao upsert do tenant Scar AI:', error.message);
  process.exit(1);
}

console.log('✅ Tenant Scar AI (GuDesignerPro) criado/atualizado');
console.log(`   Prompt version: ${promptMeta.version ?? 'n/a'} (source: ${PROMPT_PATH})`);
console.log(JSON.stringify(data, null, 2));
console.log('');
console.log(`➡️  Próximos passos:`);
console.log(`    1. Configurar inbox Z-API na conta Chatwoot (account_id=${row.chatwoot_account_id})`);
console.log(`    2. Parear Z-API com o WhatsApp +55 74 8144-6755 (QR code via celular do Gustavo)`);
console.log(`    3. Adicionar credencial Z-API via seed-zapi-credentials.mjs (TENANT_ID=${data.id})`);
console.log(`    4. pm2 reload zenya-webhook`);
