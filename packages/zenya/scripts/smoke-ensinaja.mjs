#!/usr/bin/env node
// Smoke test pré-cutover Ensina Já Rede de Educação — valida comportamento
// end-to-end do agente Zenya-Ensinaja antes do cutover.
//
// ESTRATÉGIA OFFLINE: este smoke NÃO chama APIs externas. Usa tools mockadas
// pra focar no gap real: saber se o LLM DECIDE corretamente quando qualificar
// um lead, QUANDO escalar (lead aquecido) vs manter conversa (lead frio), e
// se responde de forma concisa.
//
// Por que offline:
//   - Ensinaja NÃO tem integração custom (reuso 100% do core, como Doceria)
//   - Reproducível, não depende de credenciais/rede
//   - Foco é validar lógica de pré-venda no prompt v2 baseline-clean
//
// Taxonomia pré-venda (INVERSA da Doceria SAC):
//   Doceria: escalar vitrine = safeguard contra erro
//   Ensinaja: escalar lead aquecido = SUCESSO (bot cumpriu papel)
//
// Cenários pré-venda:
//   EN1          — Pergunta sobre cursos → qualifica, NÃO escala imediato
//   EN2 (CRÍTICO) — Lead aquecido (nome+curso+contato) → ESCALA pra equipe fechar
//   EN3          — Lead frio ("só curioso") → mantém conversa, NÃO força
//   EN4          — Pergunta de preço → responde do prompt (valores existem) ou escala
//   EN5          — Pergunta fora de escopo → declina/redireciona/escala
//   EN6          — Pergunta aberta → resposta concisa (≤ 2 mensagens)
//
// AC 8 caso 2 (EN2) é ZERO TOLERÂNCIA — é a essência do bot de pré-venda.
// Se o bot não escala com lead aquecido, perde a conversão.
//
// v2 = baseline-clean (cópia literal do v1 n8n). v2.1+ pós-Douglas poderá
// ajustar classificação "lead aquecido" e critérios de qualificação.
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/smoke-ensinaja.mjs
//
// Requisitos env: OPENAI_API_KEY
// Output: stdout com veredicto por cenário + JSON em /tmp/smoke-ensinaja-<ts>.json
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
// Carrega prompt canônico da Ensinaja
// ----------------------------------------------------------------------------
const repoRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const promptPath = path.join(repoRoot, 'docs/zenya/tenants/ensinaja/prompt.md');
const rawPrompt = await fs.readFile(promptPath, 'utf-8');
const { content: tenantPrompt } = matter(rawPrompt);
const systemPrompt = buildSystemPrompt({
  id: 'smoke-ensinaja',
  name: 'Ensina Já Rede de Educação',
  system_prompt: tenantPrompt.trim(),
  active_tools: ['google_calendar', 'google_drive', 'eleven_labs'],
  chatwoot_account_id: '0',
  allowed_phones: [],
  admin_phones: [],
  admin_contacts: [],
});

console.log(`\n🍰 Smoke Ensina Já Rede de Educação — pré-cutover`);
console.log(`   Prompt: ${promptPath}`);
console.log(`   Tamanho: ${systemPrompt.length} chars\n`);

// ----------------------------------------------------------------------------
// Tools mockadas — Ensinaja usa calendar/drive/elevenlabs em produção, mas pro
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

// Mocks adicionais — Ensinaja pode invocar estas mas o smoke apenas captura
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
// Cenários — pré-venda / qualificação de leads
// Taxonomia Ensinaja: escalar quando lead está aquecido é SUCESSO, não safeguard.
// Prompt baseline-clean v2 = v1 n8n literal. v2.1+ será customizado pós-Douglas.
// ----------------------------------------------------------------------------
const scenarios = [
  {
    id: 'EN1_PerguntaCursos_QualificaNaoEscala',
    input: 'oi, queria saber sobre os cursos de vocês',
    critical: false,
    pass_if: ({ text, toolCalls, fullText }) => {
      // Primeiro contato: bot deve qualificar (perguntar interesse, área, etc.)
      // NÃO deve escalar imediato — lead ainda não tá aquecido
      const naoEscalouCru = !toolCalls.some((c) => c.toolName === 'escalarHumano');
      // Deve perguntar algo pra qualificar
      const qualificou = /\b(qual|que|quer|interesse|área|curso|formação|objetivo|ajudar)\b/i.test(fullText);
      return {
        pass: naoEscalouCru && qualificou,
        naoEscalouCru,
        qualificou,
      };
    },
  },
  {
    id: 'EN2_LeadAquecido_MatriculaUrgente_Escala',
    input: 'quero me matricular agora, urgente! meu nome é Roberto, (11) 99123-4567, tenho interesse no curso de auxiliar administrativo',
    critical: true, // ZERO TOLERÂNCIA — é a essência do bot de pré-venda
    pass_if: ({ toolCalls }) => {
      // Lead quente com nome + contato + curso definido → DEVE escalar pra equipe fechar
      const escalou = toolCalls.some((c) => c.toolName === 'escalarHumano');
      return { pass: escalou, escalou };
    },
  },
  {
    id: 'EN3_Curioso_NaoForcaEscalacao',
    input: 'só estava curioso mesmo, ainda não decidi nada',
    critical: false,
    pass_if: ({ text, toolCalls, fullText }) => {
      // Lead frio: NÃO forçar escalação. Manter conversa leve, qualificar suave.
      const naoEscalou = !toolCalls.some((c) => c.toolName === 'escalarHumano');
      // Não pode insistir em matricular nem pressionar
      const naoForcou = !/\b(agora é a hora|não perca|última|oportunidade única|garanta)\b/i.test(fullText);
      return {
        pass: naoEscalou && naoForcou,
        naoEscalou,
        naoForcou,
      };
    },
  },
  {
    id: 'EN4_PrecoCurso_RespondeDoPrompt',
    input: 'quanto custa o curso de auxiliar administrativo?',
    critical: false,
    pass_if: ({ fullText, toolCalls }) => {
      // Bot tem valores no prompt — deve responder com número (R$ ... ou Xx de R$...)
      // OU escalar se não souber. NUNCA inventar preço.
      const citouValor = /\b(R\$\s*[\d.]+|(\d+x\s*(de\s*)?R\$)|valor|preço|investimento|parcel)\b/i.test(fullText);
      const escalou = toolCalls.some((c) => c.toolName === 'escalarHumano');
      return {
        pass: citouValor || escalou,
        citouValor,
        escalou,
      };
    },
  },
  {
    id: 'EN5_ForaDeEscopo_DeclinaOuEscala',
    input: 'você pode me ajudar a fazer um trabalho de matemática?',
    critical: false,
    pass_if: ({ fullText, toolCalls }) => {
      // Fora de escopo — bot deve declinar gentilmente ou redirecionar
      const declinou = /\b(não faço|não posso ajudar|não é a minha área|outro tipo|fora|escopo|especific)\b/i.test(fullText);
      const redirecionou = /\b(cursos|matrícul|formação|ensina|aula|disciplina)\b/i.test(fullText);
      const escalou = toolCalls.some((c) => c.toolName === 'escalarHumano');
      return {
        pass: declinou || redirecionou || escalou,
        declinou,
        redirecionou,
        escalou,
      };
    },
  },
  {
    id: 'EN6_Resposta_Concisa',
    input: 'me conta tudo que vocês fazem',
    critical: false,
    pass_if: ({ extraMessages, fullText }) => {
      // Mensagens curtas, ≤ 2 sequenciais, sem textão
      const totalMessages = 1 + extraMessages.length;
      const maxMessages = totalMessages <= 2;
      // Limite soft de "textão": <= 700 chars total (generoso; Ensinaja tem vários cursos)
      const tamanhoOk = fullText.length <= 700;
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

const outputPath = `/tmp/smoke-ensinaja-${Date.now()}.json`;
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
