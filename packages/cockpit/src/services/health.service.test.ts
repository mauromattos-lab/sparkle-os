// Unit tests for health.service.ts
// Tests: Brain ok, Brain offline, Brain degraded (partial response)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkBrainHealth, getSystemHealth } from './health.service.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkBrainHealth', () => {
  const BRAIN_URL = 'http://localhost:3003';

  it('returns ok when Brain responds healthy', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', db: 'ok', embeddingService: 'ok' }),
    });

    const result = await checkBrainHealth(BRAIN_URL);

    expect(result.name).toBe('Brain API');
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('ok');
    expect(result.checkedAt).toBeTruthy();
  });

  it('returns offline when fetch throws (service unreachable)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await checkBrainHealth(BRAIN_URL);

    expect(result.name).toBe('Brain API');
    expect(result.status).toBe('offline');
    expect(result.detail).toBeTruthy();
  });

  it('returns degraded when Brain responds with non-ok status body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'degraded', db: 'error', embeddingService: 'ok' }),
    });

    const result = await checkBrainHealth(BRAIN_URL);

    expect(result.name).toBe('Brain API');
    expect(result.status).toBe('degraded');
    expect(result.detail).toContain('error');
  });

  it('returns degraded when HTTP response is not ok (e.g. 503)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const result = await checkBrainHealth(BRAIN_URL);

    expect(result.name).toBe('Brain API');
    expect(result.status).toBe('degraded');
    expect(result.detail).toContain('503');
  });

  it('returns offline when response has partial/missing fields', async () => {
    // Empty body — status missing means not 'ok' → degraded
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await checkBrainHealth(BRAIN_URL);

    expect(result.name).toBe('Brain API');
    // status is undefined, so not 'ok' → degraded
    expect(result.status).toBe('degraded');
  });
});

describe('getSystemHealth', () => {
  const BRAIN_URL = 'http://localhost:3003';

  it('overall is ok when all integrations are ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', db: 'ok', embeddingService: 'ok' }),
    });

    const health = await getSystemHealth(BRAIN_URL);

    expect(health.overall).toBe('ok');
    expect(health.integrations).toHaveLength(1);
    expect(health.integrations.at(0)?.status).toBe('ok');
  });

  it('overall is offline when Brain is offline', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const health = await getSystemHealth(BRAIN_URL);

    expect(health.overall).toBe('offline');
    expect(health.integrations.at(0)?.status).toBe('offline');
  });

  it('overall is degraded when Brain is degraded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'degraded', db: 'error', embeddingService: 'ok' }),
    });

    const health = await getSystemHealth(BRAIN_URL);

    expect(health.overall).toBe('degraded');
    expect(health.integrations.at(0)?.status).toBe('degraded');
  });

  it('includes checkedAt timestamp', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', db: 'ok', embeddingService: 'ok' }),
    });

    const health = await getSystemHealth(BRAIN_URL);

    expect(health.checkedAt).toBeTruthy();
    expect(new Date(health.checkedAt).getTime()).not.toBeNaN();
  });
});
