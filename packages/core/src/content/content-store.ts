import { eq, desc, and, gte, or } from 'drizzle-orm';
import { getDb, schema } from '../db/client.js';
import type { ContentPost, CreateContentPostInput, UpdateContentPostInput } from './types.js';

function rowToPost(row: typeof schema.contentPosts.$inferSelect): ContentPost {
  return {
    id: row.id,
    clientId: row.clientId,
    status: row.status,
    topic: row.topic ?? null,
    title: row.title ?? null,
    meta: row.meta ?? null,
    bodyPreview: row.bodyPreview ?? null,
    bodyFull: row.bodyFull ?? null,
    imageDesc: row.imageDesc ?? null,
    pinCopy: row.pinCopy ?? null,
    pinHashtags: row.pinHashtags ?? null,
    imageDriveUrl: row.imageDriveUrl ?? null,
    blogUrl: row.blogUrl ?? null,
    pinUrl: row.pinUrl ?? null,
    errorMsg: row.errorMsg ?? null,
    rejectionNote: row.rejectionNote ?? null,
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

export async function createContentPost(input: CreateContentPostInput = {}): Promise<ContentPost> {
  const db = getDb();
  const [row] = await db
    .insert(schema.contentPosts)
    .values({
      clientId: input.clientId ?? 'plaka',
      topic: input.topic ?? null,
      status: 'gerando',
    })
    .returning();

  if (!row) throw new Error('Failed to create content post');
  return rowToPost(row);
}

export async function updateContentPost(
  id: string,
  input: UpdateContentPostInput,
): Promise<ContentPost> {
  const db = getDb();

  const values: Record<string, unknown> = {};
  if (input.status !== undefined) values['status'] = input.status;
  if (input.topic !== undefined) values['topic'] = input.topic;
  if (input.title !== undefined) values['title'] = input.title;
  if (input.meta !== undefined) values['meta'] = input.meta;
  if (input.bodyPreview !== undefined) values['bodyPreview'] = input.bodyPreview;
  if (input.bodyFull !== undefined) values['bodyFull'] = input.bodyFull;
  if (input.imageDesc !== undefined) values['imageDesc'] = input.imageDesc;
  if (input.pinCopy !== undefined) values['pinCopy'] = input.pinCopy;
  if (input.pinHashtags !== undefined) values['pinHashtags'] = input.pinHashtags;
  if (input.imageDriveUrl !== undefined) values['imageDriveUrl'] = input.imageDriveUrl;
  if (input.blogUrl !== undefined) values['blogUrl'] = input.blogUrl;
  if (input.pinUrl !== undefined) values['pinUrl'] = input.pinUrl;
  if (input.errorMsg !== undefined) values['errorMsg'] = input.errorMsg;
  if (input.rejectionNote !== undefined) values['rejectionNote'] = input.rejectionNote;
  if (input.approvedAt !== undefined) values['approvedAt'] = input.approvedAt;
  if (input.publishedAt !== undefined) values['publishedAt'] = input.publishedAt;

  const [row] = await db
    .update(schema.contentPosts)
    .set(values)
    .where(eq(schema.contentPosts.id, id))
    .returning();

  if (!row) throw new Error(`Content post ${id} not found`);
  return rowToPost(row);
}

export async function getContentPost(id: string): Promise<ContentPost | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.contentPosts)
    .where(eq(schema.contentPosts.id, id));

  return row ? rowToPost(row) : null;
}

export async function listContentPosts(
  clientId = 'plaka',
  limit = 20,
): Promise<ContentPost[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.contentPosts)
    .where(eq(schema.contentPosts.clientId, clientId))
    .orderBy(desc(schema.contentPosts.createdAt))
    .limit(limit);

  return rows.map(rowToPost);
}

export async function getPendingPostForToday(clientId = 'plaka'): Promise<ContentPost | null> {
  const db = getDb();

  const [row] = await db
    .select()
    .from(schema.contentPosts)
    .where(
      and(
        eq(schema.contentPosts.clientId, clientId),
        or(
          eq(schema.contentPosts.status, 'aguardando_aprovacao'),
          eq(schema.contentPosts.status, 'gerando'),
        ),
      ),
    )
    .orderBy(desc(schema.contentPosts.createdAt))
    .limit(1);

  return row ? rowToPost(row) : null;
}

export async function getRecentPosts(clientId = 'plaka', days = 7): Promise<ContentPost[]> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select()
    .from(schema.contentPosts)
    .where(
      and(
        eq(schema.contentPosts.clientId, clientId),
        gte(schema.contentPosts.createdAt, since),
      ),
    )
    .orderBy(desc(schema.contentPosts.createdAt));

  return rows.map(rowToPost);
}
