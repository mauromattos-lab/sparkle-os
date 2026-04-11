import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client.js';
import { redisGet, redisSet, redisDel, contextKey } from '../redis/client.js';
import type { AgentContext, SaveContextInput } from './types.js';

function rowToContext(row: typeof schema.agentContexts.$inferSelect): AgentContext {
  return {
    id: row.id,
    agentId: row.agentId,
    sessionId: row.sessionId,
    storyId: row.storyId ?? null,
    workState: row.workState,
    decisionLog: row.decisionLog,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveContext(input: SaveContextInput): Promise<AgentContext> {
  const db = getDb();
  const now = new Date();

  const [row] = await db
    .insert(schema.agentContexts)
    .values({
      agentId: input.agentId,
      sessionId: input.sessionId,
      storyId: input.storyId,
      workState: input.workState,
      decisionLog: input.decisionLog,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  // upsert: try update if insert hit nothing (on_conflict strategy: update latest per agentId)
  const saved = row ? rowToContext(row) : await updateContext(input);

  // write-through to Redis (best-effort — never fail if Redis is down)
  await redisSet(contextKey(input.agentId), JSON.stringify(saved)).catch(() => undefined);

  return saved;
}

async function updateContext(input: SaveContextInput): Promise<AgentContext> {
  const db = getDb();
  const now = new Date();

  const [row] = await db
    .update(schema.agentContexts)
    .set({
      sessionId: input.sessionId,
      storyId: input.storyId,
      workState: input.workState,
      decisionLog: input.decisionLog,
      updatedAt: now,
    })
    .where(eq(schema.agentContexts.agentId, input.agentId))
    .returning();

  if (!row) {
    throw new Error(`Context not found for agentId: ${input.agentId}`);
  }
  return rowToContext(row);
}

export async function loadContext(agentId: string): Promise<AgentContext | null> {
  // try Redis first (< 5ms)
  const cached = await redisGet(contextKey(agentId));
  if (cached) {
    return JSON.parse(cached) as AgentContext;
  }

  // fallback to Postgres
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.agentContexts)
    .where(eq(schema.agentContexts.agentId, agentId))
    .orderBy(desc(schema.agentContexts.updatedAt))
    .limit(1);

  if (!row) return null;

  const ctx = rowToContext(row);

  // warm Redis cache back up
  await redisSet(contextKey(agentId), JSON.stringify(ctx)).catch(() => undefined);

  return ctx;
}

export async function loadContextHistory(agentId: string): Promise<AgentContext[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.agentContexts)
    .where(eq(schema.agentContexts.agentId, agentId))
    .orderBy(desc(schema.agentContexts.createdAt));

  return rows.map(rowToContext);
}

export async function deleteContext(agentId: string): Promise<void> {
  const db = getDb();

  await Promise.all([
    db.delete(schema.agentContexts).where(eq(schema.agentContexts.agentId, agentId)),
    redisDel(contextKey(agentId)).catch(() => undefined),
  ]);
}
