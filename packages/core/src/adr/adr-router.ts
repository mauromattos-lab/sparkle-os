import { Hono } from 'hono';
import { createAdr, listAdrs, getAdrByNumber, getNextAdrNumber } from './adr-store.js';
import type { CreateAdrInput } from './types.js';

const adrRouter = new Hono();

// GET /api/adrs/next-number — source of truth for sequential numbering
adrRouter.get('/next-number', async (c) => {
  const next = await getNextAdrNumber();
  return c.json({ nextNumber: next, paddedNumber: String(next).padStart(3, '0') });
});

// GET /api/adrs — list all ADRs ordered by number
adrRouter.get('/', async (c) => {
  const list = await listAdrs();
  return c.json(list);
});

// GET /api/adrs/:number — get specific ADR by number
adrRouter.get('/:number', async (c) => {
  const num = parseInt(c.req.param('number'), 10);
  if (isNaN(num)) {
    return c.json({ error: 'Invalid ADR number' }, 400);
  }
  const adr = await getAdrByNumber(num);
  if (!adr) {
    return c.json({ error: `ADR-${String(num).padStart(3, '0')} not found` }, 404);
  }
  return c.json(adr);
});

// POST /api/adrs — register a new ADR
adrRouter.post('/', async (c) => {
  const body = await c.req.json<CreateAdrInput>();

  if (!body.title?.trim()) {
    return c.json({ error: 'title is required' }, 400);
  }

  const adr = await createAdr(body);
  return c.json(adr, 201);
});

export { adrRouter };
