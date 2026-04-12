// Lifecycle routes — Story 3.7
// POST /brain/lifecycle/run
// GET  /brain/lifecycle/duplicates
// PATCH /brain/lifecycle/duplicates/:id/resolve
// GET  /brain/lifecycle/pending

import { Hono } from 'hono';
import {
  runLifecycleCycle,
  listDuplicateGroups,
  resolveDuplicate,
  listPendingItems,
} from '../services/lifecycle.service.js';
import type { PendingReason } from '../db/insights.js';

export const lifecycleRouter = new Hono();

// POST /brain/lifecycle/run — execute full lifecycle cycle
lifecycleRouter.post('/run', async (c) => {
  try {
    const report = await runLifecycleCycle();
    return c.json(report);
  } catch (err) {
    console.error('[lifecycle] run error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /brain/lifecycle/duplicates — list duplicate groups
lifecycleRouter.get('/duplicates', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = parseInt(c.req.query('limit') ?? '20', 10);

  try {
    const { duplicates, total } = await listDuplicateGroups(
      isNaN(page) ? 1 : page,
      Math.min(isNaN(limit) ? 20 : limit, 100),
    );
    return c.json({ duplicates, total });
  } catch (err) {
    console.error('[lifecycle] duplicates error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /brain/lifecycle/duplicates/:id/resolve — resolve a duplicate insight
lifecycleRouter.patch('/duplicates/:id/resolve', async (c) => {
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
  const action = raw['action'];

  if (action !== 'keep' && action !== 'reject') {
    return c.json({ error: "action must be 'keep' or 'reject'" }, 400);
  }

  try {
    const insight = await resolveDuplicate(id, action);
    if (!insight) return c.json({ error: 'Insight not found' }, 404);
    return c.json(insight);
  } catch (err) {
    console.error('[lifecycle] resolve error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /brain/lifecycle/pending — list pending review queue
lifecycleRouter.get('/pending', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = parseInt(c.req.query('limit') ?? '20', 10);
  const reasonParam = c.req.query('reason');

  const validReasons: PendingReason[] = ['stale_raw', 'stale_validated', 'unresolved_duplicate'];

  if (reasonParam && !validReasons.includes(reasonParam as PendingReason)) {
    return c.json({ error: `Invalid reason filter: ${reasonParam}` }, 400);
  }

  const reason = reasonParam as PendingReason | undefined;

  try {
    const result = await listPendingItems(
      isNaN(page) ? 1 : page,
      Math.min(isNaN(limit) ? 20 : limit, 100),
      reason,
    );
    return c.json({ items: result.items, total: result.total, page: result.page });
  } catch (err) {
    console.error('[lifecycle] pending error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
