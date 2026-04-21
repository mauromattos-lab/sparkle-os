#!/usr/bin/env node
// Chat REPL no terminal — conversa com o tenant PLAKA (Roberta) SEM passar
// por WhatsApp/Z-API. Útil pra validar prompt, KB e tools antes de conectar
// qualquer canal real.
//
// Arquitetura:
//   [terminal] → generateText(AI SDK) → Roberta prompt + tools → output no console
//   (pula Z-API, Chatwoot webhook, Whisper/ElevenLabs — só a lógica do agente)
//
// Pré-requisitos:
//   .env com SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY, ZENYA_MASTER_KEY
//   Tenant PLAKA já seedado (seed-plaka-tenant + seed-plaka-credentials)
//   `npm run build` rodado (usa dist/)
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/chat-plaka.mjs            # usa tel default (Mauro)
//   node --env-file=.env scripts/chat-plaka.mjs +5531XXXXXXXXX  # simula outro cliente
//
// Comandos no prompt:
//   /sair ou /exit      — encerra
//   /reset              — limpa histórico (nova conversa)
//   /info               — mostra tenant e tools ativas

import readline from 'node:readline';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { buildSystemPrompt } from '../dist/agent/prompt.js';
import { createTenantTools } from '../dist/tenant/tool-factory.js';

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY', 'ZENYA_MASTER_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const CHATWOOT_ACCOUNT_ID = process.env.PLAKA_CHATWOOT_ACCOUNT_ID ?? '2';
const phone = process.argv[2] ?? '+5512981303249';
const conversationId = `repl-${Date.now()}`;

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: tenant, error } = await sb
  .from('zenya_tenants')
  .select('*')
  .eq('chatwoot_account_id', CHATWOOT_ACCOUNT_ID)
  .single();

if (error || !tenant) {
  console.error(`❌ Tenant com chatwoot_account_id=${CHATWOOT_ACCOUNT_ID} não encontrado: ${error?.message}`);
  process.exit(1);
}

const config = {
  id: tenant.id,
  name: tenant.name,
  system_prompt: tenant.system_prompt,
  active_tools: tenant.active_tools ?? [],
  chatwoot_account_id: tenant.chatwoot_account_id,
  allowed_phones: tenant.allowed_phones ?? [],
  admin_phones: tenant.admin_phones ?? [],
  admin_contacts: tenant.admin_contacts ?? [],
};

const systemPrompt = buildSystemPrompt(config);
const tools = createTenantTools(tenant.id, config, {
  accountId: CHATWOOT_ACCOUNT_ID,
  conversationId,
  phone,
});

const isAdmin = config.admin_phones.includes(phone);
const isAllowed = config.allowed_phones.length === 0 || config.allowed_phones.includes(phone);

console.log('');
console.log(`🤖 Chat-REPL — ${config.name}`);
console.log(`   tenant_id:     ${tenant.id}`);
console.log(`   phone simulado: ${phone}`);
console.log(`   admin:          ${isAdmin ? 'sim' : 'não'}`);
console.log(`   allowed_phones: ${config.allowed_phones.length ? config.allowed_phones.join(', ') : '(aberto)'}`);
console.log(`   allowed agora:  ${isAllowed ? 'sim' : '⚠️  NÃO — seu tel simulado não está em allowed_phones, respostas podem ser bloqueadas pelo webhook em produção'}`);
console.log(`   active_tools:   ${config.active_tools.join(', ') || '(só tools base)'}`);
console.log(`   conversationId: ${conversationId} (fake, não existe no Chatwoot)`);
console.log('');
console.log('   Comandos: /sair, /reset, /info');
console.log('');

let history = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `\x1b[36mVocê (${phone}) > \x1b[0m`,
});

rl.prompt();

rl.on('line', async (line) => {
  const msg = line.trim();
  if (!msg) {
    rl.prompt();
    return;
  }

  if (msg === '/sair' || msg === '/exit') {
    rl.close();
    return;
  }

  if (msg === '/reset') {
    history = [];
    console.log('  🔄 histórico limpo.');
    rl.prompt();
    return;
  }

  if (msg === '/info') {
    console.log(`  tenant=${tenant.id} phone=${phone} admin=${isAdmin} msgs=${history.length}`);
    rl.prompt();
    return;
  }

  history.push({ role: 'user', content: msg });

  process.stdout.write('\x1b[90m  ⏳ pensando...\x1b[0m');
  const t0 = Date.now();

  try {
    const result = await generateText({
      model: openai('gpt-4.1'),
      maxSteps: 15,
      system: systemPrompt,
      messages: history,
      tools,
      onStepFinish: ({ toolCalls, toolResults }) => {
        const calls = toolCalls ?? [];
        const results = toolResults ?? [];
        for (const call of calls) {
          const argsStr = JSON.stringify(call.args ?? {});
          const r = results.find((x) => x.toolCallId === call.toolCallId);
          const rStr = r ? JSON.stringify(r.result).slice(0, 120) : '(sem resultado ainda)';
          process.stdout.write(`\r\x1b[2K`); // clear line
          console.log(`  \x1b[33m🔧 ${call.toolName}(${argsStr})\x1b[0m`);
          console.log(`     \x1b[2m→ ${rStr}${rStr.length === 120 ? '...' : ''}\x1b[0m`);
        }
      },
    });

    process.stdout.write(`\r\x1b[2K`); // clear "pensando..."

    history.push({ role: 'assistant', content: result.text });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n\x1b[35mRoberta > ${result.text}\x1b[0m`);
    console.log(`\x1b[2m(${elapsed}s, ${result.usage?.totalTokens ?? '?'} tokens, ${result.finishReason})\x1b[0m\n`);
  } catch (err) {
    process.stdout.write(`\r\x1b[2K`);
    console.error(`\x1b[31m❌ ${err.message}\x1b[0m`);
    if (err.cause) console.error(`   cause: ${err.cause.message ?? err.cause}`);
  }

  rl.prompt();
});

rl.on('close', () => {
  console.log(`\nEncerrado. ${history.length} mensagens na memória (descartadas — REPL não persiste histórico).`);
  process.exit(0);
});
