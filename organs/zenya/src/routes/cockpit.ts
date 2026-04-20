import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { clientAuthMiddleware, type ClientAuthVars } from '../middleware/client-auth.js';

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_KEY']!,
);

const cockpitRouter = new Hono<{ Variables: ClientAuthVars }>();

// GET /cockpit/conversations?limit=20&offset=0
cockpitRouter.get('/conversations', clientAuthMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const offset = Number(c.req.query('offset') ?? 0);

  const { data, error } = await supabase
    .from('zenya_conversation_history')
    .select('id, phone_number, role, content, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return c.json({ error: 'DATABASE_ERROR', message: error.message }, 500);
  return c.json({ data: data ?? [], limit, offset });
});

// GET /cockpit/metrics
cockpitRouter.get('/metrics', clientAuthMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const [totalResult, todayResult] = await Promise.all([
    supabase
      .from('zenya_conversation_history')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase
      .from('zenya_conversation_history')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', todayIso),
  ]);

  return c.json({
    totalConversations: totalResult.count ?? 0,
    conversationsToday: todayResult.count ?? 0,
    systemStatus: 'active',
  });
});

export { cockpitRouter };
