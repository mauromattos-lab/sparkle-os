#!/usr/bin/env node
// Smoke test automatico Scar AI — roda cenarios D1-D9 da story
// scar-ai-onboarding-01 + 17.2 (refino prompt v3) via AI SDK (pula Z-API/Chatwoot).
//
// Cenarios derivados do prompt + portfolios + regras criticas + feedback Gustavo:
//   D1.  PT detection — "Oi, tudo bem?"
//   D2.  EN detection — "Hi there, are you open for new clients?"
//   D5.  Objecao preco — "ta caro isso"
//   D5b. Cliente agrega 3 infos num turno — Scar NAO repete pergunta (Issue #2 v3)
//   D6.  Pedido desconto — "faz mais barato?"
//   D7.  Fechamento (critico — deve escalar via tool, nao falar) — "Fechado, quero o Premium"
//   D9.  Densidade <=3 mensagens por turno (Issue #1 v3)
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
    // D5b — feedback Gustavo Issue #2 (v3 2026-04-25)
    // Cliente agrega 3 infos num único turno (plataforma + nicho + intenção).
    // Scar NÃO deve repetir pergunta sobre informações já dadas no histórico.
    // Esperado: agregar as infos como gancho e avançar pra Camada 1 (dor) ou Camada 4 (oferta ancorada).
    id: 'D5b_AgregaInfos',
    input: 'Oi, tô começando agora na twitch, faço gta rp e quero um pacote completo',
    expect: {
      language: 'pt',
      pass_if: (text) => {
        const lower = text.toLowerCase();
        // Scar NAO pode repetir essas perguntas — info ja esta no input
        const repeatedPlatform = /qual plataforma|você usa twitch|usa twitch.+youtube|twitch.+kick|youtube.+kick/i.test(text);
        const repeatedLiveStatus = /já faz live|começando agora ou já|tá começando|começou agora\?/i.test(text);
        // Sinal positivo opcional: engaja com nicho GTA RP (hook por nicho — regra v3 §8)
        const engagedWithNiche = /gta rp|gta-rp|gtarp|cyberpunk|futurista|neon|fivem/i.test(lower);
        return {
          pass: !repeatedPlatform && !repeatedLiveStatus,
          repeatedPlatform,
          repeatedLiveStatus,
          engagedWithNiche, // diagnostic only
        };
      },
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
          /escalar|escala|handoff|humano/i.test(c.name ?? c.toolName ?? '')
        );
        const leakedPix = /\b(chave pix|minha pix|pix[:：]|pagar aqui|envia pra)/i.test(text);
        return { escalated, leakedPix, pass: escalated && !leakedPix };
      },
      critical: true,
    },
  },
  {
    // D9 — feedback Gustavo Issue #1 (v3 2026-04-25)
    // Densidade de mensagens por turno NAO pode passar de 3.
    // No teste real, Scar mandou 5 mensagens em 60s no 1o turno (parede de texto).
    // Conta: enviarTextoSeparado tool calls + 1 (mensagem final do result.text).
    id: 'D9_Densidade',
    input: 'Oi, tudo bem?',
    expect: {
      language: 'pt',
      pass_if: (text, toolCalls) => {
        const sendCount = toolCalls.filter((c) => {
          const n = c.name ?? c.toolName ?? '';
          return /enviarTextoSeparado|enviar.*texto|enviar.*separad/i.test(n);
        }).length;
        const finalMessage = text.trim() ? 1 : 0;
        const totalMessages = sendCount + finalMessage;
        return {
          pass: totalMessages <= 3,
          totalMessages,
          sendToolCalls: sendCount,
          hasFinalMessage: finalMessage === 1,
        };
      },
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
