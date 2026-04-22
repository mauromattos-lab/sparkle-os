#!/usr/bin/env node
// REPL terminal pra conversar com o agente HL — bypass do banco.
// Usa prompt.md atual do disco + API UltraCash REAL (via ULTRACASH_API_KEY
// do .env, sem depender de credencial criptografada no Supabase).
//
// Objetivo: Mauro testar comportamento conversacional (tom, prompt v2,
// fluxo de escalação) com DADOS REAIS do estoque do Hiago, antes do
// cutover de 23h, sem precisar seedar o tenant no Supabase.
//
// Modos do Buscar_produto (trocáveis com /mode):
//   /mode real       — chama API UltraCash de verdade (default)
//   /mode in-stock   — mock com iPhones fixos (p/ testar resposta com estoque)
//   /mode no-stock   — mock "sem estoque"
//   /mode not-found  — mock "nenhum produto encontrado"
//
// Outros comandos: /sair, /reset, /info, /mode
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/chat-hl-local.mjs
//
// Requisitos env: OPENAI_API_KEY + ULTRACASH_API_KEY

import readline from 'node:readline';
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import matter from 'gray-matter';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSystemPrompt } from '../dist/agent/prompt.js';

if (!process.env.OPENAI_API_KEY) {
  console.error('ERRO: OPENAI_API_KEY não definida');
  process.exit(1);
}

const ULTRACASH_API_KEY = process.env.ULTRACASH_API_KEY;
if (!ULTRACASH_API_KEY) {
  console.warn('⚠️  ULTRACASH_API_KEY não definida — modo real indisponível, usando mock in-stock como default');
}

// ---------------------------------------------------------------------------
// Carrega prompt do disco — relêvel via /reset pra iterar sem reiniciar REPL
// ---------------------------------------------------------------------------
const repoRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const promptPath = path.join(repoRoot, 'docs/zenya/tenants/hl-importados/prompt.md');

async function loadPrompt() {
  const rawPrompt = await fs.readFile(promptPath, 'utf-8');
  const { content, data } = matter(rawPrompt);
  // buildSystemPrompt injeta ZENYA_BASE_PROMPT + data/hora atual de Brasília
  // (mesma função usada em produção), garantindo que o LLM saiba "agora" e
  // possa aplicar regras dependentes de horário.
  const fullPrompt = buildSystemPrompt({
    id: 'repl-hl',
    name: 'HL Importados',
    system_prompt: content,
    active_tools: ['ultracash'],
    chatwoot_account_id: '0',
    allowed_phones: [],
    admin_phones: [],
    admin_contacts: [],
  });
  return { content: fullPrompt, data };
}

let { content: systemPrompt, data: frontMatter } = await loadPrompt();

// ---------------------------------------------------------------------------
// Tool Buscar_produto — modo real (API UltraCash) + 3 mocks controláveis
// ---------------------------------------------------------------------------
let currentMode = ULTRACASH_API_KEY ? 'real' : 'in-stock';

const MOCK_PRODUCTS_IPHONE = [
  '- IPHONE 12 PRO MAX 256GB SEMINOVO | R$ 3.100 | 1 unidade',
  '- IPHONE 13 128GB SEMINOVO | R$ 2.800 | 2 unidades',
  '- IPHONE 14 256GB SEMINOVO | R$ 4.200 | 1 unidade',
  '- IPHONE 15 PRO 256GB NOVO LACRADO | R$ 7.500 | 1 unidade',
];

const UC_BASE_URL = 'https://apihl.ultracash.com.br';
const UC_TIMEOUT_MS = 10_000;
const UC_MAX_RESULTS = 12;

function formatarPreco(reais) {
  if (!Number.isFinite(reais) || reais <= 0) return 'Preço sob consulta';
  return `R$ ${reais.toLocaleString('pt-BR')}`;
}

async function buscarProdutosReal(termo) {
  const filial = 1;
  const url = `${UC_BASE_URL}/produtos?filial=${filial}&descricao=${encodeURIComponent(termo.toUpperCase())}`;
  const res = await fetch(url, {
    headers: {
      'x-api-key': ULTRACASH_API_KEY,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    signal: AbortSignal.timeout(UC_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`UltraCash API ${res.status} ${res.statusText}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const buscarProduto = tool({
  description:
    'Consulta o estoque da loja pelo modelo/descrição do produto. ' +
    'Use sempre que o cliente perguntar sobre disponibilidade, preço, modelos ou cores. ' +
    'CRÍTICO: busque sempre pelo modelo base (ex: "IPHONE 15 PRO", "PERFUME ASAD") — ' +
    'nunca inclua cor, condição ou qualidade no termo (AZUL, SEMINOVO, LACRADO, etc.). ' +
    'Apenas produtos com estoque > 0 são retornados.',
  parameters: z.object({
    termo: z.string().min(3).describe('Modelo base do produto em maiúsculas'),
  }),
  execute: async ({ termo }) => {
    if (currentMode === 'real') {
      try {
        const produtos = await buscarProdutosReal(termo);
        const ativos = produtos.filter((p) => p.status === 1);
        const disponiveis = ativos.filter((p) => p.estoque > 0).slice(0, UC_MAX_RESULTS);
        if (disponiveis.length === 0) {
          const semEstoque = ativos.length;
          return {
            encontrou: false,
            resultado:
              semEstoque > 0
                ? `Encontrei ${semEstoque} registro(s) para "${termo}", mas nenhum com estoque disponível no momento.`
                : `Nenhum produto encontrado para "${termo}".`,
          };
        }
        const linhas = disponiveis.map((p) => {
          const unidades = p.estoque === 1 ? '1 unidade' : `${p.estoque} unidades`;
          return `- ${p.descricao} | ${formatarPreco(p.preco_venda)} | ${unidades}`;
        });
        return { encontrou: true, resultado: linhas.join('\n') };
      } catch (err) {
        return {
          encontrou: false,
          resultado: 'Não foi possível consultar o estoque agora. Tente novamente em alguns instantes.',
          _debug: `real mode error: ${err.message}`,
        };
      }
    }
    if (currentMode === 'in-stock') {
      return { encontrou: true, resultado: MOCK_PRODUCTS_IPHONE.join('\n') };
    }
    if (currentMode === 'no-stock') {
      return {
        encontrou: false,
        resultado: `Encontrei 3 registro(s) para "${termo}", mas nenhum com estoque disponível no momento.`,
      };
    }
    return {
      encontrou: false,
      resultado: `Nenhum produto encontrado para "${termo}".`,
    };
  },
});

const extraMessages = [];
const escalateCalls = [];

const escalarHumano = tool({
  description:
    'Escala o atendimento para um humano. ANTES de chamar: envie uma mensagem ao cliente avisando o handoff. O parâmetro `resumo` é postado como MENSAGEM PÚBLICA na conversa (o cliente vê).',
  parameters: z.object({
    resumo: z.string().describe('Resumo iniciando com [ATENDIMENTO]'),
  }),
  execute: async ({ resumo }) => {
    escalateCalls.push({ resumo });
    // Em produção o core posta o resumo como mensagem pública no Chatwoot.
    // No REPL mock, imprime na mesma linha visual pra Mauro ver como o
    // cliente veria no WhatsApp (mensagem separada após a resposta curta).
    process.stdout.write(`\r\x1b[2K`);
    console.log(`\n\x1b[35mZenya (msg pública da escalação) > ${resumo}\x1b[0m`);
    return {
      escalado: true,
      mensagem: 'Atendimento escalado para um humano. O bot está desativado para esta conversa.',
    };
  },
});

const enviarTextoSeparado = tool({
  description: 'Envia um texto adicional separado para o usuário.',
  parameters: z.object({ texto: z.string() }),
  execute: async ({ texto }) => {
    extraMessages.push(texto);
    return { enviado: true };
  },
});

const refletir = tool({
  description: 'Use para raciocinar sobre o problema antes de responder.',
  parameters: z.object({ pensamento: z.string() }),
  execute: async ({ pensamento }) => {
    void pensamento;
    return { ok: true };
  },
});

const tools = { Buscar_produto: buscarProduto, escalarHumano, enviarTextoSeparado, refletir };

// ---------------------------------------------------------------------------
// REPL
// ---------------------------------------------------------------------------
const phone = '+5512999990001';

console.log('');
console.log('🤖 Chat-REPL — HL Importados');
console.log(`   Prompt: v${frontMatter.version ?? '?'} (${systemPrompt.length} chars) — ${promptPath}`);
console.log(`   Phone simulado: ${phone}`);
console.log(`   Tool mode: ${currentMode}${currentMode === 'real' ? ' (API UltraCash ao vivo)' : ' (mock)'}`);
console.log(`   UltraCash key: ${ULTRACASH_API_KEY ? 'OK' : 'não configurada'}`);
console.log('');
console.log('   Comandos:');
console.log('     /sair         encerra');
console.log('     /reset        limpa histórico');
console.log('     /info         mostra estado atual');
console.log('     /mode <x>     troca modo do Buscar_produto (real | in-stock | no-stock | not-found)');
console.log('');

let history = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `\x1b[36mVocê > \x1b[0m`,
});

rl.prompt();

rl.on('line', async (line) => {
  const raw = line.trim();
  if (!raw) {
    rl.prompt();
    return;
  }

  // Comandos são case-insensitive — o restante da mensagem fica como digitado
  const lower = raw.toLowerCase();
  const isCommand = raw.startsWith('/');
  const msg = raw;

  if (isCommand && (lower === '/sair' || lower === '/exit')) {
    rl.close();
    return;
  }

  if (isCommand && lower === '/reset') {
    history = [];
    extraMessages.length = 0;
    escalateCalls.length = 0;
    try {
      const reloaded = await loadPrompt();
      systemPrompt = reloaded.content;
      frontMatter = reloaded.data;
      console.log(`  🔄 histórico limpo + prompt recarregado do disco (v${frontMatter.version ?? '?'}, ${systemPrompt.length} chars)`);
    } catch (err) {
      console.log(`  🔄 histórico limpo (⚠️ erro ao recarregar prompt: ${err.message})`);
    }
    rl.prompt();
    return;
  }

  if (isCommand && lower === '/info') {
    console.log(`  prompt: v${frontMatter.version} | mode: ${currentMode} | msgs: ${history.length} | escalações: ${escalateCalls.length}`);
    rl.prompt();
    return;
  }

  if (isCommand && lower.startsWith('/mode ')) {
    const newMode = raw.slice('/mode '.length).trim().toLowerCase();
    if (['real', 'in-stock', 'no-stock', 'not-found'].includes(newMode)) {
      if (newMode === 'real' && !ULTRACASH_API_KEY) {
        console.log('  ❌ modo real exige ULTRACASH_API_KEY no .env');
      } else {
        currentMode = newMode;
        console.log(`  🔧 Buscar_produto agora em modo: ${currentMode}`);
      }
    } else {
      console.log('  ❌ modos válidos: real | in-stock | no-stock | not-found');
    }
    rl.prompt();
    return;
  }

  history.push({ role: 'user', content: msg });

  process.stdout.write('\x1b[90m  ⏳ pensando...\x1b[0m');
  const t0 = Date.now();

  try {
    const beforeExtras = extraMessages.length;
    const beforeEscalates = escalateCalls.length;

    const result = await generateText({
      model: openai('gpt-4.1'),
      maxSteps: 8,
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
          process.stdout.write(`\r\x1b[2K`);
          console.log(`  \x1b[33m🔧 ${call.toolName}(${argsStr})\x1b[0m`);
          console.log(`     \x1b[2m→ ${rStr}${rStr.length === 120 ? '...' : ''}\x1b[0m`);
        }
      },
    });

    process.stdout.write(`\r\x1b[2K`);

    // Mostrar mensagens enviadas via enviarTextoSeparado (na ordem)
    const newExtras = extraMessages.slice(beforeExtras);
    for (const extra of newExtras) {
      console.log(`\n\x1b[35mZenya (msg separada) > ${extra}\x1b[0m`);
    }

    if (result.text) {
      console.log(`\n\x1b[35mZenya > ${result.text}\x1b[0m`);
      history.push({ role: 'assistant', content: result.text });
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const tokensText = result.usage?.totalTokens ?? '?';
    const newEscalates = escalateCalls.length - beforeEscalates;
    const escalateNote = newEscalates > 0 ? ` • ⚠️ ${newEscalates} escalação(ões)` : '';
    console.log(`\x1b[2m(${elapsed}s, ${tokensText} tokens, ${result.finishReason}${escalateNote})\x1b[0m\n`);
  } catch (err) {
    process.stdout.write(`\r\x1b[2K`);
    console.error(`\x1b[31m❌ ${err.message}\x1b[0m`);
    if (err.cause) console.error(`   cause: ${err.cause.message ?? err.cause}`);
  }

  rl.prompt();
});

rl.on('close', () => {
  console.log(`\nEncerrado. ${history.length} mensagens. ${escalateCalls.length} escalação(ões).`);
  process.exit(0);
});
