import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './index.js';

const port = parseInt(process.env['ZENYA_API_PORT'] ?? '3005', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[zenya-api] server running on port ${info.port}`);
});
