// Insights routes — POST /brain/insights, GET /brain/insights, GET /brain/insights/:id
// API spec: docs/architecture/cerebro-coletivo.md §6

import { Hono } from 'hono';
import { ingestInsight } from '../services/ingest.service.js';
import { findInsightById, listInsights, validateInsight, rejectInsight, applyInsight } from '../db/insights.js';
import { QUALITY_THRESHOLD } from '../services/quality.service.js';
import type { InsightInput, InsightStatus, ApplicationProof, Metric } from '../types/insight.js';

function isMetric(m: unknown): m is Metric {
  if (!m || typeof m !== 'object') return false;
  const metric = m as Record<string, unknown>;
  return (
    typeof metric['name'] === 'string' &&
    typeof metric['value'] === 'number' &&
    typeof metric['unit'] === 'string' &&
    typeof metric['measuredAt'] === 'string'
  );
}

function isApplicationProof(p: unknown): p is ApplicationProof {
  if (!p || typeof p !== 'object') return false;
  const proof = p as Record<string, unknown>;
  return (
    typeof proof['appliedAt'] === 'string' &&
    typeof proof['appliedBy'] === 'string' &&
    typeof proof['changeDescription'] === 'string' &&
    typeof proof['improvementPercent'] === 'number' &&
    isMetric(proof['baselineMetric']) &&
    isMetric(proof['resultMetric'])
  );
}

export const insightsRouter = new Hono();

// POST /brain/insights — ingest a new insight
insightsRouter.post('/', async (c) => {
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

  if (typeof raw['source'] !== 'string') {
    return c.json({ error: 'source is required and must be a string' }, 400);
  }
  if (typeof raw['content'] !== 'string') {
    return c.json({ error: 'content is required and must be a string' }, 400);
  }

  // Build input, omitting optional fields when not present (exactOptionalPropertyTypes)
  const input: InsightInput = {
    source: raw['source'] as InsightInput['source'],
    content: raw['content'],
    ...(typeof raw['nucleusId'] === 'string' ? { nucleusId: raw['nucleusId'] } : {}),
    ...(typeof raw['sourceRef'] === 'string' ? { sourceRef: raw['sourceRef'] } : {}),
    ...(typeof raw['summary'] === 'string' ? { summary: raw['summary'] } : {}),
    ...(Array.isArray(raw['tags'])
      ? { tags: raw['tags'].filter((t): t is string => typeof t === 'string') }
      : {}),
  };

  try {
    const insight = await ingestInsight(input);
    return c.json(insight, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingest failed';
    if (
      message.includes('is required') ||
      message.includes('exceeds') ||
      message.includes('Invalid source')
    ) {
      return c.json({ error: message }, 400);
    }
    console.error('[insights] ingest error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /brain/insights/ingest — external knowledge ingestion endpoint (Story 3.6)
// Thin wrapper over ingestInsight with source-specific validations and automatic confidenceLevel.
// IMPORTANT: registered before /:id to avoid route conflict in Hono.
insightsRouter.post('/ingest', async (c) => {
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

  // Validate content (AC 6)
  if (raw['content'] === undefined || raw['content'] === null) {
    return c.json({ error: 'content is required' }, 400);
  }
  if (typeof raw['content'] !== 'string' || raw['content'].trim().length === 0) {
    return c.json({ error: 'content must be a non-empty string' }, 400);
  }
  if (raw['content'].length > 2000) {
    return c.json({ error: 'content exceeds 2000 character limit' }, 400);
  }

  // Validate source — only external sources allowed on /ingest (AC 1)
  if (!['mauro_input', 'agent_research'].includes(raw['source'] as string)) {
    return c.json({ error: 'source must be mauro_input or agent_research' }, 400);
  }

  const source = raw['source'] as 'mauro_input' | 'agent_research';

  // Source-specific validation: agent_research requires sourceRef (AC 1)
  if (source === 'agent_research' && !raw['sourceRef']) {
    return c.json({ error: 'sourceRef is required for agent_research (e.g. "story:3.6")' }, 400);
  }

  // Build InsightInput — confidenceLevel is derived by ingestInsight from source (AC 1)
  const input: InsightInput = {
    source,
    content: raw['content'],
    ...(typeof raw['nucleusId'] === 'string' ? { nucleusId: raw['nucleusId'] } : {}),
    ...(typeof raw['sourceRef'] === 'string' ? { sourceRef: raw['sourceRef'] } : {}),
    ...(typeof raw['summary'] === 'string' ? { summary: raw['summary'] } : {}),
    ...(Array.isArray(raw['tags'])
      ? { tags: raw['tags'].filter((t): t is string => typeof t === 'string') }
      : {}),
  };

  try {
    const insight = await ingestInsight(input);
    return c.json(insight, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingest failed';
    if (
      message.includes('is required') ||
      message.includes('exceeds') ||
      message.includes('Invalid source')
    ) {
      return c.json({ error: message }, 400);
    }
    console.error('[insights] ingest error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /brain/insights — list with pagination and filters
insightsRouter.get('/', async (c) => {
  const statusParam = c.req.query('status');
  const sourceParam = c.req.query('source');
  const nucleusId = c.req.query('nucleusId');
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = parseInt(c.req.query('limit') ?? '20', 10);
  // Story 3.7: exclude archived by default; pass includeArchived=true to include them
  const includeArchived = c.req.query('includeArchived') === 'true';

  const validStatuses: InsightStatus[] = ['raw', 'validated', 'applied', 'rejected'];
  if (statusParam && !validStatuses.includes(statusParam as InsightStatus)) {
    return c.json({ error: `Invalid status: ${statusParam}` }, 400);
  }

  const status = statusParam as InsightStatus | undefined;
  const source = sourceParam as InsightInput['source'] | undefined;

  try {
    const result = await listInsights({
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(nucleusId ? { nucleusId } : {}),
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 20 : limit,
      includeArchived,
    });
    return c.json(result);
  } catch (err) {
    console.error('[insights] list error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /brain/insights/:id — get single insight
insightsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  try {
    const insight = await findInsightById(id);
    if (!insight) return c.json({ error: 'Insight not found' }, 404);
    return c.json(insight);
  } catch (err) {
    console.error('[insights] findById error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /brain/insights/:id/validate — validate insight quality (Story 3.3)
insightsRouter.patch('/:id/validate', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

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

  if (typeof raw['qualityScore'] !== 'number') {
    return c.json({ error: 'qualityScore is required and must be a number' }, 400);
  }
  if (typeof raw['validatedBy'] !== 'string' || raw['validatedBy'].trim().length === 0) {
    return c.json({ error: 'validatedBy is required and must be a non-empty string' }, 400);
  }

  const qualityScore = raw['qualityScore'];
  if (qualityScore < 0 || qualityScore > 1) {
    return c.json({ error: 'qualityScore must be between 0.0 and 1.0' }, 400);
  }

  const validatedBy = raw['validatedBy'];
  const validationNotes = typeof raw['validationNotes'] === 'string' ? raw['validationNotes'] : null;

  try {
    const insight = await validateInsight(id, qualityScore, validatedBy, validationNotes, QUALITY_THRESHOLD);
    if (!insight) return c.json({ error: 'Insight not found' }, 404);
    return c.json(insight);
  } catch (err) {
    console.error('[insights] validate error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /brain/insights/:id/apply — register insight application (Story 3.4, FR6)
insightsRouter.patch('/:id/apply', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

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

  if (!isApplicationProof(raw['applicationProof'])) {
    return c.json({
      error:
        'applicationProof is required and must include: appliedAt, appliedBy, changeDescription, improvementPercent (number), baselineMetric, resultMetric (each with name, value, unit, measuredAt)',
    }, 400);
  }

  const proof = raw['applicationProof'];

  try {
    const existing = await findInsightById(id);
    if (!existing) return c.json({ error: 'Insight not found' }, 404);
    if (existing.status !== 'validated') {
      return c.json(
        { error: `Insight must be in 'validated' status to be applied. Current status: '${existing.status}'` },
        400,
      );
    }

    const insight = await applyInsight(id, proof);
    if (!insight) return c.json({ error: 'Insight not found' }, 404);
    return c.json(insight);
  } catch (err) {
    console.error('[insights] apply error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /brain/insights/:id/reject — reject insight (Story 3.3)
insightsRouter.patch('/:id/reject', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

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

  if (typeof raw['reason'] !== 'string' || raw['reason'].trim().length === 0) {
    return c.json({ error: 'reason is required and must be a non-empty string' }, 400);
  }

  try {
    const insight = await rejectInsight(id, raw['reason']);
    if (!insight) return c.json({ error: 'Insight not found' }, 404);
    return c.json(insight);
  } catch (err) {
    console.error('[insights] reject error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
