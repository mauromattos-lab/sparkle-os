import { describe, it, expect } from 'vitest';
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
