// Dashboard Service — Story 3.9
// Uses get_dashboard_aggregates() RPC via Supabase REST API.
// In-memory cache with TTL 60s to avoid repeated queries.

import { getSupabase } from '../db/client.js';
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

export function clearDashboardCache(): void {
  _cache = null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

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

async function fetchDashboardData(): Promise<DashboardData> {
  const sb = getSupabase();

  const { data: raw, error } = await sb.rpc('get_dashboard_aggregates');
  if (error) throw new Error(`get_dashboard_aggregates failed: ${error.message}`);

  const agg = raw as {
    summary: {
      raw: number; validated: number; applied: number; rejected: number;
      total: number; total_duplicates: number; avg_quality_score: number | null;
    };
    by_source: Record<string, number>;
    by_confidence: Record<string, number>;
    top_applied: Array<{
      id: string; summary: string | null; source: string;
      confidence_level: string; applied_at: string | null;
      improvement_percent: number | null; nucleus_id: string | null;
    }> | null;
    quality_distribution: Array<{ range: string; count: number }> | null;
    top_canonical: Array<{
      canonical_id: string; count: number; summary: string | null;
    }> | null;
  };

  const s = agg.summary;
  const statusCounts = {
    raw: Number(s.raw ?? 0),
    validated: Number(s.validated ?? 0),
    applied: Number(s.applied ?? 0),
    rejected: Number(s.rejected ?? 0),
  };
  const total = Number(s.total ?? 0);
  const totalDuplicates = Number(s.total_duplicates ?? 0);
  const avgQualityScore = s.avg_quality_score != null ? Number(s.avg_quality_score) : null;

  const src = agg.by_source ?? {};
  const bySource = {
    zenya_operation: Number(src['zenya_operation'] ?? 0),
    agent_research: Number(src['agent_research'] ?? 0),
    mauro_input: Number(src['mauro_input'] ?? 0),
  };

  const summary: DashboardSummary = {
    total,
    by_status: statusCounts,
    by_source: bySource,
    total_duplicates: totalDuplicates,
    avg_quality_score: avgQualityScore,
  };

  const cycleValidated = statusCounts.validated + statusCounts.applied;
  const completionRate = total > 0
    ? Math.round((statusCounts.applied / total) * 100 * 100) / 100
    : 0;

  const cycle: CycleMetrics = {
    ingested: total,
    validated: cycleValidated,
    applied: statusCounts.applied,
    rejected: statusCounts.rejected,
    completionRate,
  };

  const conf = agg.by_confidence ?? {};
  const insights_by_confidence: ConfidenceBreakdown = {
    authoritative: Number(conf['authoritative'] ?? 0),
    high: Number(conf['high'] ?? 0),
    medium: Number(conf['medium'] ?? 0),
  };

  const top_applied: TopAppliedInsight[] = (agg.top_applied ?? []).map((row) => ({
    id: row.id,
    summary: row.summary,
    source: row.source,
    confidenceLevel: row.confidence_level,
    appliedAt: row.applied_at,
    improvementPercent: row.improvement_percent != null ? Number(row.improvement_percent) : null,
    nucleusId: row.nucleus_id,
  }));

  const ALL_BUCKETS = [
    { range: '0.0-0.2', min: 0.0, max: 0.2 },
    { range: '0.2-0.4', min: 0.2, max: 0.4 },
    { range: '0.4-0.6', min: 0.4, max: 0.6 },
    { range: '0.6-0.8', min: 0.6, max: 0.8 },
    { range: '0.8-1.0', min: 0.8, max: 1.0 },
  ];
  const qualityMap: Record<string, number> = {};
  for (const row of agg.quality_distribution ?? []) {
    qualityMap[row.range] = Number(row.count);
  }
  const quality_distribution: QualityBucket[] = ALL_BUCKETS.map((b) => ({
    range: b.range,
    min: b.min,
    max: b.max,
    count: qualityMap[b.range] ?? 0,
  }));

  const duplicates: DuplicatesReport = {
    total_duplicates: totalDuplicates,
    top_canonical: (agg.top_canonical ?? []).map((row) => ({
      canonicalId: row.canonical_id,
      count: Number(row.count),
      summary: row.summary,
    })),
  };

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
