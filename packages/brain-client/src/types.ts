// Brain Client — local type definitions
// Source of truth: packages/brain/src/types/insight.ts + docs/architecture/cerebro-coletivo.md §3
// Copied here to avoid circular dependency (client ← server would be wrong direction)

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
  id: string;
  source: InsightSource;
  nucleusId: string | null;
  sourceRef: string | null;
  confidenceLevel: ConfidenceLevel;
  content: string;
  summary: string | null;
  tags: string[];
  embedding: number[];
  status: InsightStatus;
  qualityScore: number | null;
  validationNotes: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  applicationProof: ApplicationProof | null;
  appliedAt: string | null;
  canonicalId: string | null;
  isDuplicate: boolean;
  similarityScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult extends Insight {
  similarity: number;
}

export interface InsightInput {
  source: InsightSource;
  content: string;
  nucleusId?: string;
  sourceRef?: string;
  tags?: string[];
  summary?: string;
}

export interface ListFilters {
  status?: InsightStatus;
  source?: InsightSource;
  nucleusId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedInsights {
  data: Insight[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  statusFilter?: InsightStatus[];
  minConfidence?: ConfidenceLevel;
}

/** Reduced context entry optimised for agent prompt injection */
export interface ContextEntry {
  id: string;
  content: string;
  source: InsightSource;
  confidenceLevel: ConfidenceLevel;
  similarity: number;
}
