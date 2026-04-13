// ghost-publisher.test.ts — Story 6.2
// Testes unitários com mock da Ghost API

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ContentPost } from '@sparkle-os/core';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@sparkle-os/core', () => ({
  updateContentPost: vi.fn().mockResolvedValue({}),
}));

// Mock global fetch antes de importar o módulo
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import após mocks (dinâmico para evitar hoisting issues com vi.mock)
const { publishToGhost, slugify, buildJsonLd } = await import('./ghost-publisher.js');
const { updateContentPost } = await import('@sparkle-os/core');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const basePost: ContentPost = {
  id: 'post-123',
  clientId: 'plaka',
  status: 'aprovado',
  topic: 'acessórios para cabelo',
  title: 'Top 5 Acessórios para Cabelo em 2026',
  meta: 'Descubra os melhores acessórios para cabelo da Plaka.',
  bodyPreview: '## Introdução\n\nAcessórios são essenciais...',
  bodyFull: '## Introdução\n\nAcessórios são essenciais para qualquer look.\n\n## Destaques\n\n- Item A\n- Item B',
  imageDesc: null,
  pinCopy: null,
  pinHashtags: null,
  imageDriveUrl: null,
  blogUrl: null,
  pinUrl: null,
  errorMsg: null,
  rejectionNote: null,
  createdAt: '2026-04-13T08:00:00.000Z',
  approvedAt: '2026-04-13T09:00:00.000Z',
  publishedAt: null,
};

const ghostPostResponse = {
  posts: [
    {
      id: 'ghost-post-abc',
      uuid: 'uuid-1234',
      title: 'Top 5 Acessórios para Cabelo em 2026',
      status: 'published',
      url: 'http://187.77.37.88:2368/top-5-acessorios-para-cabelo-em-2026/',
    },
  ],
};

const ghostVerifyResponse = {
  posts: [
    {
      codeinjection_head: '<script type="application/ld+json">\n{"@context":"https://schema.org","@type":"BlogPosting"}\n</script>',
    },
  ],
};

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeErrorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env['GHOST_API_URL'] = 'http://187.77.37.88:2368';
  process.env['GHOST_ADMIN_API_KEY'] = 'abc123def456:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
});

afterEach(() => {
  delete process.env['GHOST_API_URL'];
  delete process.env['GHOST_ADMIN_API_KEY'];
});

// ─── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converte espaços em hífens', () => {
    expect(slugify('Top 5 Acessórios')).toBe('top-5-acessorios');
  });

  it('remove acentos (diacritics)', () => {
    expect(slugify('Ação é Reação')).toBe('acao-e-reacao');
  });

  it('remove caracteres especiais', () => {
    expect(slugify('Título: "O Melhor!"')).toBe('titulo-o-melhor');
  });

  it('colapsa hífens múltiplos', () => {
    expect(slugify('a  -  b')).toBe('a-b');
  });

  it('limita a 100 caracteres', () => {
    const long = 'a'.repeat(120);
    expect(slugify(long).length).toBeLessThanOrEqual(100);
  });
});

// ─── buildJsonLd ──────────────────────────────────────────────────────────────

describe('buildJsonLd', () => {
  it('inclui tipo BlogPosting', () => {
    const ld = buildJsonLd('Meu Post', '2026-04-13T08:00:00.000Z');
    expect(ld).toContain('"@type": "BlogPosting"');
  });

  it('inclui headline correto', () => {
    const ld = buildJsonLd('Meu Post', '2026-04-13T08:00:00.000Z');
    expect(ld).toContain('"headline": "Meu Post"');
  });

  it('inclui inLanguage pt-BR', () => {
    const ld = buildJsonLd('Meu Post', '2026-04-13T08:00:00.000Z');
    expect(ld).toContain('"inLanguage": "pt-BR"');
  });

  it('inclui author Plaka Acessórios', () => {
    const ld = buildJsonLd('Meu Post', '2026-04-13T08:00:00.000Z');
    expect(ld).toContain('Plaka Acessórios');
  });

  it('envolve em script tag application/ld+json', () => {
    const ld = buildJsonLd('Meu Post', '2026-04-13T08:00:00.000Z');
    expect(ld).toMatch(/^<script type="application\/ld\+json">/);
    expect(ld).toMatch(/<\/script>$/);
  });
});

// ─── publishToGhost — env vars ausentes ──────────────────────────────────────

describe('publishToGhost — env vars', () => {
  it('AC6: erro quando GHOST_API_URL ausente', async () => {
    delete process.env['GHOST_API_URL'];
    await publishToGhost(basePost);
    expect(updateContentPost).toHaveBeenCalledWith('post-123', {
      status: 'erro_publicacao',
      errorMsg: expect.stringContaining('GHOST_API_URL'),
    });
  });

  it('AC6: erro quando GHOST_ADMIN_API_KEY ausente', async () => {
    delete process.env['GHOST_ADMIN_API_KEY'];
    await publishToGhost(basePost);
    expect(updateContentPost).toHaveBeenCalledWith('post-123', {
      status: 'erro_publicacao',
      errorMsg: expect.stringContaining('GHOST_ADMIN_API_KEY'),
    });
  });

  it('AC6: erro quando GHOST_ADMIN_API_KEY em formato inválido', async () => {
    process.env['GHOST_ADMIN_API_KEY'] = 'chave-sem-dois-pontos';
    await publishToGhost(basePost);
    expect(updateContentPost).toHaveBeenCalledWith('post-123', {
      status: 'erro_publicacao',
      errorMsg: expect.stringContaining('inválida'),
    });
  });
});

// ─── publishToGhost — sucesso ─────────────────────────────────────────────────

describe('publishToGhost — sucesso', () => {
  it('AC1: faz POST para /ghost/api/admin/posts/?source=html', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))  // POST
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse)); // GET verify

    await publishToGhost(basePost);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/ghost/api/admin/posts/?source=html'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('AC2: envia título, html e slug corretos', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<{ title: string; html: string; slug: string }> };

    expect(body.posts[0]?.title).toBe('Top 5 Acessórios para Cabelo em 2026');
    expect(body.posts[0]?.html).toContain('<h2>Introdução</h2>');
    expect(body.posts[0]?.slug).toBe('top-5-acessorios-para-cabelo-em-2026');
  });

  it('AC3: envia codeinjection_head com JSON-LD BlogPosting', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<{ codeinjection_head: string }> };

    expect(body.posts[0]?.codeinjection_head).toContain('BlogPosting');
    expect(body.posts[0]?.codeinjection_head).toContain('Plaka Acessórios');
  });

  it('AC4: atualiza status para publicado com blogUrl', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost);

    expect(updateContentPost).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'publicado',
      blogUrl: ghostPostResponse.posts[0]!.url,
      publishedAt: expect.any(Date),
    }));
  });

  it('AC4: usa url de fallback com uuid quando url é null', async () => {
    const responseWithNullUrl = {
      posts: [{ ...ghostPostResponse.posts[0], url: null }],
    };

    mockFetch
      .mockResolvedValueOnce(makeOkResponse(responseWithNullUrl))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost);

    expect(updateContentPost).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'publicado',
      blogUrl: expect.stringContaining('/p/uuid-1234'),
    }));
  });

  it('faz GET de verificação pós-criação (QA fix 6.1)', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [getUrl] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(getUrl).toContain('/ghost/api/admin/posts/ghost-post-abc/');
  });

  it('publica mesmo se GET de verificação falhar (non-blocking)', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeErrorResponse(500, 'server error'));

    await publishToGhost(basePost);

    // Publicação deve ter ocorrido mesmo com falha no GET
    expect(updateContentPost).toHaveBeenCalledWith('post-123', expect.objectContaining({
      status: 'publicado',
    }));
  });
});

// ─── publishToGhost — erros ───────────────────────────────────────────────────

describe('publishToGhost — erros', () => {
  it('AC5: status erro_publicacao quando Ghost API retorna erro HTTP', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(422, 'Validation error'));

    await publishToGhost(basePost);

    expect(updateContentPost).toHaveBeenCalledWith('post-123', {
      status: 'erro_publicacao',
      errorMsg: expect.stringContaining('422'),
    });
  });

  it('AC5: status erro_publicacao em falha de rede', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await publishToGhost(basePost);

    expect(updateContentPost).toHaveBeenCalledWith('post-123', {
      status: 'erro_publicacao',
      errorMsg: expect.stringContaining('Falha de rede'),
    });
  });

  it('AC5: status erro_publicacao em timeout (AbortController)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    await publishToGhost(basePost);

    expect(updateContentPost).toHaveBeenCalledWith('post-123', {
      status: 'erro_publicacao',
      errorMsg: expect.stringContaining('Timeout'),
    });
  });

  it('AC5: status erro_publicacao quando resposta não tem posts', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ posts: [] }));

    await publishToGhost(basePost);

    expect(updateContentPost).toHaveBeenCalledWith('post-123', {
      status: 'erro_publicacao',
      errorMsg: expect.stringContaining('sem posts'),
    });
  });

  it('usa Authorization header com prefixo Ghost', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Ghost /);
  });
});

// ─── publishToGhost — body fallback ──────────────────────────────────────────

describe('publishToGhost — bodyFull vs bodyPreview', () => {
  it('usa bodyFull quando disponível', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost({ ...basePost, bodyFull: '## Full\n\nConteúdo completo.', bodyPreview: '## Preview\n\nPreview.' });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<{ html: string }> };
    expect(body.posts[0]?.html).toContain('Conteúdo completo');
    expect(body.posts[0]?.html).not.toContain('Preview');
  });

  it('usa bodyPreview quando bodyFull é null', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost({ ...basePost, bodyFull: null, bodyPreview: '## Preview\n\nConteúdo preview.' });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<{ html: string }> };
    expect(body.posts[0]?.html).toContain('Conteúdo preview');
  });
});
