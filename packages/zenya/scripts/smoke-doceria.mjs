#!/usr/bin/env node
// Smoke test pré-cutover Doceria & Padaria Dona Geralda — valida comportamento
// end-to-end do agente Zenya-Doceria antes do cutover (sem janela apertada —
// cliente já em pausa voluntária desde 2026-04-18).
//
// ESTRATÉGIA OFFLINE: este smoke NÃO chama APIs externas. Usa tools mockadas
// pra focar no gap real: saber se o LLM DECIDE corretamente quando escalar
// pedido de vitrine, QUANDO enviar link de bolos vs link geral, e COMO
// responder com concisão (sem textão).
//
// Por que offline:
//   - Doceria NÃO tem ERP custom (contraste HL/UltraCash) — não há API real pra validar
//   - Reproducível, não depende de credenciais/rede
//   - Foco é validar regras de negócio da Ariane (feedback 2026-04-17)
//
// Cenários derivados do feedback-ariane-20260417.md + prompt v2:
//   DC1 (CRÍTICO) — Pedido de vitrine específico → resumo + escalar, NÃO fechar venda
//   DC2          — Encomenda de bolo planejado → fluxo normal (sabor/decoração/data)
//   DC3          — "O que tem na vitrine hoje?" → escalar imediato
//   DC4          — "Cardápio de bolos" → envia link wa.me/p/31793244436940904/...
//   DC5          — "Cardápio completo" / delivery → envia link delivery.yooga.app/...
//   DC6          — Pergunta aberta → resposta concisa (sem textão, ≤ 2 mensagens)
//
// AC 8 caso 1 (DC1) é ZERO TOLERÂNCIA — gatilho original do incidente
// Ariane de 2026-04-17 (coxinha de vitrine confirmada sem disponibilidade real).
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/smoke-doceria.mjs
//
// Requisitos env: OPENAI_API_KEY
// Output: stdout com veredicto por cenário + JSON em /tmp/smoke-doceria-<ts>.json
// Exit code: 0=todos pass, 1=falhas não-críticas, 2=falhas críticas

import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import matter from 'gray-matter';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSystemPrompt } from '../dist/agent/prompt.js';

// ----------------------------------------------------------------------------
// Validação ambiente
// ----------------------------------------------------------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error('ERRO: OPENAI_API_KEY não definida');
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Carrega prompt canônico da Doceria
// ----------------------------------------------------------------------------
const repoRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const promptPath = path.join(repoRoot, 'docs/zenya/tenants/doceria-dona-geralda/prompt.md');
const rawPrompt = await fs.readFile(promptPath, 'utf-8');
const { content: tenantPrompt } = matter(rawPrompt);
const systemPrompt = buildSystemPrompt({
  id: 'smoke-doceria',
  name: 'Doceria & Padaria Dona Geralda',
  system_prompt: tenantPrompt.trim(),
  active_tools: ['google_calendar', 'google_drive', 'eleven_labs'],
  chatwoot_account_id: '0',
  allowed_phones: [],
  admin_phones: [],
  admin_contacts: [],
});

console.log(`\n🍰 Smoke Doceria & Padaria Dona Geralda — pré-cutover`);
console.log(`   Prompt: ${promptPath}`);
console.log(`   Tamanho: ${systemPrompt.length} chars\n`);

// ----------------------------------------------------------------------------
// Tools mockadas — Doceria usa calendar/drive/elevenlabs em produção, mas pro
// smoke offline a gente só observa escalação, mensagens extras e concisão.
// ----------------------------------------------------------------------------

function makeEscalarHumano(escalateCalls) {
  return tool({
    description:
      'Escala o atendimento para um humano. ANTES de chamar: envie mensagem ao cliente avisando o handoff.',
    parameters: z.object({
      resumo: z.string().describe('Resumo do pedido/contexto para a equipe'),
    }),
    execute: async ({ resumo }) => {
      escalateCalls.push({ resumo });
      console.log(`   [mock] escalarHumano — resumo: ${resumo.slice(0, 80)}`);
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

// Mocks adicionais — Doceria pode invocar estas mas o smoke apenas captura
function makeListarArquivos(fileListCalls) {
  return tool({
    description: 'Lista arquivos disponíveis no catálogo de fotos do Google Drive.',
    parameters: z.object({ filtro: z.string().optional() }),
    execute: async ({ filtro }) => {
      fileListCalls.push({ filtro });
      return { arquivos: [] };
    },
  });
}

function makeEnviarArquivo(fileSendCalls) {
  return tool({
    description: 'Envia um arquivo/foto do Google Drive para o cliente.',
    parameters: z.object({ arquivo_id: z.string() }),
    execute: async ({ arquivo_id }) => {
      fileSendCalls.push({ arquivo_id });
      return { enviado: true };
    },
  });
}

// ----------------------------------------------------------------------------
// Constantes derivadas do prompt — usadas em validação
// ----------------------------------------------------------------------------
const LINK_BOLOS = 'wa.me/p/31793244436940904';
const LINK_YOOGA = 'delivery.yooga.app/doceria-dona-geralda';

// ----------------------------------------------------------------------------
// Cenários
// ----------------------------------------------------------------------------
const scenarios = [
  {
    id: 'DC1_Coxinha_Vitrine_NaoFechar',
    input: 'quero uma coxinha de frango grande, quanto fica?',
    critical: true, // ZERO TOLERÂNCIA — gatilho do incidente Ariane
    pass_if: ({ text, toolCalls }) => {
      const escalou = toolCalls.some((c) => c.toolName === 'escalarHumano');
      // NÃO pode prometer que tem, NÃO pode fechar venda
      const naoPrometeu = !/\b(sim,?\s*(tem|temos)|pode vir pegar|fica reservad|pedido confirmado)\b/i.test(text);
      // Deve mencionar que vai verificar com a equipe (resumo + espera)
      const mencionouVerificar = /\b(verifica|confirm|equipe|deixa eu ver|já te aviso|pronto)\b/i.test(text);
      return {
        pass: escalou && naoPrometeu && mencionouVerificar,
        escalou,
        naoPrometeu,
        mencionouVerificar,
      };
    },
  },
  {
    id: 'DC2_Bolo_Encomenda_Normal',
    input: 'queria encomendar um bolo de chocolate 2kg pra retirar sexta',
    critical: false,
    pass_if: ({ text, toolCalls, fullText }) => {
      // Pode chamar escalar (regra do prompt: confirmar sabor/decoração com equipe)
      // mas NÃO é obrigado a escalar ANTES de coletar dados. Se coletou +
      // ofereceu seguir, é OK. Importante: deve coletar sabor/decoração/horário.
      const coletouDados = /\b(sabor|decora|topper|chantilly|ganache|hor[aá]rio|retirad|sinal)\b/i.test(fullText);
      // NÃO pode tratar como vitrine/escalar sem coletar nada
      const naoEscalouCru = toolCalls.filter((c) => c.toolName === 'escalarHumano').length === 0 || coletouDados;
      return {
        pass: coletouDados && naoEscalouCru,
        coletouDados,
        naoEscalouCru,
      };
    },
  },
  {
    id: 'DC3_VitrineHoje_Escalar',
    input: 'o que tem na vitrine hoje?',
    critical: true,
    pass_if: ({ toolCalls }) => {
      const escalou = toolCalls.some((c) => c.toolName === 'escalarHumano');
      return { pass: escalou, escalou };
    },
  },
  {
    id: 'DC4_CardapioBolos_LinkWhatsApp',
    input: 'me manda o cardápio dos bolos',
    critical: true,
    pass_if: ({ fullText }) => {
      const enviouLinkBolos = fullText.includes(LINK_BOLOS);
      const naoEnviouYooga = !fullText.includes(LINK_YOOGA);
      return {
        pass: enviouLinkBolos && naoEnviouYooga,
        enviouLinkBolos,
        naoEnviouYooga,
      };
    },
  },
  {
    id: 'DC5_CardapioCompleto_LinkYooga',
    input: 'onde eu vejo o cardápio completo pra pedir online?',
    critical: false,
    pass_if: ({ fullText }) => {
      const enviouYooga = fullText.includes(LINK_YOOGA);
      return { pass: enviouYooga, enviouYooga };
    },
  },
  {
    id: 'DC6_Resposta_Concisa',
    input: 'me conta tudo que vocês fazem',
    critical: false,
    pass_if: ({ text, extraMessages, fullText }) => {
      // Regra crítica 10 do prompt v2: mensagens curtas, ≤ 2 sequenciais, sem textão
      const totalMessages = 1 + extraMessages.length; // 1 principal + extras
      const maxMessages = totalMessages <= 2;
      // Limite soft de "textão": <= 600 chars total (generoso)
      const tamanhoOk = fullText.length <= 600;
      return {
        pass: maxMessages && tamanhoOk,
        totalMessages,
        maxMessages,
        tamanhoOk,
        charCount: fullText.length,
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
  const escalateCalls = [];
  const extraMessages = [];
  const fileListCalls = [];
  const fileSendCalls = [];
  const capturedCalls = [];
  const t0 = Date.now();

  let responseText = '';
  let error = null;

  const tools = {
    escalarHumano: makeEscalarHumano(escalateCalls),
    enviarTextoSeparado: makeEnviarTextoSeparado(extraMessages),
    refletir: makeRefletir(),
    Listar_arquivos: makeListarArquivos(fileListCalls),
    Enviar_arquivo: makeEnviarArquivo(fileSendCalls),
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

  const fullClientText = [responseText, ...extraMessages].filter(Boolean).join('\n');

  let verdict;
  if (error) {
    verdict = { pass: false, reason: `error: ${error}` };
  } else {
    verdict = scenario.pass_if({
      text: responseText,
      fullText: fullClientText,
      extraMessages,
      toolCalls: capturedCalls,
    });
  }

  const record = {
    id: scenario.id,
    critical: !!scenario.critical,
    input: scenario.input,
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

const outputPath = `/tmp/smoke-doceria-${Date.now()}.json`;
try {
  await fs.writeFile(
    outputPath,
    JSON.stringify({ summary, results, prompt_size: systemPrompt.length }, null, 2),
  );
  console.log(`\nJSON salvo: ${outputPath}`);
} catch (err) {
  console.log(`\n(não foi possível salvar JSON: ${err.message})`);
}

process.exit(summary.critical_failed > 0 ? 2 : summary.failed > 0 ? 1 : 0);
