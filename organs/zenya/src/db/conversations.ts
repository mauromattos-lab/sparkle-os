import { sql } from 'drizzle-orm';
import { getDb, schema } from './client.js';

export type ZenyaConversationRow = typeof schema.zenyaConversations.$inferSelect;

// set_config + query dentro da mesma transação — garante que o isolation key
// esteja ativo na mesma conexão do pool (Supabase Transaction pooler mode).
// is_local=TRUE: configuração válida apenas dentro desta transação.

export async function listConversations(isolationKey: string): Promise<ZenyaConversationRow[]> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_client_key', ${isolationKey}, TRUE)`);
    return tx.select().from(schema.zenyaConversations);
  });
}

export async function insertConversation(
  isolationKey: string,
  data: { clientId: string; chatwootConvId?: number; content?: Record<string, unknown> },
): Promise<ZenyaConversationRow> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_client_key', ${isolationKey}, TRUE)`);
    const [row] = await tx
      .insert(schema.zenyaConversations)
      .values({
        clientId: data.clientId,
        isolationKey,
        chatwootConvId: data.chatwootConvId ?? null,
        content: data.content ?? {},
      })
      .returning();
    if (!row) throw new Error('Failed to insert conversation');
    return row;
  });
}
