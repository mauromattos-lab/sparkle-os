import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- mock DB ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

const mockReturning = vi.fn<AnyFn>();
const mockLimit = vi.fn<AnyFn>(() => ({ then: mockReturning }));
const mockOrderBy = vi.fn<AnyFn>(() => ({ limit: mockLimit }));
const mockWhere = vi.fn<AnyFn>(() => ({
  orderBy: mockOrderBy,
  returning: mockReturning,
  then: mockReturning,
}));
const mockInsert = vi.fn<AnyFn>(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn(() => ({ returning: mockReturning })) })) }));
const mockUpdate = vi.fn<AnyFn>(() => ({ set: vi.fn(() => ({ where: mockWhere })) }));
const mockDelete = vi.fn<AnyFn>(() => ({ where: mockWhere }));
const mockSelect = vi.fn<AnyFn>(() => ({ from: vi.fn(() => ({ where: mockWhere })) }));

vi.mock('../db/client.js', () => ({
  getDb: () => ({
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect,
  }),
  schema: {
    agentContexts: { agentId: 'agent_id' },
  },
}));

// --- mock Redis ---
const mockRedisGet = vi.fn().mockResolvedValue(null);
const mockRedisSet = vi.fn().mockResolvedValue(undefined);
const mockRedisDel = vi.fn().mockResolvedValue(undefined);

vi.mock('../redis/client.js', () => ({
  redisGet: (...args: unknown[]) => mockRedisGet(...args),
  redisSet: (...args: unknown[]) => mockRedisSet(...args),
  redisDel: (...args: unknown[]) => mockRedisDel(...args),
  contextKey: (agentId: string) => `context:${agentId}:active`,
}));

import { saveContext, loadContext, loadContextHistory, deleteContext } from './context-store.js';
import type { SaveContextInput } from './types.js';

const baseInput: SaveContextInput = {
  agentId: 'dev',
  sessionId: 'session-001',
  storyId: '1.3',
  workState: {
    currentTask: 'Implementing Context Store',
    filesModified: ['packages/core/src/context/context-store.ts'],
    nextAction: 'Write tests',
    blockers: [],
  },
  decisionLog: [
    {
      decision: 'Use ioredis',
      rationale: 'Better TypeScript support',
      timestamp: '2026-04-11T12:00:00Z',
    },
  ],
};

const savedRow = {
  id: 'uuid-001',
  agentId: 'dev',
  sessionId: 'session-001',
  storyId: '1.3',
  workState: baseInput.workState,
  decisionLog: baseInput.decisionLog,
  createdAt: new Date('2026-04-11T12:00:00Z'),
  updatedAt: new Date('2026-04-11T12:00:00Z'),
};

describe('saveContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([savedRow]);
  });

  it('writes to Postgres and caches in Redis', async () => {
    const result = await saveContext(baseInput);
    expect(result.agentId).toBe('dev');
    expect(result.storyId).toBe('1.3');
    expect(mockRedisSet).toHaveBeenCalledWith(
      'context:dev:active',
      expect.stringContaining('"agentId":"dev"'),
    );
  });

  it('returns correct shape with ISO timestamps', async () => {
    const result = await saveContext(baseInput);
    expect(result.createdAt).toBe('2026-04-11T12:00:00.000Z');
    expect(result.updatedAt).toBe('2026-04-11T12:00:00.000Z');
  });
});

describe('loadContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached context from Redis when available', async () => {
    const cached = { ...savedRow, createdAt: '2026-04-11T12:00:00.000Z', updatedAt: '2026-04-11T12:00:00.000Z' };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cached));

    const result = await loadContext('dev');
    expect(result).not.toBeNull();
    expect(result?.agentId).toBe('dev');
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('falls back to Postgres when Redis cache is empty', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockLimit.mockResolvedValueOnce([savedRow]);

    const result = await loadContext('dev');
    expect(result).not.toBeNull();
    expect(result?.agentId).toBe('dev');
    expect(mockSelect).toHaveBeenCalled();
    // should warm Redis cache
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it('returns null when context does not exist', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockLimit.mockResolvedValueOnce([]);

    const result = await loadContext('architect');
    expect(result).toBeNull();
  });
});

describe('loadContextHistory', () => {
  it('returns all Postgres rows for an agent', async () => {
    const rows = [savedRow, { ...savedRow, id: 'uuid-002', sessionId: 'session-002' }];
    mockWhere.mockReturnValueOnce({ orderBy: vi.fn<AnyFn>(() => Promise.resolve(rows)) });

    const history = await loadContextHistory('dev');
    expect(history).toHaveLength(2);
    expect(history[0]?.agentId).toBe('dev');
  });
});

describe('deleteContext', () => {
  it('removes from Postgres and Redis', async () => {
    mockWhere.mockReturnValueOnce(Promise.resolve(undefined));

    await deleteContext('dev');
    expect(mockRedisDel).toHaveBeenCalledWith('context:dev:active');
  });

  it('does not throw if Redis del fails', async () => {
    mockWhere.mockReturnValueOnce(Promise.resolve(undefined));
    mockRedisDel.mockRejectedValueOnce(new Error('Redis gone'));

    await expect(deleteContext('dev')).resolves.not.toThrow();
  });
});

describe('Redis TTL fallback', () => {
  it('saveContext does not throw when Redis is unavailable', async () => {
    mockReturning.mockResolvedValue([savedRow]);
    mockRedisSet.mockRejectedValueOnce(new Error('connection refused'));

    await expect(saveContext(baseInput)).resolves.not.toThrow();
  });
});
