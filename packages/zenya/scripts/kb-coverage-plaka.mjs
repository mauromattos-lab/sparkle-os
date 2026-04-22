#!/usr/bin/env node
// KB Coverage rigoroso — para cada entry real da planilha PLAKA (6 abas),
// gera 3 variações naturais da pergunta do cliente e mede se a Roberta
// casa com a entry esperada. Métrica real de cobertura.
//
// Fluxo:
//   1. Ler todas as rows de dados das 6 abas via Sheets API (A4:G)
//   2. Pra cada entry (ID+trigger+resposta), gerar 3 variações naturais
//      via gpt-4o-mini (~US$ 0.0005 cada)
//   3. Rodar cada variação contra a Roberta (gpt-4.1, prompt + tools reais)
//   4. Classificar: hit-esperado / hit-outra-entry / sem_match / escalou
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/kb-coverage-plaka.mjs [--entries=N] [--out=report.json]
//
// Custo estimado: ~US$ 2-3 (155 testes * gpt-4.1) + ~US$ 0.10 (variações mini).

import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'node:fs';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { buildSystemPrompt } from '../dist/agent/prompt.js';
import { createTenantTools } from '../dist/tenant/tool-factory.js';

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'OPENAI_API_KEY',
  'ZENYA_MASTER_KEY',
  'PLAKA_SHEETS_SA_PATH',
  'PLAKA_KB_SPREADSHEET_ID',
];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`ERRO: env var ${k} não definida`);
    process.exit(1);
  }
}

const ABAS = [
  '🔧 Produto & Qualidade',
  '📦 Pedidos & Logística',
  '🔄 Garantia & Trocas',
  '🛍️ Compras & Pagamento',
  '🏪 Sobre a Plaka',
  '⚡ Escalamento',
];
const VARIATIONS_PER_ENTRY = 3;
const CHATWOOT_ACCOUNT_ID = process.env.PLAKA_CHATWOOT_ACCOUNT_ID ?? '2';

const args = process.argv.slice(2);
const entriesLimit = Number((args.find((a) => a.startsWith('--entries=')) ?? '').split('=')[1]) || 0;
const outPath = (args.find((a) => a.startsWith('--out=')) ?? '').split('=')[1] || '/tmp/kb-coverage.json';

// ── 1. Tenant + prompt ───────────────────────────────────────────────
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: tenant, error: tErr } = await sb
  .from('zenya_tenants')
  .select('*')
  .eq('chatwoot_account_id', CHATWOOT_ACCOUNT_ID)
  .single();
if (tErr || !tenant) {
  console.error('Tenant PLAKA não encontrado');
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

// ── 2. Ler entries reais das 6 abas ──────────────────────────────────
const sa = JSON.parse(readFileSync(process.env.PLAKA_SHEETS_SA_PATH, 'utf-8'));
const auth = new google.auth.JWT({
  email: sa.client_email,
  key: sa.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

const entries = [];
for (const aba of ABAS) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.PLAKA_KB_SPREADSHEET_ID,
      range: `'${aba}'!A4:G`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    for (const row of res.data.values ?? []) {
      const [id, trigger, resposta, condicional, ressim, resnao, escalar] = row;
      if (!id || !trigger || !resposta) continue;
      entries.push({
        aba,
        id: id.trim(),
        trigger: trigger.trim(),
        resposta_principal: resposta.trim(),
        resposta_sample: resposta.trim().slice(0, 60).toLowerCase(),
        escalar_humano: (escalar || '').toString().trim().toUpperCase() === 'SIM',
        tem_condicional: (condicional || '').toString().trim().toUpperCase() === 'SIM',
      });
    }
  } catch (err) {
    console.warn(`[aba ${aba}] falhou: ${err.message}`);
  }
}
console.log(`${entries.length} entries lidas das ${ABAS.length} abas`);
if (entriesLimit > 0) {
  entries.splice(entriesLimit);
  console.log(`limitado a ${entries.length} entries (--entries=${entriesLimit})`);
}

// ── 3. Gerar variações (gpt-4o-mini) ─────────────────────────────────
console.log(`\ngerando ${VARIATIONS_PER_ENTRY} variações para cada entry...`);
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const promptVar = `Você é um cliente da PLAKA (loja de semijoias). A base interna tem uma resposta pronta para os seguintes gatilhos:
"${e.trigger}"

E a resposta cobre este assunto (primeiros caracteres, só pra contexto):
"${e.resposta_principal.slice(0, 250)}..."

Gere ${VARIATIONS_PER_ENTRY} maneiras NATURAIS e DIFERENTES de um cliente real fazer essa pergunta via WhatsApp. Use linguagem informal brasileira, varie comprimento e estilo. Pode ter typo ocasional se parecer autêntico. NÃO use aspas, numeração, ou formatações.

Retorne apenas as ${VARIATIONS_PER_ENTRY} perguntas, uma por linha.`;

  try {
    const r = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: promptVar,
      temperature: 0.8,
    });
    e.variacoes = r.text
      .split('\n')
      .map((s) => s.replace(/^[\-•\d.\)\s]+/, '').trim())
      .filter((s) => s.length > 5)
      .slice(0, VARIATIONS_PER_ENTRY);
  } catch (err) {
    console.warn(`[${e.id}] variações falharam: ${err.message}`);
    e.variacoes = [];
  }

  if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${entries.length}\r`);
}
console.log(`\n${entries.length} entries com variações geradas`);

// ── 4. Rodar cada variação contra a Roberta ──────────────────────────
console.log(`\nrodando ${entries.reduce((a, e) => a + e.variacoes.length, 0)} testes contra a Roberta...`);
const results = [];
let testIdx = 0;
const totalTests = entries.reduce((a, e) => a + e.variacoes.length, 0);

for (const e of entries) {
  for (const variacao of e.variacoes) {
    testIdx += 1;
    const phone = '+5512981303249';
    const tools = createTenantTools(tenant.id, config, {
      accountId: CHATWOOT_ACCOUNT_ID,
      conversationId: `cov-${Date.now()}-${testIdx}`,
      phone,
    });

    const toolCalls = [];
    const t0 = Date.now();
    try {
      const r = await generateText({
        model: openai('gpt-4.1'),
        maxSteps: 8,
        system: systemPrompt,
        messages: [{ role: 'user', content: variacao }],
        tools,
        onStepFinish: ({ toolCalls: tc, toolResults: tr }) => {
          for (const call of tc ?? []) {
            const rr = (tr ?? []).find((x) => x.toolCallId === call.toolCallId);
            toolCalls.push({ name: call.toolName, args: call.args, result: rr?.result });
          }
        },
      });

      // Classificação
      const kbCall = toolCalls.find((t) => t.name === 'consultarKBSheets');
      const kbResult = kbCall?.result;
      let status;
      let detalhe;
      const escalouTool = toolCalls.some((t) => t.name === 'escalarHumano');

      if (!kbCall) {
        status = 'no-kb-call';
        detalhe = 'não consultou KB';
      } else if (kbResult?.sem_match) {
        status = escalouTool ? 'sem-match-escalou' : 'sem-match-sem-escalar';
        detalhe = kbResult.motivo || '';
      } else if (kbResult?.resposta) {
        // Bateu a entry esperada?
        const respStart = kbResult.resposta.slice(0, 60).toLowerCase();
        if (respStart === e.resposta_sample) {
          status = 'hit-certo';
          detalhe = kbResult.match_type || 'exato';
        } else {
          status = 'hit-outra-entry';
          detalhe = `matched="${kbResult.matched_keyword || '?'}"`;
        }
      } else {
        status = 'unknown';
        detalhe = JSON.stringify(kbResult).slice(0, 80);
      }

      results.push({
        aba: e.aba,
        entry_id: e.id,
        trigger_original: e.trigger,
        variacao,
        status,
        detalhe,
        escalou: escalouTool,
        resposta_roberta: r.text.slice(0, 200),
        tokens: r.usage?.totalTokens ?? 0,
        elapsed_ms: Date.now() - t0,
      });
    } catch (err) {
      results.push({
        aba: e.aba,
        entry_id: e.id,
        variacao,
        status: 'error',
        detalhe: err.message.slice(0, 100),
        elapsed_ms: Date.now() - t0,
      });
    }

    if (testIdx % 5 === 0) {
      process.stdout.write(`  ${testIdx}/${totalTests} (${((testIdx / totalTests) * 100).toFixed(0)}%)\r`);
    }
  }
}

console.log(`\n${results.length} testes concluídos`);

// ── 5. Relatório ─────────────────────────────────────────────────────
const stats = {
  total: results.length,
  'hit-certo': 0,
  'hit-outra-entry': 0,
  'sem-match-escalou': 0,
  'sem-match-sem-escalar': 0,
  'no-kb-call': 0,
  'error': 0,
  'unknown': 0,
};
for (const r of results) stats[r.status] = (stats[r.status] ?? 0) + 1;

// Por entry: taxa de cobertura
const porEntry = new Map();
for (const r of results) {
  const key = `${r.aba}:${r.entry_id}`;
  if (!porEntry.has(key)) {
    porEntry.set(key, {
      aba: r.aba,
      id: r.entry_id,
      trigger: r.trigger_original,
      total: 0,
      hits: 0,
      falhas: [],
    });
  }
  const pe = porEntry.get(key);
  pe.total += 1;
  if (r.status === 'hit-certo') pe.hits += 1;
  else pe.falhas.push({ variacao: r.variacao, status: r.status, detalhe: r.detalhe });
}

const report = {
  generated_at: new Date().toISOString(),
  tenant_id: tenant.id,
  entries_total: entries.length,
  tests_total: results.length,
  stats,
  por_entry: [...porEntry.values()].sort((a, b) => a.hits / a.total - b.hits / b.total),
  raw_results: results,
};

writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nrelatório salvo em ${outPath}`);
console.log('\n══════════════════════════════════════════════════════════════════════');
console.log('RESUMO');
console.log('══════════════════════════════════════════════════════════════════════');
for (const [k, v] of Object.entries(stats)) {
  if (k === 'total') continue;
  const pct = ((v / stats.total) * 100).toFixed(1);
  console.log(`  ${k.padEnd(26)} ${String(v).padStart(4)} (${pct}%)`);
}
const cobertura = (((stats['hit-certo'] ?? 0) / stats.total) * 100).toFixed(1);
console.log(`\n  COBERTURA REAL: ${cobertura}% (variações casam com a entry correta)`);

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log('ENTRIES COM COBERTURA < 100% (triage ordenado por piores primeiro)');
console.log('══════════════════════════════════════════════════════════════════════');
for (const pe of report.por_entry) {
  if (pe.hits === pe.total) continue;
  console.log(`\n[${pe.id}] ${pe.aba}  — ${pe.hits}/${pe.total} hits`);
  console.log(`  trigger: ${pe.trigger.slice(0, 100)}${pe.trigger.length > 100 ? '...' : ''}`);
  for (const f of pe.falhas.slice(0, 3)) {
    console.log(`  ❌ "${f.variacao.slice(0, 70)}" → ${f.status} ${f.detalhe}`);
  }
}

process.exit(0);
