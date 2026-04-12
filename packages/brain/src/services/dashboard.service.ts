// Dashboard Service — Story 3.9
// Aggregates metrics from the insights table via postgres.js (getSql()).
// In-memory cache with TTL 60s to avoid repeated heavy queries.

import { getSql } from '../db/client.js';
import type {
  DashboardData,
  DashboardSummary,
  CycleMetrics,
  ConfidenceBreakdown,
  TopAppliedInsight,
  QualityBucket,
  DuplicatesReport,
} from '../types/dashboard.js';

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: DashboardData;
  expiresAt: number;
}

let _cache: CacheEntry | null = null;

/** Clears the in-memory cache — exposed for tests. */
export function clearDashboardCache(): void {
  _cache = null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns aggregated dashboard data.
 * Uses a 60-second in-memory cache to avoid hammering the DB on every request.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const now = Date.now();

  if (_cache && _cache.expiresAt > now) {
    return { ..._cache.data, cacheHit: true };
  }

  const data = await fetchDashboardData();
  _cache = { data, expiresAt: now + 60_000 };
  return data;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Executes all aggregate queries in parallel and assembles DashboardData.
 */
async function fetchDashboardData(): Promise<DashboardData> {
  const sql = getSql();

  // All queries run in parallel
  const [summaryRows, sourceRows, confidenceRows, topAppliedRows, qualityRows, topCanonicalRows] =
    await Promise.all([
      // 1. Status counts + duplicates + avg quality
      sql<
        Array<{
          raw: string;
          validated: string;
          applied: string;
          rejected: string;
          total: string;
          total_duplicates: string;
          avg_quality_score: string | null;
        }>
      >`
        SELECT
          COUNT(*) FILTER (WHERE status = 'raw')       AS raw,
          COUNT(*) FILTER (WHERE status = 'validated') AS validated,
          COUNT(*) FILTER (WHERE status = 'applied')   AS applied,
          COUNT(*) FILTER (WHERE status = 'rejected')  AS rejected,
          COUNT(*)                                      AS total,
          COUNT(*) FILTER (WHERE is_duplicate = true)  AS total_duplicates,
          ROUND(AVG(quality_score) FILTER (WHERE status IN ('validated', 'applied')), 2)::text AS avg_quality_score
        FROM insights
      `,

      // 2. Counts by source
      sql<Array<{ source: string; count: string }>>`
        SELECT source, COUNT(*)::text AS count
        FROM insights
        GROUP BY source
      `,

      // 3. Confidence breakdown (non-rejected)
      sql<Array<{ confidence_level: string; count: string }>>`
        SELECT confidence_level, COUNT(*)::text AS count
        FROM insights
        WHERE status != 'rejected'
        GROUP BY confidence_level
      `,

      // 4. Top 5 applied insights (most recent)
      sql<
        Array<{
          id: string;
          summary: string | null;
          source: string;
          confidence_level: string;
          applied_at: string | null;
          improvement_percent: string | null;
          nucleus_id: string | null;
        }>
      >`
        SELECT
          id,
          summary,
          source,
          confidence_level,
          applied_at,
          (application_proof->>'improvementPercent')::numeric::text AS improvement_percent,
          nucleus_id
        FROM insights
        WHERE status = 'applied'
        ORDER BY applied_at DESC NULLS LAST
        LIMIT 5
      `,

      // 5. Quality distribution histogram (5 buckets)
      sql<Array<{ range: string; count: string }>>`
        SELECT
          CASE
            WHEN quality_score < 0.2 THEN '0.0–0.2'
            WHEN quality_score < 0.4 THEN '0.2–0.4'
            WHEN quality_score < 0.6 THEN '0.4–0.6'
            WHEN quality_score < 0.8 THEN '0.6–0.8'
            ELSE '0.8–1.0'
          END AS range,
          COUNT(*)::text AS count
        FROM insights
        WHERE status IN ('validated', 'applied')
          AND quality_score IS NOT NULL
        GROUP BY 1
        ORDER BY 1
      `,

      // 6. Top 5 canonical insights with most duplicates pointing to them
      sql<Array<{ canonical_id: string; count: string; summary: string | null }>>`
        SELECT
          i.canonical_id,
          COUNT(*)::text AS count,
          c.summary
        FROM insights i
        JOIN insights c ON c.id = i.canonical_id
        WHERE i.is_duplicate = true
          AND i.canonical_id IS NOT NULL
        GROUP BY i.canonical_id, c.summary
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `,
    ]);

  // ── Assemble summary ──────────────────────────────────────────────────────

  const raw = summaryRows[0];
  const statusCounts = {
    raw: parseInt(raw?.raw ?? '0', 10),
    validated: parseInt(raw?.validated ?? '0', 10),
    applied: parseInt(raw?.applied ?? '0', 10),
    rejected: parseInt(raw?.rejected ?? '0', 10),
  };
  const total = parseInt(raw?.total ?? '0', 10);
  const totalDuplicates = parseInt(raw?.total_duplicates ?? '0', 10);
  const avgQualityScore =
    raw?.avg_quality_score != null ? parseFloat(raw.avg_quality_score) : null;

  // Build by_source map
  const sourceMap: Record<string, number> = {};
  for (const row of sourceRows) {
    sourceMap[row.source] = parseInt(row.count, 10);
  }
  const bySource = {
    zenya_operation: sourceMap['zenya_operation'] ?? 0,
    agent_research: sourceMap['agent_research'] ?? 0,
    mauro_input: sourceMap['mauro_input'] ?? 0,
  };

  const summary: DashboardSummary = {
    total,
    by_status: statusCounts,
    by_source: bySource,
    total_duplicates: totalDuplicates,
    avg_quality_score: avgQualityScore,
  };

  // ── Assemble cycle ────────────────────────────────────────────────────────

  // validated = insights that reached 'validated', 'applied', or beyond
  const cycleValidated = statusCounts.validated + statusCounts.applied;
  const ingested = total;
  const completionRate =
    ingested > 0
      ? Math.round((statusCounts.applied / ingested) * 100 * 100) / 100
      : 0;

  const cycle: CycleMetrics = {
    ingested,
    validated: cycleValidated,
    applied: statusCounts.applied,
    rejected: statusCounts.rejected,
    completionRate,
  };

  // ── Assemble confidence breakdown ─────────────────────────────────────────

  const confMap: Record<string, number> = {};
  for (const row of confidenceRows) {
    confMap[row.confidence_level] = parseInt(row.count, 10);
  }
  const insights_by_confidence: ConfidenceBreakdown = {
    authoritative: confMap['authoritative'] ?? 0,
    high: confMap['high'] ?? 0,
    medium: confMap['medium'] ?? 0,
  };

  // ── Assemble top_applied ──────────────────────────────────────────────────

  const top_applied: TopAppliedInsight[] = topAppliedRows.map((row) => ({
    id: row.id,
    summary: row.summary,
    source: row.source,
    confidenceLevel: row.confidence_level,
    appliedAt: row.applied_at,
    improvementPercent:
      row.improvement_percent != null ? parseFloat(row.improvement_percent) : null,
    nucleusId: row.nucleus_id,
  }));

  // ── Assemble quality_distribution (always 5 buckets) ─────────────────────

  const ALL_BUCKETS: Array<{ range: string; min: number; max: number }> = [
    { range: '0.0–0.2', min: 0.0, max: 0.2 },
    { range: '0.2–0.4', min: 0.2, max: 0.4 },
    { range: '0.4–0.6', min: 0.4, max: 0.6 },
    { range: '0.6–0.8', min: 0.6, max: 0.8 },
    { range: '0.8–1.0', min: 0.8, max: 1.0 },
  ];

  const qualityMap: Record<string, number> = {};
  for (const row of qualityRows) {
    qualityMap[row.range] = parseInt(row.count, 10);
  }

  const quality_distribution: QualityBucket[] = ALL_BUCKETS.map((b) => ({
    range: b.range,
    min: b.min,
    max: b.max,
    count: qualityMap[b.range] ?? 0,
  }));

  // ── Assemble duplicates ───────────────────────────────────────────────────

  const duplicates: DuplicatesReport = {
    total_duplicates: totalDuplicates,
    top_canonical: topCanonicalRows.map((row) => ({
      canonicalId: row.canonical_id,
      count: parseInt(row.count, 10),
      summary: row.summary,
    })),
  };

  // ── Final payload (cacheHit=false — fresh data) ───────────────────────────

  return {
    generatedAt: new Date().toISOString(),
    cacheHit: false,
    summary,
    cycle,
    insights_by_confidence,
    top_applied,
    quality_distribution,
    duplicates,
  };
}
