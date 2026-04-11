import { Hono } from 'hono';
import { ZENYA_FLOWS } from '../data/flows-seed.js';

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

export { flowsRouter };
