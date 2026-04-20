import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { clientAuthMiddleware } from '../middleware/client-auth.js';

const cockpitRouter = new Hono();

// GET /cockpit/conversations?limit=20&offset=0
cockpitRouter.get('/conversations', clientAuthMiddleware, async (c) => {
  const tenantId = c.get('tenantId') as string;
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const offset = Number(c.req.query('offset') ?? 0);

  const db = getDb();
  const rows = await db.execute<{
    id: string;
    phone_number: string;
    role: string;
    content: string;
    created_at: string;
  }>(sql`
    SELECT id, phone_number, role, content, created_at
    FROM zenya_conversation_history
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return c.json({ data: rows, limit, offset });
});

// GET /cockpit/metrics
cockpitRouter.get('/metrics', clientAuthMiddleware, async (c) => {
  const tenantId = c.get('tenantId') as string;
  const db = getDb();

  const [totalResult, todayResult] = await Promise.all([
    db.execute<{ count: string }>(sql`
      SELECT COUNT(*)::text AS count
      FROM zenya_conversation_history
      WHERE tenant_id = ${tenantId}
    `),
    db.execute<{ count: string }>(sql`
      SELECT COUNT(*)::text AS count
      FROM zenya_conversation_history
      WHERE tenant_id = ${tenantId}
        AND created_at >= CURRENT_DATE
    `),
  ]);

  return c.json({
    totalConversations: Number(totalResult[0]?.count ?? 0),
    conversationsToday: Number(todayResult[0]?.count ?? 0),
    systemStatus: 'active',
  });
});

export { cockpitRouter };
