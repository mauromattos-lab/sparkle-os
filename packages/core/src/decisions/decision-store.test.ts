import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => 'mock-eq'),
  asc: vi.fn((_a: unknown) => 'mock-asc'),
}));

const mockReturning = vi.fn<AnyFn>();
const mockWhere = vi.fn<AnyFn>();
const mockOrderBy = vi.fn<AnyFn>();
const mockInsert = vi.fn<AnyFn>();
const mockSelect = vi.fn<AnyFn>();
const mockUpdate = vi.fn<AnyFn>();

vi.mock('../db/client.js', () => ({
  getDb: () => ({
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  }),
  schema: {
    pendingDecisions: { status: 'status', id: 'id' },
  },
}));

import { createDecision, listPendingDecisions, resolveDecision } from './decision-store.js';

const baseRow = {
  id: 'dec-uuid-001',
  title: 'Choose escalation model',
  context: 'Need to define when to escalate to Mauro',
  options: [
    {
      label: 'Decision matrix',
      description: '4-tier classification',
      recommendation: true,
      pros: ['clear criteria'],
      cons: ['rigid'],
    },
  ],
  requestedBy: 'dev',
  storyId: '1.6',
  priority: 'normal',
  status: 'pending',
  resolution: null,
  createdAt: new Date('2026-04-11T12:00:00Z'),
  resolvedAt: null,
};

describe('createDecision', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a decision and returns it', async () => {
    mockInsert.mockReturnValueOnce({
      values: vi.fn<AnyFn>(() => ({ returning: mockReturning })),
    });
    mockReturning.mockResolvedValueOnce([baseRow]);

    const result = await createDecision({
      title: 'Choose escalation model',
      context: 'Need to define when to escalate to Mauro',
      options: baseRow.options,
      requestedBy: 'dev',
      storyId: '1.6',
    });

    expect(result.title).toBe('Choose escalation model');
    expect(result.status).toBe('pending');
    expect(result.resolvedAt).toBeNull();
    expect(result.createdAt).toBe('2026-04-11T12:00:00.000Z');
  });

  it('defaults priority to normal', async () => {
    mockInsert.mockReturnValueOnce({
      values: vi.fn<AnyFn>(() => ({ returning: mockReturning })),
    });
    mockReturning.mockResolvedValueOnce([baseRow]);

    const result = await createDecision({
      title: 'Decision',
      context: 'Context',
      options: [],
      requestedBy: 'sm',
    });

    expect(result.priority).toBe('normal');
  });
});

describe('listPendingDecisions', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns only pending decisions ordered by createdAt', async () => {
    const rows = [baseRow, { ...baseRow, id: 'dec-uuid-002', title: 'Second decision' }];
    mockSelect.mockReturnValueOnce({
      from: vi.fn<AnyFn>(() => ({
        where: vi.fn<AnyFn>(() => ({
          orderBy: mockOrderBy,
        })),
      })),
    });
    mockOrderBy.mockResolvedValueOnce(rows);

    const list = await listPendingDecisions();
    expect(list).toHaveLength(2);
    expect(list[0]?.status).toBe('pending');
  });
});

describe('resolveDecision', () => {
  beforeEach(() => vi.resetAllMocks());

  it('resolves a decision and sets resolvedAt', async () => {
    const resolvedRow = {
      ...baseRow,
      status: 'resolved',
      resolution: 'Adopted 4-tier decision matrix',
      resolvedAt: new Date('2026-04-11T15:00:00Z'),
    };
    mockUpdate.mockReturnValueOnce({
      set: vi.fn<AnyFn>(() => ({
        where: vi.fn<AnyFn>(() => ({ returning: mockReturning })),
      })),
    });
    mockReturning.mockResolvedValueOnce([resolvedRow]);

    const result = await resolveDecision('dec-uuid-001', {
      resolution: 'Adopted 4-tier decision matrix',
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe('resolved');
    expect(result?.resolution).toBe('Adopted 4-tier decision matrix');
    expect(result?.resolvedAt).toBe('2026-04-11T15:00:00.000Z');
  });

  it('returns null when decision not found', async () => {
    mockUpdate.mockReturnValueOnce({
      set: vi.fn<AnyFn>(() => ({
        where: vi.fn<AnyFn>(() => ({ returning: mockReturning })),
      })),
    });
    mockReturning.mockResolvedValueOnce([]);

    const result = await resolveDecision('nonexistent-id', { resolution: 'N/A' });
    expect(result).toBeNull();
  });
});
