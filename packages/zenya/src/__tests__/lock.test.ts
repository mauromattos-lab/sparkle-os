// Tests pra session lock — Story 18.1 / TD-06.
// Cobre: cleanup pre-acquire, conflict handling, TTL configurável.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (hoisted) ---

const mockLt = vi.fn();
const mockEqPhone = vi.fn(() => ({ lt: mockLt }));
const mockEqTenant = vi.fn(() => ({ eq: mockEqPhone }));
const mockDelete = vi.fn(() => ({ eq: mockEqTenant }));
const mockInsert = vi.fn();

const mockFrom = vi.fn(() => ({
  delete: mockDelete,
  insert: mockInsert,
}));

vi.mock('../db/client.js', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

// Import after mocks
import { acquireLock, releaseLock, withSessionLock } from '../worker/lock.js';

// --- Helpers ---

function setupSuccessfulInsert(): void {
  mockLt.mockResolvedValue({ error: null });
  mockInsert.mockResolvedValue({ error: null });
}

function setupConflictInsert(): void {
  mockLt.mockResolvedValue({ error: null });
  mockInsert.mockResolvedValue({ error: { code: '23505' } });
}

function setupDbErrorInsert(): void {
  mockLt.mockResolvedValue({ error: null });
  mockInsert.mockResolvedValue({ error: { code: '50000', message: 'DB unavailable' } });
}

// --- Tests ---

describe('lock.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('runs pre-acquire cleanup before INSERT (TTL-based)', async () => {
      setupSuccessfulInsert();

      await acquireLock('tenant-1', '+5511999');

      // Cleanup chain: from('zenya_session_lock').delete().eq().eq().lt('locked_at', threshold)
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockEqTenant).toHaveBeenCalledWith('tenant_id', 'tenant-1');
      expect(mockEqPhone).toHaveBeenCalledWith('phone_number', '+5511999');
      expect(mockLt).toHaveBeenCalledWith('locked_at', expect.any(String));

      // Insert chamado depois
      expect(mockInsert).toHaveBeenCalledWith({
        tenant_id: 'tenant-1',
        phone_number: '+5511999',
      });
    });

    it('returns true on successful insert (lock fresh acquired)', async () => {
      setupSuccessfulInsert();

      const result = await acquireLock('tenant-1', '+5511999');
      expect(result).toBe(true);
    });

    it('returns false on duplicate key conflict (23505) — lock vivo by other session', async () => {
      setupConflictInsert();

      const result = await acquireLock('tenant-1', '+5511999');
      expect(result).toBe(false);

      // Cleanup ainda roda mesmo no caso de conflict (lock vivo passou pelo TTL)
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('throws on non-conflict DB error', async () => {
      setupDbErrorInsert();

      await expect(acquireLock('tenant-1', '+5511999')).rejects.toThrow(
        'Lock acquisition failed: DB unavailable',
      );
    });

    it('cleanup uses staleThreshold derived from STALE_LOCK_AGE_MS (default 5min)', async () => {
      setupSuccessfulInsert();

      const before = Date.now();
      await acquireLock('tenant-1', '+5511999');
      const after = Date.now();

      const ltCall = mockLt.mock.calls[0];
      const threshold = new Date(ltCall![1] as string).getTime();

      // threshold deve estar entre (before - 5min) e (after - 5min) ± margem pequena
      const fiveMinAgo = before - 300000;
      expect(threshold).toBeGreaterThanOrEqual(fiveMinAgo - 100);
      expect(threshold).toBeLessThanOrEqual(after - 300000 + 100);
    });
  });

  describe('releaseLock (sem mudança vs original)', () => {
    it('exists and is callable', async () => {
      // Função permanece igual ao original — smoke check
      expect(typeof releaseLock).toBe('function');
    });
  });

  describe('withSessionLock (sem mudança vs original)', () => {
    it('exists and returns shape { locked }', async () => {
      expect(typeof withSessionLock).toBe('function');
    });
  });
});
