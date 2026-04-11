import { Hono } from 'hono';
import { getDb } from '../db/client.js';
import { sql } from 'drizzle-orm';

// Config mutável — permite override nos testes sem readonly constraint do ESM.
export const healthConfig = {
  n8nBaseUrl: process.env['N8N_BASE_URL'] ?? 'http://localhost:5678/api/v1',
  chatwootBaseUrl: process.env['CHATWOOT_BASE_URL'] ?? '',
};

interface ServiceStatus {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    n8n: ServiceStatus;
    chatwoot: ServiceStatus;
    postgres: ServiceStatus;
  };
  checkedAt: string;
}

async function checkN8n(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(`${healthConfig.n8nBaseUrl}/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    if (!response.ok) {
      return { status: 'down', latencyMs, error: `HTTP ${response.status}` };
    }
    return { status: 'up', latencyMs };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function checkChatwoot(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(`${healthConfig.chatwootBaseUrl}/auth/sign_in`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    // 401/422 significa que o servidor está up (recusou credenciais vazias — esperado)
    if (response.status === 404) {
      return { status: 'down', latencyMs, error: `HTTP ${response.status}` };
    }
    return { status: 'up', latencyMs };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function checkPostgres(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export const healthRouter = new Hono();

healthRouter.get('/', async (c) => {
  const [n8n, chatwoot, postgres] = await Promise.all([
    checkN8n(),
    checkChatwoot(),
    checkPostgres(),
  ]);

  const services = { n8n, chatwoot, postgres };

  // down: n8n ou Chatwoot down (operação da Zenya impossível)
  // degraded: pelo menos 1 serviço down mas n8n e Chatwoot ainda up
  // healthy: todos up
  let status: HealthResponse['status'];
  if (n8n.status === 'down' || chatwoot.status === 'down') {
    status = 'down';
  } else if (postgres.status === 'down') {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  const body: HealthResponse = {
    status,
    services,
    checkedAt: new Date().toISOString(),
  };

  const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 207 : 503;
  return c.json(body, httpStatus);
});

