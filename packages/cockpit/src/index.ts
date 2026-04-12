// SparkleOS Cockpit — Entry Point
// Port 3004 | /cockpit — Piloting Interface

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { renderOverview } from './routes/overview.js';
import { renderBrainPanel } from './routes/brain.js';
import { renderShell } from './routes/shell.js';

const app = new Hono();

// Redirect root to cockpit overview
app.get('/', (c) => c.redirect('/cockpit'));

// Main overview panel — handle both /cockpit and /cockpit/
app.get('/cockpit', renderOverview);
app.get('/cockpit/', renderOverview);

// Brain Collective panel — Story 4.5
app.get('/cockpit/brain', renderBrainPanel);

// Placeholder routes for future panels (Stories 4.2–4.4, 4.6–4.8)
const placeholderPanels = [
  { path: '/cockpit/agents', label: 'Agentes', story: '4.2' },
  { path: '/cockpit/decisions', label: 'Decisões', story: '4.3' },
  { path: '/cockpit/zenya', label: 'Zenya', story: '4.4' },
  { path: '/cockpit/costs', label: 'Custos', story: '4.6' },
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
