import { Hono } from 'hono';
import { createDecision, listPendingDecisions, resolveDecision } from './decision-store.js';
import type { CreateDecisionInput, ResolveDecisionInput } from './types.js';

const decisionRouter = new Hono();

// GET /api/decisions/pending
decisionRouter.get('/pending', async (c) => {
  const list = await listPendingDecisions();
  return c.json(list);
});

// POST /api/decisions
decisionRouter.post('/', async (c) => {
  const body = await c.req.json<CreateDecisionInput>();

  if (!body.title?.trim() || !body.context?.trim() || !body.requestedBy?.trim()) {
    return c.json({ error: 'title, context, and requestedBy are required' }, 400);
  }

  const decision = await createDecision(body);
  return c.json(decision, 201);
});

// PATCH /api/decisions/:id
decisionRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<ResolveDecisionInput>();

  if (!body.resolution?.trim()) {
    return c.json({ error: 'resolution is required' }, 400);
  }

  const decision = await resolveDecision(id, body);
  if (!decision) {
    return c.json({ error: `Decision ${id} not found` }, 404);
  }
  return c.json(decision);
});

export { decisionRouter };
