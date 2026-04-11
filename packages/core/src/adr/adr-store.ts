import { eq, asc, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client.js';
import type { ADR, CreateAdrInput } from './types.js';

function rowToAdr(row: typeof schema.adrs.$inferSelect): ADR {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status as ADR['status'],
    context: row.context ?? null,
    decision: row.decision ?? null,
    rationale: row.rationale ?? null,
    alternatives: row.alternatives ?? [],
    consequences: row.consequences ?? null,
    createdBy: row.createdBy ?? null,
    storyId: row.storyId ?? null,
    filePath: row.filePath,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function adrFilePath(number: number, title: string): string {
  const paddedNum = String(number).padStart(3, '0');
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `docs/adrs/adr-${paddedNum}-${slug}.md`;
}

export async function getNextAdrNumber(): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ max: sql<number>`COALESCE(MAX(number), 0)` })
    .from(schema.adrs);
  return (result[0]?.max ?? 0) + 1;
}

export async function createAdr(input: CreateAdrInput): Promise<ADR> {
  const db = getDb();
  const number = await getNextAdrNumber();
  const filePath = adrFilePath(number, input.title);

  const [row] = await db
    .insert(schema.adrs)
    .values({
      number,
      title: input.title,
      status: input.status ?? 'proposed',
      context: input.context ?? null,
      decision: input.decision ?? null,
      rationale: input.rationale ?? null,
      alternatives: input.alternatives ?? [],
      consequences: input.consequences ?? null,
      createdBy: input.createdBy ?? null,
      storyId: input.storyId ?? null,
      filePath,
    })
    .returning();

  if (!row) throw new Error('Failed to create ADR');
  return rowToAdr(row);
}

export async function listAdrs(): Promise<ADR[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.adrs)
    .orderBy(asc(schema.adrs.number));
  return rows.map(rowToAdr);
}

export async function getAdrByNumber(number: number): Promise<ADR | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.adrs)
    .where(eq(schema.adrs.number, number));
  return row ? rowToAdr(row) : null;
}
