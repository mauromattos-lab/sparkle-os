import { Hono } from 'hono';
import { saveContext, loadContext, loadContextHistory, deleteContext } from './context-store.js';
import type { SaveContextInput } from './types.js';

const contextRouter = new Hono();

// GET /api/context/:agentId — returns active context for agent
contextRouter.get('/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const ctx = await loadContext(agentId);
  if (!ctx) {
    return c.json({ error: 'Context not found' }, 404);
  }
  return c.json(ctx);
});

// POST /api/context/:agentId — save or update context
contextRouter.post('/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const body = await c.req.json<Omit<SaveContextInput, 'agentId'>>();

  if (!body.sessionId) {
    return c.json({ error: 'sessionId is required' }, 400);
  }

  const ctx = await saveContext({
    agentId,
    sessionId: body.sessionId,
    storyId: body.storyId ?? null,
    workState: body.workState ?? {
      currentTask: '',
      filesModified: [],
      nextAction: '',
      blockers: [],
    },
    decisionLog: body.decisionLog ?? [],
  });

  return c.json(ctx, 201);
});

// GET /api/context/:agentId/history — full Postgres history
contextRouter.get('/:agentId/history', async (c) => {
  const agentId = c.req.param('agentId');
  const history = await loadContextHistory(agentId);
  return c.json(history);
});

// DELETE /api/context/:agentId — clear active context
contextRouter.delete('/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  await deleteContext(agentId);
  return c.json({ deleted: true });
});

export { contextRouter };
