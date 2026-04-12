// Dashboard route integration tests — Story 3.9
// 9 test cases covering DashboardData structure, calculation correctness, cache, and HTML endpoint.
// All DB calls are mocked via vi.mock('./db/client.js').

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the DB client so no real Postgres connection is made.
vi.mock('./db/client.js', () => ({
  getSql: vi.fn(),
}));

// Mock DB insights (used by other routes loaded through app/index)
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

// Mock embedding service (used by other routes)
vi.mock('./services/embedding.service.js', () => ({
  generateEmbedding: vi.fn(),
  checkEmbeddingServiceHealth: vi.fn(),
}));

// Mock dashboard service's cache-clearing function as a side effect is needed.
// We import clearDashboardCache directly after mocks are set up.

import { getSql } from './db/client.js';
import { clearDashboardCache } from './services/dashboard.service.js';
import { app } from './index.js';

const mockGetSql = vi.mocked(getSql);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a tagged-template-literal-compatible mock for postgres.js sql`...` */
function buildSqlMock(responses: unknown[][]) {
  let callIdx = 0;
  return vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => {
    const result = responses[callIdx] ?? [];
    callIdx++;
    return Promise.resolve(result);
  });
}

/** Default summary row (all zeros). */
const DEFAULT_SUMMARY_ROW = {
  raw: '0',
  validated: '0',
  applied: '0',
  rejected: '0',
  total: '0',
  total_duplicates: '0',
  avg_quality_score: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearDashboardCache();
});

afterEach(() => {
  vi.clearAllMocks();
  clearDashboardCache();
});

// ─── Test 1: GET /brain/dashboard → 200 com DashboardData estrutura completa ──

describe('GET /brain/dashboard', () => {
  it('returns 200 with a complete DashboardData structure', async () => {
    const sqlMock = buildSqlMock([
      [DEFAULT_SUMMARY_ROW], // summaryRows
      [],                    // sourceRows
      [],                    // confidenceRows
      [],                    // topAppliedRows
      [],                    // qualityRows
      [],                    // topCanonicalRows
    ]);
    mockGetSql.mockReturnValue(sqlMock as never);

    const res = await app.request('/brain/dashboard');
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;

    // Top-level keys
    expect(body).toHaveProperty('generatedAt');
    expect(body).toHaveProperty('cacheHit');
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('cycle');
    expect(body).toHaveProperty('insights_by_confidence');
    expect(body).toHaveProperty('top_applied');
    expect(body).toHaveProperty('quality_distribution');
    expect(body).toHaveProperty('duplicates');

    // summary sub-structure
    const summary = body['summary'] as Record<string, unknown>;
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('by_status');
    expect(summary).toHaveProperty('by_source');
    expect(summary).toHaveProperty('total_duplicates');
    expect(summary).toHaveProperty('avg_quality_score');

    // cycle sub-structure
    const cycle = body['cycle'] as Record<string, unknown>;
    expect(cycle).toHaveProperty('ingested');
    expect(cycle).toHaveProperty('validated');
    expect(cycle).toHaveProperty('applied');
    expect(cycle).toHaveProperty('rejected');
    expect(cycle).toHaveProperty('completionRate');

    // quality_distribution always 5 buckets
    expect(Array.isArray(body['quality_distribution'])).toBe(true);
    expect((body['quality_distribution'] as unknown[]).length).toBe(5);

    // duplicates sub-structure
    const dup = body['duplicates'] as Record<string, unknown>;
    expect(dup).toHaveProperty('total_duplicates');
    expect(dup).toHaveProperty('top_canonical');
  });

  // ─── Test 2: summary.total reflete inserções ─────────────────────────────

  it('summary.total reflects data in the database', async () => {
    const sqlMock = buildSqlMock([
      [{ raw: '3', validated: '2', applied: '1', rejected: '0', total: '6', total_duplicates: '0', avg_quality_score: null }],
      [],
      [],
      [],
      [],
      [],
    ]);
    mockGetSql.mockReturnValue(sqlMock as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { summary: { total: number } };

    expect(body.summary.total).toBe(6);
  });

  // ─── Test 3: cycle.completionRate calculado corretamente ────────────────────

  it('cycle.completionRate = applied / ingested * 100 (2 decimal places)', async () => {
    // 3 raw + 2 validated + 1 applied + 0 rejected = 6 total
    // completionRate = 1 / 6 * 100 = 16.67
    const sqlMock = buildSqlMock([
      [{ raw: '3', validated: '2', applied: '1', rejected: '0', total: '6', total_duplicates: '0', avg_quality_score: null }],
      [],
      [],
      [],
      [],
      [],
    ]);
    mockGetSql.mockReturnValue(sqlMock as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { cycle: { completionRate: number; applied: number; ingested: number } };

    expect(body.cycle.applied).toBe(1);
    expect(body.cycle.ingested).toBe(6);
    expect(body.cycle.completionRate).toBeCloseTo(16.67, 1);
  });

  // ─── Test 4: top_applied max 5 items, ordenado por appliedAt desc ──────────

  it('top_applied is limited to 5 items ordered by appliedAt DESC', async () => {
    const appliedRows = [
      { id: 'a1', summary: 'Insight 1', source: 'zenya_operation', confidence_level: 'high', applied_at: '2026-04-12T10:00:00Z', improvement_percent: null, nucleus_id: null },
      { id: 'a2', summary: 'Insight 2', source: 'agent_research', confidence_level: 'medium', applied_at: '2026-04-11T10:00:00Z', improvement_percent: null, nucleus_id: null },
      { id: 'a3', summary: 'Insight 3', source: 'mauro_input', confidence_level: 'authoritative', applied_at: '2026-04-10T10:00:00Z', improvement_percent: null, nucleus_id: null },
      { id: 'a4', summary: 'Insight 4', source: 'zenya_operation', confidence_level: 'high', applied_at: '2026-04-09T10:00:00Z', improvement_percent: null, nucleus_id: null },
      { id: 'a5', summary: 'Insight 5', source: 'zenya_operation', confidence_level: 'high', applied_at: '2026-04-08T10:00:00Z', improvement_percent: null, nucleus_id: null },
    ];

    const sqlMock = buildSqlMock([
      [{ raw: '0', validated: '0', applied: '5', rejected: '0', total: '5', total_duplicates: '0', avg_quality_score: null }],
      [],
      [],
      appliedRows,
      [],
      [],
    ]);
    mockGetSql.mockReturnValue(sqlMock as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { top_applied: Array<{ id: string; appliedAt: string | null }> };

    expect(body.top_applied).toHaveLength(5);
    // First item is the most recent (SQL returns ordered by applied_at DESC)
    expect(body.top_applied[0]?.id).toBe('a1');
    expect(body.top_applied[0]?.appliedAt).toBe('2026-04-12T10:00:00Z');
  });

  // ─── Test 5: improvementPercent=null quando applicationProof ausente ────────

  it('top_applied.improvementPercent is null when applicationProof is absent', async () => {
    const appliedRows = [
      { id: 'b1', summary: 'Sem proof', source: 'zenya_operation', confidence_level: 'high', applied_at: '2026-04-12T00:00:00Z', improvement_percent: null, nucleus_id: null },
    ];

    const sqlMock = buildSqlMock([
      [{ raw: '0', validated: '0', applied: '1', rejected: '0', total: '1', total_duplicates: '0', avg_quality_score: null }],
      [],
      [],
      appliedRows,
      [],
      [],
    ]);
    mockGetSql.mockReturnValue(sqlMock as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { top_applied: Array<{ improvementPercent: number | null }> };

    expect(body.top_applied[0]?.improvementPercent).toBeNull();
  });

  // ─── Test 6: quality_distribution sempre 5 buckets (count 0 para vazios) ───

  it('quality_distribution always has exactly 5 buckets, empty ones have count=0', async () => {
    // DB returns only 2 populated buckets
    const qualityRows = [
      { range: '0.6–0.8', count: '3' },
      { range: '0.8–1.0', count: '7' },
    ];

    const sqlMock = buildSqlMock([
      [DEFAULT_SUMMARY_ROW],
      [],
      [],
      [],
      qualityRows,
      [],
    ]);
    mockGetSql.mockReturnValue(sqlMock as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { quality_distribution: Array<{ range: string; count: number }> };

    expect(body.quality_distribution).toHaveLength(5);

    const ranges = body.quality_distribution.map((b) => b.range);
    expect(ranges).toContain('0.0–0.2');
    expect(ranges).toContain('0.2–0.4');
    expect(ranges).toContain('0.4–0.6');
    expect(ranges).toContain('0.6–0.8');
    expect(ranges).toContain('0.8–1.0');

    // Empty buckets must have count=0
    const emptyBucket = body.quality_distribution.find((b) => b.range === '0.0–0.2');
    expect(emptyBucket?.count).toBe(0);

    // Populated buckets have correct counts
    const highBucket = body.quality_distribution.find((b) => b.range === '0.8–1.0');
    expect(highBucket?.count).toBe(7);
  });

  // ─── Test 7: duplicates.top_canonical max 5 ────────────────────────────────

  it('duplicates.top_canonical contains at most 5 entries', async () => {
    const canonicalRows = [
      { canonical_id: 'c1', count: '5', summary: 'Canon 1' },
      { canonical_id: 'c2', count: '3', summary: 'Canon 2' },
      { canonical_id: 'c3', count: '2', summary: 'Canon 3' },
      { canonical_id: 'c4', count: '1', summary: 'Canon 4' },
      { canonical_id: 'c5', count: '1', summary: 'Canon 5' },
    ];

    const sqlMock = buildSqlMock([
      [{ ...DEFAULT_SUMMARY_ROW, total_duplicates: '12' }],
      [],
      [],
      [],
      [],
      canonicalRows,
    ]);
    mockGetSql.mockReturnValue(sqlMock as never);

    const res = await app.request('/brain/dashboard');
    const body = await res.json() as { duplicates: { total_duplicates: number; top_canonical: Array<{ canonicalId: string; count: number }> } };

    expect(body.duplicates.total_duplicates).toBe(12);
    expect(body.duplicates.top_canonical.length).toBeLessThanOrEqual(5);
    expect(body.duplicates.top_canonical[0]?.canonicalId).toBe('c1');
    expect(body.duplicates.top_canonical[0]?.count).toBe(5);
  });

  // ─── Test 8: GET /brain/dashboard/ui → 200, Content-Type: text/html ─────────

  it('GET /brain/dashboard/ui returns 200 with text/html content', async () => {
    const res = await app.request('/brain/dashboard/ui');

    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toMatch(/text\/html/);

    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Cérebro Coletivo');
    expect(html).toContain('/brain/dashboard'); // fetch client-side call
  });

  // ─── Test 9: segunda requisição em < 60s retorna cacheHit=true ─────────────

  it('second request within 60s returns cacheHit=true', async () => {
    const sqlMock = buildSqlMock([
      // First call (6 queries)
      [DEFAULT_SUMMARY_ROW], [], [], [], [], [],
      // Second call should NOT happen (cache hit) — but add fallback just in case
      [DEFAULT_SUMMARY_ROW], [], [], [], [], [],
    ]);
    mockGetSql.mockReturnValue(sqlMock as never);

    // First request — populates cache
    const res1 = await app.request('/brain/dashboard');
    const body1 = await res1.json() as { cacheHit: boolean };
    expect(body1.cacheHit).toBe(false);

    // Second request — must come from cache (sqlMock should NOT be called again)
    const res2 = await app.request('/brain/dashboard');
    const body2 = await res2.json() as { cacheHit: boolean };
    expect(body2.cacheHit).toBe(true);

    // SQL was called only 6 times (for the first request)
    expect(sqlMock).toHaveBeenCalledTimes(6);
  });
});
