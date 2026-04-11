import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de fetch global e do db client antes dos imports
const { mockFetch, mockDbExecute } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockDbExecute: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

vi.mock('../db/client.js', () => ({
  getDb: vi.fn(() => ({
    execute: mockDbExecute,
  })),
  schema: {},
}));

import { app } from '../index.js';
import { healthConfig } from './health.js';

// Helper para criar Response simulada
function makeResponse(status: number, ok?: boolean): Response {
  return { ok: ok ?? status < 400, status } as Response;
}

describe('GET /health — Testes de Degradação (Story 2.9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Override de URLs para valores de teste (objeto mutável — sem readonly constraint)
    healthConfig.n8nBaseUrl = 'http://n8n-test/api/v1';
    healthConfig.chatwootBaseUrl = 'http://chatwoot-test';
  });

  // Task 4.1 — n8n indisponível
  it('retorna status down quando n8n está indisponível', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('n8n')) {
        throw new Error('Connection refused');
      }
      // Chatwoot up
      return Promise.resolve(makeResponse(200));
    });
    mockDbExecute.mockResolvedValue(undefined);

    const res = await app.request('/health');
    const body = await res.json() as {
      status: string;
      services: { n8n: { status: string }; chatwoot: { status: string }; postgres: { status: string } };
    };

    expect(res.status).toBe(503);
    expect(body.status).toBe('down');
    expect(body.services.n8n.status).toBe('down');
  });

  // Task 4.2 — Chatwoot indisponível
  it('retorna status down quando Chatwoot está indisponível', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('chatwoot')) {
        throw new Error('ECONNREFUSED');
      }
      // n8n up
      return Promise.resolve(makeResponse(200));
    });
    mockDbExecute.mockResolvedValue(undefined);

    const res = await app.request('/health');
    const body = await res.json() as {
      status: string;
      services: { n8n: { status: string }; chatwoot: { status: string } };
    };

    expect(res.status).toBe(503);
    expect(body.status).toBe('down');
    expect(body.services.chatwoot.status).toBe('down');
  });

  // Task 4.3 — Postgres indisponível (n8n + Chatwoot ainda up → degraded)
  it('retorna status degraded quando Postgres está indisponível', async () => {
    mockFetch.mockResolvedValue(makeResponse(200));
    mockDbExecute.mockRejectedValue(new Error('Connection to database failed'));

    const res = await app.request('/health');
    const body = await res.json() as {
      status: string;
      services: { postgres: { status: string; error: string } };
    };

    expect(res.status).toBe(207);
    expect(body.status).toBe('degraded');
    expect(body.services.postgres.status).toBe('down');
    expect(body.services.postgres.error).toBeTruthy();
  });

  // Todos os serviços up → healthy
  it('retorna status healthy quando todos os serviços estão up', async () => {
    mockFetch.mockResolvedValue(makeResponse(200));
    mockDbExecute.mockResolvedValue(undefined);

    const res = await app.request('/health');
    const body = await res.json() as {
      status: string;
      services: {
        n8n: { status: string; latencyMs: number };
        chatwoot: { status: string };
        postgres: { status: string };
      };
      checkedAt: string;
    };

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.services.n8n.status).toBe('up');
    expect(body.services.chatwoot.status).toBe('up');
    expect(body.services.postgres.status).toBe('up');
    expect(body.checkedAt).toBeTruthy();
  });

  // n8n retorna status HTTP não-ok
  it('retorna n8n down quando /healthz retorna HTTP 503', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('n8n')) {
        return Promise.resolve(makeResponse(503, false));
      }
      return Promise.resolve(makeResponse(200));
    });
    mockDbExecute.mockResolvedValue(undefined);

    const res = await app.request('/health');
    const body = await res.json() as { services: { n8n: { status: string; error: string } } };

    expect(body.services.n8n.status).toBe('down');
    expect(body.services.n8n.error).toContain('503');
  });

  // Chatwoot retorna 401 → ainda considerado up (servidor rodando)
  it('considera Chatwoot up quando retorna 401 (credenciais vazias esperadas)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('chatwoot')) {
        return Promise.resolve(makeResponse(401, false));
      }
      return Promise.resolve(makeResponse(200));
    });
    mockDbExecute.mockResolvedValue(undefined);

    const res = await app.request('/health');
    const body = await res.json() as { services: { chatwoot: { status: string } } };

    expect(body.services.chatwoot.status).toBe('up');
  });
});

// Task 4.4 — Erro tipado retornado pelo Adapter (não 500 genérico)
describe('Error handler — erros tipados (AC: 4)', () => {
  it('ZenyaBaseError é serializado com code e statusCode corretos', async () => {
    // Verifica a estrutura dos erros tipados diretamente
    const { ZenyaBaseError } = await import('../errors/index.js');
    const { ZenyaN8nError } = await import('../errors/ZenyaN8nError.js');
    const { ZenyaChatwootError } = await import('../errors/ZenyaChatwootError.js');
    const { ZenyaDatabaseError } = await import('../errors/ZenyaDatabaseError.js');

    const n8nErr = ZenyaN8nError.unavailable(new Error('timeout'));
    expect(n8nErr.code).toBe('N8N_UNAVAILABLE');
    expect(n8nErr.statusCode).toBe(502);
    expect(n8nErr instanceof ZenyaBaseError).toBe(true);
    expect(n8nErr.toJSON()).toMatchObject({ error: 'ZenyaN8nError', code: 'N8N_UNAVAILABLE' });

    const chatwootErr = ZenyaChatwootError.inboxCreateFailed('Teste', new Error('fail'));
    expect(chatwootErr.code).toBe('CHATWOOT_INBOX_CREATE_FAILED');
    expect(chatwootErr.statusCode).toBe(502);
    expect(chatwootErr.context).toMatchObject({ name: 'Teste' });

    const dbErr = ZenyaDatabaseError.unavailable();
    expect(dbErr.code).toBe('DB_UNAVAILABLE');
    expect(dbErr.statusCode).toBe(503);

    const cloneErr = ZenyaN8nError.cloneFailed('wf-123');
    expect(cloneErr.context).toMatchObject({ workflowId: 'wf-123' });
  });

  it('ZenyaDatabaseError.isolationError tem code correto', async () => {
    const { ZenyaDatabaseError } = await import('../errors/ZenyaDatabaseError.js');
    const err = ZenyaDatabaseError.isolationError();
    expect(err.code).toBe('DB_ISOLATION_ERROR');
    expect(err.message).toContain('isolation key');
  });
});
