import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zapiAddLabel, zapiRemoveLabel, type ZApiCredentials } from '../integrations/zapi-labels.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockCreds: ZApiCredentials = {
  instanceId: 'INSTANCE123',
  token: 'TOKEN456',
  clientToken: 'CLIENT789',
  labels: {
    humano: '10',
  },
};

const BASE = 'https://api.z-api.io/instances/INSTANCE123/token/TOKEN456';

beforeEach(() => {
  vi.clearAllMocks();
});

// --- zapiAddLabel ---

describe('zapiAddLabel', () => {
  it('POST correto para tags-add com phone normalizado', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await zapiAddLabel('+5531999998888', '10', mockCreds);

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/tags-add`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phone: '5531999998888', tag: '10' }),
      }),
    );
  });

  it('normaliza phone sem + também (idempotente)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await zapiAddLabel('5531999998888', '10', mockCreds);

    const call = mockFetch.mock.calls[0]!;
    const body = JSON.parse((call[1] as { body: string }).body) as { phone: string };
    expect(body.phone).toBe('5531999998888');
  });

  it('lança erro quando API retorna status não-OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as Response);

    await expect(zapiAddLabel('+5531999998888', '10', mockCreds)).rejects.toThrow(
      'Z-API tags-add failed (403)',
    );
  });

  it('envia client-token no header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await zapiAddLabel('+5531999998888', '10', mockCreds);

    const headers = (mockFetch.mock.calls[0]![1] as { headers: Record<string, string> }).headers;
    expect(headers['client-token']).toBe('CLIENT789');
  });
});

// --- zapiRemoveLabel ---

describe('zapiRemoveLabel', () => {
  it('POST correto para tags-remove com phone normalizado', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await zapiRemoveLabel('+5531999998888', '10', mockCreds);

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/tags-remove`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phone: '5531999998888', tag: '10' }),
      }),
    );
  });

  it('lança erro quando API retorna status não-OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response);

    await expect(zapiRemoveLabel('+5531999998888', '10', mockCreds)).rejects.toThrow(
      'Z-API tags-remove failed (500)',
    );
  });
});

// --- Graceful degradation: tenant sem labels configurado ---

describe('graceful degradation', () => {
  it('credenciais sem labels não chamam Z-API (verificado pelo chamador)', () => {
    // ZApiCredentials sem labels é válido — a ausência de labels.humano
    // é verificada pelo chamador (tool-factory / cleanup) antes de invocar as funções.
    // Este teste confirma que o tipo permite omissão do campo.
    const credsWithoutLabels: ZApiCredentials = {
      instanceId: 'X',
      token: 'Y',
      clientToken: 'Z',
      // labels ausente
    };
    expect(credsWithoutLabels.labels).toBeUndefined();
    expect(credsWithoutLabels.labels?.humano).toBeUndefined();
  });
});
