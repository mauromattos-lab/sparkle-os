// Ghost Publisher — Story 6.2
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

// ─── JSON-LD Schema BlogPosting (AC3) ─────────────────────────────────────────

export function buildJsonLd(title: string, datePublished: string): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    author: { '@type': 'Organization', name: 'Plaka Acessórios' },
    publisher: { '@type': 'Organization', name: 'Plaka Acessórios' },
    datePublished,
    inLanguage: 'pt-BR',
  };

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
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

  const postBody = {
    posts: [
      {
        title,
        status: 'published', // aprovado no Cockpit → publicado diretamente
        html: bodyHtml,
        slug: slugify(title),
        codeinjection_head: buildJsonLd(title, now), // AC3 — JSON-LD BlogPosting
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
