// product-enricher.test.ts — Stories 6.6 + 6.7 + 6.8
// Unit tests with mocked NuvemShop API and OpenAI client

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock OpenAI antes de importar o módulo
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

const { fetchClientProducts, fetchFirstProductImageUrl, fetchRelevantProductImageUrl, buildSelectionPrompt } = await import('./product-enricher.js');

const PRODUCTS_FIXTURE = [
  {
    name: { pt: 'Choker Illusion Corrente Manu Banhada à Prata', en: null },
    canonical_url: 'https://www.plakaacessorios.com/produtos/choker-illusion/',
    published: true,
    images: [{ src: 'https://d2r9epyceweg5n.cloudfront.net/stores/001/447/473/products/choker-p1.jpg' }],
  },
  {
    name: { pt: 'Colar Gotas Eye Banhado à Prata', en: null },
    canonical_url: 'https://www.plakaacessorios.com/produtos/colar-gotas-eye/',
    published: true,
    images: [{ src: 'https://d2r9epyceweg5n.cloudfront.net/stores/001/447/473/products/colar-p1.jpg' }],
  },
  {
    name: { pt: 'Produto Rascunho', en: null },
    canonical_url: 'https://www.plakaacessorios.com/produtos/rascunho/',
    published: false,
    images: [],
  },
];

beforeEach(() => {
  vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', 'test-token');
  vi.stubEnv('NUVEMSHOP_USER_ID', '1447473');
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
  mockFetch.mockReset();
  mockCreate.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('fetchClientProducts', () => {
  it('AC1: retorna bloco de produtos formatado com URLs reais', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => PRODUCTS_FIXTURE,
    });

    const result = await fetchClientProducts();

    expect(result).toContain('## Produtos da Loja');
    expect(result).toContain('Choker Illusion Corrente Manu Banhada à Prata');
    expect(result).toContain('https://www.plakaacessorios.com/produtos/choker-illusion/');
    expect(result).toContain('Colar Gotas Eye Banhado à Prata');
  });

  it('AC1: busca endpoint correto com per_page=10', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_FIXTURE });

    await fetchClientProducts();

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('/v1/1447473/products');
    expect(url).toContain('per_page=10');
  });

  it('AC4: inclui apenas produtos publicados (filtra published=false)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_FIXTURE });

    const result = await fetchClientProducts();

    expect(result).not.toContain('Produto Rascunho');
  });

  it('AC5: retorna string vazia se NUVEMSHOP_ACCESS_TOKEN não configurado', async () => {
    vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', '');

    const result = await fetchClientProducts();

    expect(result).toBe('');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('AC5: retorna string vazia se NUVEMSHOP_USER_ID não configurado', async () => {
    vi.stubEnv('NUVEMSHOP_USER_ID', '');

    const result = await fetchClientProducts();

    expect(result).toBe('');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('AC5: retorna string vazia se API retornar erro HTTP', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchClientProducts();

    expect(result).toBe('');
  });

  it('AC5: retorna string vazia se fetch lançar exceção (falha de rede)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchClientProducts();

    expect(result).toBe('');
  });

  it('AC5: retorna string vazia se lista de produtos estiver vazia', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    const result = await fetchClientProducts();

    expect(result).toBe('');
  });

  it('usa nome em inglês como fallback quando pt não disponível', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { name: { pt: null, en: 'Gold Choker' }, canonical_url: 'https://plaka.com/p/1', published: true, images: [] },
      ],
    });

    const result = await fetchClientProducts();

    expect(result).toContain('Gold Choker');
  });
});

// ─── fetchFirstProductImageUrl — Story 6.7 ───────────────────────────────────

describe('fetchFirstProductImageUrl', () => {
  it('AC1: retorna URL da imagem do primeiro produto publicado com imagem', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_FIXTURE });

    const result = await fetchFirstProductImageUrl();

    expect(result).toBe('https://d2r9epyceweg5n.cloudfront.net/stores/001/447/473/products/choker-p1.jpg');
  });

  it('retorna null se nenhum produto tiver imagem (AC6 graceful degradation)', async () => {
    const noImages = PRODUCTS_FIXTURE.map((p) => ({ ...p, images: [] }));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => noImages });

    const result = await fetchFirstProductImageUrl();

    expect(result).toBeNull();
  });

  it('retorna null se API falhar com exceção (AC6 graceful degradation)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchFirstProductImageUrl();

    expect(result).toBeNull();
  });

  it('retorna null se API retornar erro HTTP (AC6 graceful degradation)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const result = await fetchFirstProductImageUrl();

    expect(result).toBeNull();
  });

  it('retorna null se env vars não configuradas (AC6 graceful degradation)', async () => {
    vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', '');

    const result = await fetchFirstProductImageUrl();

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('pula produtos não publicados e retorna imagem do primeiro publicado', async () => {
    const products = [
      { name: { pt: 'Rascunho', en: null }, canonical_url: '...', published: false, images: [{ src: 'should-not-return.jpg' }] },
      { name: { pt: 'Publicado', en: null }, canonical_url: '...', published: true, images: [{ src: 'https://cdn.example.com/correct.jpg' }] },
    ];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => products });

    const result = await fetchFirstProductImageUrl();

    expect(result).toBe('https://cdn.example.com/correct.jpg');
  });

  it('retorna null se lista estiver vazia', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    const result = await fetchFirstProductImageUrl();

    expect(result).toBeNull();
  });
});

// ─── buildSelectionPrompt — Story 6.8 ────────────────────────────────────────

describe('buildSelectionPrompt', () => {
  it('gera prompt com título e lista de produtos', () => {
    const result = buildSelectionPrompt('Semi joia na praia', undefined, ['Choker Illusion', 'Colar Gotas Eye']);

    expect(result).toContain('Título do post: Semi joia na praia');
    expect(result).toContain('0: Choker Illusion');
    expect(result).toContain('1: Colar Gotas Eye');
    expect(result).toContain('número inteiro');
  });

  it('inclui linha de tópico quando postTopic fornecido', () => {
    const result = buildSelectionPrompt('Título', 'cuidados', ['Produto A']);

    expect(result).toContain('Tópico: cuidados');
  });

  it('omite linha de tópico quando postTopic undefined', () => {
    const result = buildSelectionPrompt('Título', undefined, ['Produto A']);

    expect(result).not.toContain('Tópico:');
  });
});

// ─── fetchRelevantProductImageUrl — Story 6.8 ────────────────────────────────

describe('fetchRelevantProductImageUrl', () => {
  it('AC1/AC2: seleciona produto relevante via LLM e retorna url + productName', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_FIXTURE });
    // LLM seleciona índice 1 (Colar Gotas Eye)
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '1' } }] });

    const result = await fetchRelevantProductImageUrl('Post sobre colares', 'estilo');

    expect(result).toEqual({
      url: 'https://d2r9epyceweg5n.cloudfront.net/stores/001/447/473/products/colar-p1.jpg',
      productName: 'Colar Gotas Eye Banhado à Prata',
    });
  });

  it('AC5: retorna null se API NuvemShop falhar', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchRelevantProductImageUrl('Post qualquer');

    expect(result).toBeNull();
  });

  it('AC5: retorna null se nenhum produto publicado tiver imagem', async () => {
    const noImages = PRODUCTS_FIXTURE.map((p) => ({ ...p, images: [] }));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => noImages });

    const result = await fetchRelevantProductImageUrl('Post qualquer');

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('AC6: fallback para primeiro produto se LLM retornar índice fora do range', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_FIXTURE });
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '99' } }] });

    const result = await fetchRelevantProductImageUrl('Post qualquer');

    expect(result?.productName).toBe('Choker Illusion Corrente Manu Banhada à Prata');
  });

  it('AC6: fallback para primeiro produto se LLM retornar resposta inválida (NaN)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_FIXTURE });
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'colar' } }] });

    const result = await fetchRelevantProductImageUrl('Post qualquer');

    expect(result?.productName).toBe('Choker Illusion Corrente Manu Banhada à Prata');
  });

  it('AC5: fallback para primeiro produto se LLM lançar exceção', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_FIXTURE });
    mockCreate.mockRejectedValueOnce(new Error('OpenAI timeout'));

    const result = await fetchRelevantProductImageUrl('Post qualquer');

    expect(result?.productName).toBe('Choker Illusion Corrente Manu Banhada à Prata');
  });

  it('AC5: fallback para primeiro produto se OPENAI_API_KEY não configurado', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_FIXTURE });

    const result = await fetchRelevantProductImageUrl('Post qualquer');

    expect(result?.productName).toBe('Choker Illusion Corrente Manu Banhada à Prata');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
