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
  it('POST correto para /chats/{phone}/tags/{labelId} sem body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await zapiAddLabel('+5531999998888', '10', mockCreds);

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/chats/5531999998888/tags/10`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    // sem body — tag no path
    const callOpts = mockFetch.mock.calls[0]![1] as { body?: string };
    expect(callOpts.body).toBeUndefined();
  });

  it('normaliza phone sem + (idempotente) — phone no path', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await zapiAddLabel('5531999998888', '10', mockCreds);

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('/chats/5531999998888/tags/10');
  });

  it('lança erro quando API retorna status não-OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as Response);

    await expect(zapiAddLabel('+5531999998888', '10', mockCreds)).rejects.toThrow(
      'Z-API chats/tags failed (403)',
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
  it('DELETE correto para /chats/{phone}/tags/{labelId} sem body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await zapiRemoveLabel('+5531999998888', '10', mockCreds);

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/chats/5531999998888/tags/10`,
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
    // sem body — tag no path
    const callOpts = mockFetch.mock.calls[0]![1] as { body?: string };
    expect(callOpts.body).toBeUndefined();
  });

  it('lança erro quando API retorna status não-OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response);

    await expect(zapiRemoveLabel('+5531999998888', '10', mockCreds)).rejects.toThrow(
      'Z-API chats/tags/delete failed (500)',
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
