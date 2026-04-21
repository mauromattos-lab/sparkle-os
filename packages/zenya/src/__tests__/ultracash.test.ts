import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (hoisted before imports) ---

const mockGetCredentialJson = vi.fn();
vi.mock('../tenant/credentials.js', () => ({
  getCredentialJson: (...args: unknown[]) => mockGetCredentialJson(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { createUltracashTools } from '../integrations/ultracash.js';

const TENANT_ID = 'tenant-hl';

function mkProduto(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id_produto: 19,
    descricao: 'IPHONE 15 PRO 256GB NATURAL',
    imagem: '',
    aplicacao: '',
    preco_venda: 7500,
    preco2: 0,
    preco3: 0,
    estoque: 2,
    status: 1,
    custo_medio: 5000,
    preco_compra: 5000,
    validade: '',
    ...overrides,
  };
}

function mkResponse(body: unknown, ok = true, status = 200): unknown {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'ERR',
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCredentialJson.mockResolvedValue({ api_key: 'test-key', filial: 1 });
});

describe('createUltracashTools — Buscar_produto', () => {
  it('retorna apenas produtos com estoque > 0 e status = 1', async () => {
    mockFetch.mockResolvedValue(
      mkResponse([
        mkProduto({ descricao: 'IPHONE 15 PRO 256GB NATURAL', estoque: 2 }),
        mkProduto({ descricao: 'IPHONE 15 PRO 256GB AZUL', estoque: 0 }),
        mkProduto({ descricao: 'IPHONE 15 PRO 128GB INATIVO', estoque: 5, status: 0 }),
      ]),
    );

    const tools = createUltracashTools(TENANT_ID);
    const result = (await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<{
      encontrou: boolean;
      resultado: string;
    }>)({ termo: 'IPHONE' })) as { encontrou: boolean; resultado: string };

    expect(result.encontrou).toBe(true);
    expect(result.resultado).toContain('NATURAL');
    expect(result.resultado).not.toContain('AZUL'); // estoque=0
    expect(result.resultado).not.toContain('INATIVO'); // status=0
  });

  it('NUNCA expõe custo_medio nem preco_compra no resultado', async () => {
    mockFetch.mockResolvedValue(
      mkResponse([mkProduto({ preco_venda: 7500, custo_medio: 5000, preco_compra: 4800 })]),
    );

    const tools = createUltracashTools(TENANT_ID);
    const result = (await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<{
      resultado: string;
    }>)({ termo: 'IPHONE' })) as { resultado: string };

    expect(result.resultado).not.toContain('5000');
    expect(result.resultado).not.toContain('4800');
    expect(result.resultado).not.toMatch(/custo/i);
    expect(result.resultado).not.toMatch(/compra/i);
    expect(result.resultado).toContain('R$ 7.500');
  });

  it('envia header x-api-key e Accept-Encoding', async () => {
    mockFetch.mockResolvedValue(mkResponse([]));

    const tools = createUltracashTools(TENANT_ID);
    await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<unknown>)({
      termo: 'iphone',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('apihl.ultracash.com.br/produtos');
    expect(url).toContain('filial=1');
    expect(url).toContain('descricao=IPHONE'); // upper-cased
    const headers = opts.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['Accept-Encoding']).toContain('gzip');
  });

  it('usa filial da credential quando fornecida', async () => {
    mockGetCredentialJson.mockResolvedValue({ api_key: 'k', filial: 7 });
    mockFetch.mockResolvedValue(mkResponse([]));

    const tools = createUltracashTools(TENANT_ID);
    await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<unknown>)({
      termo: 'teste',
    });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('filial=7');
  });

  it('retorna mensagem gentil quando há ativos mas nenhum com estoque', async () => {
    mockFetch.mockResolvedValue(
      mkResponse([
        mkProduto({ estoque: 0 }),
        mkProduto({ estoque: 0, descricao: 'IPHONE 14' }),
      ]),
    );

    const tools = createUltracashTools(TENANT_ID);
    const result = (await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<{
      encontrou: boolean;
      resultado: string;
    }>)({ termo: 'IPHONE' })) as { encontrou: boolean; resultado: string };

    expect(result.encontrou).toBe(false);
    expect(result.resultado).toMatch(/estoque disponível|sem estoque/i);
  });

  it('retorna "Nenhum produto encontrado" quando a API retorna array vazio', async () => {
    mockFetch.mockResolvedValue(mkResponse([]));

    const tools = createUltracashTools(TENANT_ID);
    const result = (await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<{
      encontrou: boolean;
      resultado: string;
    }>)({ termo: 'XPTO' })) as { encontrou: boolean; resultado: string };

    expect(result.encontrou).toBe(false);
    expect(result.resultado).toContain('Nenhum produto encontrado');
  });

  it('retorna mensagem gentil quando a API falha com 5xx', async () => {
    mockFetch.mockResolvedValue(mkResponse(null, false, 502));

    const tools = createUltracashTools(TENANT_ID);
    const result = (await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<{
      encontrou: boolean;
      resultado: string;
    }>)({ termo: 'IPHONE' })) as { encontrou: boolean; resultado: string };

    expect(result.encontrou).toBe(false);
    expect(result.resultado).toMatch(/não foi possível|alguns instantes/i);
  });

  it('retorna mensagem dedicada quando o tenant não tem credencial configurada', async () => {
    mockGetCredentialJson.mockRejectedValue(new Error('No credential found'));

    const tools = createUltracashTools(TENANT_ID);
    const result = (await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<{
      encontrou: boolean;
      resultado: string;
    }>)({ termo: 'IPHONE' })) as { encontrou: boolean; resultado: string };

    expect(result.encontrou).toBe(false);
    expect(result.resultado).toMatch(/indisponível/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('limita a 12 resultados mesmo quando há mais disponíveis', async () => {
    const produtos = Array.from({ length: 20 }, (_, i) =>
      mkProduto({ id_produto: i, descricao: `IPHONE ${i}`, estoque: 1 }),
    );
    mockFetch.mockResolvedValue(mkResponse(produtos));

    const tools = createUltracashTools(TENANT_ID);
    const result = (await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<{
      resultado: string;
    }>)({ termo: 'IPHONE' })) as { resultado: string };

    const linhas = result.resultado.split('\n');
    expect(linhas.length).toBe(12);
  });

  it('formata preço em reais com separador de milhar pt-BR', async () => {
    mockFetch.mockResolvedValue(mkResponse([mkProduto({ preco_venda: 13000, estoque: 1 })]));

    const tools = createUltracashTools(TENANT_ID);
    const result = (await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<{
      resultado: string;
    }>)({ termo: 'MACBOOK' })) as { resultado: string };

    expect(result.resultado).toContain('R$ 13.000');
  });

  it('retorna "Preço sob consulta" quando preco_venda é 0', async () => {
    mockFetch.mockResolvedValue(mkResponse([mkProduto({ preco_venda: 0, estoque: 1 })]));

    const tools = createUltracashTools(TENANT_ID);
    const result = (await (tools.Buscar_produto!.execute as (args: { termo: string }) => Promise<{
      resultado: string;
    }>)({ termo: 'IPHONE' })) as { resultado: string };

    expect(result.resultado).toContain('Preço sob consulta');
  });
});
