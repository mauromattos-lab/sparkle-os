import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCredentialJson = vi.fn();
vi.mock('../tenant/credentials.js', () => ({
  getCredentialJson: (...args: unknown[]) => mockGetCredentialJson(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { createNuvemshopTools, __resetCacheForTests } from '../integrations/nuvemshop.js';

const TENANT_ID = 'tenant-plaka';

function mkPedido(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 1001,
    number: 1234,
    status: 'open',
    payment_status: 'paid',
    shipping_status: 'shipped',
    shipping_tracking_number: 'AB123456789BR',
    shipping_tracking_url: 'https://correios.com.br/track/AB123456789BR',
    customer: { name: 'Maria Teste' },
    products: [
      { name: 'Colar Prata Anatomy', quantity: 1 },
      { name: 'Brinco Argola Mini', quantity: 2 },
    ],
    total: '249.90',
    created_at: '2026-04-15T14:30:00Z',
    ...overrides,
  };
}

function mkResponse(body: unknown, ok = true, status = 200, headers: Record<string, string> = {}): unknown {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'ERR',
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

type BuscarPedidoArgs = { numero: string };
type BuscarPedidoResult = {
  encontrado: boolean;
  mensagem?: string;
  numero?: number;
  pagamento?: string;
  envio?: string;
  rastreio?: string | null;
  erro?: boolean;
  cliente?: string | null;
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetCacheForTests();
  mockGetCredentialJson.mockResolvedValue({
    access_token: 'test-token',
    store_id: '42',
    user_agent: 'SparkleOS Zenya (contato@sparkleai.tech)',
  });
});

describe('createNuvemshopTools — buscarPedidoNuvemshop', () => {
  it('retorna pedido com formatação amigável em português', async () => {
    mockFetch.mockResolvedValue(mkResponse([mkPedido()]));

    const tools = createNuvemshopTools(TENANT_ID);
    const exec = tools.buscarPedidoNuvemshop!.execute as (
      a: BuscarPedidoArgs,
    ) => Promise<BuscarPedidoResult>;
    const result = await exec({ numero: '1234' });

    expect(result.encontrado).toBe(true);
    expect(result.numero).toBe(1234);
    expect(result.pagamento).toBe('pago');
    expect(result.envio).toBe('enviado');
    expect(result.rastreio).toBe('AB123456789BR');
  });

  it('usa header Authentication: bearer (minúsculo), exigido pela API Nuvemshop', async () => {
    mockFetch.mockResolvedValue(mkResponse([mkPedido()]));

    const tools = createNuvemshopTools(TENANT_ID);
    const exec = tools.buscarPedidoNuvemshop!.execute as (a: BuscarPedidoArgs) => Promise<unknown>;
    await exec({ numero: '1234' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0]!;
    expect(call[0]).toContain('/v1/42/orders?q=1234');
    expect(call[1].headers.Authentication).toBe('bearer test-token');
    expect(call[1].headers['User-Agent']).toContain('SparkleOS');
  });

  it('normaliza número extraindo só dígitos ("#1234" e "pedido 1234")', async () => {
    mockFetch.mockResolvedValue(mkResponse([mkPedido()]));

    const tools = createNuvemshopTools(TENANT_ID);
    const exec = tools.buscarPedidoNuvemshop!.execute as (a: BuscarPedidoArgs) => Promise<unknown>;

    await exec({ numero: '#1234' });
    __resetCacheForTests();
    await exec({ numero: 'pedido 1234' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    for (const call of mockFetch.mock.calls) {
      expect(call[0]).toContain('q=1234');
    }
  });

  it('retorna encontrado=false com mensagem amigável quando pedido não existe (EC-1)', async () => {
    mockFetch.mockResolvedValue(mkResponse([], true, 200));

    const tools = createNuvemshopTools(TENANT_ID);
    const exec = tools.buscarPedidoNuvemshop!.execute as (
      a: BuscarPedidoArgs,
    ) => Promise<BuscarPedidoResult>;
    const result = await exec({ numero: '9999' });

    expect(result.encontrado).toBe(false);
    expect(result.mensagem).toContain('Não encontrei');
    expect(result.erro).toBeUndefined();
  });

  it('trata 404 explicitamente como "não encontrado"', async () => {
    mockFetch.mockResolvedValue(mkResponse('not found', false, 404));

    const tools = createNuvemshopTools(TENANT_ID);
    const exec = tools.buscarPedidoNuvemshop!.execute as (
      a: BuscarPedidoArgs,
    ) => Promise<BuscarPedidoResult>;
    const result = await exec({ numero: '9999' });

    expect(result.encontrado).toBe(false);
    expect(result.erro).toBeUndefined();
  });

  it('degrada graciosamente em erro de API (não lança exception, retorna erro=true + mensagem)', async () => {
    mockFetch.mockResolvedValue(mkResponse('internal error', false, 500));

    const tools = createNuvemshopTools(TENANT_ID);
    const exec = tools.buscarPedidoNuvemshop!.execute as (
      a: BuscarPedidoArgs,
    ) => Promise<BuscarPedidoResult>;
    const result = await exec({ numero: '1234' });

    expect(result.encontrado).toBe(false);
    expect(result.erro).toBe(true);
    expect(result.mensagem).toContain('problema técnico');
  });

  it('rejeita entrada sem dígitos extraíveis (não chama a API)', async () => {
    const tools = createNuvemshopTools(TENANT_ID);
    const exec = tools.buscarPedidoNuvemshop!.execute as (
      a: BuscarPedidoArgs,
    ) => Promise<BuscarPedidoResult>;
    const result = await exec({ numero: 'não sei' });

    expect(result.encontrado).toBe(false);
    expect(result.mensagem).toContain('número de pedido');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('prefere match exato quando API retorna múltiplos resultados fuzzy', async () => {
    mockFetch.mockResolvedValue(
      mkResponse([
        mkPedido({ number: 12345, customer: { name: 'Outro' } }),
        mkPedido({ number: 1234, customer: { name: 'Correto' } }),
      ]),
    );

    const tools = createNuvemshopTools(TENANT_ID);
    const exec = tools.buscarPedidoNuvemshop!.execute as (
      a: BuscarPedidoArgs,
    ) => Promise<BuscarPedidoResult>;
    const result = await exec({ numero: '1234' });

    expect(result.encontrado).toBe(true);
    expect(result.numero).toBe(1234);
    expect(result.cliente).toBe('Correto');
  });

  it('formata envio como "ainda não enviado" quando shipping_status é null', async () => {
    mockFetch.mockResolvedValue(
      mkResponse([mkPedido({ shipping_status: null, shipping_tracking_number: null })]),
    );

    const tools = createNuvemshopTools(TENANT_ID);
    const exec = tools.buscarPedidoNuvemshop!.execute as (
      a: BuscarPedidoArgs,
    ) => Promise<BuscarPedidoResult>;
    const result = await exec({ numero: '1234' });

    expect(result.envio).toBe('ainda não enviado');
    expect(result.rastreio).toBeNull();
  });
});
