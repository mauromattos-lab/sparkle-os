// Collective Brain — Core Types
// Source of truth: docs/architecture/cerebro-coletivo.md §3.1, §3.2, §3.3

export type InsightSource = 'zenya_operation' | 'agent_research' | 'mauro_input';
export type InsightStatus = 'raw' | 'validated' | 'applied' | 'rejected';
export type ConfidenceLevel = 'authoritative' | 'high' | 'medium';

export interface Metric {
  name: string;
  value: number;
  unit: string;
  measuredAt: string; // ISO 8601
}

export interface ApplicationProof {
  appliedAt: string;
  appliedBy: string;
  changeDescription: string;
  baselineMetric: Metric;
  resultMetric: Metric;
  improvementPercent: number;
  storyId: string | null;
  nucleusId: string | null;
  evidenceRef: string | null;
}

export interface Insight {
  // Identity
  id: string; // UUID v4

  // Origin
  source: InsightSource;
  nucleusId: string | null;
  sourceRef: string | null;
  confidenceLevel: ConfidenceLevel;

  // Content
  content: string; // max 2000 chars
  summary: string | null; // max 200 chars
  tags: string[];

  // Vector (Voyage-3, 1024 dims, HNSW index)
  embedding: number[];

  // Lifecycle
  status: InsightStatus;

  // Validation
  qualityScore: number | null; // 0.0–1.0
  validationNotes: string | null;
  validatedAt: string | null;
  validatedBy: string | null;

  // Application (FR6 — full cycle mandatory)
  applicationProof: ApplicationProof | null;
  appliedAt: string | null;

  // Canonicalization
  canonicalId: string | null;
  isDuplicate: boolean;
  similarityScore: number | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface InsightInput {
  source: InsightSource;
  content: string; // max 2000 chars
  nucleusId?: string;
  sourceRef?: string;
  tags?: string[];
  summary?: string;
}

// Confidence level derived from source — docs/architecture/cerebro-coletivo.md §3.3
export const CONFIDENCE_BY_SOURCE: Record<InsightSource, ConfidenceLevel> = {
  mauro_input: 'authoritative',
  zenya_operation: 'high',
  agent_research: 'medium',
};

// Zenya execution log row (from zenya_execution_log table)
export interface ZenyaExecutionLog {
  id: string;
  flowId: string;
  flowName: string;
  executionId: string | null;
  status: 'success' | 'error';
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
