import { Hono } from 'hono';
import { recordCost, getCostSummary, getCostByAgent, getBudgetStatus } from './cost-store.js';
import type { RecordCostInput } from './types.js';

const costRouter = new Hono();

// POST /api/costs/events — registra evento de custo
costRouter.post('/events', async (c) => {
  const body = await c.req.json<RecordCostInput>();

  if (!body.agentId?.trim() || !body.operationType || body.units == null || body.unitCost == null) {
    return c.json({ error: 'agentId, operationType, units, and unitCost are required' }, 400);
  }

  const event = await recordCost(body);
  return c.json(event, 201);
});

// GET /api/costs/summary?period=daily&date=2026-04-11
costRouter.get('/summary', async (c) => {
  const period = (c.req.query('period') ?? 'monthly') as 'daily' | 'weekly' | 'monthly';
  const date = c.req.query('date') ?? c.req.query('month') ?? new Date().toISOString().slice(0, 10);

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return c.json({ error: 'period must be daily, weekly, or monthly' }, 400);
  }

  const summary = await getCostSummary(period, date);
  return c.json(summary);
});

// GET /api/costs/by-agent?period=monthly&month=2026-04
costRouter.get('/by-agent', async (c) => {
  const period = (c.req.query('period') ?? 'monthly') as 'daily' | 'weekly' | 'monthly';
  const date = c.req.query('date') ?? c.req.query('month') ?? new Date().toISOString().slice(0, 10);

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return c.json({ error: 'period must be daily, weekly, or monthly' }, 400);
  }

  const summaries = await getCostByAgent(period, date);
  return c.json(summaries);
});

// GET /api/costs/budget
costRouter.get('/budget', async (c) => {
  const status = await getBudgetStatus();
  return c.json(status);
});

export { costRouter };
