#!/usr/bin/env node
// Smoke test da KB da Roberta (PLAKA) — roda perguntas sintéticas cobrindo
// as 6 categorias da planilha, captura tool calls + resposta, classifica em
// ok / warn / gap pra identificar onde a KB ainda não cobre.
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/kb-smoke-plaka.mjs
//
// Roda em ~2-3min (29 perguntas, ~4s cada).

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

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: tenant, error } = await sb
  .from('zenya_tenants')
  .select('*')
  .eq('chatwoot_account_id', CHATWOOT_ACCOUNT_ID)
  .single();
if (error || !tenant) {
  console.error('Tenant PLAKA não encontrado:', error?.message);
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

const questions = [
  // Produto & Qualidade
  { cat: 'P&Q', q: 'minha peça oxidou, o que fazer?' },
  { cat: 'P&Q', q: 'a peça tá escurecendo, é normal?' },
  { cat: 'P&Q', q: 'posso dormir com o colar?' },
  { cat: 'P&Q', q: 'posso tomar banho de piscina com a peça?' },
  { cat: 'P&Q', q: 'tenho alergia a níquel, essas peças são hipoalergênicas?' },
  { cat: 'P&Q', q: 'como limpo minha pulseira?' },
  { cat: 'P&Q', q: 'quanto tempo dura essa semijoia?' },
  { cat: 'P&Q', q: 'a cor do meu colar está diferente da foto' },
  // Pedidos & Logística
  { cat: 'Ped', q: 'quanto tempo demora pra chegar?' },
  { cat: 'Ped', q: 'meu pedido ainda não chegou, o que faço?' },
  { cat: 'Ped', q: 'vocês entregam em Salvador?' },
  { cat: 'Ped', q: 'como acompanho o rastreamento?' },
  // Garantia & Trocas
  { cat: 'G&T', q: 'quero trocar meu colar, o fecho quebrou' },
  { cat: 'G&T', q: 'posso devolver se não gostar?' },
  { cat: 'G&T', q: 'qual a garantia das peças?' },
  { cat: 'G&T', q: 'chegou uma peça diferente da que pedi' },
  // Compras & Pagamento
  { cat: 'C&P', q: 'quais formas de pagamento vocês aceitam?' },
  { cat: 'C&P', q: 'tem desconto no pix?' },
  { cat: 'C&P', q: 'posso parcelar em quantas vezes?' },
  { cat: 'C&P', q: 'tem cupom de primeiro pedido?' },
  // Sobre a Plaka
  { cat: 'Sob', q: 'onde fica a loja física?' },
  { cat: 'Sob', q: 'qual o horário de atendimento?' },
  { cat: 'Sob', q: 'vocês têm Instagram?' },
  { cat: 'Sob', q: 'qual é o site de vocês?' },
  // Escalamento
  { cat: 'Esc', q: 'quero falar com um atendente' },
  { cat: 'Esc', q: 'preciso falar com o gerente urgente' },
  // Fora do escopo
  { cat: 'FoE', q: 'qual o preço do bitcoin hoje?' },
  { cat: 'FoE', q: 'vocês vendem iphone?' },
  // Caso misto
  { cat: 'Mix', q: 'meu pedido é 58177 e a peça oxidou, o que fazer?' },
];

console.log(`\nKB Smoke Test — ${config.name}`);
console.log(`tenant_id: ${tenant.id}`);
console.log(`total perguntas: ${questions.length}`);
console.log('─'.repeat(70));

const results = [];
for (const [i, q] of questions.entries()) {
  process.stdout.write(`[${i + 1}/${questions.length}] ${q.cat} · ${q.q.slice(0, 40)}... `);
  const phone = '+5512981303249';
  const conversationId = `smoke-${Date.now()}-${i}`;
  const tools = createTenantTools(tenant.id, config, {
    accountId: CHATWOOT_ACCOUNT_ID,
    conversationId,
    phone,
  });

  const toolCalls = [];
  const t0 = Date.now();
  try {
    const r = await generateText({
      model: openai('gpt-4.1'),
      maxSteps: 15,
      system: systemPrompt,
      messages: [{ role: 'user', content: q.q }],
      tools,
      onStepFinish: ({ toolCalls: tc, toolResults: tr }) => {
        for (const call of tc ?? []) {
          const rr = (tr ?? []).find((x) => x.toolCallId === call.toolCallId);
          toolCalls.push({
            name: call.toolName,
            args: call.args,
            result: rr?.result,
          });
        }
      },
    });

    const elapsed = Date.now() - t0;
    results.push({
      ...q,
      resposta: r.text,
      toolCalls,
      tokens: r.usage?.totalTokens ?? 0,
      elapsedMs: elapsed,
      finishReason: r.finishReason,
    });
    console.log(`✓ ${(elapsed / 1000).toFixed(1)}s`);
  } catch (err) {
    results.push({
      ...q,
      error: err.message,
      toolCalls,
      elapsedMs: Date.now() - t0,
    });
    console.log(`✗ ${err.message}`);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Relatório
// ────────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(70));
console.log('RELATÓRIO');
console.log('═'.repeat(70) + '\n');

function classify(r) {
  if (r.error) return { tag: '❌', reason: `ERRO: ${r.error}` };

  const kbCall = r.toolCalls.find((t) => t.name === 'consultarKBSheets');
  const escalar = r.toolCalls.find((t) => t.name === 'escalarHumano');
  const nuvemshop = r.toolCalls.find((t) => t.name === 'buscarPedidoNuvemshop');

  // Escalamento solicitado explicitamente
  if (r.cat === 'Esc') {
    if (escalar) return { tag: '✅', reason: 'escalou conforme pedido' };
    return { tag: '⚠️', reason: 'não escalou mas deveria' };
  }

  // Fora de escopo
  if (r.cat === 'FoE') {
    if (escalar || r.resposta.match(/não.*atend|fora.*escop|não.*trabalh|não.*vende/i)) {
      return { tag: '✅', reason: 'recusou apropriadamente' };
    }
    return { tag: '⚠️', reason: 'respondeu algo fora de escopo' };
  }

  // Todo resto deveria usar KB
  if (!kbCall) {
    return { tag: '❌', reason: 'NÃO consultou KB (violação da regra do prompt)' };
  }

  const kbResult = kbCall.result ?? {};
  if (kbResult.sem_match) {
    return {
      tag: '⚠️',
      reason: `KB sem_match (${kbResult.match_type ? 'fuzzy falhou' : 'exato+fuzzy falharam'}) — ${escalar ? 'escalou' : 'respondeu sem KB'}`,
    };
  }
  const matchType = kbResult.match_type === 'fuzzy' ? `fuzzy:${kbResult.matched_keyword}` : 'exato';
  return { tag: '✅', reason: `KB hit (${matchType})` };
}

for (const r of results) {
  const { tag, reason } = classify(r);
  console.log(`${tag} [${r.cat}] ${r.q}`);
  console.log(`   ${reason}`);
  const tools = r.toolCalls.map((t) => {
    const res = typeof t.result === 'object' ? JSON.stringify(t.result).slice(0, 60) : String(t.result).slice(0, 60);
    return `${t.name}→${res}`;
  }).join(' | ');
  if (tools) console.log(`   tools: ${tools}`);
  const respPreview = (r.resposta ?? '').slice(0, 120).replace(/\n/g, ' ');
  if (respPreview) console.log(`   resp:  ${respPreview}${r.resposta?.length > 120 ? '...' : ''}`);
  if (r.tokens) console.log(`   ${r.tokens} tokens · ${(r.elapsedMs / 1000).toFixed(1)}s`);
  console.log('');
}

// Summary
const counts = { '✅': 0, '⚠️': 0, '❌': 0 };
for (const r of results) {
  const { tag } = classify(r);
  counts[tag] = (counts[tag] ?? 0) + 1;
}
console.log('─'.repeat(70));
console.log(`TOTAL: ${results.length} | ✅ ${counts['✅']} ok | ⚠️ ${counts['⚠️']} gaps | ❌ ${counts['❌']} erros`);
const totalTokens = results.reduce((a, r) => a + (r.tokens ?? 0), 0);
const totalMs = results.reduce((a, r) => a + (r.elapsedMs ?? 0), 0);
console.log(`tokens totais: ${totalTokens} · tempo total: ${(totalMs / 1000).toFixed(1)}s`);

process.exit(0);
