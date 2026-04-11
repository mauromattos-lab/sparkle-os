import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// mock drizzle-orm operators to avoid column type checks
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => 'mock-eq'),
  asc: vi.fn((_a: unknown) => 'mock-asc'),
  sql: Object.assign(
    (_strings: TemplateStringsArray, ..._values: unknown[]) => ({ as: vi.fn() }),
    { raw: vi.fn() }
  ),
}));

const mockReturning = vi.fn<AnyFn>();
const mockOrderBy = vi.fn<AnyFn>();
const mockWhere = vi.fn<AnyFn>();
const mockSelect = vi.fn<AnyFn>();
const mockInsert = vi.fn<AnyFn>();

vi.mock('../db/client.js', () => ({
  getDb: () => ({
    insert: mockInsert,
    select: mockSelect,
  }),
  schema: {
    adrs: { number: 'number' },
  },
}));

import { createAdr, listAdrs, getAdrByNumber, getNextAdrNumber, adrFilePath } from './adr-store.js';

const baseRow = {
  id: 'adr-uuid-001',
  number: 1,
  title: 'Repository Structure',
  status: 'accepted',
  context: 'Needed monorepo',
  decision: 'pnpm workspaces',
  rationale: 'Best for multi-package TS',
  alternatives: ['polyrepo', 'nx'],
  consequences: 'Efficient disk usage',
  createdBy: 'architect',
  storyId: '1.1',
  filePath: 'docs/adrs/adr-001-repository-structure.md',
  createdAt: new Date('2026-04-11T12:00:00Z'),
  updatedAt: new Date('2026-04-11T12:00:00Z'),
};

describe('adrFilePath', () => {
  it('pads number to 3 digits', () => {
    expect(adrFilePath(1, 'Repository Structure')).toBe(
      'docs/adrs/adr-001-repository-structure.md',
    );
    expect(adrFilePath(42, 'Context Store Redis Postgres')).toBe(
      'docs/adrs/adr-042-context-store-redis-postgres.md',
    );
  });
});

describe('getNextAdrNumber', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 1 when no ADRs exist', async () => {
    const mockFrom = vi.fn<AnyFn>().mockResolvedValueOnce([{ max: 0 }]);
    mockSelect.mockReturnValueOnce({ from: mockFrom });

    const next = await getNextAdrNumber();
    expect(next).toBe(1);
  });

  it('returns max + 1 when ADRs exist', async () => {
    const mockFrom = vi.fn<AnyFn>().mockResolvedValueOnce([{ max: 5 }]);
    mockSelect.mockReturnValueOnce({ from: mockFrom });

    const next = await getNextAdrNumber();
    expect(next).toBe(6);
  });
});

describe('createAdr', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates ADR with correct number and filePath', async () => {
    // mock getNextAdrNumber (select)
    const mockFrom1 = vi.fn<AnyFn>().mockResolvedValueOnce([{ max: 0 }]);
    mockSelect.mockReturnValueOnce({ from: mockFrom1 });

    // mock insert
    mockInsert.mockReturnValueOnce({
      values: vi.fn<AnyFn>(() => ({ returning: mockReturning })),
    });
    mockReturning.mockResolvedValueOnce([baseRow]);

    const adr = await createAdr({
      title: 'Repository Structure',
      status: 'accepted',
      createdBy: 'architect',
      storyId: '1.1',
    });

    expect(adr.number).toBe(1);
    expect(adr.filePath).toBe('docs/adrs/adr-001-repository-structure.md');
    expect(adr.createdAt).toBe('2026-04-11T12:00:00.000Z');
  });

  it('defaults status to proposed', async () => {
    const mockFrom1 = vi.fn<AnyFn>().mockResolvedValueOnce([{ max: 2 }]);
    mockSelect.mockReturnValueOnce({ from: mockFrom1 });

    mockInsert.mockReturnValueOnce({
      values: vi.fn<AnyFn>(() => ({ returning: mockReturning })),
    });
    mockReturning.mockResolvedValueOnce([{ ...baseRow, number: 3, status: 'proposed' }]);

    const adr = await createAdr({ title: 'New Decision' });
    expect(adr.status).toBe('proposed');
  });
});

describe('listAdrs', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns ADRs ordered by number', async () => {
    const rows = [baseRow, { ...baseRow, id: 'adr-uuid-002', number: 2, title: 'Context Store' }];
    mockOrderBy.mockResolvedValueOnce(rows);
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockSelect.mockReturnValueOnce({
      from: vi.fn<AnyFn>(() => ({ orderBy: mockOrderBy })),
    });

    const list = await listAdrs();
    expect(list).toHaveLength(2);
    expect(list[0]?.number).toBe(1);
    expect(list[1]?.number).toBe(2);
  });
});

describe('getAdrByNumber', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns ADR when found', async () => {
    mockWhere.mockResolvedValueOnce([baseRow]);
    mockSelect.mockReturnValueOnce({
      from: vi.fn<AnyFn>(() => ({ where: mockWhere })),
    });

    const adr = await getAdrByNumber(1);
    expect(adr).not.toBeNull();
    expect(adr?.number).toBe(1);
    expect(adr?.title).toBe('Repository Structure');
  });

  it('returns null when not found', async () => {
    mockWhere.mockResolvedValueOnce([]);
    mockSelect.mockReturnValueOnce({
      from: vi.fn<AnyFn>(() => ({ where: mockWhere })),
    });

    const adr = await getAdrByNumber(999);
    expect(adr).toBeNull();
  });
});
