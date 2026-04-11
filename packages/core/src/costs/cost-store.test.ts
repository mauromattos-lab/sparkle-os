import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => 'mock-eq'),
  gte: vi.fn((_a: unknown, _b: unknown) => 'mock-gte'),
  lte: vi.fn((_a: unknown, _b: unknown) => 'mock-lte'),
  and: vi.fn((..._args: unknown[]) => 'mock-and'),
  sql: Object.assign(vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => 'mock-sql'), {
    raw: vi.fn((_s: string) => 'mock-sql-raw'),
  }),
}));

const mockReturning = vi.fn<AnyFn>();
const mockWhere = vi.fn<AnyFn>();
const mockInsert = vi.fn<AnyFn>();
const mockSelect = vi.fn<AnyFn>();

vi.mock('../db/client.js', () => ({
  getDb: () => ({
    insert: mockInsert,
    select: mockSelect,
  }),
  schema: {
    costEvents: {
      agentId: 'agentId',
      operationType: 'operationType',
      createdAt: 'createdAt',
      totalCost: 'totalCost',
    },
  },
}));

import { recordCost, getCostSummary, getCostByAgent, getBudgetStatus } from './cost-store.js';

const baseRow = {
  id: 'cost-uuid-001',
  agentId: 'dev',
  operationType: 'llm_input',
  model: 'claude-sonnet-4-6',
  units: '1000',
  unitCost: '0.000003',
  totalCost: '0.003',
  storyId: '1.8',
  sessionId: 'sess-001',
  metadata: {},
  createdAt: new Date('2026-04-11T10:00:00Z'),
};

describe('recordCost', () => {
  beforeEach(() => vi.resetAllMocks());

  it('records a cost event and returns it', async () => {
    mockInsert.mockReturnValueOnce({
      values: vi.fn<AnyFn>(() => ({ returning: mockReturning })),
    });
    mockReturning.mockResolvedValueOnce([baseRow]);

    const result = await recordCost({
      agentId: 'dev',
      operationType: 'llm_input',
      model: 'claude-sonnet-4-6',
      units: 1000,
      unitCost: 0.000003,
      storyId: '1.8',
    });

    expect(result.agentId).toBe('dev');
    expect(result.operationType).toBe('llm_input');
    expect(result.totalCost).toBe(0.003);
    expect(result.createdAt).toBe('2026-04-11T10:00:00.000Z');
  });

  it('throws if insert returns nothing', async () => {
    mockInsert.mockReturnValueOnce({
      values: vi.fn<AnyFn>(() => ({ returning: mockReturning })),
    });
    mockReturning.mockResolvedValueOnce([]);

    await expect(
      recordCost({ agentId: 'dev', operationType: 'llm_input', units: 100, unitCost: 0.001 }),
    ).rejects.toThrow('Failed to record cost event');
  });
});

describe('getCostSummary', () => {
  beforeEach(() => vi.resetAllMocks());

  it('aggregates costs by operation type', async () => {
    const rows = [
      baseRow,
      { ...baseRow, id: 'cost-uuid-002', operationType: 'llm_output', totalCost: '0.015' },
      { ...baseRow, id: 'cost-uuid-003', operationType: 'llm_input', totalCost: '0.003' },
    ];

    mockSelect.mockReturnValueOnce({
      from: vi.fn<AnyFn>(() => ({
        where: vi.fn<AnyFn>().mockResolvedValueOnce(rows),
      })),
    });

    const summary = await getCostSummary('daily', '2026-04-11');
    expect(summary.eventCount).toBe(3);
    expect(summary.totalCost).toBeCloseTo(0.021);
    expect(summary.byOperationType['llm_input']).toBeCloseTo(0.006);
    expect(summary.byOperationType['llm_output']).toBeCloseTo(0.015);
    expect(summary.period).toBe('daily:2026-04-11');
  });
});

describe('getCostByAgent', () => {
  beforeEach(() => vi.resetAllMocks());

  it('groups costs by agent and sorts descending', async () => {
    const rows = [
      baseRow,
      { ...baseRow, id: 'cost-uuid-002', agentId: 'qa', totalCost: '0.020' },
      { ...baseRow, id: 'cost-uuid-003', agentId: 'dev', totalCost: '0.005' },
    ];

    mockSelect.mockReturnValueOnce({
      from: vi.fn<AnyFn>(() => ({
        where: vi.fn<AnyFn>().mockResolvedValueOnce(rows),
      })),
    });

    const summaries = await getCostByAgent('monthly', '2026-04-11');
    expect(summaries).toHaveLength(2);
    // sorted by totalCost desc: qa (0.020) > dev (0.008)
    expect(summaries[0]?.agentId).toBe('qa');
    expect(summaries[1]?.agentId).toBe('dev');
  });
});

describe('getBudgetStatus', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns budget status with correct percentage', async () => {
    process.env['MONTHLY_BUDGET_USD'] = '570';

    mockSelect.mockReturnValueOnce({
      from: vi.fn<AnyFn>(() => ({
        where: vi.fn<AnyFn>().mockResolvedValueOnce([{ total: '513' }]),
      })),
    });

    const status = await getBudgetStatus();
    expect(status.monthlyBudgetUsd).toBe(570);
    expect(status.currentMonthCost).toBe(513);
    expect(status.remainingBudget).toBeCloseTo(57);
    expect(status.percentUsed).toBeCloseTo(0.9);
    expect(status.isAlertTriggered).toBe(true);
  });

  it('alert not triggered when under threshold', async () => {
    process.env['MONTHLY_BUDGET_USD'] = '570';

    mockSelect.mockReturnValueOnce({
      from: vi.fn<AnyFn>(() => ({
        where: vi.fn<AnyFn>().mockResolvedValueOnce([{ total: '200' }]),
      })),
    });

    const status = await getBudgetStatus();
    expect(status.isAlertTriggered).toBe(false);
  });
});
