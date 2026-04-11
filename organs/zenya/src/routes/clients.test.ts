import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock factories declaradas antes dos imports para garantir hoisting correto
const {
  mockCloneWorkflow,
  mockDeleteWorkflow,
  mockCreateInbox,
  mockDeleteInbox,
  mockInsertReturning,
  mockOrderBy,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockOrderBy = vi.fn();
  return {
    mockCloneWorkflow: vi.fn(),
    mockDeleteWorkflow: vi.fn(),
    mockCreateInbox: vi.fn(),
    mockDeleteInbox: vi.fn(),
    mockInsertReturning,
    mockOrderBy,
  };
});

vi.mock('../n8n/client.js', () => ({
  ZenyaN8nClient: vi.fn(() => ({
    cloneWorkflow: mockCloneWorkflow,
    deleteWorkflow: mockDeleteWorkflow,
  })),
}));

vi.mock('../chatwoot/client.js', () => ({
  ZenyaChatwootClient: vi.fn(() => ({
    createInbox: mockCreateInbox,
    deleteInbox: mockDeleteInbox,
  })),
}));

vi.mock('../db/client.js', () => ({
  getDb: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockInsertReturning,
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: mockOrderBy,
      })),
    })),
  })),
  schema: {
    zenyaClients: {
      provisionedAt: 'provisioned_at',
    },
  },
}));

import { app } from '../index.js';

const mockClientRow = {
  id: 'uuid-client-1',
  name: 'Acme Corp',
  whatsappNumber: '+5511999999999',
  n8nWorkflowIds: ['cloned-workflow-id'],
  chatwootInboxId: 42,
  status: 'active',
  dataIsolationKey: 'isolation-key-uuid',
  provisionedAt: new Date('2026-04-11T00:00:00.000Z'),
  provisionedBy: 'agent',
  metadata: {},
  externalId: null,
};

describe('POST /clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: provisiona cliente e retorna 201', async () => {
    mockCloneWorkflow.mockResolvedValueOnce({ id: 'cloned-workflow-id', name: 'Acme Corp - Secretária v3' });
    mockCreateInbox.mockResolvedValueOnce({ id: 42, name: 'Acme Corp', channel_type: 'Channel::Api' });
    mockInsertReturning.mockResolvedValueOnce([mockClientRow]);

    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Corp', whatsappNumber: '+5511999999999' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body['id']).toBe('uuid-client-1');
    expect(body['dataIsolationKey']).toBe('isolation-key-uuid');
    expect(body['n8nWorkflowIds']).toEqual(['cloned-workflow-id']);
    expect(body['chatwootInboxId']).toBe(42);
  });

  it('retorna 400 quando name está ausente', async () => {
    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsappNumber: '+5511999999999' }),
    });

    expect(res.status).toBe(400);
  });

  it('n8n falha: retorna 500 sem compensação (nada criado)', async () => {
    mockCloneWorkflow.mockRejectedValueOnce(new Error('n8n API error fetching template: 503 Service Unavailable'));

    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Corp', whatsappNumber: '+5511999999999' }),
    });

    expect(res.status).toBe(500);
    expect(mockDeleteWorkflow).not.toHaveBeenCalled();
    expect(mockDeleteInbox).not.toHaveBeenCalled();
  });

  it('Chatwoot falha após n8n clone: compensa deletando o workflow clonado', async () => {
    mockCloneWorkflow.mockResolvedValueOnce({ id: 'cloned-workflow-id', name: 'Acme Corp - Secretária v3' });
    mockCreateInbox.mockRejectedValueOnce(new Error('Chatwoot API error creating inbox: 502 Bad Gateway'));
    mockDeleteWorkflow.mockResolvedValueOnce(undefined);

    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Corp', whatsappNumber: '+5511999999999' }),
    });

    expect(res.status).toBe(500);
    expect(mockDeleteWorkflow).toHaveBeenCalledWith('cloned-workflow-id');
    expect(mockDeleteInbox).not.toHaveBeenCalled();
  });

  it('Postgres falha após n8n + Chatwoot: compensa deletando workflow e inbox', async () => {
    mockCloneWorkflow.mockResolvedValueOnce({ id: 'cloned-workflow-id', name: 'Acme Corp - Secretária v3' });
    mockCreateInbox.mockResolvedValueOnce({ id: 42, name: 'Acme Corp', channel_type: 'Channel::Api' });
    mockInsertReturning.mockRejectedValueOnce(new Error('database connection error'));
    mockDeleteWorkflow.mockResolvedValueOnce(undefined);
    mockDeleteInbox.mockResolvedValueOnce(undefined);

    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Corp', whatsappNumber: '+5511999999999' }),
    });

    expect(res.status).toBe(500);
    expect(mockDeleteInbox).toHaveBeenCalledWith(42);
    expect(mockDeleteWorkflow).toHaveBeenCalledWith('cloned-workflow-id');
  });
});

describe('GET /clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna array de clientes com status', async () => {
    mockOrderBy.mockResolvedValueOnce([mockClientRow]);

    const res = await app.request('/clients');

    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    const first = body[0] as Record<string, unknown>;
    expect(first['id']).toBe('uuid-client-1');
    expect(first['status']).toBe('active');
  });

  it('retorna array vazio quando não há clientes', async () => {
    mockOrderBy.mockResolvedValueOnce([]);

    const res = await app.request('/clients');

    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(0);
  });
});
