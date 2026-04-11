import { Hono } from 'hono';
import { ZENYA_FLOWS } from '../data/flows-seed.js';
import { ZenyaN8nClient } from '../n8n/client.js';

const flowsRouter = new Hono();

// GET /flows — inventário completo dos 15 fluxos Zenya Prime
flowsRouter.get('/', (c) => {
  return c.json(ZENYA_FLOWS);
});

// GET /flows/:id — detalhes de um fluxo específico por ID n8n
flowsRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const flow = ZENYA_FLOWS.find((f) => f.id === id);

  if (!flow) {
    return c.json({ error: `Flow '${id}' not found` }, 404);
  }

  return c.json(flow);
});

// POST /flows/:id/clone — clona um fluxo n8n com novo nome
flowsRouter.post('/:id/clone', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ newName?: string }>();
  const newName = body.newName?.trim() ?? `Clone — ${id}`;

  if (!newName) {
    return c.json({ error: 'newName must not be empty' }, 400);
  }

  try {
    const n8nClient = new ZenyaN8nClient();
    const cloned = await n8nClient.cloneWorkflow(id, newName);
    return c.json(cloned, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 502);
  }
});

export { flowsRouter };
