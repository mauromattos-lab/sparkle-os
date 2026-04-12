// Insight DB queries — Supabase REST API (replaces postgres.js / pgvector direct)
import { getSupabase } from './client.js';
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
  embedding: unknown;
  status: string;
  quality_score: number | null;
  validation_notes: string | null;
  validated_at: string | null;
  validated_by: string | null;
  application_proof: unknown | null;
  applied_at: string | null;
  canonical_id: string | null;
  is_duplicate: boolean;
  similarity_score: number | null;
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
    embedding: [],
    status: row.status as InsightStatus,
    qualityScore: row.quality_score ?? null,
    validationNotes: row.validation_notes,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
    applicationProof: row.application_proof as Insight['applicationProof'],
    appliedAt: row.applied_at,
    canonicalId: row.canonical_id,
    isDuplicate: row.is_duplicate,
    similarityScore: row.similarity_score ?? null,
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
  const sb = getSupabase();

  const { data: rows, error } = await sb
    .from('insights')
    .insert({
      source: data.source,
      nucleus_id: data.nucleusId ?? null,
      source_ref: data.sourceRef ?? null,
      confidence_level: data.confidenceLevel,
      content: data.content,
      summary: data.summary ?? null,
      tags: data.tags ?? [],
      // PostgREST accepts vector as string "[x,y,z,...]"
      embedding: data.embedding.length > 0 ? `[${data.embedding.join(',')}]` : null,
      status: 'raw',
      is_duplicate: data.isDuplicate,
      canonical_id: data.canonicalId ?? null,
      similarity_score: data.similarityScore ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`insertInsight failed: ${error.message}`);
  if (!rows) throw new Error('Insert returned no rows');
  return rowToInsight(rows as InsightRow);
}

export async function findInsightById(id: string): Promise<Insight | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('insights')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`findInsightById failed: ${error.message}`);
  return data ? rowToInsight(data as InsightRow) : null;
}

export interface ListInsightsOptions {
  status?: InsightStatus;
  source?: Insight['source'];
  nucleusId?: string;
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}

export interface PaginatedInsights {
  data: Insight[];
  total: number;
  page: number;
  limit: number;
}

export async function listInsights(opts: ListInsightsOptions = {}): Promise<PaginatedInsights> {
  const sb = getSupabase();
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  let query = sb.from('insights').select('*', { count: 'exact' });

  if (opts.status) query = query.eq('status', opts.status);
  if (opts.source) query = query.eq('source', opts.source);
  if (opts.nucleusId) query = query.eq('nucleus_id', opts.nucleusId);
  if (!opts.includeArchived) query = query.not('tags', 'cs', '{"archived"}');

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`listInsights failed: ${error.message}`);

  return {
    data: (data ?? []).map((r) => rowToInsight(r as InsightRow)),
    total: count ?? 0,
    page,
    limit,
  };
}

export async function countInsightsExcludingRejected(): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb
    .from('insights')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'rejected');

  if (error) throw new Error(`countInsightsExcludingRejected failed: ${error.message}`);
  return count ?? 0;
}

export interface SimilarInsight {
  id: string;
  similarity: number;
}

export async function findSimilarInsights(
  embedding: number[],
  limit = 5,
): Promise<SimilarInsight[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('find_similar_insights', {
    query_embedding: `[${embedding.join(',')}]`,
    match_count: limit,
  });

  if (error) throw new Error(`findSimilarInsights failed: ${error.message}`);
  return (data ?? []) as SimilarInsight[];
}

export async function validateInsight(
  id: string,
  qualityScore: number,
  validatedBy: string,
  validationNotes: string | null,
  threshold: number,
): Promise<Insight | null> {
  const sb = getSupabase();
  const newStatus = qualityScore >= threshold ? 'validated' : 'raw';

  const { data, error } = await sb
    .from('insights')
    .update({
      quality_score: qualityScore,
      validation_notes: validationNotes ?? null,
      validated_at: new Date().toISOString(),
      validated_by: validatedBy,
      status: newStatus,
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`validateInsight failed: ${error.message}`);
  return data ? rowToInsight(data as InsightRow) : null;
}

export async function rejectInsight(id: string, reason: string): Promise<Insight | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('insights')
    .update({ status: 'rejected', validation_notes: reason })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`rejectInsight failed: ${error.message}`);
  return data ? rowToInsight(data as InsightRow) : null;
}

export async function applyInsight(id: string, proof: ApplicationProof): Promise<Insight | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('insights')
    .update({
      status: 'applied',
      application_proof: proof,
      applied_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`applyInsight failed: ${error.message}`);
  return data ? rowToInsight(data as InsightRow) : null;
}

export interface SearchInsightsOptions {
  embedding: number[];
  limit?: number;
  statusFilter?: InsightStatus[];
  allowedConfidences?: ConfidenceLevel[];
  threshold?: number;
  includeArchived?: boolean;
}

export interface SearchResult extends Insight {
  similarity: number;
}

export async function searchInsights(opts: SearchInsightsOptions): Promise<SearchResult[]> {
  const sb = getSupabase();
  const limit = Math.min(opts.limit ?? 10, 50);
  const threshold = opts.threshold ?? 0.75;
  const statusFilter = opts.statusFilter ?? ['validated', 'applied'];
  const confidences = opts.allowedConfidences ?? ['authoritative', 'high', 'medium'];

  const { data, error } = await sb.rpc('search_insights_by_embedding', {
    query_embedding: `[${opts.embedding.join(',')}]`,
    match_threshold: threshold,
    match_count: limit,
    status_filter: statusFilter,
    confidence_filter: confidences,
    include_archived: opts.includeArchived ?? false,
  });

  if (error) throw new Error(`searchInsights failed: ${error.message}`);

  return (data ?? []).map((row: InsightRow & { similarity: number }) => ({
    ...rowToInsight(row),
    similarity: row.similarity,
  }));
}

// --- Story 3.7: Lifecycle helpers ---

export async function markStaleRawInsights(daysThreshold: number): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('mark_stale_raw_insights', { days_threshold: daysThreshold });
  if (error) throw new Error(`markStaleRawInsights failed: ${error.message}`);
  return (data as number) ?? 0;
}

export async function markStaleValidatedInsights(daysThreshold: number): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('mark_stale_validated_insights', { days_threshold: daysThreshold });
  if (error) throw new Error(`markStaleValidatedInsights failed: ${error.message}`);
  return (data as number) ?? 0;
}

export async function archiveOldRejectedInsights(daysThreshold: number): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('archive_old_rejected_insights', { days_threshold: daysThreshold });
  if (error) throw new Error(`archiveOldRejectedInsights failed: ${error.message}`);
  return (data as number) ?? 0;
}

export async function countUnresolvedDuplicates(): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb
    .from('insights')
    .select('*', { count: 'exact', head: true })
    .eq('is_duplicate', true);
  if (error) throw new Error(`countUnresolvedDuplicates failed: ${error.message}`);
  return count ?? 0;
}

export async function listDuplicateInsights(
  page: number,
  limit: number,
): Promise<{ data: Insight[]; total: number }> {
  const sb = getSupabase();
  const offset = (page - 1) * limit;

  const { data, count, error } = await sb
    .from('insights')
    .select('*', { count: 'exact' })
    .eq('is_duplicate', true)
    .order('canonical_id')
    .order('created_at')
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`listDuplicateInsights failed: ${error.message}`);

  return {
    data: (data ?? []).map((r) => rowToInsight(r as InsightRow)),
    total: count ?? 0,
  };
}

export type PendingReason = 'stale_raw' | 'stale_validated' | 'unresolved_duplicate';

export async function listPendingInsights(
  page: number,
  limit: number,
  reasonFilter?: PendingReason,
): Promise<{ data: Array<Insight & { pendingReason: PendingReason }>; total: number }> {
  const sb = getSupabase();
  const offset = (page - 1) * limit;

  const { data, error } = await sb.rpc('list_pending_insights', {
    p_limit: limit,
    p_offset: offset,
    p_reason: reasonFilter ?? null,
  });

  if (error) throw new Error(`listPendingInsights failed: ${error.message}`);

  const rows = (data ?? []) as Array<InsightRow & { pending_reason: string; total_count: number }>;
  const total = rows[0]?.total_count ?? 0;

  return {
    data: rows.map((row) => ({
      ...rowToInsight(row),
      pendingReason: row.pending_reason as PendingReason,
    })),
    total,
  };
}

export async function keepDuplicateInsight(id: string): Promise<Insight | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('insights')
    .update({
      is_duplicate: false,
      canonical_id: null,
      validation_notes: 'Promovido a independente — ciclo de vida',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`keepDuplicateInsight failed: ${error.message}`);
  return data ? rowToInsight(data as InsightRow) : null;
}
