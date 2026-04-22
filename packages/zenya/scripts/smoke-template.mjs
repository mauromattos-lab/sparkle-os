#!/usr/bin/env node
// ============================================================================
// smoke-template.mjs — Template genérico de smoke test para tenants Zenya
// ============================================================================
//
// Propósito
// ---------
// Rodar bateria automática de cenários contra um tenant Zenya através do AI SDK,
// pulando toda a camada de transporte (Z-API, Chatwoot, Whisper/ElevenLabs).
// Cada cenário tem um classificador heurístico (pass_if) que diz se passou.
//
// Quando usar
// -----------
// - Depois de seed novo ou prompt ajustado, antes de conectar Z-API
// - Para validar regressão após mudança de prompt em tenant em produção
// - Como baseline antes de refino (brownfield): rodar com prompt atual,
//   depois com prompt proposto, comparar
//
// Referência do método: docs/zenya/TENANT-REFINEMENT-PLAYBOOK.md §2 passo 3
//
// Como adaptar para um tenant novo
// --------------------------------
// 1. Copiar este arquivo para smoke-<seutenant>.mjs
// 2. Escolher a VARIANTE abaixo conforme o tipo de tenant:
//    - VARIANTE A: tenant prompt-only (sem KB, sem integrações) — EXEMPLO: Scar AI
//    - VARIANTE B: tenant com KB ou integrações — EXEMPLO: PLAKA (Nuvemshop+sheets_kb)
// 3. Descomentar o bloco da variante escolhida
// 4. Ajustar os cenários para refletir o conteúdo REAL do seu tenant
//    (prompt, portfólios, KB entries, tabela de preços)
//    IMPORTANTE: derivar da fonte, não adivinhar — ver armadilha §5.4 do playbook
//
// Uso
// ---
//   cd packages/zenya
//   node --env-file=.env scripts/smoke-<seutenant>.mjs --tenant=<chatwoot_account_id>
//   # ou: CHATWOOT_ACCOUNT_ID=N node --env-file=.env scripts/smoke-<seutenant>.mjs
//
// Saída
// -----
// Relatório inline no stdout + JSON salvo em /tmp/smoke-<tenant>-<ts>.json.
// Exit code: 0 = tudo passou · 1 = falhas não-críticas · 2 = falha crítica
// ============================================================================

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { buildSystemPrompt } from '../dist/agent/prompt.js';
import { createTenantTools } from '../dist/tenant/tool-factory.js';

// ----------------------------------------------------------------------------
// Validação de ambiente
// ----------------------------------------------------------------------------
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY', 'ZENYA_MASTER_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// Parsing de argumentos — aceita --tenant=<id> ou env CHATWOOT_ACCOUNT_ID
// Sem default: se nenhum for informado, falha com mensagem clara
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
let tenantArg = null;
for (const arg of args) {
  if (arg.startsWith('--tenant=')) tenantArg = arg.slice('--tenant='.length);
}

const CHATWOOT_ACCOUNT_ID = tenantArg ?? process.env.CHATWOOT_ACCOUNT_ID;
if (!CHATWOOT_ACCOUNT_ID) {
  console.error('ERRO: informe o tenant via --tenant=<chatwoot_account_id> ou env CHATWOOT_ACCOUNT_ID');
  console.error('Uso: node scripts/smoke-<tenant>.mjs --tenant=7');
  process.exit(1);
}

// Telefone simulado — cliente fictício não-admin (teste sem whitelist admin)
const phone = '+5512999990001';

// ----------------------------------------------------------------------------
// Carrega tenant do banco
// ----------------------------------------------------------------------------
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: tenant, error } = await sb
  .from('zenya_tenants')
  .select('*')
  .eq('chatwoot_account_id', CHATWOOT_ACCOUNT_ID)
  .single();

if (error || !tenant) {
  console.error(`Tenant chatwoot_account_id=${CHATWOOT_ACCOUNT_ID} não encontrado: ${error?.message}`);
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

// ============================================================================
// CENÁRIOS — escolha UMA variante abaixo conforme o tipo do seu tenant
// ============================================================================
//
// Como escrever um bom pass_if (classificador heurístico):
//
//   ✅ BOM: heurística clara com alternativas + exclusões
//      pass_if: (text) => /\b(Pix|pix)\b/.test(text) && !/\b(boleto)\b/.test(text)
//
//   ❌ RUIM: substring match frágil (falha em variações)
//      pass_if: (text) => text.includes('pix')
//
// Para cenários CRÍTICOS (tool obrigatória a invocar), use critical: true e
// verifique toolCalls — ver armadilha §5.1 do playbook (LLM pode escrever
// "vou fazer" sem invocar a tool).
// ============================================================================

// ----------------------------------------------------------------------------
// === VARIANTE A: TENANT PROMPT-ONLY ===
// EXEMPLO: Scar AI — prompt puro, sem KB, sem tools externas.
// Cenários focam em: idioma, tom, objeções, escalação de tool crítica.
// Descomente este bloco se seu tenant tem active_tools=[] e prompt-driven.
// ----------------------------------------------------------------------------
/*
const scenarios = [
  {
    // Detecção de idioma na primeira mensagem
    id: 'A1_IdiomaPT',
    input: 'Oi, tudo bem?',
    expect: {
      // Resposta deve ter palavra em português E NÃO abrir em inglês
      pass_if: (text) => /\b(olá|oi|tudo|bem|como|ajudar|posso)\b/i.test(text)
                         && !/^(hi|hello|hey)\b/i.test(text.trim()),
    },
  },
  {
    // Consistência de idioma — se detectou EN, resposta inteira em EN
    id: 'A2_IdiomaEN',
    input: 'Hi there, can you help me?',
    expect: {
      pass_if: (text) => /\b(hi|hello|hey|yes|sure|help|welcome)\b/i.test(text)
                         && !/\b(tudo bem|você|estou|posso)\b/i.test(text),
    },
  },
  {
    // Objeção típica — deve oferecer alternativa real do prompt
    id: 'A3_ObjecaoPreco',
    // TODO: adapte "tá caro" ao seu contexto — o cliente da sua vertical fala assim?
    input: 'Nossa, tá caro. Não tem opção mais em conta?',
    expect: {
      // TODO: ajuste o regex pras palavras-chave que SEU prompt usa pra responder
      pass_if: (text) => /\b(avulsa|individual|separad[ao]|parcelar|desconto)\b/i.test(text),
    },
  },
  {
    // CRÍTICO — fechamento deve INVOCAR escalarHumano via tool, não apenas escrever
    id: 'A4_FechamentoCRITICO',
    input: 'Fechado, quero fazer a contratação. Como pago?',
    expect: {
      // Checagem dupla: tool foi invocada E resposta não vazou instruções de pagamento
      pass_if: (text, toolCalls) => {
        const escalated = toolCalls.some((c) => /escalar|handoff|humano/i.test(c.toolName));
        const leakedPix = /\b(chave pix|minha pix|pix[:：]|pagar aqui)\b/i.test(text);
        return { escalated, leakedPix, pass: escalated && !leakedPix };
      },
      critical: true,
    },
  },
];
*/

// ----------------------------------------------------------------------------
// === VARIANTE B: TENANT COM KB ou INTEGRAÇÕES ===
// EXEMPLO: PLAKA Acessórios — Nuvemshop + sheets_kb; HL — ultracash; Fun — loja_integrada.
// Cenários focam em: hit da KB, miss que deve escalar, fuzzy fallback,
// chamada correta da integração externa.
// Descomente este bloco se seu tenant tem active_tools populadas.
// ----------------------------------------------------------------------------
/*
const scenarios = [
  {
    // HIT — pergunta direta de entry da KB
    id: 'B1_KB_HitDireto',
    // TODO: substitua pela pergunta EXATA de uma entry da SUA KB
    input: 'Qual o prazo de entrega?',
    expect: {
      // TODO: valide que a tool de KB foi invocada E a resposta veio da KB
      pass_if: (text, toolCalls) => {
        const kbCalled = toolCalls.some((c) => /kb|consultar|buscar/i.test(c.toolName));
        return { kbCalled, pass: kbCalled && text.length > 10 };
      },
    },
  },
  {
    // MISS — pergunta fora do escopo da KB deve escalar, não improvisar
    // Armadilha §5.3 do playbook: sem escalar = Roberta improvisando
    id: 'B2_KB_MissEscala_CRITICO',
    // TODO: pergunta fora do domínio do seu tenant (não existe na KB)
    input: 'Vocês vendem passagem aérea?',
    expect: {
      pass_if: (text, toolCalls) => {
        const escalated = toolCalls.some((c) => /escalar|handoff|humano/i.test(c.toolName));
        const improvised = /\b(sim, vendemos|temos sim)\b/i.test(text);
        return { escalated, improvised, pass: escalated && !improvised };
      },
      critical: true,
    },
  },
  {
    // FUZZY — mesma intenção com palavras flexionadas (demora → demorando)
    id: 'B3_KB_FuzzyMorfologico',
    // TODO: versão com variação morfológica de uma pergunta que já existe na KB
    input: 'Tá demorando demais meu pedido, o que faço?',
    expect: {
      pass_if: (text, toolCalls) => {
        const kbCalled = toolCalls.some((c) => /kb|consultar|buscar/i.test(c.toolName));
        return { kbCalled, pass: kbCalled };
      },
    },
  },
  {
    // INTEGRAÇÃO EXTERNA — tool específica do tenant deve ser invocada
    id: 'B4_IntegracaoExterna',
    // TODO: pergunta que DEVE disparar a tool específica do seu tenant
    //   EXEMPLO PLAKA: "consultar produto X" → Nuvemshop buscarProduto
    //   EXEMPLO HL: "quanto tá meu saldo?" → UltraCash getBalance
    input: 'Consulta pra mim o produto X',
    expect: {
      // TODO: ajuste o regex pra sua tool externa
      pass_if: (text, toolCalls) => {
        const toolCalled = toolCalls.some((c) => /produto|nuvemshop|loja/i.test(c.toolName));
        return { toolCalled, pass: toolCalled };
      },
    },
  },
];
*/

// ----------------------------------------------------------------------------
// FALLBACK: se nenhuma variante foi descomentada, cenários vazios
// ----------------------------------------------------------------------------
const scenarios = typeof globalThis.__smoke_scenarios__ !== 'undefined'
  ? globalThis.__smoke_scenarios__
  : [];

if (scenarios.length === 0) {
  console.error('ERRO: nenhum cenário definido.');
  console.error('Abra este script e descomente a VARIANTE A ou B de acordo com o tipo do seu tenant.');
  console.error('Referência: docs/zenya/TENANT-REFINEMENT-PLAYBOOK.md §2 passo 3 e §4 tipos de tenant.');
  process.exit(1);
}

// ============================================================================
// Execução — loop padrão, não mexer exceto se precisar lógica diferente
// ============================================================================

console.log(`\n🤖 Smoke ${config.name} — ${scenarios.length} cenários\n`);
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

  // Classificação: aplica pass_if e trata resultado heterogêneo
  // (pode retornar boolean simples ou objeto com detalhes)
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

  // Icon: ✅ passou · 🔴 crítico falhou · ⚠️ não-crítico falhou
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

// ============================================================================
// Sumário + persistência em /tmp pra rastreabilidade histórica
// ============================================================================

const summary = {
  total: results.length,
  passed: results.filter((r) => r.result.pass).length,
  failed: results.filter((r) => !r.result.pass).length,
  critical_failed: results.filter((r) => r.critical && !r.result.pass).length,
};

console.log('───────────────────────────────────────');
console.log(`RESUMO: ${summary.passed}/${summary.total} passaram`);
if (summary.critical_failed > 0) {
  console.log(`🔴 ${summary.critical_failed} FALHA(S) CRÍTICA(S) — revisar prompt antes de go-live`);
}

// Nome do tenant no path — vira slug para compor o arquivo JSON
const slug = String(config.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const outputPath = `/tmp/smoke-${slug || 'tenant'}-${Date.now()}.json`;
try {
  const fs = await import('node:fs/promises');
  await fs.writeFile(outputPath, JSON.stringify({ summary, results }, null, 2));
  console.log(`\nJSON salvo: ${outputPath}`);
} catch (err) {
  console.log(`\n(não foi possível salvar JSON: ${err.message})`);
}

// Exit code: 0 passou · 1 falhas menores · 2 falhas críticas
process.exit(summary.critical_failed > 0 ? 2 : summary.failed > 0 ? 1 : 0);
