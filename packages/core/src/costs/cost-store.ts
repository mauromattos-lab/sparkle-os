import { gte, lte, eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client.js';
import type {
  CostEvent,
  RecordCostInput,
  CostSummary,
  AgentCostSummary,
  BudgetStatus,
} from './types.js';

function rowToEvent(row: typeof schema.costEvents.$inferSelect): CostEvent {
  return {
    id: row.id,
    agentId: row.agentId,
    operationType: row.operationType as CostEvent['operationType'],
    model: row.model ?? null,
    units: Number(row.units),
    unitCost: Number(row.unitCost),
    totalCost: Number(row.totalCost),
    storyId: row.storyId ?? null,
    sessionId: row.sessionId ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordCost(input: RecordCostInput): Promise<CostEvent> {
  const db = getDb();
  const totalCost = input.units * input.unitCost;

  const [row] = await db
    .insert(schema.costEvents)
    .values({
      agentId: input.agentId,
      operationType: input.operationType,
      model: input.model ?? null,
      units: String(input.units),
      unitCost: String(input.unitCost),
      totalCost: String(totalCost),
      storyId: input.storyId ?? null,
      sessionId: input.sessionId ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();

  if (!row) throw new Error('Failed to record cost event');
  return rowToEvent(row);
}

function buildDateRange(period: 'daily' | 'weekly' | 'monthly', reference: string) {
  const ref = new Date(reference);
  let start: Date;
  let end: Date;

  if (period === 'daily') {
    start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
  } else if (period === 'weekly') {
    const day = ref.getDay();
    start = new Date(ref);
    start.setDate(ref.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    // monthly
    start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { start, end };
}

export async function getCostSummary(
  period: 'daily' | 'weekly' | 'monthly',
  reference: string,
): Promise<CostSummary> {
  const db = getDb();
  const { start, end } = buildDateRange(period, reference);

  const rows = await db
    .select()
    .from(schema.costEvents)
    .where(
      and(
        gte(schema.costEvents.createdAt, start),
        lte(schema.costEvents.createdAt, end),
      ),
    );

  const byOperationType: Record<string, number> = {};
  let totalCost = 0;

  for (const row of rows) {
    const cost = Number(row.totalCost);
    totalCost += cost;
    byOperationType[row.operationType] = (byOperationType[row.operationType] ?? 0) + cost;
  }

  return {
    period: `${period}:${reference}`,
    totalCost,
    byOperationType,
    eventCount: rows.length,
  };
}

export async function getCostByAgent(
  period: 'daily' | 'weekly' | 'monthly',
  reference: string,
): Promise<AgentCostSummary[]> {
  const db = getDb();
  const { start, end } = buildDateRange(period, reference);

  const rows = await db
    .select()
    .from(schema.costEvents)
    .where(
      and(
        gte(schema.costEvents.createdAt, start),
        lte(schema.costEvents.createdAt, end),
      ),
    );

  const byAgent: Record<string, AgentCostSummary> = {};

  for (const row of rows) {
    const cost = Number(row.totalCost);
    if (!byAgent[row.agentId]) {
      byAgent[row.agentId] = {
        agentId: row.agentId,
        totalCost: 0,
        byOperationType: {},
        eventCount: 0,
      };
    }
    const summary = byAgent[row.agentId]!;
    summary.totalCost += cost;
    summary.byOperationType[row.operationType] =
      (summary.byOperationType[row.operationType] ?? 0) + cost;
    summary.eventCount += 1;
  }

  return Object.values(byAgent).sort((a, b) => b.totalCost - a.totalCost);
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  const db = getDb();
  const monthlyBudgetUsd = Number(process.env['MONTHLY_BUDGET_USD'] ?? '570');
  const alertThreshold = 0.9;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(total_cost), 0)` })
    .from(schema.costEvents)
    .where(gte(schema.costEvents.createdAt, monthStart));

  const currentMonthCost = Number(rows[0]?.total ?? 0);
  const remainingBudget = monthlyBudgetUsd - currentMonthCost;
  const percentUsed = currentMonthCost / monthlyBudgetUsd;

  return {
    monthlyBudgetUsd,
    currentMonthCost,
    remainingBudget,
    percentUsed,
    alertThreshold,
    isAlertTriggered: percentUsed >= alertThreshold,
  };
}
