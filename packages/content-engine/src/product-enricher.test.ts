// product-enricher.test.ts — Stories 6.6 + 6.7
// Unit tests with mocked NuvemShop API

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { fetchClientProducts, fetchFirstProductImageUrl } = await import('./product-enricher.js');

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
  mockFetch.mockReset();
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

  it('AC1: busca endpoint correto com per_page=10 e sort_by=updated_at', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => PRODUCTS_FIXTURE });

    await fetchClientProducts();

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('/v1/1447473/products');
    expect(url).toContain('per_page=10');
    expect(url).toContain('sort_by=updated_at');
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
