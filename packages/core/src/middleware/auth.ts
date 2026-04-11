import type { Context, Next } from 'hono';

/**
 * Bearer token middleware for SparkleOS internal API.
 * Validates INTERNAL_API_TOKEN from Authorization header.
 * System is internal-only (Mauro + AIOX agents) — no OAuth needed.
 */
export async function requireInternalToken(c: Context, next: Next): Promise<void | Response> {
  const token = process.env['INTERNAL_API_TOKEN'];

  if (!token) {
    return c.json({ error: 'INTERNAL_API_TOKEN not configured' }, 500);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const provided = authHeader.slice('Bearer '.length);
  if (provided !== token) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  await next();
}
