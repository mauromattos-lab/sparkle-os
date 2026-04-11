import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../index.js';

describe('GET /flows', () => {
  it('retorna array com os 15 fluxos Zenya Prime', async () => {
    const res = await app.request('/flows');

    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(15);
  });

  it('todos os fluxos têm id, name, category e status', async () => {
    const res = await app.request('/flows');
    const body = await res.json() as Array<Record<string, unknown>>;

    for (const flow of body) {
      expect(flow).toHaveProperty('id');
      expect(flow).toHaveProperty('name');
      expect(flow).toHaveProperty('category');
      expect(flow).toHaveProperty('status');
    }
  });
});

describe('GET /flows/:id', () => {
  it('retorna o fluxo 01. Secretária v3 pelo ID correto', async () => {
    const res = await app.request('/flows/r3C1FMc6NIi6eCGI');

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['id']).toBe('r3C1FMc6NIi6eCGI');
    expect(body['name']).toBe('01. Secretária v3');
    expect(body['category']).toBe('atendimento');
  });

  it('retorna 404 para ID inválido', async () => {
    const res = await app.request('/flows/id-invalido');

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });
});

describe('POST /flows/:id/clone', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockFullWorkflow = {
    id: 'r3C1FMc6NIi6eCGI',
    name: '01. Secretária v3',
    active: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    nodes: [],
    connections: {},
  };

  const mockClonedWorkflow = {
    id: 'cloned-id-123',
    name: 'Acme Corp - Secretária v3',
    active: false,
    createdAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  };

  it('retorna 201 com workflow clonado no happy path', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockFullWorkflow })
      .mockResolvedValueOnce({ ok: true, json: async () => mockClonedWorkflow });

    const res = await app.request('/flows/r3C1FMc6NIi6eCGI/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: 'Acme Corp - Secretária v3' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body['id']).toBe('cloned-id-123');
    expect(body['name']).toBe('Acme Corp - Secretária v3');
  });

  it('retorna 502 quando n8n está indisponível', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' });

    const res = await app.request('/flows/r3C1FMc6NIi6eCGI/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: 'Teste Clone' }),
    });

    expect(res.status).toBe(502);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });
});
