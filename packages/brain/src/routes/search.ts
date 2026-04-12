// Search route — POST /brain/insights/search
// Semantic search via HNSW cosine similarity (Story 3.3)
// API spec: docs/architecture/cerebro-coletivo.md §6

import { Hono } from 'hono';
import { generateEmbedding } from '../services/embedding.service.js';
import { searchInsights } from '../db/insights.js';
import type { ConfidenceLevel, InsightStatus } from '../types/insight.js';

export const searchRouter = new Hono();

// Confidence level ordering for minConfidence filter
const CONFIDENCE_ORDER: ConfidenceLevel[] = ['authoritative', 'high', 'medium'];

function resolveAllowedConfidences(minConfidence?: ConfidenceLevel): ConfidenceLevel[] {
  if (!minConfidence) return ['authoritative', 'high', 'medium'];
  const minIdx = CONFIDENCE_ORDER.indexOf(minConfidence);
  // Include minConfidence and all levels above (more trusted)
  return CONFIDENCE_ORDER.slice(0, minIdx + 1);
}

const VALID_STATUSES: InsightStatus[] = ['raw', 'validated', 'applied', 'rejected'];
const VALID_CONFIDENCES: ConfidenceLevel[] = ['authoritative', 'high', 'medium'];

// POST /brain/insights/search
searchRouter.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Request body must be a JSON object' }, 400);
  }

  const raw = body as Record<string, unknown>;

  if (typeof raw['query'] !== 'string' || raw['query'].trim().length === 0) {
    return c.json({ error: 'query is required and must be a non-empty string' }, 400);
  }

  const query = raw['query'];
  const limit = typeof raw['limit'] === 'number' ? raw['limit'] : 10;
  const threshold = typeof raw['threshold'] === 'number' ? raw['threshold'] : 0.75;
  // Story 3.7: exclude archived by default; pass includeArchived=true to include them
  const includeArchived = raw['includeArchived'] === true;

  // Validate threshold range
  if (threshold < 0 || threshold > 1) {
    return c.json({ error: 'threshold must be between 0.0 and 1.0' }, 400);
  }

  // Parse statusFilter
  let statusFilter: InsightStatus[] = ['validated', 'applied'];
  if (Array.isArray(raw['statusFilter'])) {
    const provided = raw['statusFilter'].filter((s): s is string => typeof s === 'string');
    const invalid = provided.filter((s) => !VALID_STATUSES.includes(s as InsightStatus));
    if (invalid.length > 0) {
      return c.json({ error: `Invalid statusFilter values: ${invalid.join(', ')}` }, 400);
    }
    statusFilter = provided as InsightStatus[];
  }

  // Parse minConfidence
  let allowedConfidences: ConfidenceLevel[] = ['authoritative', 'high', 'medium'];
  if (raw['minConfidence'] !== undefined) {
    if (typeof raw['minConfidence'] !== 'string' || !VALID_CONFIDENCES.includes(raw['minConfidence'] as ConfidenceLevel)) {
      return c.json({ error: `Invalid minConfidence: must be one of ${VALID_CONFIDENCES.join(', ')}` }, 400);
    }
    allowedConfidences = resolveAllowedConfidences(raw['minConfidence'] as ConfidenceLevel);
  }

  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Search via HNSW
    const results = await searchInsights({
      embedding,
      limit,
      statusFilter,
      allowedConfidences,
      threshold,
      includeArchived,
    });

    return c.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    // Embedding service errors (missing API key, etc.)
    if (message.includes('VOYAGE_API_KEY') || message.includes('Voyage API')) {
      return c.json({ error: 'Embedding service unavailable', details: message }, 503);
    }
    console.error('[search] error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
