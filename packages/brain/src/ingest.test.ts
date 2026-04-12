// Ingest service unit tests
// Tests are isolated with mocks — no real DB or Voyage API calls

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB and embedding service before importing ingest service
vi.mock('./db/insights.js', () => ({
  insertInsight: vi.fn(),
  countInsightsExcludingRejected: vi.fn(),
  findSimilarInsights: vi.fn(),
}));

vi.mock('./services/embedding.service.js', () => ({
  generateEmbedding: vi.fn(),
}));

import { ingestInsight } from './services/ingest.service.js';
import {
  insertInsight,
  countInsightsExcludingRejected,
  findSimilarInsights,
} from './db/insights.js';
import { generateEmbedding } from './services/embedding.service.js';

const mockInsertInsight = vi.mocked(insertInsight);
const mockCount = vi.mocked(countInsightsExcludingRejected);
const mockFindSimilar = vi.mocked(findSimilarInsights);
const mockGenerateEmbedding = vi.mocked(generateEmbedding);

const FAKE_EMBEDDING = Array.from({ length: 1024 }, (_, i) => i / 1024);

const BASE_INSIGHT = {
  id: 'test-id',
  source: 'zenya_operation' as const,
  nucleusId: 'zenya',
  sourceRef: 'exec-123',
  confidenceLevel: 'high' as const,
  content: 'Fluxo "Atendimento" executado com status success em 1200ms',
  summary: null,
  tags: ['Atendimento', 'success', 'zenya_execution'],
  embedding: FAKE_EMBEDDING,
  status: 'raw' as const,
  qualityScore: null,
  validationNotes: null,
  validatedAt: null,
  validatedBy: null,
  applicationProof: null,
  appliedAt: null,
  canonicalId: null,
  isDuplicate: false,
  similarityScore: null,
  createdAt: '2026-04-11T00:00:00Z',
  updatedAt: '2026-04-11T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateEmbedding.mockResolvedValue(FAKE_EMBEDDING);
  mockInsertInsight.mockResolvedValue(BASE_INSIGHT);
});

describe('ingestInsight', () => {
  describe('confidenceLevel derivation from source', () => {
    it('should set confidenceLevel=high for zenya_operation', async () => {
      mockCount.mockResolvedValue(0);

      await ingestInsight({
        source: 'zenya_operation',
        content: 'Operação Zenya teste',
      });

      expect(mockInsertInsight).toHaveBeenCalledWith(
        expect.objectContaining({ confidenceLevel: 'high' })
      );
    });

    it('should set confidenceLevel=authoritative for mauro_input', async () => {
      mockCount.mockResolvedValue(0);

      await ingestInsight({
        source: 'mauro_input',
        content: 'Input direto do Mauro',
      });

      expect(mockInsertInsight).toHaveBeenCalledWith(
        expect.objectContaining({ confidenceLevel: 'authoritative' })
      );
    });

    it('should set confidenceLevel=medium for agent_research', async () => {
      mockCount.mockResolvedValue(0);

      await ingestInsight({
        source: 'agent_research',
        content: 'Pesquisa realizada por agente',
      });

      expect(mockInsertInsight).toHaveBeenCalledWith(
        expect.objectContaining({ confidenceLevel: 'medium' })
      );
    });
  });

  describe('canonicalization', () => {
    it('should skip canonicalization when DB is empty', async () => {
      mockCount.mockResolvedValue(0);

      await ingestInsight({ source: 'zenya_operation', content: 'Test insight' });

      expect(mockFindSimilar).not.toHaveBeenCalled();
      expect(mockInsertInsight).toHaveBeenCalledWith(
        expect.objectContaining({ isDuplicate: false, canonicalId: null })
      );
    });

    it('should mark isDuplicate=true when cosine similarity > 0.92', async () => {
      mockCount.mockResolvedValue(5);
      mockFindSimilar.mockResolvedValue([
        { id: 'existing-id', similarity: 0.95 },
        { id: 'other-id', similarity: 0.88 },
      ]);

      await ingestInsight({ source: 'zenya_operation', content: 'Duplicate insight' });

      expect(mockInsertInsight).toHaveBeenCalledWith(
        expect.objectContaining({
          isDuplicate: true,
          canonicalId: 'existing-id',
          similarityScore: 0.95,
        })
      );
    });

    it('should NOT mark isDuplicate when similarity <= 0.92', async () => {
      mockCount.mockResolvedValue(5);
      mockFindSimilar.mockResolvedValue([
        { id: 'other-id', similarity: 0.88 },
      ]);

      await ingestInsight({ source: 'zenya_operation', content: 'Unique insight' });

      expect(mockInsertInsight).toHaveBeenCalledWith(
        expect.objectContaining({ isDuplicate: false, canonicalId: null })
      );
    });
  });

  describe('input validation', () => {
    it('should throw when content exceeds 2000 chars', async () => {
      await expect(
        ingestInsight({ source: 'zenya_operation', content: 'a'.repeat(2001) })
      ).rejects.toThrow('content exceeds 2000 character limit');
    });

    it('should throw when source is invalid', async () => {
      await expect(
        ingestInsight({ source: 'invalid_source' as never, content: 'test' })
      ).rejects.toThrow('Invalid source');
    });

    it('should throw when content is empty', async () => {
      await expect(
        ingestInsight({ source: 'zenya_operation', content: '' })
      ).rejects.toThrow('content is required');
    });
  });

  describe('basic ingest flow', () => {
    it('should persist with status=raw', async () => {
      mockCount.mockResolvedValue(0);

      const result = await ingestInsight({
        source: 'zenya_operation',
        content: 'Test insight',
        nucleusId: 'zenya',
        tags: ['test'],
      });

      expect(mockGenerateEmbedding).toHaveBeenCalledWith('Test insight');
      expect(mockInsertInsight).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'zenya_operation',
          content: 'Test insight',
          nucleusId: 'zenya',
          tags: ['test'],
        })
      );
      expect(result.status).toBe('raw');
    });
  });
});

describe('ZenyaAdapter', () => {
  it('should transform execution log to InsightInput', async () => {
    const { ZenyaAdapter } = await import('./adapters/zenya.adapter.js');
    const adapter = new ZenyaAdapter();

    const log = {
      id: 'log-1',
      flowId: 'flow-abc',
      flowName: 'Atendimento Principal',
      executionId: 'exec-123',
      status: 'success' as const,
      durationMs: 1500,
      startedAt: '2026-04-11T10:00:00Z',
      finishedAt: '2026-04-11T10:00:01Z',
      errorMessage: null,
      metadata: {},
      createdAt: '2026-04-11T10:00:01Z',
    };

    const input = adapter.fromExecutionLog(log);

    expect(input.source).toBe('zenya_operation');
    expect(input.nucleusId).toBe('zenya');
    expect(input.sourceRef).toBe('exec-123');
    expect(input.content).toContain('Atendimento Principal');
    expect(input.content).toContain('success');
    expect(input.content).toContain('1500ms');
    expect(input.tags).toContain('zenya_execution');
  });

  it('should use flowId as sourceRef when executionId is null', async () => {
    const { ZenyaAdapter } = await import('./adapters/zenya.adapter.js');
    const adapter = new ZenyaAdapter();

    const log = {
      id: 'log-2',
      flowId: 'flow-xyz',
      flowName: 'Fallback Flow',
      executionId: null,
      status: 'error' as const,
      durationMs: null,
      startedAt: '2026-04-11T10:00:00Z',
      finishedAt: null,
      errorMessage: 'Timeout occurred',
      metadata: {},
      createdAt: '2026-04-11T10:00:01Z',
    };

    const input = adapter.fromExecutionLog(log);

    expect(input.sourceRef).toBe('flow-xyz');
    expect(input.content).toContain('Timeout occurred');
  });
});
