// Insight DB queries — raw SQL for pgvector operations
import { getSql } from './client.js';
import type { Insight, InsightInput, ConfidenceLevel, InsightStatus, ApplicationProof } from '../types/insight.js';

interface InsightRow {
  id: string;
  source: string;
  nucleus_id: string | null;
  source_ref: string | null;
  confidence_level: string;
  content: string;
  summary: string | null;
  tags: string[];
  embedding: number[] | null;
  status: string;
  quality_score: string | null;
  validation_notes: string | null;
  validated_at: string | null;
  validated_by: string | null;
  application_proof: unknown | null;
  applied_at: string | null;
  canonical_id: string | null;
  is_duplicate: boolean;
  similarity_score: string | null;
  created_at: string;
  updated_at: string;
}

function rowToInsight(row: InsightRow): Insight {
  return {
    id: row.id,
    source: row.source as Insight['source'],
    nucleusId: row.nucleus_id,
    sourceRef: row.source_ref,
    confidenceLevel: row.confidence_level as ConfidenceLevel,
    content: row.content,
    summary: row.summary,
    tags: row.tags,
    embedding: row.embedding ?? [],
    status: row.status as InsightStatus,
    qualityScore: row.quality_score !== null ? parseFloat(row.quality_score) : null,
    validationNotes: row.validation_notes,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
    applicationProof: row.application_proof as Insight['applicationProof'],
    appliedAt: row.applied_at,
    canonicalId: row.canonical_id,
    isDuplicate: row.is_duplicate,
    similarityScore: row.similarity_score !== null ? parseFloat(row.similarity_score) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface InsightCreateData extends InsightInput {
  confidenceLevel: ConfidenceLevel;
  embedding: number[];
  isDuplicate: boolean;
  canonicalId: string | null;
  similarityScore: number | null;
}

export async function insertInsight(data: InsightCreateData): Promise<Insight> {
  const sql = getSql();
  const embeddingStr = `[${data.embedding.join(',')}]`;

  const rows = await sql<InsightRow[]>`
    INSERT INTO insights (
      source, nucleus_id, source_ref, confidence_level,
      content, summary, tags, embedding,
      status, is_duplicate, canonical_id, similarity_score
    ) VALUES (
      ${data.source},
      ${data.nucleusId ?? null},
      ${data.sourceRef ?? null},
      ${data.confidenceLevel},
      ${data.content},
      ${data.summary ?? null},
      ${data.tags ?? []},
      ${embeddingStr}::vector,
      'raw',
      ${data.isDuplicate},
      ${data.canonicalId ?? null},
      ${data.similarityScore ?? null}
    )
    RETURNING *
  `;

  const row = rows[0];
  if (!row) throw new Error('Insert returned no rows');
  return rowToInsight(row);
}

export async function findInsightById(id: string): Promise<Insight | null> {
  const sql = getSql();
  const rows = await sql<InsightRow[]>`
    SELECT * FROM insights WHERE id = ${id}
  `;
  const row = rows[0];
  return row ? rowToInsight(row) : null;
}

export interface ListInsightsOptions {
  status?: InsightStatus;
  source?: Insight['source'];
  nucleusId?: string;
  page?: number;
  limit?: number;
  includeArchived?: boolean; // Story 3.7 — default false excludes archived insights
}

export interface PaginatedInsights {
  data: Insight[];
  total: number;
  page: number;
  limit: number;
}

export async function listInsights(opts: ListInsightsOptions = {}): Promise<PaginatedInsights> {
  const sql = getSql();
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const rows = await sql<InsightRow[]>`
    SELECT * FROM insights
    WHERE 1=1
      ${opts.status ? sql`AND status = ${opts.status}` : sql``}
      ${opts.source ? sql`AND source = ${opts.source}` : sql``}
      ${opts.nucleusId ? sql`AND nucleus_id = ${opts.nucleusId}` : sql``}
      ${!opts.includeArchived ? sql`AND NOT ('archived' = ANY(tags))` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count FROM insights
    WHERE 1=1
      ${opts.status ? sql`AND status = ${opts.status}` : sql``}
      ${opts.source ? sql`AND source = ${opts.source}` : sql``}
      ${opts.nucleusId ? sql`AND nucleus_id = ${opts.nucleusId}` : sql``}
      ${!opts.includeArchived ? sql`AND NOT ('archived' = ANY(tags))` : sql``}
  `;

  const total = parseInt(countRows[0]?.count ?? '0', 10);

  return {
    data: rows.map(rowToInsight),
    total,
    page,
    limit,
  };
}

export async function countInsightsExcludingRejected(): Promise<number> {
  const sql = getSql();
  const rows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count FROM insights WHERE status != 'rejected'
  `;
  return parseInt(rows[0]?.count ?? '0', 10);
}

export interface SimilarInsight {
  id: string;
  similarity: number;
}

export async function findSimilarInsights(
  embedding: number[],
  limit = 5
): Promise<SimilarInsight[]> {
  const sql = getSql();
  const embeddingStr = `[${embedding.join(',')}]`;

  const rows = await sql<Array<{ id: string; similarity: number }>>`
    SELECT id, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM insights
    WHERE status != 'rejected'
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `;

  return rows;
}

// --- Story 3.3: Validate / Reject / Search ---

export async function validateInsight(
  id: string,
  qualityScore: number,
  validatedBy: string,
  validationNotes: string | null,
  threshold: number,
): Promise<Insight | null> {
  const sql = getSql();
  // Only transition to 'validated' if score meets threshold
  const newStatus = qualityScore >= threshold ? 'validated' : 'raw';

  const rows = await sql<InsightRow[]>`
    UPDATE insights
    SET quality_score    = ${qualityScore},
        validation_notes = ${validationNotes ?? null},
        validated_at     = NOW(),
        validated_by     = ${validatedBy},
        status           = ${newStatus}
    WHERE id = ${id}
    RETURNING *
  `;

  const row = rows[0];
  return row ? rowToInsight(row) : null;
}

export async function rejectInsight(id: string, reason: string): Promise<Insight | null> {
  const sql = getSql();

  const rows = await sql<InsightRow[]>`
    UPDATE insights
    SET status           = 'rejected',
        validation_notes = ${reason}
    WHERE id = ${id}
    RETURNING *
  `;

  const row = rows[0];
  return row ? rowToInsight(row) : null;
}

// --- Story 3.4: Apply ---

export async function applyInsight(
  id: string,
  proof: ApplicationProof,
): Promise<Insight | null> {
  const sql = getSql();

  const rows = await sql<InsightRow[]>`
    UPDATE insights
    SET status            = 'applied',
        application_proof = ${JSON.stringify(proof)}::jsonb,
        applied_at        = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  const row = rows[0];
  return row ? rowToInsight(row) : null;
}

export interface SearchInsightsOptions {
  embedding: number[];
  limit?: number;
  statusFilter?: InsightStatus[];
  allowedConfidences?: ConfidenceLevel[];
  threshold?: number;
  includeArchived?: boolean; // Story 3.7 — default false excludes archived insights
}

export interface SearchResult extends Insight {
  similarity: number;
}

export async function searchInsights(opts: SearchInsightsOptions): Promise<SearchResult[]> {
  const sql = getSql();
  const embeddingStr = `[${opts.embedding.join(',')}]`;
  const limit = Math.min(opts.limit ?? 10, 50);
  const threshold = opts.threshold ?? 0.75;
  const statusFilter = opts.statusFilter ?? ['validated', 'applied'];
  const confidences = opts.allowedConfidences ?? ['authoritative', 'high', 'medium'];

  const rows = await sql<Array<InsightRow & { similarity: string | number }>>`
    SELECT *, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM insights
    WHERE status = ANY(${statusFilter}::text[])
      AND confidence_level = ANY(${confidences}::text[])
      AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${threshold}
      ${!opts.includeArchived ? sql`AND NOT ('archived' = ANY(tags))` : sql``}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ...rowToInsight(row),
    similarity: typeof row.similarity === 'number'
      ? row.similarity
      : parseFloat(String(row.similarity)),
  }));
}

// --- Story 3.7: Lifecycle helpers ---

/**
 * Marks raw insights as stale (idempotent via SQL).
 * Criteria: status='raw', created_at older than daysThreshold, no 'stale' tag yet.
 */
export async function markStaleRawInsights(daysThreshold: number): Promise<number> {
  const sql = getSql();
  const result = await sql<InsightRow[]>`
    UPDATE insights
    SET tags = array_append(tags, 'stale'), updated_at = NOW()
    WHERE status = 'raw'
      AND NOT ('stale' = ANY(tags))
      AND created_at < NOW() - (${daysThreshold} || ' days')::interval
    RETURNING id
  `;
  return result.length;
}

/**
 * Marks validated insights (without appliedAt) as stale (idempotent via SQL).
 * Criteria: status='validated', applied_at IS NULL, validated_at older than daysThreshold.
 */
export async function markStaleValidatedInsights(daysThreshold: number): Promise<number> {
  const sql = getSql();
  const result = await sql<InsightRow[]>`
    UPDATE insights
    SET tags = array_append(tags, 'stale'), updated_at = NOW()
    WHERE status = 'validated'
      AND applied_at IS NULL
      AND NOT ('stale' = ANY(tags))
      AND validated_at < NOW() - (${daysThreshold} || ' days')::interval
    RETURNING id
  `;
  return result.length;
}

/**
 * Archives old rejected insights (idempotent via SQL).
 * Criteria: status='rejected', created_at older than daysThreshold, no 'archived' tag yet.
 */
export async function archiveOldRejectedInsights(daysThreshold: number): Promise<number> {
  const sql = getSql();
  const result = await sql<InsightRow[]>`
    UPDATE insights
    SET tags = array_append(tags, 'archived'), updated_at = NOW()
    WHERE status = 'rejected'
      AND NOT ('archived' = ANY(tags))
      AND created_at < NOW() - (${daysThreshold} || ' days')::interval
    RETURNING id
  `;
  return result.length;
}

/**
 * Counts unresolved duplicate insights (is_duplicate = true).
 */
export async function countUnresolvedDuplicates(): Promise<number> {
  const sql = getSql();
  const rows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count FROM insights WHERE is_duplicate = true
  `;
  return parseInt(rows[0]?.count ?? '0', 10);
}

/**
 * Lists duplicate insights paginated (is_duplicate = true).
 */
export async function listDuplicateInsights(
  page: number,
  limit: number,
): Promise<{ data: Insight[]; total: number }> {
  const sql = getSql();
  const offset = (page - 1) * limit;

  const rows = await sql<InsightRow[]>`
    SELECT * FROM insights
    WHERE is_duplicate = true
    ORDER BY canonical_id, created_at
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count FROM insights WHERE is_duplicate = true
  `;

  return {
    data: rows.map(rowToInsight),
    total: parseInt(countRows[0]?.count ?? '0', 10),
  };
}

export type PendingReason = 'stale_raw' | 'stale_validated' | 'unresolved_duplicate';

/**
 * Lists pending insights (stale raw, stale validated, unresolved duplicates) paginated.
 * Optionally filter by reason type.
 */
export async function listPendingInsights(
  page: number,
  limit: number,
  reasonFilter?: PendingReason,
): Promise<{ data: Array<Insight & { pendingReason: PendingReason }>; total: number }> {
  const sql = getSql();
  const offset = (page - 1) * limit;

  const includeStaleRaw = !reasonFilter || reasonFilter === 'stale_raw';
  const includeStaleValidated = !reasonFilter || reasonFilter === 'stale_validated';
  const includeDuplicates = !reasonFilter || reasonFilter === 'unresolved_duplicate';

  type PendingRow = InsightRow & { pending_reason: string };

  // Build union of applicable queries
  const rows = await sql<PendingRow[]>`
    SELECT q.*, q.pending_reason FROM (
      ${includeStaleRaw ? sql`
        SELECT *, 'stale_raw'::text AS pending_reason FROM insights
        WHERE status = 'raw' AND 'stale' = ANY(tags)
      ` : sql`SELECT * FROM insights WHERE false, 'stale_raw'::text AS pending_reason`}
      ${includeStaleValidated ? sql`
        UNION ALL
        SELECT *, 'stale_validated'::text AS pending_reason FROM insights
        WHERE status = 'validated' AND 'stale' = ANY(tags)
      ` : sql``}
      ${includeDuplicates ? sql`
        UNION ALL
        SELECT *, 'unresolved_duplicate'::text AS pending_reason FROM insights
        WHERE is_duplicate = true
      ` : sql``}
    ) AS q
    ORDER BY q.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count FROM (
      ${includeStaleRaw ? sql`
        SELECT id FROM insights WHERE status = 'raw' AND 'stale' = ANY(tags)
      ` : sql`SELECT id FROM insights WHERE false`}
      ${includeStaleValidated ? sql`
        UNION ALL
        SELECT id FROM insights WHERE status = 'validated' AND 'stale' = ANY(tags)
      ` : sql``}
      ${includeDuplicates ? sql`
        UNION ALL
        SELECT id FROM insights WHERE is_duplicate = true
      ` : sql``}
    ) AS combined
  `;

  return {
    data: rows.map((row) => ({
      ...rowToInsight(row),
      pendingReason: row.pending_reason as PendingReason,
    })),
    total: parseInt(countRows[0]?.count ?? '0', 10),
  };
}

/**
 * Resolves a duplicate by promoting it to an independent insight (keep action).
 */
export async function keepDuplicateInsight(id: string): Promise<Insight | null> {
  const sql = getSql();
  const rows = await sql<InsightRow[]>`
    UPDATE insights
    SET is_duplicate = false,
        canonical_id = null,
        validation_notes = 'Promovido a independente — ciclo de vida',
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? rowToInsight(rows[0]) : null;
}
