// SparkleOS Cockpit — Entry Point
// Port 3004 | /cockpit — Piloting Interface

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { renderOverview } from './routes/overview.js';
import { renderBrainPanel } from './routes/brain.js';
import { renderDecisions } from './routes/decisions.js';
import { renderShell } from './routes/shell.js';
import { agentsRouter } from './routes/agents.js';
import { renderCosts } from './routes/costs.js';
import { zenyaRouter } from './routes/zenya.js';

const app = new Hono();

// Redirect root to cockpit overview
app.get('/', (c) => c.redirect('/cockpit'));

// Main overview panel — handle both /cockpit and /cockpit/
app.get('/cockpit', renderOverview);
app.get('/cockpit/', renderOverview);

// Brain Collective panel — Story 4.5
app.get('/cockpit/brain', renderBrainPanel);

// Agent activity panel — Story 4.2
app.route('/cockpit/agents', agentsRouter);

// Zenya nucleus panel — Story 4.4
app.route('/cockpit/zenya', zenyaRouter);

// Costs panel — Story 4.6
app.get('/cockpit/costs', renderCosts);

// Decisions panel — Story 4.3
app.get('/cockpit/decisions', renderDecisions);

// Placeholder routes for future panels (Stories 4.7–4.8)
const placeholderPanels = [
  { path: '/cockpit/progress', label: 'Progresso', story: '4.7' },
  { path: '/cockpit/summary', label: 'Resumo', story: '4.8' },
];

for (const panel of placeholderPanels) {
  const { path, label, story } = panel;
  app.get(path, (c) => {
    const content = `
      <div class="main-header">
        <h1>${label}</h1>
        <div class="subtitle">Painel em desenvolvimento</div>
      </div>
      <div class="placeholder">
        <h2>${label}</h2>
        <p>Este painel será implementado na Story ${story}.</p>
      </div>
    `;
    return c.html(renderShell({ title: label, activePanel: label.toLowerCase(), content }));
  });
}

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

export { app };

// Start server only when running as main module (not during tests)
if (process.env['VITEST'] === undefined) {
  const port = parseInt(process.env['COCKPIT_PORT'] ?? '3004', 10);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[cockpit] Piloting Interface running on port ${info.port}`);
  });
}
