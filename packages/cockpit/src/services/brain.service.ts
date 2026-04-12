// Brain Service — fetches collective brain status for Cockpit panel
// Calls /brain/health and /brain/dashboard in parallel (Promise.all)
// Graceful degradation: returns healthy:false if Brain API is offline

const BRAIN_URL = process.env['BRAIN_URL'] ?? 'http://localhost:3003';

// ─── Response types from Brain API ──────────────────────────────────────────

export interface BrainHealthResponse {
  status: string;
  db: string;
  embeddingService: string;
}

export interface TopAppliedInsight {
  id: string;
  content: string;
  quality_score?: number | null;
  source?: string;
  tags?: string[];
}

export interface BrainDashboardResponse {
  generatedAt: string;
  cacheHit: boolean;
  summary: {
    total: number;
    by_status: {
      raw: number;
      validated: number;
      applied: number;
      rejected: number;
    };
    by_source: {
      zenya_operation: number;
      agent_research: number;
      mauro_input: number;
    };
    total_duplicates: number;
    avg_quality_score: number | null;
  };
  cycle: {
    ingested: number;
    validated: number;
    applied: number;
    rejected: number;
    completionRate: number;
  };
  top_applied: TopAppliedInsight[];
}

// ─── Consolidated return type ────────────────────────────────────────────────

export type BrainStatus =
  | {
      healthy: true;
      health: BrainHealthResponse;
      dashboard: BrainDashboardResponse;
      topApplied: TopAppliedInsight[];
    }
  | {
      healthy: false;
      error: string;
    };

// ─── Service function ────────────────────────────────────────────────────────

/**
 * Fetch Brain health and dashboard data in parallel.
 * Returns consolidated BrainStatus — never throws.
 * If Brain is offline or unreachable, returns { healthy: false }.
 */
export async function getBrainStatus(): Promise<BrainStatus> {
  try {
    const [healthRes, dashRes] = await Promise.all([
      fetch(`${BRAIN_URL}/brain/health`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${BRAIN_URL}/brain/dashboard`, { signal: AbortSignal.timeout(5000) }),
    ]);

    if (!healthRes.ok || !dashRes.ok) {
      return {
        healthy: false,
        error: `Brain API respondeu com erro — health: ${healthRes.status}, dashboard: ${dashRes.status}`,
      };
    }

    const health = (await healthRes.json()) as BrainHealthResponse;
    const dashboard = (await dashRes.json()) as BrainDashboardResponse;

    // Safe access: only the first 3 top_applied entries
    const topApplied: TopAppliedInsight[] = Array.isArray(dashboard.top_applied)
      ? dashboard.top_applied.slice(0, 3)
      : [];

    return { healthy: true, health, dashboard, topApplied };
  } catch {
    return { healthy: false, error: 'Brain API indisponível' };
  }
}
