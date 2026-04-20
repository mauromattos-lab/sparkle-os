import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const { mockExecute, mockGetUser, mockGetClientSession } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetClientSession: vi.fn(),
}));

vi.mock('../db/client.js', () => ({
  getDb: vi.fn(() => ({ execute: mockExecute })),
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

import { cockpitRouter } from './cockpit.js';

const app = new Hono();
app.route('/cockpit', cockpitRouter);

const authHeaders = { Authorization: 'Bearer valid-token' };

function setupAuth(tenantId = 'tenant-A') {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null });
  mockGetClientSession.mockResolvedValue({ tenantId, tenantName: 'Empresa A' });
}

describe('GET /cockpit/conversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 401 sem token', async () => {
    const res = await app.request('/cockpit/conversations');
    expect(res.status).toBe(401);
  });

  it('retorna lista paginada de conversas do tenant', async () => {
    setupAuth('tenant-A');
    mockExecute.mockResolvedValueOnce([
      { id: 'conv-1', phone_number: '+55119999', role: 'user', content: 'oi', created_at: '2026-04-20' },
    ]);
    const res = await app.request('/cockpit/conversations?limit=10&offset=0', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it('limita a 100 mesmo que limite maior seja pedido', async () => {
    setupAuth();
    mockExecute.mockResolvedValueOnce([]);
    const res = await app.request('/cockpit/conversations?limit=999', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(100);
  });

  it('tenant A não vê conversas do tenant B', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null });

    mockGetClientSession.mockResolvedValueOnce({ tenantId: 'tenant-A', tenantName: 'A' });
    mockExecute.mockResolvedValueOnce([{ id: 'conv-A', phone_number: '+551', role: 'user', content: 'A', created_at: '' }]);
    const resA = await app.request('/cockpit/conversations', { headers: authHeaders });

    mockGetClientSession.mockResolvedValueOnce({ tenantId: 'tenant-B', tenantName: 'B' });
    mockExecute.mockResolvedValueOnce([{ id: 'conv-B', phone_number: '+552', role: 'user', content: 'B', created_at: '' }]);
    const resB = await app.request('/cockpit/conversations', { headers: authHeaders });

    const bodyA = await resA.json();
    const bodyB = await resB.json();
    const idsA = bodyA.data.map((r: { id: string }) => r.id);
    const idsB = bodyB.data.map((r: { id: string }) => r.id);
    expect(idsA.some((id: string) => idsB.includes(id))).toBe(false);
  });
});

describe('GET /cockpit/metrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 401 sem token', async () => {
    const res = await app.request('/cockpit/metrics');
    expect(res.status).toBe(401);
  });

  it('retorna totais de conversas e status do sistema', async () => {
    setupAuth();
    mockExecute
      .mockResolvedValueOnce([{ count: '42' }])
      .mockResolvedValueOnce([{ count: '5' }]);
    const res = await app.request('/cockpit/metrics', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalConversations).toBe(42);
    expect(body.conversationsToday).toBe(5);
    expect(body.systemStatus).toBe('active');
  });
});
