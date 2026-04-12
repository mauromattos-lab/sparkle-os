// Ingest Service — full pipeline: validate → embed → canonicalize → persist
// Algorithm: docs/architecture/cerebro-coletivo.md §5 (Ingestão) and §7 (Canonicalização)

import { generateEmbedding } from './embedding.service.js';
import {
  insertInsight,
  countInsightsExcludingRejected,
  findSimilarInsights,
} from '../db/insights.js';
import { CONFIDENCE_BY_SOURCE } from '../types/insight.js';
import type { Insight, InsightInput } from '../types/insight.js';

const CANONICALIZATION_THRESHOLD = 0.92;

interface CanonicalCheck {
  isDuplicate: boolean;
  canonicalId: string | null;
  similarityScore: number | null;
}

async function checkCanonical(embedding: number[]): Promise<CanonicalCheck> {
  // Step 1: Skip if DB is empty (HNSW requires at least 1 vector)
  const count = await countInsightsExcludingRejected();
  if (count === 0) {
    return { isDuplicate: false, canonicalId: null, similarityScore: null };
  }

  // Step 2: Find top 5 most similar (excluding rejected)
  const similars = await findSimilarInsights(embedding, 5);

  // Step 3: Check threshold 0.92
  const top = similars[0];
  if (top && top.similarity > CANONICALIZATION_THRESHOLD) {
    return {
      isDuplicate: true,
      canonicalId: top.id,
      similarityScore: top.similarity,
    };
  }

  return { isDuplicate: false, canonicalId: null, similarityScore: null };
}

function validateInput(input: InsightInput): void {
  if (!input.source) throw new Error('source is required');
  if (!['zenya_operation', 'agent_research', 'mauro_input'].includes(input.source)) {
    throw new Error(`Invalid source: ${input.source}`);
  }
  if (!input.content || input.content.trim().length === 0) {
    throw new Error('content is required');
  }
  if (input.content.length > 2000) {
    throw new Error('content exceeds 2000 character limit');
  }
  if (input.summary && input.summary.length > 200) {
    throw new Error('summary exceeds 200 character limit');
  }
}

export async function ingestInsight(input: InsightInput): Promise<Insight> {
  // Validate input
  validateInput(input);

  // Derive confidence level from source (cerebro-coletivo.md §3.3)
  const confidenceLevel = CONFIDENCE_BY_SOURCE[input.source];

  // Generate embedding (Voyage-3, 1024 dims)
  const embedding = await generateEmbedding(input.content);

  // Canonicalization check (cerebro-coletivo.md §7)
  const canonical = await checkCanonical(embedding);

  // Persist with status='raw' (exactOptionalPropertyTypes: omit undefined optional fields)
  const insight = await insertInsight({
    source: input.source,
    content: input.content,
    tags: input.tags ?? [],
    confidenceLevel,
    embedding,
    isDuplicate: canonical.isDuplicate,
    canonicalId: canonical.canonicalId,
    similarityScore: canonical.similarityScore,
    ...(input.nucleusId ? { nucleusId: input.nucleusId } : {}),
    ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    ...(input.summary ? { summary: input.summary } : {}),
  });

  return insight;
}
