// Unit tests for decisions.service.ts
// Uses vi.mock to avoid real DB connections (port 5432)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PendingDecision } from '@sparkle-os/core';

// ── Mock @sparkle-os/core ─────────────────────────────────────────────────────
vi.mock('@sparkle-os/core', () => ({
  listPendingDecisions: vi.fn(),
}));

// Import AFTER mock registration
import { getDecisionsDashboard, getDecisionsCount } from './decisions.service.js';
import { listPendingDecisions } from '@sparkle-os/core';

const mockListPendingDecisions = vi.mocked(listPendingDecisions);

// ── Sample fixtures ───────────────────────────────────────────────────────────
const sampleDecisions: PendingDecision[] = [
  {
    id: 'dec-001',
    title: 'Escolher banco de dados para módulo X',
    context: 'Precisamos decidir entre PostgreSQL e SQLite para o módulo de logs.',
    requestedBy: '@dev (Dex)',
    storyId: '4.1',
    options: [
      {
        label: 'PostgreSQL',
        description: 'Banco relacional robusto.',
        recommendation: true,
        pros: ['Escalável', 'ACID'],
        cons: ['Requer porta 5432'],
      },
      {
        label: 'SQLite',
        description: 'Banco embutido, sem servidor.',
        recommendation: false,
        pros: ['Simples'],
        cons: ['Não escalável'],
      },
    ],
    priority: 'normal',
    status: 'pending',
    resolution: null,
    createdAt: '2026-04-12T10:00:00.000Z',
    resolvedAt: null,
  },
  {
    id: 'dec-002',
    title: 'Definir estratégia de deploy',
    context: 'Qual pipeline de deploy usar para a versão 1.0?',
    requestedBy: '@architect (Aria)',
    storyId: null,
    options: [],
    priority: 'urgent',
    status: 'pending',
    resolution: null,
    createdAt: '2026-04-12T11:00:00.000Z',
    resolvedAt: null,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('decisions.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDecisionsDashboard()', () => {
    it('returns decisions list when core is available', async () => {
      mockListPendingDecisions.mockResolvedValueOnce(sampleDecisions);

      const result = await getDecisionsDashboard();

      expect(result.coreAvailable).toBe(true);
      expect(result.error).toBeNull();
      expect(result.decisions).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.decisions[0]?.title).toBe('Escolher banco de dados para módulo X');
    });

    it('returns empty list when core returns no decisions', async () => {
      mockListPendingDecisions.mockResolvedValueOnce([]);

      const result = await getDecisionsDashboard();

      expect(result.coreAvailable).toBe(true);
      expect(result.error).toBeNull();
      expect(result.decisions).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('returns empty list with coreAvailable=false when core throws (graceful degradation)', async () => {
      mockListPendingDecisions.mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 127.0.0.1:5432'),
      );

      const result = await getDecisionsDashboard();

      expect(result.coreAvailable).toBe(false);
      expect(result.decisions).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.error).toContain('5432');
    });

    it('handles non-Error thrown objects gracefully', async () => {
      mockListPendingDecisions.mockRejectedValueOnce('unexpected string error');

      const result = await getDecisionsDashboard();

      expect(result.coreAvailable).toBe(false);
      expect(result.decisions).toHaveLength(0);
      expect(result.error).toBe('unexpected string error');
    });

    it('maps count to decisions.length correctly', async () => {
      mockListPendingDecisions.mockResolvedValueOnce([sampleDecisions[0]!]);

      const result = await getDecisionsDashboard();

      expect(result.count).toBe(result.decisions.length);
      expect(result.count).toBe(1);
    });
  });

  describe('getDecisionsCount()', () => {
    it('returns count when core is available', async () => {
      mockListPendingDecisions.mockResolvedValueOnce(sampleDecisions);

      const count = await getDecisionsCount();

      expect(count).toBe(2);
    });

    it('returns 0 when core returns empty list', async () => {
      mockListPendingDecisions.mockResolvedValueOnce([]);

      const count = await getDecisionsCount();

      expect(count).toBe(0);
    });

    it('returns 0 when core is unavailable — never throws', async () => {
      mockListPendingDecisions.mockRejectedValueOnce(new Error('DB unavailable'));

      const count = await getDecisionsCount();

      expect(count).toBe(0);
    });
  });
});
