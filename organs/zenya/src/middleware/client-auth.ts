import type { Context, Next } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { getClientSession, ClientNotFoundError } from '../auth/session.js';

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_KEY']!,
);

export type ClientAuthVars = {
  tenantId: string;
  tenantName: string;
};

export async function clientAuthMiddleware(
  c: Context<{ Variables: ClientAuthVars }>,
  next: Next,
): Promise<Response | void> {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'UNAUTHORIZED', message: 'Token não fornecido' }, 401);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return c.json({ error: 'UNAUTHORIZED', message: 'Token inválido ou expirado' }, 401);

  try {
    const session = await getClientSession(user.id);
    c.set('tenantId', session.tenantId);
    c.set('tenantName', session.tenantName);
  } catch (err) {
    if (err instanceof ClientNotFoundError) {
      return c.json({ error: 'FORBIDDEN', message: 'Usuário sem tenant vinculado' }, 403);
    }
    throw err;
  }

  await next();
}
