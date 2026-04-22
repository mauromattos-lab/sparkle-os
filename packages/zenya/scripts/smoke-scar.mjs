#!/usr/bin/env node
// Smoke test automatico Scar AI — roda cenarios D1-D7 da story
// scar-ai-onboarding-01 via AI SDK (pula Z-API/Chatwoot).
//
// Cenarios derivados do prompt + portfolios + regras criticas:
//   D1. PT detection — "Oi, tudo bem?"
//   D2. EN detection — "Hi there, are you open for new clients?"
//   D5. Objecao preco — "ta caro isso"
//   D6. Pedido desconto — "faz mais barato?"
//   D7. Fechamento (critico — deve escalar via tool, nao falar) — "Fechado, quero o Premium"
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/smoke-scar.mjs
//
// Output: JSON no stdout com resultado por cenario + sumario.

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { buildSystemPrompt } from '../dist/agent/prompt.js';
import { createTenantTools } from '../dist/tenant/tool-factory.js';

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY', 'ZENYA_MASTER_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} nao definida`);
    process.exit(1);
  }
}

const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID ?? '7';
const phone = '+5512999990001'; // simulado — cliente novo, nao admin

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: tenant, error } = await sb
  .from('zenya_tenants')
  .select('*')
  .eq('chatwoot_account_id', CHATWOOT_ACCOUNT_ID)
  .single();

if (error || !tenant) {
  console.error(`Tenant chatwoot_account_id=${CHATWOOT_ACCOUNT_ID} nao encontrado: ${error?.message}`);
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

const scenarios = [
  {
    id: 'D1_PT',
    input: 'Oi, tudo bem?',
    expect: {
      language: 'pt',
      // heuristica: resposta deve conter palavra em pt E NAO ter palavras tipicas de EN no inicio
      pass_if: (text) => /\b(olá|oi|tudo|bem|como|ajudar|posso|gustavo|live|streamer|stream|design)\b/i.test(text)
                         && !/^(hi|hello|hey)\b/i.test(text.trim()),
    },
  },
  {
    id: 'D2_EN',
    input: 'Hi there, are you open for new clients?',
    expect: {
      language: 'en',
      pass_if: (text) => /\b(hi|hello|hey|yes|sure|open|client|design|stream|overlay)\b/i.test(text)
                         && !/^(olá|oi|tudo bem)\b/i.test(text.trim()),
    },
  },
  {
    id: 'D5_ObjecaoPreco',
    input: 'Nossa, tá caro isso. Não tem opção mais em conta?',
    expect: {
      language: 'pt',
      pass_if: (text) => /\b(avulsa|avulsas|individual|separad[ao]|unidade|por peça|apenas a|só a)\b/i.test(text)
                         || /R\$\s*\d/.test(text), // ou lista tabela de avulsas com preços
    },
  },
  {
    id: 'D6_PedidoDesconto',
    input: 'Dá pra fazer mais barato? Tô meio apertado esse mês',
    expect: {
      language: 'pt',
      pass_if: (text) => /5%/.test(text) || /cinco por cento/i.test(text),
    },
  },
  {
    id: 'D7_Fechamento_CRITICO',
    input: 'Fechado, quero o Premium. Como faço pra pagar?',
    expect: {
      language: 'pt',
      // CRITICO: deve INVOCAR tool de escalacao (nao apenas falar que vai)
      // E NAO deve vazar chave Pix / instrucoes de pagamento direto
      pass_if: (text, toolCalls) => {
        const escalated = toolCalls.some((c) =>
          /escalar|escala|handoff|humano/i.test(c.toolName)
        );
        const leakedPix = /\b(chave pix|minha pix|pix[:：]|pagar aqui|envia pra)/i.test(text);
        return { escalated, leakedPix, pass: escalated && !leakedPix };
      },
      critical: true,
    },
  },
];

console.log(`\n🤖 Smoke ${config.name} — ${scenarios.length} cenarios\n`);
console.log(`   tenant_id: ${tenant.id}`);
console.log(`   active_tools: ${config.active_tools.join(', ') || '(base)'}\n`);

const results = [];

for (const scenario of scenarios) {
  const conversationId = `smoke-${scenario.id}-${Date.now()}`;
  const tools = createTenantTools(tenant.id, config, {
    accountId: CHATWOOT_ACCOUNT_ID,
    conversationId,
    phone,
  });

  const capturedCalls = [];
  const t0 = Date.now();

  let responseText = '';
  let error = null;

  try {
    const result = await generateText({
      model: openai('gpt-4.1'),
      maxSteps: 8,
      system: systemPrompt,
      messages: [{ role: 'user', content: scenario.input }],
      tools,
      onStepFinish: ({ toolCalls }) => {
        for (const call of toolCalls ?? []) {
          capturedCalls.push({ name: call.toolName, args: call.args });
        }
      },
    });
    responseText = result.text;
  } catch (err) {
    error = err.message;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  let passResult;
  if (error) {
    passResult = { pass: false, reason: `error: ${error}` };
  } else if (typeof scenario.expect.pass_if === 'function') {
    const r = scenario.expect.pass_if(responseText, capturedCalls);
    passResult = typeof r === 'boolean' ? { pass: r } : r;
  } else {
    passResult = { pass: false, reason: 'no classifier' };
  }

  const record = {
    id: scenario.id,
    critical: !!scenario.critical,
    input: scenario.input,
    response: responseText,
    tool_calls: capturedCalls.map((c) => c.name),
    elapsed_s: Number(elapsed),
    result: passResult,
  };

  results.push(record);

  const icon = passResult.pass ? '✅' : (scenario.critical ? '🔴' : '⚠️');
  console.log(`${icon} ${scenario.id} (${elapsed}s)`);
  console.log(`   IN:  ${scenario.input}`);
  console.log(`   OUT: ${responseText.slice(0, 200)}${responseText.length > 200 ? '...' : ''}`);
  if (capturedCalls.length) {
    console.log(`   TOOLS: ${capturedCalls.map((c) => c.name).join(', ')}`);
  }
  if (!passResult.pass) {
    console.log(`   FAIL: ${JSON.stringify(passResult)}`);
  }
  console.log('');
}

const summary = {
  total: results.length,
  passed: results.filter((r) => r.result.pass).length,
  failed: results.filter((r) => !r.result.pass).length,
  critical_failed: results.filter((r) => r.critical && !r.result.pass).length,
};

console.log('───────────────────────────────────────');
console.log(`RESUMO: ${summary.passed}/${summary.total} passaram`);
if (summary.critical_failed > 0) {
  console.log(`🔴 ${summary.critical_failed} FALHA(S) CRITICA(S) — revisar prompt antes de go-live`);
}

// JSON final pra rastreabilidade
const outputPath = `/tmp/smoke-scar-${Date.now()}.json`;
try {
  const fs = await import('node:fs/promises');
  await fs.writeFile(outputPath, JSON.stringify({ summary, results }, null, 2));
  console.log(`\nJSON salvo: ${outputPath}`);
} catch (err) {
  console.log(`\n(nao foi possivel salvar JSON: ${err.message})`);
}

process.exit(summary.critical_failed > 0 ? 2 : summary.failed > 0 ? 1 : 0);
