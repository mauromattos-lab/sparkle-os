#!/usr/bin/env node
// Updates the Fun Personalize tenant system_prompt in zenya_tenants
// using the latest value from the seed.ts (compiled into dist/).
// Run from packages/zenya after `npm run build`.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { TENANTS } from '../dist/tenant/seed.js';

const FUN_TENANT_ID = 'a1980ce7-4174-4cd0-8fe1-b22795589614';

const funSeed = TENANTS.find(
  (t) => t.chatwoot_account_id === '1' && (t.name ?? '').toLowerCase().includes('fun personalize'),
);
if (!funSeed) {
  console.error('Fun Personalize seed not found in TENANTS');
  process.exit(1);
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data: current, error: fetchErr } = await sb
  .from('zenya_tenants')
  .select('name, system_prompt')
  .eq('id', FUN_TENANT_ID)
  .single();

if (fetchErr || !current) {
  console.error('Tenant not found:', fetchErr?.message);
  process.exit(1);
}

console.log(`Current prompt length: ${current.system_prompt.length}`);
console.log(`New prompt length:     ${funSeed.system_prompt.length}`);
console.log(`Diff in chars:         ${funSeed.system_prompt.length - current.system_prompt.length}`);

if (current.system_prompt === funSeed.system_prompt) {
  console.log('Prompts já são idênticos — nada a fazer.');
  process.exit(0);
}

const { error: updateErr } = await sb
  .from('zenya_tenants')
  .update({ system_prompt: funSeed.system_prompt })
  .eq('id', FUN_TENANT_ID);

if (updateErr) {
  console.error('Erro ao atualizar:', updateErr.message);
  process.exit(1);
}

console.log('✅ Prompt atualizado com sucesso.');
console.log('⚠️  Cache de tenant dura 5min — para pegar o prompt novo na hora, reinicie o zenya-webhook.');
