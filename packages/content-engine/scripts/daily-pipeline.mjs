/**
 * daily-pipeline.mjs — Epic 9: Automação Diária de Conteúdo AEO
 *
 * Steps:
 *   0  — Gate de scheduling (max 1 post/dia)
 *   1  — Sage gera briefing (Claude API)
 *   2  — Lyra escreve post (Claude API)
 *   3  — Rex valida post (Claude API)
 *   4-5 — Loop de revisão (max 2 iterações)
 *   6  — Saída por escalação (Z-API + exit 0)
 *   7  — Resolver feature image (NuvemShop)
 *   8  — Processar imagem 1200×630 (sharp)
 *   9a — Upload imagem ao Ghost
 *   9b — Publicar post no Ghost
 *   10 — Atualizar posts-history.md
 *   11 — Notificação de sucesso (Z-API)
 */

import { readFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parse as parseYaml } from 'yaml';
import { marked } from 'marked';
import { buildJwt, slugify, loadEnv } from './_publish-helpers.mjs';

// Sharp via createRequire (módulo CJS — import direto falha em .mjs)
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

// Carregar .env local (scripts manuais) — no-op em GitHub Actions (usa secrets)
loadEnv();

// ─── Utilitários ──────────────────────────────────────────────────────────────

function readRepoFile(relPath) {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
}

/**
 * Chama a OpenAI API com retry (429/500/503) e backoff exponencial.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {number} maxTokens
 * @param {{ jsonMode?: boolean }} [options] — jsonMode força response_format=json_object
 */
async function callClaude(systemPrompt, userMessage, maxTokens = 4096, options = {}) {
  const body = {
    model: 'gpt-4o',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  };
  if (options.jsonMode) body.response_format = { type: 'json_object' };

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return (await res.json()).choices[0].message.content;
    if ([429, 500, 503].includes(res.status) && attempt < 2) {
      const wait = 30000 * (attempt + 1);
      console.warn(`[openai] tentativa ${attempt + 1} falhou (${res.status}) — aguardando ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  }
}

/**
 * Extrai bloco YAML/JSON do texto de Claude (que pode ter texto adicional).
 */
function extractBlock(text) {
  const match = text.match(/```(?:yaml|json)?\s*([\s\S]+?)```/);
  return match ? match[1].trim() : text.trim();
}

/**
 * Remove trailing commas antes de `]` ou `}` — erro comum de LLM.
 */
function stripTrailingCommas(jsonText) {
  return jsonText.replace(/,(\s*[\]}])/g, '$1');
}

/**
 * Parseia o JSON de veredicto do Rex com tolerância a malformações comuns de LLM:
 *   - JSON envolto em bloco markdown ```json ... ```
 *   - Texto adicional antes/depois do JSON
 *   - Trailing commas antes de ] ou }
 *
 * Rex deve responder: { "veredicto": "...", "feedback": "..." }
 *
 * @throws se nem parse direto nem parse sanitizado funcionar.
 */
export function parseRexVeredicto(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Rex retornou resposta vazia ou inválida');
  }

  const unwrapped = extractBlock(text);
  const start = unwrapped.indexOf('{');
  const end = unwrapped.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`Rex não retornou JSON válido:\n${text.slice(0, 300)}`);
  }

  const candidate = unwrapped.slice(start, end + 1);

  try {
    return JSON.parse(candidate);
  } catch (firstErr) {
    try {
      return JSON.parse(stripTrailingCommas(candidate));
    } catch (secondErr) {
      throw new Error(
        `Rex retornou JSON malformado. Parse direto: ${firstErr.message}. ` +
        `Parse sanitizado: ${secondErr.message}.\nPreview: ${candidate.slice(0, 300)}`
      );
    }
  }
}

/**
 * Envia mensagem WhatsApp via Z-API.
 * Graceful degradation: se secrets não configurados, loga warning e continua.
 */
async function sendWhatsApp(message) {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const phone = process.env.MAURO_PHONE;
  if (!instanceId || !token || !phone) {
    console.warn('[notify] Z-API não configurado — pulando notificação');
    return;
  }
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `55${phone}`, message }),
      }
    );
    if (!res.ok) console.warn(`[notify] Z-API ${res.status}: ${await res.text()}`);
  } catch (err) {
    console.warn(`[notify] Falha ao enviar WhatsApp: ${err.message}`);
  }
}

// ─── Step 0: Gate de scheduling ───────────────────────────────────────────────

function checkSchedulingGate() {
  const force = process.env.FORCE === 'true';
  if (force) {
    console.log('[step-0] Flag --force ativa — ignorando gate');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const history = readRepoFile('squads/aeo-squad-plaka/data/posts-history.md');
  if (history.includes(`| ${today} |`)) {
    console.log(`[step-0] Já existe post hoje (${today}) — pulando`);
    process.exit(0);
  }
  console.log(`[step-0] Nenhum post hoje (${today}) — prosseguindo`);
}

// ─── Step 1: Sage gera briefing ───────────────────────────────────────────────

async function generateBriefing() {
  console.log('[step-1] Sage gerando briefing...');
  const systemPrompt = readRepoFile('squads/aeo-squad-plaka/tasks/daily-briefing.md');
  const history = readRepoFile('squads/aeo-squad-plaka/data/posts-history.md');
  const today = new Date().toISOString().slice(0, 10);

  // Últimos 10 posts para contexto (evitar repetição)
  const last10 = history
    .split('\n')
    .filter(l => /^\| \d{4}-\d{2}-\d{2}/.test(l))
    .slice(-10)
    .join('\n');

  const userMsg = [
    `Data: ${today}`,
    '',
    'Últimos 10 posts publicados:',
    last10,
    '',
    'Gere o briefing completo em YAML conforme o formato especificado.',
    'Responda APENAS com o bloco YAML, sem texto adicional.',
  ].join('\n');

  const raw = await callClaude(systemPrompt, userMsg, 2048);
  const parsed = parseYaml(extractBlock(raw));
  // O task file define YAML com chave raiz "briefing:" — desembrulhar se presente
  const briefing = parsed?.briefing ?? parsed;

  console.log(`[step-1] Tópico: "${briefing.topico}" | Bloco: ${briefing.bloco_conteudo}`);
  return briefing;
}

// ─── Step 2: Lyra escreve post ────────────────────────────────────────────────

async function writePost(briefing) {
  console.log('[step-2] Lyra escrevendo post...');
  const systemPrompt = readRepoFile('squads/aeo-squad-plaka/tasks/write-post.md');
  const context = readRepoFile('squads/aeo-squad-plaka/data/plaka-context.md');
  const history = readRepoFile('squads/aeo-squad-plaka/data/posts-history.md');

  // Últimas 5 URLs para links internos contextuais
  const last5urls = history
    .split('\n')
    .filter(l => /^\| \d{4}-\d{2}-\d{2}/.test(l))
    .slice(-5)
    .map(l => l.split('|').map(c => c.trim()).at(-2) ?? '')
    .filter(Boolean)
    .join('\n');

  const userMsg = [
    'Briefing:',
    JSON.stringify(briefing, null, 2),
    '',
    'Contexto da marca Plaka:',
    context,
    '',
    'URLs dos últimos posts (para links internos):',
    last5urls,
    '',
    'Escreva o post completo em Markdown.',
  ].join('\n');

  let post = await callClaude(systemPrompt, userMsg, 8192);

  // Verificar mínimo de 800 palavras
  const wordCount = post.split(/\s+/).filter(Boolean).length;
  if (wordCount < 800) {
    console.log(`[step-2] ${wordCount} palavras — solicitando expansão...`);
    const expandMsg = `${userMsg}\n\n---\nPost gerado (${wordCount} palavras — abaixo do mínimo de 800):\n${post}\n\n---\nExpanda para pelo menos 800 palavras mantendo a qualidade e estrutura.`;
    post = await callClaude(systemPrompt, expandMsg, 8192);
  }

  console.log(`[step-2] Post concluído (${post.split(/\s+/).filter(Boolean).length} palavras)`);
  return post;
}

// ─── Step 3: Rex valida ───────────────────────────────────────────────────────

async function validatePost(post, iteration = 1) {
  console.log(`[step-3] Rex validando (iteração ${iteration})...`);
  const systemPrompt = readRepoFile('squads/aeo-squad-plaka/tasks/validate-post.md');

  const userMsg = [
    'Post para validar:',
    '',
    post,
    '',
    '---',
    'Responda APENAS com um objeto JSON no formato:',
    '{ "veredicto": "APROVADO" | "REVISAO" | "ESCALADO", "feedback": "..." }',
  ].join('\n');

  const raw = await callClaude(systemPrompt, userMsg, 1024, { jsonMode: true });
  const result = parseRexVeredicto(raw);
  // Normalizar veredictos com variações (ex: APROVADO_COM_OBSERVACOES → APROVADO)
  if (result.veredicto?.startsWith('APROVADO')) result.veredicto = 'APROVADO';
  if (result.veredicto?.startsWith('REVISAO')) result.veredicto = 'REVISAO';
  console.log(`[step-3] Veredicto: ${result.veredicto}`);
  return result;
}

// ─── Steps 4-5: Loop de revisão ───────────────────────────────────────────────

async function revisionLoop(briefing, post, firstVeredicto) {
  if (firstVeredicto.veredicto !== 'REVISAO') {
    return { post, veredicto: firstVeredicto };
  }

  console.log('[step-4] Lyra reescrevendo com feedback do Rex...');
  const systemPrompt = readRepoFile('squads/aeo-squad-plaka/tasks/write-post.md');
  const context = readRepoFile('squads/aeo-squad-plaka/data/plaka-context.md');

  const rewriteMsg = [
    'Briefing original:',
    JSON.stringify(briefing, null, 2),
    '',
    'Contexto da marca Plaka:',
    context,
    '',
    'Post rejeitado:',
    post,
    '',
    'Feedback do Rex:',
    firstVeredicto.feedback,
    '',
    'Reescreva o post corrigindo os problemas indicados pelo Rex.',
  ].join('\n');

  const revisedPost = await callClaude(systemPrompt, rewriteMsg, 8192);

  console.log('[step-5] Rex revalidando post revisado...');
  const secondVeredicto = await validatePost(revisedPost, 2);

  // 2ª rejeição → escalação
  if (secondVeredicto.veredicto === 'REVISAO') {
    secondVeredicto.veredicto = 'ESCALADO';
    secondVeredicto.feedback = `Rejeitado 2x. Último feedback: ${secondVeredicto.feedback}`;
    console.log('[step-5] 2ª rejeição — escalando');
  }

  return { post: revisedPost, veredicto: secondVeredicto };
}

// ─── Step 6: Escalação ────────────────────────────────────────────────────────

async function handleEscalation(briefing, veredicto) {
  console.log('[step-6] Escalando para Mauro via WhatsApp...');

  const repoUrl = process.env.GITHUB_REPOSITORY
    ? `github.com/${process.env.GITHUB_REPOSITORY}/actions`
    : 'github.com/actions';

  const message = [
    '⚠️ *Post precisa de revisão — Plaka Blog*',
    '',
    `Tópico: ${briefing.topico}`,
    `Feedback Rex: ${veredicto.feedback}`,
    '',
    `Revisar em: ${repoUrl}`,
  ].join('\n');

  await sendWhatsApp(message);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, 'needs_escalation=true\n');
  }

  console.log('[step-6] Notificação de escalação enviada — encerrando');
  process.exit(0);
}

// ─── Step 7: Feature image (NuvemShop) ───────────────────────────────────────

// Mapeamento bloco → produto verificado com modelo (índices confirmados no Epic 8)
const BLOCO_IMAGE_MAP = {
  cuidados:   { query: 'choker',             nth: 0, imgIdx: 1 },
  qualidade:  { query: 'estrelinhas',        nth: 0, imgIdx: 1 },
  estilo:     { query: 'colar choker disco', nth: 0, imgIdx: 1 },
  materiais:  { query: 'corrente bicolor',   nth: 0, imgIdx: 1 },
  tendencias: { query: 'galax',              nth: 0, imgIdx: 0 },
  ocasioes:   { query: 'bolinhas ouro',      nth: 0, imgIdx: 2 },
};

async function resolveFeatureImage(bloco_conteudo, topico) {
  const NS_TOKEN = process.env.NUVEMSHOP_ACCESS_TOKEN;
  const NS_USER = process.env.NUVEMSHOP_USER_ID;

  if (!NS_TOKEN || !NS_USER) {
    console.warn('[step-7] NuvemShop não configurado — sem feature image');
    return null;
  }

  const mapping = BLOCO_IMAGE_MAP[bloco_conteudo];
  if (!mapping) {
    console.warn(`[step-7] Bloco "${bloco_conteudo}" não mapeado — usando fallback por tópico`);
    return _resolveImageFallback(NS_TOKEN, NS_USER, topico);
  }

  const { query, nth, imgIdx } = mapping;
  const url = `https://api.tiendanube.com/v1/${NS_USER}/products?q=${encodeURIComponent(query)}&fields=id,name,images&per_page=20`;

  const res = await fetch(url, {
    headers: {
      Authentication: `bearer ${NS_TOKEN}`,
      'User-Agent': 'MauronStore (mauromattosnegocios@gmail.com)',
    },
  });

  if (!res.ok) throw new Error(`NuvemShop ${res.status} para query "${query}"`);

  const products = await res.json();
  const withImages = products.filter(p => p.images?.length > 0);
  if (!withImages.length) return null;

  const product = withImages[Math.min(nth, withImages.length - 1)];
  const image = product.images[Math.min(imgIdx, product.images.length - 1)];

  const productName = typeof product.name === 'object'
    ? (product.name?.pt ?? product.name?.en)
    : product.name;

  console.log(`[step-7] Imagem resolvida: "${productName}" (query="${query}" idx=${imgIdx})`);
  return { imageUrl: image.src, productName: String(productName) };
}

async function _resolveImageFallback(token, userId, topico) {
  const words = topico.split(/\s+/).filter(Boolean);
  const query = words.slice(0, 3).join(' ');
  const url = `https://api.tiendanube.com/v1/${userId}/products?q=${encodeURIComponent(query)}&fields=id,name,images&per_page=5`;

  const res = await fetch(url, {
    headers: {
      Authentication: `bearer ${token}`,
      'User-Agent': 'MauronStore (mauromattosnegocios@gmail.com)',
    },
  });

  if (!res.ok) return null;
  const products = await res.json();

  for (const p of products.filter(p => p.images?.length > 0)) {
    const img = p.images.find(i => i.src?.split('/').pop()?.startsWith('img_')) ?? p.images[0];
    const name = typeof p.name === 'object' ? (p.name?.pt ?? p.name?.en) : p.name;
    if (img?.src && name) return { imageUrl: img.src, productName: String(name) };
  }
  return null;
}

// ─── Step 8: Processar imagem com Sharp ───────────────────────────────────────

async function processImage(imageUrl) {
  console.log('[step-8] Processando imagem 1200×630...');

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const W = 1200;
  const H = 630;

  // Background: resize cover + blur + escurecer
  const background = await sharp(buffer)
    .resize(W, H, { fit: 'cover' })
    .blur(30)
    .modulate({ brightness: 0.6 })
    .toBuffer();

  // Foreground: produto redimensionado (altura max 590, sem ampliar)
  const foreground = await sharp(buffer)
    .resize(null, 590, { withoutEnlargement: true })
    .toBuffer();

  const { width: fgW, height: fgH } = await sharp(foreground).metadata();
  const left = Math.round((W - fgW) / 2);
  const top = Math.round((H - fgH) / 2);

  const output = await sharp(background)
    .composite([{ input: foreground, left, top }])
    .jpeg({ quality: 88 })
    .toBuffer();

  console.log(`[step-8] Imagem processada: ${W}×${H} JPEG q88`);
  return output;
}

// ─── Steps 9a + 9b: Ghost ────────────────────────────────────────────────────

function ghostJwt() {
  const [keyId, keySecret] = process.env.GHOST_ADMIN_API_KEY.split(':');
  return buildJwt(keyId, keySecret);
}

function ghostBase() {
  return process.env.GHOST_API_URL.replace(/\/$/, '');
}

async function uploadImageToGhost(imageBuffer, filename = 'feature-image.jpg') {
  console.log('[step-9a] Enviando imagem ao Ghost...');

  const formData = new FormData();
  formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), filename);
  formData.append('purpose', 'image');

  const res = await fetch(`${ghostBase()}/ghost/api/admin/images/upload/`, {
    method: 'POST',
    headers: { Authorization: `Ghost ${ghostJwt()}`, 'Accept-Version': 'v5.0' },
    body: formData,
  });

  if (!res.ok) throw new Error(`Ghost image upload ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('Ghost não retornou URL da imagem');
  console.log(`[step-9a] Imagem Ghost: ${url}`);
  return url;
}

async function getPostBySlug(slug) {
  const res = await fetch(
    `${ghostBase()}/ghost/api/admin/posts/?filter=slug:${slug}&fields=id,slug,updated_at`,
    { headers: { Authorization: `Ghost ${ghostJwt()}`, 'Accept-Version': 'v5.0' } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.posts?.[0] ?? null;
}

async function publishToGhost(briefing, postMd, featureImageUrl, productName) {
  console.log('[step-9b] Publicando no Ghost...');

  const title = briefing.topico;
  const slug = slugify(title);
  const html = marked.parse(postMd);
  const publishedAt = new Date().toISOString();

  // Ghost 5 usa mobiledoc internamente — encapsular HTML em HTML card
  const mobiledoc = JSON.stringify({
    version: '0.3.1',
    atoms: [],
    cards: [['html', { html }]],
    markups: [],
    sections: [[10, 0]],
  });

  const payload = {
    status: 'published',
    title,
    slug,
    mobiledoc,
    feature_image: featureImageUrl ?? undefined,
    feature_image_alt: featureImageUrl ? `${productName} — Plaka Acessórios` : undefined,
    tags: [{ slug: briefing.bloco_conteudo }, { slug: 'semi-joias' }],
    published_at: publishedAt,
  };

  const existing = await getPostBySlug(slug);

  if (existing) {
    console.log(`[step-9b] Slug "${slug}" já existe — atualizando (PATCH)...`);
    const res = await fetch(`${ghostBase()}/ghost/api/admin/posts/${existing.id}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Ghost ${ghostJwt()}`,
        'Accept-Version': 'v5.0',
      },
      body: JSON.stringify({ posts: [{ ...payload, updated_at: existing.updated_at }] }),
    });
    if (!res.ok) throw new Error(`Ghost PATCH ${res.status}: ${await res.text()}`);
  } else {
    const res = await fetch(`${ghostBase()}/ghost/api/admin/posts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Ghost ${ghostJwt()}`,
        'Accept-Version': 'v5.0',
      },
      body: JSON.stringify({ posts: [payload] }),
    });
    if (!res.ok) throw new Error(`Ghost POST ${res.status}: ${await res.text()}`);
  }

  const postUrl = `https://blog.plakaacessorios.com/${slug}/`;
  console.log(`[step-9b] Publicado: ${postUrl}`);
  return { slug, title, url: postUrl };
}

// ─── Step 10: posts-history.md ────────────────────────────────────────────────

function updatePostsHistory(date, briefing, slug, url) {
  const historyPath = resolve(REPO_ROOT, 'squads/aeo-squad-plaka/data/posts-history.md');
  const content = readFileSync(historyPath, 'utf8');

  if (content.includes(`| ${date} |`)) {
    console.log('[step-10] Data já existe em posts-history.md — pulando');
  } else {
    const keywords = Array.isArray(briefing.palavras_chave)
      ? briefing.palavras_chave.join(', ')
      : (briefing.palavras_chave ?? '');

    const pergunta = briefing.pergunta_central ?? briefing.topico;
    const line = `| ${date} | ${briefing.topico} | ${pergunta} | ${briefing.bloco_conteudo} | ${keywords} | ${url} |\n`;
    appendFileSync(historyPath, line);
    console.log('[step-10] posts-history.md atualizado');
  }

  // Exportar variáveis para git-auto-commit no workflow
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `POST_DATE=${date}\n`);
    appendFileSync(process.env.GITHUB_ENV, `POST_TITLE=${briefing.topico}\n`);
  }
}

// ─── Step 11: Notificação de sucesso ──────────────────────────────────────────

async function notifySuccess(briefing, date, slug) {
  const message = [
    '✅ *Post publicado — Plaka Blog*',
    '',
    `📝 ${briefing.topico}`,
    `🏷 ${briefing.bloco_conteudo} · ${date}`,
    `🔗 https://blog.plakaacessorios.com/${slug}/`,
    '',
    'Gerado automaticamente pelo squad AEO.',
  ].join('\n');

  await sendWhatsApp(message);
  console.log('[step-11] Notificação de sucesso enviada');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Plaka Daily Content Pipeline\n');

  // Step 0: Gate
  checkSchedulingGate();

  // Step 1: Briefing (Sage)
  const briefing = await generateBriefing();

  // Step 2: Escrever (Lyra)
  let post = await writePost(briefing);

  // Step 3: Validar (Rex)
  let veredicto = await validatePost(post);

  // Steps 4-5: Loop de revisão
  if (veredicto.veredicto === 'REVISAO') {
    const result = await revisionLoop(briefing, post, veredicto);
    post = result.post;
    veredicto = result.veredicto;
  }

  // Step 6: Escalação
  if (veredicto.veredicto === 'ESCALADO') {
    await handleEscalation(briefing, veredicto);
    return;
  }

  // Step 7: Feature image
  const imageResult = await resolveFeatureImage(briefing.bloco_conteudo, briefing.topico);

  // Step 8 + 9a: Processar e enviar imagem
  let ghostImageUrl = null;
  if (imageResult) {
    const imageBuffer = await processImage(imageResult.imageUrl);
    ghostImageUrl = await uploadImageToGhost(imageBuffer);
  } else {
    console.warn('[step-8] Sem imagem — publicando sem feature image');
  }

  // Step 9b: Publicar post
  const today = new Date().toISOString().slice(0, 10);
  const productName = imageResult?.productName ?? 'Plaka Acessórios';
  const { slug, url } = await publishToGhost(briefing, post, ghostImageUrl, productName);

  // Step 10: Histórico
  updatePostsHistory(today, briefing, slug, url);

  // Step 11: Notificação
  await notifySuccess(briefing, today, slug);

  console.log('\n✅ Pipeline concluído com sucesso\n');
}

// Executar main() apenas quando invocado diretamente (node daily-pipeline.mjs),
// não quando importado por testes ou outros módulos.
const invokedDirectly = process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  main().catch(err => {
    console.error('\n[FATAL]', err.message);
    process.exit(1);
  });
}
