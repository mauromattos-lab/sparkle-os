#!/usr/bin/env node
// Smoke test pré-cutover HL Importados — valida comportamento end-to-end
// do agente Zenya-HL antes de liberar às 23h BRT (2026-04-22).
//
// ESTRATÉGIA OFFLINE: este smoke NÃO chama APIs externas (UltraCash,
// Supabase, Chatwoot). Usa tools mockadas com 3 modos de resultado
// (in-stock, no-stock, not-found) pra focar no gap real: saber se o
// LLM DECIDE corretamente quando chamar a tool, COMO responder dado
// cada resultado, e QUANDO escalar pra humano.
//
// Por que offline:
//   - Tool UltraCash já tem 11 unit tests (ultracash.test.ts) que cobrem
//     sanitização, filtro de estoque, formatação de preço, erros de rede
//   - Conexão UltraCash já foi validada em 2026-04-20 (~40KB response OK)
//   - Gap real é validar o AGENTE (prompt + tool-use + escalação), não a tool
//   - Offline = reproducível, não depende de credenciais/rede
//
// Cenários derivados do prompt (docs/zenya/tenants/hl-importados/prompt.md):
//   HL1. Recepção inicial — não deve chamar tool, cumprimenta natural
//   HL2. Busca iPhone com estoque — deve chamar Buscar_produto + informar preço+parcelamento
//   HL3. Produto sem estoque cadastrado — deve oferecer pedido especial + escalar
//   HL4. Pedido de falar com humano — deve escalar IMEDIATO (regra 3 do prompt)
//   HL5. Pedido de desconto — NÃO discute, escala (regra 7 do prompt)
//   HL6. Pergunta se é robô — honesta (regra 8 do prompt)
//   HL7. Encomenda de produto específico — oferece pedido especial, escala
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/smoke-hl.mjs
//
// Requisitos env: OPENAI_API_KEY
// Output: stdout com veredicto por cenário + JSON em /tmp/smoke-hl-<ts>.json
// Exit code: 0=todos pass, 1=falhas não-críticas, 2=falhas críticas

import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import matter from 'gray-matter';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ----------------------------------------------------------------------------
// Validação ambiente
// ----------------------------------------------------------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error('ERRO: OPENAI_API_KEY não definida');
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Carrega prompt canônico da HL
// ----------------------------------------------------------------------------
const repoRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const promptPath = path.join(repoRoot, 'docs/zenya/tenants/hl-importados/prompt.md');
const rawPrompt = await fs.readFile(promptPath, 'utf-8');
const { content: systemPrompt } = matter(rawPrompt);

console.log(`\n🤖 Smoke HL Importados — pré-cutover 23h`);
console.log(`   Prompt: ${promptPath}`);
console.log(`   Tamanho: ${systemPrompt.length} chars\n`);

// ----------------------------------------------------------------------------
// Tools mockadas — controladas pelo cenário via currentMockMode
// ----------------------------------------------------------------------------
let currentMockMode = 'in-stock'; // global state, alterado por cenário

// Dados reais coletados da API UltraCash em 2026-04-20 (filtro descricao=IPHONE)
// Simplificado: só alguns seminovos + novos. Mantém campos do shape real.
const MOCK_PRODUCTS_IPHONE = [
  '- IPHONE 12 PRO MAX 256GB SEMINOVO | R$ 3.100 | 1 unidade',
  '- IPHONE 13 128GB SEMINOVO | R$ 2.800 | 2 unidades',
  '- IPHONE 15 PRO 256GB NOVO LACRADO | R$ 7.500 | 1 unidade',
];

function makeBuscarProduto() {
  return tool({
    description:
      'Consulta o estoque da loja pelo modelo/descrição do produto. ' +
      'Use sempre que o cliente perguntar sobre disponibilidade, preço, modelos ou cores. ' +
      'Apenas produtos com estoque > 0 são retornados.',
    parameters: z.object({
      termo: z.string().min(3).describe('Modelo base do produto em maiúsculas'),
    }),
    execute: async ({ termo }) => {
      console.log(`   [mock] Buscar_produto(termo="${termo}") mode=${currentMockMode}`);
      if (currentMockMode === 'in-stock') {
        return {
          encontrou: true,
          resultado: MOCK_PRODUCTS_IPHONE.join('\n'),
        };
      }
      if (currentMockMode === 'no-stock') {
        return {
          encontrou: false,
          resultado: `Encontrei 3 registro(s) para "${termo}", mas nenhum com estoque disponível no momento.`,
        };
      }
      // not-found
      return {
        encontrou: false,
        resultado: `Nenhum produto encontrado para "${termo}".`,
      };
    },
  });
}

function makeEscalarHumano(escalateCalls) {
  return tool({
    description:
      'Escala o atendimento para um humano. ANTES de chamar: envie uma mensagem ao cliente avisando o handoff.',
    parameters: z.object({
      resumo: z.string().describe('Resumo iniciando com [ATENDIMENTO]'),
    }),
    execute: async ({ resumo }) => {
      escalateCalls.push({ resumo });
      console.log(`   [mock] escalarHumano invocada — resumo: ${resumo.slice(0, 80)}`);
      return {
        escalado: true,
        mensagem: 'Atendimento escalado para um humano. O bot está desativado para esta conversa.',
      };
    },
  });
}

function makeEnviarTextoSeparado(extraMessages) {
  return tool({
    description: 'Envia um texto adicional separado para o usuário.',
    parameters: z.object({ texto: z.string() }),
    execute: async ({ texto }) => {
      extraMessages.push(texto);
      return { enviado: true };
    },
  });
}

function makeRefletir() {
  return tool({
    description: 'Use para raciocinar sobre o problema antes de responder.',
    parameters: z.object({ pensamento: z.string() }),
    execute: async ({ pensamento }) => {
      void pensamento;
      return { ok: true };
    },
  });
}

// ----------------------------------------------------------------------------
// Cenários
// ----------------------------------------------------------------------------
const scenarios = [
  {
    id: 'HL1_Recepcao',
    input: 'oi, tudo bem?',
    mockMode: 'in-stock', // irrelevante — não deve chamar tool
    critical: false,
    pass_if: ({ text, toolCalls }) => {
      // Deve cumprimentar naturalmente, não deve chamar Buscar_produto
      const cumprimentou = /\b(oi|olá|bem-vindo|ajuda|procurand|hl)\b/i.test(text);
      const nenhumaBusca = !toolCalls.some((c) => c.toolName === 'Buscar_produto');
      const semEscalacao = !toolCalls.some((c) => c.toolName === 'escalarHumano');
      return {
        pass: cumprimentou && nenhumaBusca && semEscalacao,
        cumprimentou,
        nenhumaBusca,
        semEscalacao,
      };
    },
  },
  {
    id: 'HL2_BuscaIphone_ComEstoque',
    input: 'quanto tá o iphone 12 pro?',
    mockMode: 'in-stock',
    critical: true,
    pass_if: ({ text, toolCalls }) => {
      const chamouBusca = toolCalls.some((c) => c.toolName === 'Buscar_produto');
      // Deve citar preço (R$ X) OU número com milhar ponto (R$ 3.100)
      const citouPreco = /R\$\s*[\d.]+/.test(text);
      // Bonus: cita parcelamento ou garantia (regra do prompt passo 3)
      const citouExtras = /\b(18x|parcel|garant|seminov)\b/i.test(text);
      return {
        pass: chamouBusca && citouPreco,
        chamouBusca,
        citouPreco,
        citouExtras,
      };
    },
  },
  {
    id: 'HL3_ProdutoNaoEncontrado',
    input: 'tem Samsung Galaxy S25 Ultra aí?',
    mockMode: 'not-found',
    critical: true,
    pass_if: ({ text, toolCalls }) => {
      const chamouBusca = toolCalls.some((c) => c.toolName === 'Buscar_produto');
      // Deve oferecer pedido especial OU escalar (regra: sem estoque → encomenda + escalar)
      const ofereceuEncomenda = /\b(pedido especial|encomenda|consultar|verificar|equipe)\b/i.test(text);
      const escalou = toolCalls.some((c) => c.toolName === 'escalarHumano');
      return {
        pass: chamouBusca && (ofereceuEncomenda || escalou),
        chamouBusca,
        ofereceuEncomenda,
        escalou,
      };
    },
  },
  {
    id: 'HL4_FalarHumano_Imediato',
    input: 'quero falar com alguém da loja',
    mockMode: 'in-stock',
    critical: true,
    pass_if: ({ text, toolCalls }) => {
      // Regra 3 do prompt: escalar IMEDIATO sem perguntar motivo
      const escalou = toolCalls.some((c) => c.toolName === 'escalarHumano');
      // Deve enviar mensagem ANTES de escalar (pode estar no text ou em extraMessages)
      const enviouMensagemHandoff = /🔄|passando para a equipe|equipe agora/i.test(text);
      // NÃO deve insistir perguntando motivo antes
      const nao_insistiu = !/\bqual|motiv|por qu[eê]|razão/i.test(text);
      return {
        pass: escalou && enviouMensagemHandoff,
        escalou,
        enviouMensagemHandoff,
        nao_insistiu,
      };
    },
  },
  {
    id: 'HL5_PedidoDesconto',
    input: 'dá um desconto aí? tô meio apertado',
    mockMode: 'in-stock',
    critical: true,
    pass_if: ({ text, toolCalls }) => {
      // Regra 7: não discutir preço/desconto, escalar
      const escalou = toolCalls.some((c) => c.toolName === 'escalarHumano');
      // NÃO deve prometer desconto nem citar valor específico
      const nao_prometeu = !/\b(dou \d+%|faço por|te dou|desconto de \d)/i.test(text);
      return {
        pass: escalou && nao_prometeu,
        escalou,
        nao_prometeu,
      };
    },
  },
  {
    id: 'HL6_PerguntaSeEhIA',
    input: 'você é um robô?',
    mockMode: 'in-stock',
    critical: false,
    pass_if: ({ text, toolCalls }) => {
      // Regra 8: honesto — "Sou a Zenya, assistente virtual"
      const honesto = /\b(zenya|assistente|virtual|ia|inteligência artificial)\b/i.test(text);
      // Não deve negar ser robô
      const nao_mentiu = !/\bn[ãa]o sou um robô|sou humano/i.test(text);
      // Bonus: menciona que equipe humana tá aqui também
      const mencionouEquipe = /\b(equipe|gente|humano|pessoa|aqui tamb[ée]m|falar com)\b/i.test(text);
      return {
        pass: honesto && nao_mentiu,
        honesto,
        nao_mentiu,
        mencionouEquipe,
      };
    },
  },
  {
    id: 'HL7_Encomenda',
    input: 'queria uma cafeteira Nespresso Vertuo nova, vocês têm?',
    mockMode: 'not-found',
    critical: false,
    pass_if: ({ text, toolCalls }) => {
      const chamouBusca = toolCalls.some((c) => c.toolName === 'Buscar_produto');
      const ofereceuEncomenda = /\b(pedido especial|encomenda|consultar|verificar|equipe)\b/i.test(text);
      return {
        pass: chamouBusca && ofereceuEncomenda,
        chamouBusca,
        ofereceuEncomenda,
      };
    },
  },
];

// ----------------------------------------------------------------------------
// Execução
// ----------------------------------------------------------------------------
console.log(`Rodando ${scenarios.length} cenários...\n`);

const results = [];

for (const scenario of scenarios) {
  currentMockMode = scenario.mockMode;
  const escalateCalls = [];
  const extraMessages = [];
  const capturedCalls = [];
  const t0 = Date.now();

  let responseText = '';
  let error = null;

  const tools = {
    Buscar_produto: makeBuscarProduto(),
    escalarHumano: makeEscalarHumano(escalateCalls),
    enviarTextoSeparado: makeEnviarTextoSeparado(extraMessages),
    refletir: makeRefletir(),
  };

  try {
    const result = await generateText({
      model: openai('gpt-4.1'),
      maxSteps: 8,
      system: systemPrompt,
      messages: [{ role: 'user', content: scenario.input }],
      tools,
      onStepFinish: ({ toolCalls }) => {
        for (const call of toolCalls ?? []) {
          capturedCalls.push({ toolName: call.toolName, args: call.args });
        }
      },
    });
    responseText = result.text;
  } catch (err) {
    error = err.message;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // Combina texto final + textos de enviarTextoSeparado (cliente veria tudo)
  const fullClientText = [responseText, ...extraMessages].filter(Boolean).join('\n');

  let verdict;
  if (error) {
    verdict = { pass: false, reason: `error: ${error}` };
  } else {
    verdict = scenario.pass_if({ text: fullClientText, toolCalls: capturedCalls });
  }

  const record = {
    id: scenario.id,
    critical: !!scenario.critical,
    input: scenario.input,
    mockMode: scenario.mockMode,
    response_text: responseText,
    extra_messages: extraMessages,
    tool_calls: capturedCalls.map((c) => c.toolName),
    escalate_calls: escalateCalls.length,
    elapsed_s: Number(elapsed),
    verdict,
  };
  results.push(record);

  const icon = verdict.pass ? '✅' : scenario.critical ? '🔴' : '⚠️';
  console.log(`${icon} ${scenario.id} (${elapsed}s)`);
  console.log(`   IN:  ${scenario.input}`);
  console.log(`   OUT: ${responseText.slice(0, 180)}${responseText.length > 180 ? '...' : ''}`);
  if (extraMessages.length > 0) {
    console.log(`   EXTRA: ${extraMessages.map((m) => m.slice(0, 100)).join(' | ')}`);
  }
  if (capturedCalls.length > 0) {
    console.log(`   TOOLS: ${capturedCalls.map((c) => c.toolName).join(', ')}`);
  }
  if (!verdict.pass) {
    console.log(`   FAIL: ${JSON.stringify(verdict)}`);
  } else if (Object.keys(verdict).some((k) => k !== 'pass' && verdict[k] === false)) {
    const fails = Object.entries(verdict).filter(([k, v]) => k !== 'pass' && v === false);
    console.log(`   warn: ${fails.map(([k]) => k).join(', ')} false`);
  }
  console.log('');
}

// ----------------------------------------------------------------------------
// Sumário
// ----------------------------------------------------------------------------
const summary = {
  total: results.length,
  passed: results.filter((r) => r.verdict.pass).length,
  failed: results.filter((r) => !r.verdict.pass).length,
  critical_failed: results.filter((r) => r.critical && !r.verdict.pass).length,
};

console.log('───────────────────────────────────────');
console.log(`RESUMO: ${summary.passed}/${summary.total} passaram (${summary.critical_failed} crítico(s) falho(s))`);

const outputPath = `/tmp/smoke-hl-${Date.now()}.json`;
try {
  await fs.writeFile(outputPath, JSON.stringify({ summary, results, prompt_size: systemPrompt.length }, null, 2));
  console.log(`\nJSON salvo: ${outputPath}`);
} catch (err) {
  console.log(`\n(não foi possível salvar JSON: ${err.message})`);
}

process.exit(summary.critical_failed > 0 ? 2 : summary.failed > 0 ? 1 : 0);
