#!/usr/bin/env node
// REPL terminal pra conversar com o agente Doceria — bypass do banco.
// Usa prompt.md atual do disco (com hot-reload via /reset pra iterar sem
// reiniciar). Pra Mauro testar tom, regras de vitrine e concisão antes
// do cutover, sem precisar seedar o tenant no Supabase.
//
// Diferença do HL REPL: sem integração externa real. Doceria não tem ERP —
// apenas tools mockadas (escalar/textos/reflexão/drive-dummy).
//
// Comandos: /sair, /reset, /info
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/chat-doceria-local.mjs
//
// Requisitos env: OPENAI_API_KEY

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

// ---------------------------------------------------------------------------
// Carrega prompt do disco — releva via /reset pra iterar sem reiniciar REPL
// ---------------------------------------------------------------------------
const repoRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const promptPath = path.join(repoRoot, 'docs/zenya/tenants/doceria-dona-geralda/prompt.md');

async function loadPrompt() {
  const rawPrompt = await fs.readFile(promptPath, 'utf-8');
  const { content, data } = matter(rawPrompt);
  const fullPrompt = buildSystemPrompt({
    id: 'repl-doceria',
    name: 'Doceria & Padaria Dona Geralda',
    system_prompt: content.trim(),
    active_tools: ['google_calendar', 'google_drive', 'eleven_labs'],
    chatwoot_account_id: '0',
    allowed_phones: [],
    admin_phones: [],
    admin_contacts: [],
  });
  return { content: fullPrompt, data };
}

let { content: systemPrompt, data: frontMatter } = await loadPrompt();

// ---------------------------------------------------------------------------
// Tools mockadas
// ---------------------------------------------------------------------------
const escalarHumano = tool({
  description:
    'Escala o atendimento para um humano. ANTES de chamar, envie uma mensagem ao cliente avisando o handoff.',
  parameters: z.object({
    resumo: z.string().describe('Resumo do pedido/contexto para a equipe'),
  }),
  execute: async ({ resumo }) => {
    console.log(`\n   🚨 [escalarHumano] resumo: ${resumo}`);
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
    console.log(`\n   💬 [texto extra]: ${texto}`);
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

const listarArquivos = tool({
  description: 'Lista arquivos disponíveis no catálogo de fotos do Google Drive.',
  parameters: z.object({ filtro: z.string().optional() }),
  execute: async ({ filtro }) => {
    console.log(`\n   📂 [Listar_arquivos] filtro="${filtro ?? ''}"`);
    return { arquivos: [] }; // Mock — sem arquivos reais no REPL
  },
});

const enviarArquivo = tool({
  description: 'Envia um arquivo/foto do Google Drive para o cliente.',
  parameters: z.object({ arquivo_id: z.string() }),
  execute: async ({ arquivo_id }) => {
    console.log(`\n   📎 [Enviar_arquivo] id=${arquivo_id}`);
    return { enviado: true };
  },
});

const tools = {
  escalarHumano,
  enviarTextoSeparado,
  refletir,
  Listar_arquivos: listarArquivos,
  Enviar_arquivo: enviarArquivo,
};

// ---------------------------------------------------------------------------
// REPL
// ---------------------------------------------------------------------------
const messages = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

function banner() {
  console.log(`\n🍰 REPL Doceria & Padaria Dona Geralda (Gê)`);
  console.log(`   Prompt: ${promptPath} (v${frontMatter.version ?? '?'})`);
  console.log(`   Tamanho: ${systemPrompt.length} chars`);
  console.log(`   Comandos: /sair  /reset  /info`);
  console.log(`   Modelo: gpt-4.1 · maxSteps 8`);
  console.log('');
}

banner();

function prompt() {
  rl.question('você > ', async (input) => {
    const text = input.trim();
    if (!text) return prompt();

    if (text === '/sair') {
      console.log('tchau!');
      rl.close();
      return;
    }

    if (text === '/reset') {
      messages.length = 0;
      try {
        const reloaded = await loadPrompt();
        systemPrompt = reloaded.content;
        frontMatter = reloaded.data;
        console.log(`✅ prompt recarregado (${systemPrompt.length} chars, v${frontMatter.version ?? '?'}). histórico limpo.`);
      } catch (err) {
        console.error(`❌ erro recarregando prompt: ${err.message}`);
      }
      return prompt();
    }

    if (text === '/info') {
      console.log(`mensagens no histórico: ${messages.length}`);
      console.log(`prompt: ${systemPrompt.length} chars (v${frontMatter.version ?? '?'})`);
      return prompt();
    }

    messages.push({ role: 'user', content: text });

    const t0 = Date.now();
    const stepTrail = [];
    try {
      const result = await generateText({
        model: openai('gpt-4.1'),
        maxSteps: 8,
        system: systemPrompt,
        messages,
        tools,
        onStepFinish: ({ toolCalls, toolResults, text: stepText, finishReason }) => {
          const calls = (toolCalls ?? []).map((c) => ({
            name: c.toolName,
            args: c.args,
          }));
          stepTrail.push({
            tools: calls,
            finishReason,
            hasText: Boolean(stepText?.trim()),
          });
          // Render reasoning inline — "refletir" não tem log próprio no execute
          for (const c of calls) {
            if (c.name === 'refletir' && c.args?.pensamento) {
              console.log(`\n   🧠 [refletir]: ${c.args.pensamento.slice(0, 220)}${c.args.pensamento.length > 220 ? '...' : ''}`);
            }
          }
        },
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      messages.push({ role: 'assistant', content: result.text });

      // Trail resumido — mostra passos executados pro operador
      if (stepTrail.length > 0) {
        const summary = stepTrail
          .map((s, i) => {
            const toolNames = s.tools.map((t) => t.name);
            const reason = s.finishReason === 'stop' ? '' : ` [${s.finishReason}]`;
            if (toolNames.length === 0) return `step${i + 1}: texto${reason}`;
            return `step${i + 1}: ${toolNames.join('+')}${reason}`;
          })
          .join(' → ');
        console.log(`\n   🔎 trail: ${summary}`);
      }

      console.log(`\ngê  > ${result.text}  (${elapsed}s · ${stepTrail.length} step${stepTrail.length === 1 ? '' : 's'})\n`);
    } catch (err) {
      console.error(`\n❌ erro: ${err.message}\n`);
    }

    prompt();
  });
}

prompt();
