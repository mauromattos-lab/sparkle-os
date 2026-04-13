// pipeline-runner.ts — executa a pipeline daily-content do squad aeo-squad-plaka
// Sage → Lyra → Rex → (revisão se necessário) → Vista

import OpenAI from 'openai';
import { join } from 'path';
import { createContentPost, updateContentPost } from '@sparkle-os/core';
import { loadAgentPrompt, loadTaskPrompt, loadSquadContext } from './agent-loader.js';
import { loadClientConfig } from './client-config.js';
import { fetchClientProducts } from './product-enricher.js';

const MODEL = process.env['CONTENT_ENGINE_MODEL'] ?? 'gpt-4o-mini';
const MAX_REVISION_ITERATIONS = 2;

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set');
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

async function callAgent(
  agentName: string,
  taskName: string,
  userMessage: string,
  squadRoot?: string,
): Promise<string> {
  const [systemPrompt, taskPrompt] = await Promise.all([
    loadAgentPrompt(agentName, squadRoot),
    loadTaskPrompt(taskName, squadRoot),
  ]);

  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: `${systemPrompt}\n\n---\n\n## Tarefa Atual\n\n${taskPrompt}` },
      { role: 'user', content: userMessage },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error(`Agent ${agentName} returned no text content`);
  }
  return text;
}

function extractBriefingTopic(briefingOutput: string): string {
  const match = briefingOutput.match(/t[oó]pico:\s*["']?([^\n"']+)/i);
  return match?.[1]?.trim() ?? 'Tema do dia';
}

function extractPostTitle(postOutput: string): string {
  const match = postOutput.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? 'Post AEO';
}

function extractMetaDescription(postOutput: string): string {
  const match = postOutput.match(/meta[_\s]?description[:\s]+["']?([^\n"']{10,160})/i);
  return match?.[1]?.trim() ?? postOutput.slice(0, 160);
}

function extractBodyPreview(postOutput: string): string {
  const lines = postOutput.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  return lines.slice(0, 3).join(' ').slice(0, 200);
}

function isRevisionVerdict(rexOutput: string): boolean {
  return /veredicto[:\s]+REVISAO/i.test(rexOutput) || /\bREVISAO\b/.test(rexOutput);
}

function isEscalatedVerdict(rexOutput: string): boolean {
  return /veredicto[:\s]+ESCALADO/i.test(rexOutput) || /\bESCALADO\b/.test(rexOutput);
}

function isApprovedVerdict(rexOutput: string): boolean {
  return /veredicto[:\s]+APROVADO/i.test(rexOutput) || /\bAPROVADO\b/.test(rexOutput);
}

function extractFeedback(rexOutput: string): string {
  const match = rexOutput.match(/feedback[:\s]+(.+?)(?:\n\n|\n#|$)/is);
  return match?.[1]?.trim() ?? rexOutput.slice(0, 500);
}

export async function runDailyPipeline(clientId = 'plaka'): Promise<void> {
  const today = new Date().toLocaleDateString('pt-BR');
  console.log(`[content-engine] Iniciando pipeline para ${clientId} — ${today}`);

  // Cria registro no DB com status inicial
  const post = await createContentPost({ clientId });
  const postId = post.id;

  try {
    // Carrega configuração do cliente (AC3: squad path parametrizado)
    const clientConfig = await loadClientConfig(clientId);
    const squadRoot = join(process.cwd(), clientConfig.squadPath);

    // Carrega contexto do cliente (AC2: usa client-context.md em vez de plaka-context.md)
    const { clientContext, postsHistory } = await loadSquadContext(clientId);

    // Story 6.6 — Enriquecimento com catálogo de produtos (graceful degradation)
    const productContext = await fetchClientProducts().catch(() => '');
    if (productContext) {
      console.log(`[content-engine] [${postId}] Produtos carregados para briefing`);
    }

    // --- Step 1: Sage define o tópico ---
    console.log(`[content-engine] [${postId}] Step 1: Sage — daily briefing`);
    const briefingOutput = await callAgent(
      'sage',
      'daily-briefing',
      `Data atual: ${today}\n\nHistórico de posts:\n${postsHistory}\n\nContexto da marca:\n${clientContext}`,
      squadRoot,
    );

    const topic = extractBriefingTopic(briefingOutput);
    await updateContentPost(postId, { topic, status: 'gerando' });

    // --- Step 2: Lyra escreve o post ---
    console.log(`[content-engine] [${postId}] Step 2: Lyra — write post`);
    const lyraUserMessage = [
      `Briefing do dia:\n${briefingOutput}`,
      `Voz e contexto da marca (${clientConfig.name}):\n${clientContext}`,
      `Histórico de posts:\n${postsHistory}`,
      ...(productContext ? [productContext] : []),
    ].join('\n\n');

    const postOutput = await callAgent('lyra', 'write-post', lyraUserMessage, squadRoot);

    // --- Step 3: Rex valida (iteração 1) ---
    console.log(`[content-engine] [${postId}] Step 3: Rex — validate (iteração 1)`);
    let rexOutput = await callAgent(
      'rex',
      'validate-post',
      `Post para validar (iteração 1 de ${MAX_REVISION_ITERATIONS}):\n\n${postOutput}`,
      squadRoot,
    );

    // Strip markdown code fence if the model wrapped the output
    // Also strip internal changelog section added by revision agent (always at the end)
    let finalPost = postOutput
      .replace(/^```markdown\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .replace(/\n#{1,3}\s*Changelog[\s\S]*/i, '')
      .trim();
    let iterationCount = 1;

    // --- Step 4: Revisão se necessário (máx 2 iterações) ---
    if (isRevisionVerdict(rexOutput) && iterationCount < MAX_REVISION_ITERATIONS) {
      iterationCount = 2;
      const feedback = extractFeedback(rexOutput);

      console.log(`[content-engine] [${postId}] Step 4: Lyra — rewrite (feedback recebido)`);
      const revisedPost = await callAgent(
        'lyra',
        'rewrite-post',
        `Post original:\n${postOutput}\n\nFeedback do Rex:\n${feedback}\n\nReescreva incorporando o feedback. Iteração ${iterationCount} de ${MAX_REVISION_ITERATIONS}.`,
        squadRoot,
      );

      // --- Step 5: Rex revalida ---
      console.log(`[content-engine] [${postId}] Step 5: Rex — revalidate (iteração 2)`);
      rexOutput = await callAgent(
        'rex',
        'validate-post',
        `Post revisado para validar (iteração 2 de ${MAX_REVISION_ITERATIONS}):\n\n${revisedPost}`,
        squadRoot,
      );
      finalPost = revisedPost;
    }

    // --- Verifica veredito final ---
    if (isEscalatedVerdict(rexOutput)) {
      console.warn(`[content-engine] [${postId}] Rex escalou após ${iterationCount} iterações`);
      await updateContentPost(postId, {
        status: 'escalado',
        title: extractPostTitle(finalPost),
        bodyPreview: extractBodyPreview(finalPost),
        errorMsg: `Rex escalou após ${iterationCount} iterações. Requer revisão manual.`,
      });
      return;
    }

    if (!isApprovedVerdict(rexOutput)) {
      console.warn(`[content-engine] [${postId}] Veredito indefinido — escalando`);
      await updateContentPost(postId, {
        status: 'escalado',
        title: extractPostTitle(finalPost),
        bodyPreview: extractBodyPreview(finalPost),
        errorMsg: 'Veredito do Rex não reconhecido. Requer revisão manual.',
      });
      return;
    }

    // --- Step 7: Vista seleciona imagem e cria pin ---
    console.log(`[content-engine] [${postId}] Step 7: Vista — curate visual`);
    const vistaOutput = await callAgent(
      'vista',
      'curate-visual',
      `Post aprovado:\n${finalPost}\n\nBriefing original:\n${briefingOutput}`,
      squadRoot,
    ).catch((err) => {
      // Vista pode falhar se Drive não estiver configurado — não bloqueia
      console.warn(`[content-engine] [${postId}] Vista falhou (não bloqueante): ${String(err)}`);
      return null;
    });

    // --- Atualiza post com conteúdo final ---
    const updatePayload: Parameters<typeof updateContentPost>[1] = {
      status: 'aguardando_aprovacao',
      title: extractPostTitle(finalPost),
      meta: extractMetaDescription(finalPost),
      bodyPreview: extractBodyPreview(finalPost),
      bodyFull: finalPost,
    };

    if (vistaOutput) {
      const imageDesc = extractImageDesc(vistaOutput);
      const pinCopy = extractPinCopy(vistaOutput);
      const pinHashtags = extractPinHashtags(vistaOutput);
      if (imageDesc) updatePayload.imageDesc = imageDesc;
      if (pinCopy) updatePayload.pinCopy = pinCopy;
      if (pinHashtags) updatePayload.pinHashtags = pinHashtags;
    }

    await updateContentPost(postId, updatePayload);

    console.log(`[content-engine] [${postId}] Pipeline concluída — aguardando aprovação de Mauro`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[content-engine] [${postId}] Erro técnico: ${errorMsg}`);

    await updateContentPost(postId, {
      status: 'erro',
      errorMsg: errorMsg.slice(0, 500),
    }).catch(() => {
      // Ignora erro secundário no update
    });
  }
}

function extractImageDesc(vistaOutput: string): string | null {
  const match = vistaOutput.match(/alt[_\s]?text[:\s]+["']?([^\n"']+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractPinCopy(vistaOutput: string): string | null {
  const match = vistaOutput.match(/descri[cç][aã]o[_\s]?pin[:\s]+["']?([^\n"']+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractPinHashtags(vistaOutput: string): string | null {
  const match = vistaOutput.match(/hashtags[:\s]+([#\w\s,]+)/i);
  return match?.[1]?.trim() ?? null;
}
