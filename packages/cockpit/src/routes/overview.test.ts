// Unit tests for overview route
// Tests: route responds with HTML, includes status indicators

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../index.js';

// Mock fetch used by health service
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /cockpit/', () => {
  it('returns 200 with HTML content type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', db: 'ok', embeddingService: 'ok' }),
    });

    const req = new Request('http://localhost/cockpit/');
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('renders Brain API status in HTML', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', db: 'ok', embeddingService: 'ok' }),
    });

    const req = new Request('http://localhost/cockpit/');
    const res = await app.fetch(req);
    const html = await res.text();

    expect(html).toContain('Brain API');
    expect(html).toContain('Operacional');
  });

  it('renders offline alert when Brain is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const req = new Request('http://localhost/cockpit/');
    const res = await app.fetch(req);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('Brain API');
    expect(html).toContain('Offline');
  });

  it('includes navigation sidebar with all panels', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', db: 'ok', embeddingService: 'ok' }),
    });

    const req = new Request('http://localhost/cockpit/');
    const res = await app.fetch(req);
    const html = await res.text();

    expect(html).toContain('Agentes');
    expect(html).toContain('Decisões');
    expect(html).toContain('Zenya');
    expect(html).toContain('Cérebro');
    expect(html).toContain('Custos');
    expect(html).toContain('Progresso');
    expect(html).toContain('Resumo');
  });

  it('includes auto-refresh meta tag', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', db: 'ok', embeddingService: 'ok' }),
    });

    const req = new Request('http://localhost/cockpit/');
    const res = await app.fetch(req);
    const html = await res.text();

    // meta http-equiv="refresh" content="30"
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('content="30"');
  });

  it('includes inline SOP when Brain is offline', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const req = new Request('http://localhost/cockpit/');
    const res = await app.fetch(req);
    const html = await res.text();

    // SOP text should appear
    expect(html).toContain('packages/brain');
    expect(html).toContain('npm run dev');
  });
});

describe('GET /cockpit/agents (placeholder)', () => {
  it('returns 200 with HTML placeholder', async () => {
    const req = new Request('http://localhost/cockpit/agents');
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Agentes');
  });
});
