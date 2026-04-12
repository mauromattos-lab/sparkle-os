// Search route unit tests — Story 3.3
// Tests: semantic search with filters, empty base, confidence filter

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./db/insights.js', () => ({
  insertInsight: vi.fn(),
  countInsightsExcludingRejected: vi.fn(),
  findSimilarInsights: vi.fn(),
  findInsightById: vi.fn(),
  listInsights: vi.fn(),
  validateInsight: vi.fn(),
  rejectInsight: vi.fn(),
  searchInsights: vi.fn(),
}));

vi.mock('./services/embedding.service.js', () => ({
  generateEmbedding: vi.fn(),
  checkEmbeddingServiceHealth: vi.fn(),
}));

import { searchInsights } from './db/insights.js';
import { generateEmbedding } from './services/embedding.service.js';
import { app } from './index.js';

const mockSearchInsights = vi.mocked(searchInsights);
const mockGenerateEmbedding = vi.mocked(generateEmbedding);

const FAKE_EMBEDDING = Array.from({ length: 1024 }, (_, i) => i / 1024);

const VALIDATED_INSIGHT = {
  id: 'insight-1',
  source: 'zenya_operation' as const,
  nucleusId: 'zenya',
  sourceRef: 'exec-123',
  confidenceLevel: 'high' as const,
  content: 'Fluxo de atendimento executado em 500ms',
  summary: null,
  tags: ['zenya', 'atendimento'],
  embedding: FAKE_EMBEDDING,
  status: 'validated' as const,
  qualityScore: 0.85,
  validationNotes: 'Aprovado automaticamente',
  validatedAt: '2026-04-11T10:00:00Z',
  validatedBy: 'system',
  applicationProof: null,
  appliedAt: null,
  canonicalId: null,
  isDuplicate: false,
  similarityScore: null,
  createdAt: '2026-04-11T10:00:00Z',
  updatedAt: '2026-04-11T10:00:00Z',
  similarity: 0.92,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateEmbedding.mockResolvedValue(FAKE_EMBEDDING);
});

describe('POST /brain/insights/search', () => {
  it('should return results for valid query', async () => {
    mockSearchInsights.mockResolvedValue([VALIDATED_INSIGHT]);

    const res = await app.request('/brain/insights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'atendimento fluxo zenya' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { results: unknown[] };
    expect(body.results).toHaveLength(1);
    expect(mockGenerateEmbedding).toHaveBeenCalledWith('atendimento fluxo zenya');
    expect(mockSearchInsights).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: FAKE_EMBEDDING,
        threshold: 0.75,
        statusFilter: ['validated', 'applied'],
      })
    );
  });

  it('should return empty array when no results above threshold', async () => {
    mockSearchInsights.mockResolvedValue([]);

    const res = await app.request('/brain/insights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query sem resultados' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { results: unknown[] };
    expect(body.results).toHaveLength(0);
  });

  it('should respect custom limit and threshold', async () => {
    mockSearchInsights.mockResolvedValue([]);

    await app.request('/brain/insights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', limit: 5, threshold: 0.85 }),
    });

    expect(mockSearchInsights).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, threshold: 0.85 })
    );
  });

  it('should respect statusFilter parameter', async () => {
    mockSearchInsights.mockResolvedValue([]);

    await app.request('/brain/insights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', statusFilter: ['applied'] }),
    });

    expect(mockSearchInsights).toHaveBeenCalledWith(
      expect.objectContaining({ statusFilter: ['applied'] })
    );
  });

  it('should filter by minConfidence=high (excludes medium)', async () => {
    mockSearchInsights.mockResolvedValue([]);

    await app.request('/brain/insights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', minConfidence: 'high' }),
    });

    expect(mockSearchInsights).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedConfidences: ['authoritative', 'high'],
      })
    );
  });

  it('should return 400 when query is missing', async () => {
    const res = await app.request('/brain/insights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 5 }),
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid threshold', async () => {
    const res = await app.request('/brain/insights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', threshold: 1.5 }),
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid minConfidence value', async () => {
    const res = await app.request('/brain/insights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', minConfidence: 'invalid_level' }),
    });
    expect(res.status).toBe(400);
  });
});
