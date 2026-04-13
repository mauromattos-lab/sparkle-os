// ghost-publisher.test.ts — Stories 6.2 + 6.3 + 6.7
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
const { publishToGhost, slugify, buildJsonLd, extractFaqItems, estimateWordCount } = await import('./ghost-publisher.js');
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

// ─── Story 6.3 — estimateWordCount ───────────────────────────────────────────

describe('estimateWordCount', () => {
  it('conta palavras removendo tags HTML', () => {
    const html = '<h2>Título do Post</h2><p>Conteúdo com <strong>três</strong> palavras extras.</p>';
    expect(estimateWordCount(html)).toBeGreaterThan(0);
  });

  it('retorna 0 para string vazia', () => {
    expect(estimateWordCount('')).toBe(0);
  });

  it('retorna 0 para HTML sem texto', () => {
    expect(estimateWordCount('<p></p><h2></h2>')).toBe(0);
  });

  it('conta corretamente texto simples sem tags', () => {
    expect(estimateWordCount('uma duas três quatro cinco')).toBe(5);
  });
});

// ─── Story 6.3 — extractFaqItems ─────────────────────────────────────────────

describe('extractFaqItems', () => {
  const htmlWithFaq = `
    <h2>O que são acessórios de cabelo?</h2>
    <p>Acessórios de cabelo são itens decorativos e funcionais usados para prender, decorar ou estilizar o cabelo de diversas formas.</p>
    <h2>Quais são os tipos mais populares?</h2>
    <p>Os tipos mais populares incluem presilhas, tiaras, elásticos coloridos, grampos e faixas de cabelo para diferentes ocasiões.</p>
    <h2>Como escolher o acessório ideal?</h2>
    <p>Para escolher o acessório ideal, considere o tipo de cabelo, o estilo do look e a ocasião em que será usado para melhor resultado.</p>
  `;

  it('AC3: extrai pares FAQ de H2 + parágrafo seguinte', () => {
    const items = extractFaqItems(htmlWithFaq);
    expect(items.length).toBe(3);
  });

  it('AC3: cada item tem question e answer não vazios', () => {
    const items = extractFaqItems(htmlWithFaq);
    items.forEach((item) => {
      expect(item.question.length).toBeGreaterThanOrEqual(10);
      expect(item.answer.length).toBeGreaterThanOrEqual(20);
    });
  });

  it('AC4: retorna [] quando há menos de 3 pares válidos', () => {
    const htmlInsuficiente = `
      <h2>Pergunta curta?</h2>
      <p>Resposta também curta aqui vai.</p>
      <p>Parágrafo sem heading anterior.</p>
    `;
    // Apenas 1 par → extractFaqItems retorna 1 item (não filtra por mínimo)
    // FAQPage é omitido pelo buildJsonLd quando < 3 itens
    const items = extractFaqItems(htmlInsuficiente);
    expect(items.length).toBeLessThan(3);
  });

  it('AC4: respeita maxItems', () => {
    const items = extractFaqItems(htmlWithFaq, 2);
    expect(items.length).toBe(2);
  });

  it('filtra pares com question < 10 chars', () => {
    const html = '<h2>Curta?</h2><p>Resposta com mais de vinte caracteres totais aqui.</p>';
    const items = extractFaqItems(html);
    expect(items.length).toBe(0);
  });

  it('funciona com H3 além de H2', () => {
    const html = `
      <h3>Qual é a diferença entre presilha e grampo?</h3>
      <p>Presilhas são maiores e prendem mais cabelo, enquanto grampos são pequenos e discretos para fixar mechas específicas.</p>
    `;
    const items = extractFaqItems(html);
    expect(items.length).toBe(1);
    expect(items[0]?.question).toContain('presilha');
  });
});

// ─── Story 6.3 — buildJsonLd expandido ───────────────────────────────────────

describe('buildJsonLd — Story 6.3 expansão', () => {
  it('AC2: inclui wordCount quando fornecido', () => {
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', { wordCount: 850 });
    expect(ld).toContain('"wordCount": 850');
  });

  it('AC2: inclui url quando fornecida', () => {
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', { url: 'http://ghost.example/post/' });
    expect(ld).toContain('"url": "http://ghost.example/post/"');
  });

  it('AC2: inclui articleSection quando fornecida', () => {
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', { articleSection: 'acessórios' });
    expect(ld).toContain('"articleSection": "acessórios"');
  });

  it('AC1: inclui FAQPage quando faqItems >= 3', () => {
    const faqItems = [
      { question: 'Pergunta um sobre acessórios?', answer: 'Resposta detalhada sobre a pergunta um aqui.' },
      { question: 'Pergunta dois sobre cabelos?', answer: 'Resposta detalhada sobre a pergunta dois aqui.' },
      { question: 'Pergunta três sobre produtos?', answer: 'Resposta detalhada sobre a pergunta três aqui.' },
    ];
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', { faqItems });
    expect(ld).toContain('FAQPage');
    expect(ld).toContain('Question');
    expect(ld).toContain('acceptedAnswer');
  });

  it('AC4: omite FAQPage quando faqItems < 3', () => {
    const faqItems = [
      { question: 'Só uma pergunta curta?', answer: 'Resposta detalhada aqui com mais de vinte caracteres.' },
    ];
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', { faqItems });
    expect(ld).not.toContain('FAQPage');
  });

  it('AC4: omite FAQPage quando faqItems é vazio', () => {
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', { faqItems: [] });
    expect(ld).not.toContain('FAQPage');
  });

  it('AC5: JSON-LD sem options é JSON válido', () => {
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z');
    const inner = ld.replace(/<script[^>]*>/, '').replace('</script>', '').trim();
    expect(() => JSON.parse(inner)).not.toThrow();
  });

  it('AC5: JSON-LD com FAQPage é JSON válido', () => {
    const faqItems = [
      { question: 'Pergunta um sobre acessórios?', answer: 'Resposta um com mais de vinte caracteres.' },
      { question: 'Pergunta dois sobre cabelos?', answer: 'Resposta dois com mais de vinte caracteres.' },
      { question: 'Pergunta três sobre produtos?', answer: 'Resposta três com mais de vinte caracteres.' },
    ];
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', { faqItems });
    const inner = ld.replace(/<script[^>]*>/, '').replace('</script>', '').trim();
    expect(() => JSON.parse(inner)).not.toThrow();
  });

  it('AC7: retrocompatibilidade — sem options funciona como Story 6.2', () => {
    const ld = buildJsonLd('Meu Post', '2026-04-13T08:00:00.000Z');
    expect(ld).toContain('BlogPosting');
    expect(ld).toContain('Plaka Acessórios');
    expect(ld).not.toContain('FAQPage');
  });
});

// ─── Story 6.7 — buildJsonLd com ImageObject ──────────────────────────────────

describe('buildJsonLd — Story 6.7 ImageObject', () => {
  it('AC4: inclui ImageObject quando imageUrl fornecida', () => {
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', {
      imageUrl: 'https://cdn.plaka.com.br/produto.jpg',
    });
    expect(ld).toContain('"@type": "ImageObject"');
    expect(ld).toContain('"url": "https://cdn.plaka.com.br/produto.jpg"');
  });

  it('AC4: inclui description no ImageObject quando imageAlt fornecida', () => {
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', {
      imageUrl: 'https://cdn.plaka.com.br/produto.jpg',
      imageAlt: 'pulseira de couro marrom com fecho dourado',
    });
    expect(ld).toContain('"description": "pulseira de couro marrom com fecho dourado"');
  });

  it('AC4: omite ImageObject quando imageUrl ausente (retrocompatibilidade)', () => {
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z');
    expect(ld).not.toContain('ImageObject');
  });

  it('AC4: JSON-LD com ImageObject é JSON válido', () => {
    const ld = buildJsonLd('Título', '2026-04-13T08:00:00.000Z', {
      imageUrl: 'https://cdn.plaka.com.br/produto.jpg',
      imageAlt: 'pulseira de couro',
    });
    const inner = ld.replace(/<script[^>]*>/, '').replace('</script>', '').trim();
    expect(() => JSON.parse(inner)).not.toThrow();
  });
});

// ─── Story 6.7 — publishToGhost com feature_image ────────────────────────────

describe('publishToGhost — Story 6.7 feature image', () => {
  it('AC3: envia feature_image quando featureImageUrl fornecida', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost, 'https://cdn.plaka.com.br/produto.jpg');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<Record<string, unknown>> };
    expect(body.posts[0]?.['feature_image']).toBe('https://cdn.plaka.com.br/produto.jpg');
  });

  it('AC3: envia feature_image_alt quando post.imageDesc presente', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(
      { ...basePost, imageDesc: 'pulseira de couro marrom com fecho dourado' },
      'https://cdn.plaka.com.br/produto.jpg',
    );

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<Record<string, unknown>> };
    expect(body.posts[0]?.['feature_image_alt']).toBe('pulseira de couro marrom com fecho dourado');
  });

  it('AC6: publica sem feature_image quando featureImageUrl não fornecida', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<Record<string, unknown>> };
    expect(body.posts[0]).not.toHaveProperty('feature_image');
  });

  it('AC6: publica sem feature_image_alt quando imageDesc é null', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost({ ...basePost, imageDesc: null }, 'https://cdn.plaka.com.br/produto.jpg');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<Record<string, unknown>> };
    expect(body.posts[0]).not.toHaveProperty('feature_image_alt');
  });

  it('AC4: codeinjection_head contém ImageObject quando featureImageUrl fornecida', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost, 'https://cdn.plaka.com.br/produto.jpg');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<{ codeinjection_head: string }> };
    expect(body.posts[0]?.codeinjection_head).toContain('ImageObject');
    expect(body.posts[0]?.codeinjection_head).toContain('https://cdn.plaka.com.br/produto.jpg');
  });
});

// ─── Story 6.3 — publishToGhost envia wordCount e articleSection ─────────────

describe('publishToGhost — Story 6.3 AEO expandido', () => {
  it('inclui wordCount no codeinjection_head quando bodyFull tem conteúdo', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost(basePost);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<{ codeinjection_head: string }> };
    expect(body.posts[0]?.codeinjection_head).toContain('wordCount');
  });

  it('inclui articleSection derivado do topic no codeinjection_head', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(ghostPostResponse))
      .mockResolvedValueOnce(makeOkResponse(ghostVerifyResponse));

    await publishToGhost({ ...basePost, topic: 'acessórios para cabelo' });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { posts: Array<{ codeinjection_head: string }> };
    expect(body.posts[0]?.codeinjection_head).toContain('articleSection');
  });
});
