// Unit tests for brain.service.ts
// Uses vi.stubGlobal to mock fetch — no real HTTP calls

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBrainStatus } from './brain.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockHealthOk = {
  status: 'ok',
  db: 'ok',
  embeddingService: 'ok',
};

const mockDashboard = {
  generatedAt: '2026-04-12T10:00:00.000Z',
  cacheHit: false,
  summary: {
    total: 42,
    by_status: { raw: 5, validated: 10, applied: 20, rejected: 7 },
    by_source: { zenya_operation: 15, agent_research: 20, mauro_input: 7 },
    total_duplicates: 3,
    avg_quality_score: 0.85,
  },
  cycle: {
    ingested: 42,
    validated: 30,
    applied: 20,
    rejected: 7,
    completionRate: 47.6,
  },
  top_applied: [
    { id: '1', content: 'Insight A', quality_score: 0.95, source: 'zenya_operation' },
    { id: '2', content: 'Insight B', quality_score: 0.90, source: 'agent_research' },
    { id: '3', content: 'Insight C', quality_score: 0.88, source: 'mauro_input' },
    { id: '4', content: 'Insight D', quality_score: 0.80, source: 'zenya_operation' },
  ],
};

function makeFetchOk(data: unknown) {
  return () =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response);
}

function makeFetchFail(status: number) {
  return () =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({}),
    } as Response);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getBrainStatus', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns healthy:true with consolidated data when both APIs respond ok', async () => {
    fetchSpy
      .mockImplementationOnce(makeFetchOk(mockHealthOk))
      .mockImplementationOnce(makeFetchOk(mockDashboard));

    const result = await getBrainStatus();

    expect(result.healthy).toBe(true);
    if (result.healthy) {
      expect(result.health.status).toBe('ok');
      expect(result.health.db).toBe('ok');
      expect(result.dashboard.summary.total).toBe(42);
      expect(result.dashboard.cycle.completionRate).toBe(47.6);
    }
  });

  it('limits topApplied to the first 3 entries', async () => {
    fetchSpy
      .mockImplementationOnce(makeFetchOk(mockHealthOk))
      .mockImplementationOnce(makeFetchOk(mockDashboard));

    const result = await getBrainStatus();

    expect(result.healthy).toBe(true);
    if (result.healthy) {
      expect(result.topApplied).toHaveLength(3);
      expect(result.topApplied[0]!.id).toBe('1');
      expect(result.topApplied[2]!.id).toBe('3');
    }
  });

  it('returns healthy:false when health endpoint fails', async () => {
    fetchSpy
      .mockImplementationOnce(makeFetchFail(503))
      .mockImplementationOnce(makeFetchOk(mockDashboard));

    const result = await getBrainStatus();

    expect(result.healthy).toBe(false);
    if (!result.healthy) {
      expect(result.error).toMatch(/503/);
    }
  });

  it('returns healthy:false when dashboard endpoint fails', async () => {
    fetchSpy
      .mockImplementationOnce(makeFetchOk(mockHealthOk))
      .mockImplementationOnce(makeFetchFail(500));

    const result = await getBrainStatus();

    expect(result.healthy).toBe(false);
    if (!result.healthy) {
      expect(result.error).toMatch(/500/);
    }
  });

  it('returns healthy:false with error message when fetch throws (Brain offline)', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await getBrainStatus();

    expect(result.healthy).toBe(false);
    if (!result.healthy) {
      expect(result.error).toBe('Brain API indisponível');
    }
  });

  it('returns healthy:false when fetch times out', async () => {
    fetchSpy.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    const result = await getBrainStatus();

    expect(result.healthy).toBe(false);
    if (!result.healthy) {
      expect(result.error).toBe('Brain API indisponível');
    }
  });

  it('handles empty top_applied array gracefully', async () => {
    const dashWithNoApplied = { ...mockDashboard, top_applied: [] };
    fetchSpy
      .mockImplementationOnce(makeFetchOk(mockHealthOk))
      .mockImplementationOnce(makeFetchOk(dashWithNoApplied));

    const result = await getBrainStatus();

    expect(result.healthy).toBe(true);
    if (result.healthy) {
      expect(result.topApplied).toHaveLength(0);
    }
  });

  it('handles missing top_applied field gracefully (fallback to empty array)', async () => {
    const { top_applied: _omitted, ...dashWithoutTopApplied } = mockDashboard;
    fetchSpy
      .mockImplementationOnce(makeFetchOk(mockHealthOk))
      .mockImplementationOnce(makeFetchOk(dashWithoutTopApplied));

    const result = await getBrainStatus();

    expect(result.healthy).toBe(true);
    if (result.healthy) {
      expect(result.topApplied).toHaveLength(0);
    }
  });

  it('calls both fetch endpoints (parallelism check)', async () => {
    fetchSpy
      .mockImplementationOnce(makeFetchOk(mockHealthOk))
      .mockImplementationOnce(makeFetchOk(mockDashboard));

    await getBrainStatus();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [call1, call2] = fetchSpy.mock.calls;
    expect((call1 as unknown[])[0]).toContain('/brain/health');
    expect((call2 as unknown[])[0]).toContain('/brain/dashboard');
  });
});
