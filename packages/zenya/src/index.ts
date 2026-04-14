// Zenya — Órgão de atendimento WhatsApp do SparkleOS
// Port 3004 (internal VPS)

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createWebhookRouter } from './worker/webhook.js';

const app = new Hono();

// Health check
app.get('/zenya/health', (c) => c.json({ ok: true, service: 'zenya' }));

// Webhook route
app.route('/', createWebhookRouter());

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

export { app };

// Start server only when not in test mode
if (process.env['VITEST'] === undefined) {
  const port = parseInt(process.env['ZENYA_PORT'] ?? '3004', 10);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[zenya] Webhook server running on port ${info.port}`);
  });
}
