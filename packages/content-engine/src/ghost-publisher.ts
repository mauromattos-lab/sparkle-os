// Ghost Publisher — Stories 6.2 + 6.3
// Publishes approved content posts to Ghost CMS via Admin API
// JWT HS256 gerado localmente com node:crypto (sem deps externas)
// Padrão: pinterest-publisher.ts e nuvemshop-publisher.ts

import { createHmac } from 'node:crypto';
import { updateContentPost } from '@sparkle-os/core';
import type { ContentPost } from '@sparkle-os/core';
import { markdownToHtml } from './nuvemshop-publisher.js';

// ─── JWT (Ghost Admin API usa HS256 com secret em hex) ───────────────────────

function buildJwt(id: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })
  ).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const keyBuffer = Buffer.from(secret, 'hex');
  const signature = createHmac('sha256', keyBuffer).update(signingInput).digest('base64url');

  return `${signingInput}.${signature}`;
}

// ─── Slug ─────────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

// ─── AEO helpers (Story 6.3) ──────────────────────────────────────────────────

// Estima wordCount removendo tags HTML e contando palavras
export function estimateWordCount(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').filter((w) => w.length > 0).length;
}

// Extrai até maxItems pares FAQ de H2/H3 + parágrafo seguinte do HTML
export function extractFaqItems(
  html: string,
  maxItems = 5
): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = [];

  // Normaliza quebras de linha para facilitar matching
  const normalized = html.replace(/\r?\n/g, ' ');

  // Encontra pares heading + parágrafo seguinte
  const pattern = /<h[23][^>]*>(.*?)<\/h[23]>\s*<p[^>]*>(.*?)<\/p>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null && items.length < maxItems) {
    const question = (match[1] ?? '').replace(/<[^>]+>/g, '').trim();
    const answer = (match[2] ?? '').replace(/<[^>]+>/g, '').trim();

    if (question.length >= 10 && answer.length >= 20) {
      items.push({ question, answer });
    }
  }

  return items;
}

// ─── JSON-LD Schema BlogPosting + FAQPage (AC3 Story 6.2, expandido Story 6.3) ─

export interface JsonLdOptions {
  url?: string;
  wordCount?: number;
  articleSection?: string;
  faqItems?: Array<{ question: string; answer: string }>;
}

export function buildJsonLd(
  title: string,
  datePublished: string,
  options: JsonLdOptions = {}
): string {
  const { url, wordCount, articleSection, faqItems } = options;

  const blogPosting: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    author: { '@type': 'Organization', name: 'Plaka Acessórios' },
    publisher: { '@type': 'Organization', name: 'Plaka Acessórios' },
    datePublished,
    inLanguage: 'pt-BR',
    ...(url ? { url } : {}),
    ...(wordCount !== undefined ? { wordCount } : {}),
    ...(articleSection ? { articleSection } : {}),
  };

  const schemas: unknown[] = [blogPosting];

  // FAQPage apenas quando há 3+ pares detectados (AC4)
  if (faqItems && faqItems.length >= 3) {
    const faqPage = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    };
    schemas.push(faqPage);
  }

  // Array de schemas ou schema único (retrocompatibilidade com AC7)
  const output = schemas.length === 1 ? schemas[0] : schemas;

  return `<script type="application/ld+json">\n${JSON.stringify(output, null, 2)}\n</script>`;
}

// ─── Ghost Admin API types ────────────────────────────────────────────────────

interface GhostPost {
  id: string;
  uuid: string;
  title: string;
  status: string;
  url: string | null; // drafts retornam null (QA fix 6.1)
}

// ─── Ghost Admin API — fetch com timeout ─────────────────────────────────────

function ghostFetch(
  url: string,
  options: RequestInit,
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// ─── Verificar persistência do codeinjection_head (QA fix 6.1) ───────────────

async function verifyCodeInjection(
  ghostUrl: string,
  token: string,
  postId: string
): Promise<void> {
  const response = await ghostFetch(
    `${ghostUrl}/ghost/api/admin/posts/${postId}/?fields=codeinjection_head`,
    {
      headers: {
        Authorization: `Ghost ${token}`,
        'Accept-Version': 'v5.0',
      },
    }
  );

  if (!response.ok) {
    console.warn(
      `[ghost-publisher] GET pós-criação retornou ${response.status} — codeinjection_head não verificado`
    );
    return;
  }

  const data = (await response.json()) as { posts?: Array<{ codeinjection_head?: string }> };
  const head = data.posts?.[0]?.codeinjection_head;
  if (!head || !head.includes('BlogPosting')) {
    console.warn('[ghost-publisher] codeinjection_head não encontrado ou sem BlogPosting no GET pós-criação');
  }
}

// ─── Publisher principal (AC1 + AC2 + AC3 + AC4 + AC5 + AC6) ─────────────────

export async function publishToGhost(post: ContentPost): Promise<void> {
  const ghostApiUrl = process.env['GHOST_API_URL'];
  const ghostAdminApiKey = process.env['GHOST_ADMIN_API_KEY'];

  // AC6 — credenciais via env
  if (!ghostApiUrl || !ghostAdminApiKey) {
    await updateContentPost(post.id, {
      status: 'erro_publicacao',
      errorMsg: 'GHOST_API_URL ou GHOST_ADMIN_API_KEY não configurado',
    });
    return;
  }

  const keyParts = ghostAdminApiKey.split(':');
  if (keyParts.length !== 2 || !keyParts[0] || !keyParts[1]) {
    await updateContentPost(post.id, {
      status: 'erro_publicacao',
      errorMsg: 'GHOST_ADMIN_API_KEY inválida — formato esperado: {id}:{secret}',
    });
    return;
  }

  const [keyId, keySecret] = keyParts;
  const baseUrl = ghostApiUrl.replace(/\/$/, '');

  // AC2 — título + HTML + slug
  const title = post.title ?? '(sem título)';
  const bodyHtml = post.bodyFull
    ? markdownToHtml(post.bodyFull)
    : post.bodyPreview
      ? markdownToHtml(post.bodyPreview)
      : '';

  const now = new Date().toISOString();
  const token = buildJwt(keyId, keySecret);

  // Story 6.3 — AEO expandido: FAQ + wordCount + articleSection
  const faqItems = extractFaqItems(bodyHtml);
  const wordCount = estimateWordCount(bodyHtml);
  const jsonLdOptions: JsonLdOptions = { wordCount, faqItems };
  if (post.topic) jsonLdOptions.articleSection = post.topic;

  const postBody = {
    posts: [
      {
        title,
        status: 'published', // aprovado no Cockpit → publicado diretamente
        html: bodyHtml,
        slug: slugify(title),
        codeinjection_head: buildJsonLd(title, now, jsonLdOptions),
      },
    ],
  };

  // AC1 — POST /ghost/api/admin/posts/?source=html
  let response: Response;
  try {
    response = await ghostFetch(
      `${baseUrl}/ghost/api/admin/posts/?source=html`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Ghost ${token}`,
          'Accept-Version': 'v5.0',
        },
        body: JSON.stringify(postBody),
      }
    );
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError'
      ? 'Timeout ao publicar no Ghost (>10s)'
      : `Falha de rede ao publicar no Ghost: ${String(err)}`;

    // AC5 — erro logado e status atualizado
    console.error(`[ghost-publisher] ${msg}`);
    await updateContentPost(post.id, {
      status: 'erro_publicacao',
      errorMsg: msg,
    });
    return;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => String(response.status));
    const msg = `Ghost API error ${response.status}: ${errText.slice(0, 200)}`;
    console.error(`[ghost-publisher] ${msg}`);
    await updateContentPost(post.id, {
      status: 'erro_publicacao',
      errorMsg: msg,
    });
    return;
  }

  const data = (await response.json()) as { posts: GhostPost[] };
  const ghostPost = data.posts?.[0];

  if (!ghostPost) {
    const msg = 'Ghost API retornou resposta inesperada — sem posts na resposta';
    console.error(`[ghost-publisher] ${msg}`);
    await updateContentPost(post.id, {
      status: 'erro_publicacao',
      errorMsg: msg,
    });
    return;
  }

  // Verificar persistência do codeinjection_head (QA fix 6.1)
  await verifyCodeInjection(baseUrl, buildJwt(keyId, keySecret), ghostPost.id);

  // AC4 — status publicado + link direto ao post
  const blogUrl = ghostPost.url ?? `${baseUrl}/p/${ghostPost.uuid}`;
  await updateContentPost(post.id, {
    status: 'publicado',
    blogUrl,
    publishedAt: new Date(),
  });

  console.log(`[ghost-publisher] Post publicado com sucesso: ${blogUrl}`);
}
