import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const { mockGetUser, mockGetClientSession } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetClientSession: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('../auth/session.js', () => ({
  getClientSession: mockGetClientSession,
  ClientNotFoundError: class ClientNotFoundError extends Error {
    constructor(msg: string) { super(msg); this.name = 'ClientNotFoundError'; }
  },
}));

import { clientAuthMiddleware } from './client-auth.js';

function buildApp() {
  const app = new Hono();
  app.get('/test', clientAuthMiddleware, (c) =>
    c.json({ tenantId: c.get('tenantId'), tenantName: c.get('tenantName') }),
  );
  return app;
}

describe('clientAuthMiddleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 401 sem Authorization header', async () => {
    const res = await buildApp().request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('retorna 401 com token inválido', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid') });
    const res = await buildApp().request('/test', {
      headers: { Authorization: 'Bearer token-invalido' },
    });
    expect(res.status).toBe(401);
  });

  it('retorna 403 quando usuário não tem tenant vinculado', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-id' } }, error: null });
    const { ClientNotFoundError } = await import('../auth/session.js');
    mockGetClientSession.mockRejectedValueOnce(new ClientNotFoundError('user-id'));
    const res = await buildApp().request('/test', {
      headers: { Authorization: 'Bearer token-valido' },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('injeta tenantId e tenantName na request quando autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-id' } }, error: null });
    mockGetClientSession.mockResolvedValueOnce({ tenantId: 'tenant-A', tenantName: 'Empresa A' });
    const res = await buildApp().request('/test', {
      headers: { Authorization: 'Bearer token-valido' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenantId).toBe('tenant-A');
    expect(body.tenantName).toBe('Empresa A');
  });

  it('tenant A não recebe dados do tenant B — sessões isoladas', async () => {
    mockGetUser
      .mockResolvedValueOnce({ data: { user: { id: 'user-A' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'user-B' } }, error: null });
    mockGetClientSession
      .mockResolvedValueOnce({ tenantId: 'tenant-A', tenantName: 'Empresa A' })
      .mockResolvedValueOnce({ tenantId: 'tenant-B', tenantName: 'Empresa B' });

    const app = buildApp();
    const [resA, resB] = await Promise.all([
      app.request('/test', { headers: { Authorization: 'Bearer token-A' } }),
      app.request('/test', { headers: { Authorization: 'Bearer token-B' } }),
    ]);

    const bodyA = await resA.json();
    const bodyB = await resB.json();
    expect(bodyA.tenantId).not.toBe(bodyB.tenantId);
  });
});
