import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';

export interface ClientSession {
  tenantId: string;
  tenantName: string;
}

export class ClientNotFoundError extends Error {
  constructor(userId: string) {
    super(`Nenhum tenant Zenya ativo vinculado ao usuário: ${userId}`);
    this.name = 'ClientNotFoundError';
  }
}

/**
 * Retorna tenantId e tenantName do tenant vinculado ao userId do Supabase Auth.
 * Lança ClientNotFoundError se o usuário não tiver tenant ativo.
 */
export async function getClientSession(userId: string): Promise<ClientSession> {
  const db = getDb();

  const rows = await db.execute<{ id: string; name: string }>(sql`
    SELECT zt.id, zt.name
    FROM zenya_client_users zcu
    JOIN zenya_tenants zt ON zt.id = zcu.tenant_id
    WHERE zcu.user_id = ${userId}::uuid
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) throw new ClientNotFoundError(userId);

  return {
    tenantId: row.id,
    tenantName: row.name,
  };
}
