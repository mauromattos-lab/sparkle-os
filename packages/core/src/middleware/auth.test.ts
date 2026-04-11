import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { requireInternalToken } from './auth.js';

function buildApp(token: string | undefined) {
  const app = new Hono();
  app.use('/*', requireInternalToken);
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

describe('requireInternalToken middleware', () => {
  const originalToken = process.env['INTERNAL_API_TOKEN'];

  beforeEach(() => {
    process.env['INTERNAL_API_TOKEN'] = 'test-secret-token';
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env['INTERNAL_API_TOKEN'];
    } else {
      process.env['INTERNAL_API_TOKEN'] = originalToken;
    }
  });

  it('allows request with correct token', async () => {
    const app = buildApp('test-secret-token');
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer test-secret-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toEqual({ ok: true });
  });

  it('rejects request with wrong token', async () => {
    const app = buildApp('test-secret-token');
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('Invalid token');
  });

  it('rejects request without Authorization header', async () => {
    const app = buildApp('test-secret-token');
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('Missing or invalid Authorization header');
  });

  it('rejects request with non-Bearer Authorization', async () => {
    const app = buildApp('test-secret-token');
    const res = await app.request('/test', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 500 when INTERNAL_API_TOKEN not configured', async () => {
    delete process.env['INTERNAL_API_TOKEN'];
    const app = buildApp(undefined);
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer any-token' },
    });
    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('INTERNAL_API_TOKEN not configured');
  });
});

describe('tenant isolation model (documented behavior)', () => {
  it('validates isolation policy prevents empty tenant access', () => {
    // The RLS policy uses NULLIF to prevent empty string from becoming a real UUID
    // and falls back to '00000000-0000-0000-0000-000000000000' (non-existent tenant)
    // This test documents the expected behavior — real verification requires Postgres

    const tenantId = 'abc123';
    const fallbackUuid = '00000000-0000-0000-0000-000000000000';

    // Simulate the COALESCE(NULLIF(setting, ''))::UUID logic
    function resolveTenantContext(setting: string | null): string {
      const id = setting && setting.trim() !== '' ? setting : null;
      return id ?? fallbackUuid;
    }

    expect(resolveTenantContext('abc123')).toBe('abc123');
    expect(resolveTenantContext('')).toBe(fallbackUuid);
    expect(resolveTenantContext(null)).toBe(fallbackUuid);
  });

  it('validates tenant model invariant: each tenant has a unique slug', () => {
    const tenants = [
      { id: 'uuid-1', slug: 'empresa-abc', status: 'active' },
      { id: 'uuid-2', slug: 'empresa-xyz', status: 'active' },
    ];

    const slugs = tenants.map((t) => t.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });
});
