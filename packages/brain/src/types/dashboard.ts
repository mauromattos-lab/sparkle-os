// Dashboard types — Story 3.9
// DashboardData is the data contract for Epic 4 frontend consumption.

export interface DashboardData {
  generatedAt: string; // ISO 8601 — timestamp da geração
  cacheHit: boolean; // true se veio do cache em memória
  summary: DashboardSummary;
  cycle: CycleMetrics;
  insights_by_confidence: ConfidenceBreakdown;
  top_applied: TopAppliedInsight[];
  quality_distribution: QualityBucket[];
  duplicates: DuplicatesReport;
}

export interface DashboardSummary {
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
  avg_quality_score: number | null; // null se não houver insights validados/aplicados
}

export interface CycleMetrics {
  ingested: number; // total criados (todos os status)
  validated: number; // total que chegaram a validated, applied ou além
  applied: number; // total com status='applied'
  rejected: number; // total com status='rejected'
  completionRate: number; // applied / ingested * 100, 2 casas decimais (0 se ingested=0)
}

export interface ConfidenceBreakdown {
  authoritative: number;
  high: number;
  medium: number;
}

export interface TopAppliedInsight {
  id: string;
  summary: string | null;
  source: string;
  confidenceLevel: string;
  appliedAt: string | null;
  improvementPercent: number | null;
  nucleusId: string | null;
}

export interface QualityBucket {
  range: string; // ex: "0.0–0.2"
  min: number; // ex: 0.0
  max: number; // ex: 0.2
  count: number;
}

export interface DuplicatesReport {
  total_duplicates: number;
  top_canonical: TopCanonical[];
}

export interface TopCanonical {
  canonicalId: string;
  count: number;
  summary: string | null;
}
