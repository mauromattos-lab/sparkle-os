// Health check route — GET /brain/health
// Validates DB connectivity and Voyage API availability

import { Hono } from 'hono';
import { checkDbHealth } from '../db/client.js';
import { checkEmbeddingServiceHealth } from '../services/embedding.service.js';

export const healthRouter = new Hono();

healthRouter.get('/', async (c) => {
  const [dbOk, embeddingOk] = await Promise.all([
    checkDbHealth(),
    checkEmbeddingServiceHealth(),
  ]);

  const status = dbOk && embeddingOk ? 'ok' : 'degraded';

  return c.json(
    {
      status,
      db: dbOk ? 'ok' : 'error',
      embeddingService: embeddingOk ? 'ok' : 'error',
    },
    status === 'ok' ? 200 : 503
  );
});
