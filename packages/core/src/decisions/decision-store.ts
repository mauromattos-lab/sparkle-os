import { eq, asc } from 'drizzle-orm';
import { getDb, schema } from '../db/client.js';
import type { PendingDecision, CreateDecisionInput, ResolveDecisionInput } from './types.js';

function rowToDecision(row: typeof schema.pendingDecisions.$inferSelect): PendingDecision {
  return {
    id: row.id,
    title: row.title,
    context: row.context,
    options: row.options,
    requestedBy: row.requestedBy,
    storyId: row.storyId ?? null,
    priority: row.priority as PendingDecision['priority'],
    status: row.status as PendingDecision['status'],
    resolution: row.resolution ?? null,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export async function createDecision(input: CreateDecisionInput): Promise<PendingDecision> {
  const db = getDb();
  const [row] = await db
    .insert(schema.pendingDecisions)
    .values({
      title: input.title,
      context: input.context,
      options: input.options,
      requestedBy: input.requestedBy,
      storyId: input.storyId ?? null,
      priority: input.priority ?? 'normal',
    })
    .returning();

  if (!row) throw new Error('Failed to create decision');
  return rowToDecision(row);
}

export async function listPendingDecisions(): Promise<PendingDecision[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.pendingDecisions)
    .where(eq(schema.pendingDecisions.status, 'pending'))
    .orderBy(asc(schema.pendingDecisions.createdAt));
  return rows.map(rowToDecision);
}

export async function resolveDecision(
  id: string,
  input: ResolveDecisionInput,
): Promise<PendingDecision | null> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .update(schema.pendingDecisions)
    .set({
      resolution: input.resolution,
      status: input.status ?? 'resolved',
      resolvedAt: now,
    })
    .where(eq(schema.pendingDecisions.id, id))
    .returning();

  return row ? rowToDecision(row) : null;
}
