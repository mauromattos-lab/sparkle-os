// Unit tests for zenya.service.ts
// Covers: n8n online, n8n offline (timeout/error), no API key (ping only), workflow count

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getZenyaStatus, getEpicStoryProgress } from './zenya.service.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  delete process.env['N8N_URL'];
  delete process.env['N8N_API_KEY'];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('getZenyaStatus', () => {
  it('returns online=true and workflowCount=null when n8n responds and no API key', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    const result = await getZenyaStatus();

    expect(result.online).toBe(true);
    expect(result.workflowCount).toBeNull();
    expect(result.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/healthz'),
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('returns online=true with workflowCount when N8N_API_KEY is set and workflows endpoint succeeds', async () => {
    process.env['N8N_API_KEY'] = 'test-api-key';

    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: '1' }, { id: '2' }, { id: '3' }] }),
    } as unknown as Response);

    const result = await getZenyaStatus();

    expect(result.online).toBe(true);
    expect(result.workflowCount).toBe(3);
    expect(result.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns online=false and error message when healthz throws (timeout / network error)', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'));

    const result = await getZenyaStatus();

    expect(result.online).toBe(false);
    expect(result.workflowCount).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('n8n');
  });

  it('returns online=false when healthz responds with non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false } as Response);

    const result = await getZenyaStatus();

    expect(result.online).toBe(false);
    expect(result.workflowCount).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('returns online=true with workflowCount=null when API key set but workflow endpoint fails', async () => {
    process.env['N8N_API_KEY'] = 'test-api-key';

    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    mockFetch.mockRejectedValueOnce(new Error('connection refused'));

    const result = await getZenyaStatus();

    expect(result.online).toBe(true);
    expect(result.workflowCount).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns online=true with workflowCount=null when workflow endpoint returns non-ok status', async () => {
    process.env['N8N_API_KEY'] = 'bad-key';

    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    mockFetch.mockResolvedValueOnce({ ok: false } as Response);

    const result = await getZenyaStatus();

    expect(result.online).toBe(true);
    expect(result.workflowCount).toBeNull();
    expect(result.error).toBeNull();
  });

  it('uses N8N_URL env variable when set', async () => {
    process.env['N8N_URL'] = 'http://vps.example.com:5678';
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await getZenyaStatus();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://vps.example.com:5678/healthz',
      expect.anything(),
    );
  });

  it('passes X-N8N-API-KEY header to workflow endpoint (does NOT expose in healthz call)', async () => {
    process.env['N8N_API_KEY'] = 'secret-key';

    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as unknown as Response);

    await getZenyaStatus();

    const healthzCall = mockFetch.mock.calls[0];
    expect(healthzCall[1]?.headers).toBeUndefined();

    const workflowsCall = mockFetch.mock.calls[1];
    expect(workflowsCall[1]?.headers?.['X-N8N-API-KEY']).toBe('secret-key');
  });
});

describe('getEpicStoryProgress', () => {
  it('returns zero counts when stories directory does not exist', async () => {
    const result = await getEpicStoryProgress('__nonexistent_prefix_999.');
    expect(result.total).toBe(0);
    expect(result.done).toBe(0);
    expect(result.inProgress).toBe(0);
  });
});
