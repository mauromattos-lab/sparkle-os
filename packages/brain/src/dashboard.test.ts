// Dashboard route integration tests — Story 3.9
// Updated for Supabase REST API (replaces postgres.js tagged template mocks).
// All DB calls go through a single rpc('get_dashboard_aggregates') call.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./db/client.js', () => ({
  getSupabase: vi.fn(),
  checkDbHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('./db/insights.js', () => ({
  insertInsight: vi.fn(),
  countInsightsExcludingRejected: vi.fn(),
  findSimilarInsights: vi.fn(),
  findInsightById: vi.fn(),
  listInsights: vi.fn(),
  validateInsight: vi.fn(),
  rejectInsight: vi.fn(),
  searchInsights: vi.fn(),
  applyInsight: vi.fn(),
  markStaleRawInsights: vi.fn(),
  markStaleValidatedInsights: vi.fn(),
  archiveOldRejectedInsights: vi.fn(),
  countUnresolvedDuplicates: vi.fn(),
  listDuplicateInsights: vi.fn(),
  listPendingInsights: vi.fn(),
  keepDuplicateInsight: vi.fn(),
}));

vi.mock('./services/embedding.service.js', () => ({
  generateEmbedding: vi.fn(),
  checkEmbeddingServiceHealth: vi.fn(),
}));

import { getSupabase } from './db/client.js';
import { clearDashboardCache } from './services/dashboard.service.js';
import { app } from './index.js';

const mockGetSupabase = vi.mocked(getSupabase);

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AggregatesOverride = {
  summary?: {
    raw: number; validated: number; applied: number; rejected: number;
    total: number; total_duplicates: number; avg_quality_score: number | null;
  };
  by_source?: Record<string, number>;
  by_confidence?: Record<string, number>;
  top_applied?: Array<{
    id: string; summary: string | null; source: string;
    confidence_level: string; applied_at: string | null;
    improvement_percent: number | null; nucleus_id: string | null;
  }> | null;
  quality_distribution?: Array<{ range: string; count: number }> | null;
  top_canonical?: Array<{ canonical_id: string; count: number; summary: string | null }> | null;
};

const DEFAULT_SUMMARY = {
  raw: 0, validated: 0, applied: 0, rejected: 0,
  total: 0, total_duplicates: 0, avg_quality_score: null,
};

/** Builds a mock Supabase client whose rpc() resolves with `aggregates`. */
function buildSupabaseMock(aggregates: AggregatesOverride = {}) {
  const data = {
    summary: aggregates.summary ?? DEFAULT_SUMMARY,
    by_source: aggregates.by_source ?? {},
    by_confidence: aggregates.by_confidence ?? {},
    top_applied: aggregates.top_applied ?? null,
    quality_distribution: aggregates.quality_distribution ?? null,
    top_canonical: aggregates.top_canonical ?? null,
  };
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearDashboardCache();
});

afterEach(() => {
  vi.clearAllMocks();
  clearDashboardCache();
});

describe('GET /brain/dashboard', () => {

  // ─── Test 1: estrutura completa ───────────────────────────────────────────

  it('returns 200 with a complete DashboardData structure', async () => {
    mockGetSupabase.mockReturnValue(buildSupabaseMock() as never);

    const res = await app.request('/brain/dashboard');
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;

    expect(body).toHaveProperty('generatedAt');
    expect(body).toHaveProperty('cacheHit');
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('cycle');
    expect(body).toHaveProperty('insights_by_confidence');
    expect(body).toHaveProperty('top_applied');
    expect(body).toHaveProperty('quality_distribution');
    expect(body).toHaveProperty('duplicates');

    const summary = body['summary'] as Record<string, unknown>;
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('by_status');
    expect(summary).toHaveProperty('by_source');
    expect(summary).toHaveProperty('total_duplicates');
    expect(summary).toHaveProperty('avg_quality_score');

    const cycle = body['cycle'] as Record<string, unknown>;
    expect(cycle).toHaveProperty('ingested');
    expect(cycle).toHaveProperty('validated');
    expect(cycle).toHaveProperty('applied');
    expect(cycle).toHaveProperty('rejected');
    expect(cycle).toHaveProperty('completionRate');

    expect(Array.isArray(body['quality_distribution'])).toBe(true);
    expect((body['quality_distribution'] as unknown[]).length).toBe(5);

    const dup = body['duplicates'] as Record<string, unknown>;
    expect(dup).toHaveProperty('total_duplicates');
    expect(dup).toHaveProperty('top_canonical');
  });

  // ─── Test 2: summary.total reflete dados ─────────────────────────────────

  it('summary.total reflects data in the database', async () => {
    mockGetSupabase.mockReturnValue(buildSupabaseMock({
      summary: { raw: 3, validated: 2, applied: 1, rejected: 0, total: 6, total_duplicates: 0, avg_quality_score: null },
    }) as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { summary: { total: number } };

    expect(body.summary.total).toBe(6);
  });

  // ─── Test 3: completionRate calculado corretamente ────────────────────────

  it('cycle.completionRate = applied / ingested * 100 (2 decimal places)', async () => {
    // completionRate = 1 / 6 * 100 = 16.67
    mockGetSupabase.mockReturnValue(buildSupabaseMock({
      summary: { raw: 3, validated: 2, applied: 1, rejected: 0, total: 6, total_duplicates: 0, avg_quality_score: null },
    }) as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { cycle: { completionRate: number; applied: number; ingested: number } };

    expect(body.cycle.applied).toBe(1);
    expect(body.cycle.ingested).toBe(6);
    expect(body.cycle.completionRate).toBeCloseTo(16.67, 1);
  });

  // ─── Test 4: top_applied max 5, ordenado por appliedAt desc ──────────────

  it('top_applied is limited to 5 items ordered by appliedAt DESC', async () => {
    const top_applied = [
      { id: 'a1', summary: 'Insight 1', source: 'zenya_operation', confidence_level: 'high', applied_at: '2026-04-12T10:00:00Z', improvement_percent: null, nucleus_id: null },
      { id: 'a2', summary: 'Insight 2', source: 'agent_research', confidence_level: 'medium', applied_at: '2026-04-11T10:00:00Z', improvement_percent: null, nucleus_id: null },
      { id: 'a3', summary: 'Insight 3', source: 'mauro_input', confidence_level: 'authoritative', applied_at: '2026-04-10T10:00:00Z', improvement_percent: null, nucleus_id: null },
      { id: 'a4', summary: 'Insight 4', source: 'zenya_operation', confidence_level: 'high', applied_at: '2026-04-09T10:00:00Z', improvement_percent: null, nucleus_id: null },
      { id: 'a5', summary: 'Insight 5', source: 'zenya_operation', confidence_level: 'high', applied_at: '2026-04-08T10:00:00Z', improvement_percent: null, nucleus_id: null },
    ];

    mockGetSupabase.mockReturnValue(buildSupabaseMock({
      summary: { raw: 0, validated: 0, applied: 5, rejected: 0, total: 5, total_duplicates: 0, avg_quality_score: null },
      top_applied,
    }) as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { top_applied: Array<{ id: string; appliedAt: string | null }> };

    expect(body.top_applied).toHaveLength(5);
    expect(body.top_applied[0]?.id).toBe('a1');
    expect(body.top_applied[0]?.appliedAt).toBe('2026-04-12T10:00:00Z');
  });

  // ─── Test 5: improvementPercent=null quando ausente ──────────────────────

  it('top_applied.improvementPercent is null when applicationProof is absent', async () => {
    mockGetSupabase.mockReturnValue(buildSupabaseMock({
      summary: { raw: 0, validated: 0, applied: 1, rejected: 0, total: 1, total_duplicates: 0, avg_quality_score: null },
      top_applied: [
        { id: 'b1', summary: 'Sem proof', source: 'zenya_operation', confidence_level: 'high', applied_at: '2026-04-12T00:00:00Z', improvement_percent: null, nucleus_id: null },
      ],
    }) as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { top_applied: Array<{ improvementPercent: number | null }> };

    expect(body.top_applied[0]?.improvementPercent).toBeNull();
  });

  // ─── Test 6: quality_distribution sempre 5 buckets ───────────────────────

  it('quality_distribution always has exactly 5 buckets, empty ones have count=0', async () => {
    mockGetSupabase.mockReturnValue(buildSupabaseMock({
      quality_distribution: [
        { range: '0.6-0.8', count: 3 },
        { range: '0.8-1.0', count: 7 },
      ],
    }) as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { quality_distribution: Array<{ range: string; count: number }> };

    expect(body.quality_distribution).toHaveLength(5);

    const ranges = body.quality_distribution.map((b) => b.range);
    expect(ranges).toContain('0.0-0.2');
    expect(ranges).toContain('0.2-0.4');
    expect(ranges).toContain('0.4-0.6');
    expect(ranges).toContain('0.6-0.8');
    expect(ranges).toContain('0.8-1.0');

    const emptyBucket = body.quality_distribution.find((b) => b.range === '0.0-0.2');
    expect(emptyBucket?.count).toBe(0);

    const highBucket = body.quality_distribution.find((b) => b.range === '0.8-1.0');
    expect(highBucket?.count).toBe(7);
  });

  // ─── Test 7: duplicates.top_canonical max 5 ──────────────────────────────

  it('duplicates.top_canonical contains at most 5 entries', async () => {
    mockGetSupabase.mockReturnValue(buildSupabaseMock({
      summary: { raw: 0, validated: 0, applied: 0, rejected: 0, total: 0, total_duplicates: 12, avg_quality_score: null },
      top_canonical: [
        { canonical_id: 'c1', count: 5, summary: 'Canon 1' },
        { canonical_id: 'c2', count: 3, summary: 'Canon 2' },
        { canonical_id: 'c3', count: 2, summary: 'Canon 3' },
        { canonical_id: 'c4', count: 1, summary: 'Canon 4' },
        { canonical_id: 'c5', count: 1, summary: 'Canon 5' },
      ],
    }) as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { duplicates: { total_duplicates: number; top_canonical: Array<{ canonicalId: string; count: number }> } };

    expect(body.duplicates.total_duplicates).toBe(12);
    expect(body.duplicates.top_canonical.length).toBeLessThanOrEqual(5);
    expect(body.duplicates.top_canonical[0]?.canonicalId).toBe('c1');
    expect(body.duplicates.top_canonical[0]?.count).toBe(5);
  });

  // ─── Test 8: GET /brain/dashboard/ui → 200 text/html ─────────────────────

  it('GET /brain/dashboard/ui returns 200 with text/html content', async () => {
    const res = await app.request('/brain/dashboard/ui');

    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toMatch(/text\/html/);

    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Cérebro Coletivo');
    expect(html).toContain('/brain/dashboard');
  });

  // ─── Test 9: segunda requisição retorna cacheHit=true ────────────────────

  it('second request within 60s returns cacheHit=true', async () => {
    const sbMock = buildSupabaseMock();
    mockGetSupabase.mockReturnValue(sbMock as never);

    const res1 = await app.request('/brain/dashboard');
    const body1 = await res1.json() as { cacheHit: boolean };
    expect(body1.cacheHit).toBe(false);

    const res2 = await app.request('/brain/dashboard');
    const body2 = await res2.json() as { cacheHit: boolean };
    expect(body2.cacheHit).toBe(true);

    // rpc() called only once (second request served from cache)
    expect(sbMock.rpc).toHaveBeenCalledTimes(1);
  });
});
