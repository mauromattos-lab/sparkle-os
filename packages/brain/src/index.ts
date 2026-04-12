// SparkleOS Collective Brain — Entry Point
// Port 3003 (internal VPS) | /brain (external via Core gateway)

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { insightsRouter } from './routes/insights.js';
import { healthRouter } from './routes/health.js';
import { searchRouter } from './routes/search.js';
import { lifecycleRouter } from './routes/lifecycle.js';
import { dashboardRouter } from './routes/dashboard.js';
import { dashboardUiRouter } from './routes/dashboard-ui.js';

const app = new Hono();

app.route('/brain/health', healthRouter);
app.route('/brain/insights/search', searchRouter);
app.route('/brain/lifecycle', lifecycleRouter);
app.route('/brain/dashboard', dashboardRouter);
app.route('/brain/dashboard', dashboardUiRouter);
app.route('/brain/insights', insightsRouter);

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

const port = parseInt(process.env['BRAIN_PORT'] ?? '3003', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[brain] Collective Brain running on port ${info.port}`);
});

export { app };
export type { Insight, InsightInput, InsightSource, InsightStatus, ConfidenceLevel } from './types/insight.js';
