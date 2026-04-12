// SparkleOS Cockpit — Entry Point
// Port 3004 | /cockpit — Piloting Interface

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { renderOverview } from './routes/overview.js';
import { renderShell } from './routes/shell.js';
import { renderCosts } from './routes/costs.js';
import { zenyaRouter } from './routes/zenya.js';

const app = new Hono();

// Redirect root to cockpit overview
app.get('/', (c) => c.redirect('/cockpit'));

// Main overview panel — handle both /cockpit and /cockpit/
app.get('/cockpit', renderOverview);
app.get('/cockpit/', renderOverview);

// Zenya nucleus panel (Story 4.4)
app.route('/cockpit/zenya', zenyaRouter);

// Costs panel (Story 4.6)
app.get('/cockpit/costs', renderCosts);

// Placeholder routes for future panels (Stories 4.2–4.3, 4.5, 4.7–4.8)
const placeholderPanels = [
  { path: '/cockpit/agents', label: 'Agentes', story: '4.2' },
  { path: '/cockpit/decisions', label: 'Decisões', story: '4.3' },
  { path: '/cockpit/brain', label: 'Cérebro', story: '4.5' },
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
