// Dashboard route — Story 3.9
// GET /brain/dashboard — returns DashboardData as JSON (with in-memory cache TTL 60s)

import { Hono } from 'hono';
import { getDashboardData } from '../services/dashboard.service.js';

export const dashboardRouter = new Hono();

dashboardRouter.get('/', async (c) => {
  try {
    const data = await getDashboardData();
    return c.json(data);
  } catch (err) {
    console.error('[dashboard] error fetching dashboard data:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
