// Zenya — Órgão de atendimento WhatsApp do SparkleOS
// Port 3004 (internal VPS)

// Load .env before anything else — required for PM2 production mode
import 'dotenv/config';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createWebhookRouter } from './worker/webhook.js';

// ---------------------------------------------------------------------------
// Startup env validation — fail fast with a clear message
// ---------------------------------------------------------------------------
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'ZENYA_MASTER_KEY',
  'OPENAI_API_KEY',
  'CHATWOOT_API_TOKEN',
  'CHATWOOT_BASE_URL',
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error('[zenya] Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

const app = new Hono();

// Health check — returns service status and which optional features are active
app.get('/zenya/health', (c) => {
  return c.json({
    ok: true,
    service: 'zenya',
    version: process.env['npm_package_version'] ?? 'unknown',
    features: {
      elevenlabs: Boolean(process.env['ELEVENLABS_API_KEY']),
      google_calendar: Boolean(process.env['GOOGLE_CLIENT_ID']),
    },
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// Webhook route
app.route('/', createWebhookRouter());

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

export { app };

// Start server only when not in test mode
if (process.env['VITEST'] === undefined) {
  validateEnv();

  const port = parseInt(process.env['ZENYA_PORT'] ?? '3004', 10);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[zenya] Webhook server running on port ${info.port}`);
  });
}
