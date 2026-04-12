// BrainClient unit tests — Story 3.5
// Tests: search, getInsight, getContext, error handling, network failures

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrainClient } from './client.js';
import { BrainClientError } from './errors.js';
import type { Insight, SearchResult } from './types.js';

const BASE_URL = 'http://localhost:3003';

const SEARCH_RESULT: SearchResult = {
  id: 'insight-1',
  source: 'zenya_operation',
  nucleusId: 'zenya',
  sourceRef: 'exec-001',
  confidenceLevel: 'high',
  content: 'Taxa de escalação caiu 36% após ajuste no fluxo de triagem',
  summary: null,
  tags: ['zenya', 'escalacao'],
  embedding: [],
  status: 'validated',
  qualityScore: 0.85,
  validationNotes: 'Aprovado',
  validatedAt: '2026-04-11T10:00:00Z',
  validatedBy: 'system',
  applicationProof: null,
  appliedAt: null,
  canonicalId: null,
  isDuplicate: false,
  similarityScore: null,
  createdAt: '2026-04-11T09:00:00Z',
  updatedAt: '2026-04-11T10:00:00Z',
  similarity: 0.92,
};

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BrainClient.search', () => {
  it('should return results for a valid query', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeResponse({ results: [SEARCH_RESULT] }));

    const client = new BrainClient({ baseUrl: BASE_URL });
    const { results } = await client.search('taxa de escalação');

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('insight-1');
    expect(results[0]!.similarity).toBe(0.92);

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/brain/insights/search`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'taxa de escalação' }),
      }),
    );
  });

  it('should forward custom options to the request body', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeResponse({ results: [] }));

    const client = new BrainClient({ baseUrl: BASE_URL });
    await client.search('test query', { limit: 5, threshold: 0.85, minConfidence: 'high' });

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/brain/insights/search`,
      expect.objectContaining({
        body: JSON.stringify({ query: 'test query', limit: 5, threshold: 0.85, minConfidence: 'high' }),
      }),
    );
  });

  it('should throw BrainClientError on HTTP 400', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeResponse({ error: 'query is required' }, 400));

    const client = new BrainClient({ baseUrl: BASE_URL });
    await expect(client.search('')).rejects.toThrow(BrainClientError);
    await expect(client.search('')).rejects.toMatchObject({ status: 400 });
  });
});

describe('BrainClient.getInsight', () => {
  it('should return insight by id', async () => {
    const insight: Insight = { ...SEARCH_RESULT };
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeResponse(insight));

    const client = new BrainClient({ baseUrl: BASE_URL });
    const result = await client.getInsight('insight-1');

    expect(result.id).toBe('insight-1');
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/brain/insights/insight-1`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('should throw BrainClientError(404) when insight not found', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeResponse({ error: 'Insight not found' }, 404));

    const client = new BrainClient({ baseUrl: BASE_URL });
    await expect(client.getInsight('nonexistent')).rejects.toThrow(BrainClientError);
    await expect(client.getInsight('nonexistent')).rejects.toMatchObject({ status: 404 });
  });
});

describe('BrainClient.getContext', () => {
  it('should return reduced ContextEntry[] from search results', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeResponse({ results: [SEARCH_RESULT] }));

    const client = new BrainClient({ baseUrl: BASE_URL });
    const context = await client.getContext('melhorar fluxo de atendimento');

    expect(context).toHaveLength(1);
    const entry = context[0]!;
    // Must have only the reduced fields
    expect(entry.id).toBe('insight-1');
    expect(entry.content).toBe(SEARCH_RESULT.content);
    expect(entry.source).toBe('zenya_operation');
    expect(entry.confidenceLevel).toBe('high');
    expect(entry.similarity).toBe(0.92);
    // Must NOT have extra fields like embedding or tags
    expect('embedding' in entry).toBe(false);
    expect('tags' in entry).toBe(false);
  });

  it('should return empty array when brain has no matching context', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeResponse({ results: [] }));

    const client = new BrainClient({ baseUrl: BASE_URL });
    const context = await client.getContext('tarefa sem contexto no brain');

    expect(context).toHaveLength(0);
  });
});

describe('BrainClient.ingest — external knowledge ingestion (Story 3.6)', () => {
  const INGEST_INSIGHT: Insight = {
    ...SEARCH_RESULT,
    source: 'agent_research',
    confidenceLevel: 'medium',
    sourceRef: 'story:3.6',
    status: 'raw',
    qualityScore: null,
    validationNotes: null,
    validatedAt: null,
    validatedBy: null,
    applicationProof: null,
    appliedAt: null,
    similarity: 0,
  };

  // AC 3, scenario 1: agent_research without sourceRef → server returns 400 → client propagates BrainClientError(400)
  it('should propagate 400 when agent_research is ingested without sourceRef', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      makeResponse({ error: 'sourceRef is required for agent_research' }, 400),
    );

    const client = new BrainClient({ baseUrl: BASE_URL });
    await expect(
      client.ingest({ source: 'agent_research', content: 'Insight sem sourceRef' }),
    ).rejects.toThrow(BrainClientError);
    await expect(
      client.ingest({ source: 'agent_research', content: 'Insight sem sourceRef' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  // AC 3, scenario 2: agent_research with sourceRef → server returns 201 with confidenceLevel='medium'
  it('should return Insight with confidenceLevel medium for agent_research with sourceRef', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeResponse(INGEST_INSIGHT, 201));

    const client = new BrainClient({ baseUrl: BASE_URL });
    const result = await client.ingest({
      source: 'agent_research',
      content: 'Padrão identificado: usuários abandonam fluxo após 3 perguntas',
      sourceRef: 'story:3.6',
    });

    expect(result.confidenceLevel).toBe('medium');
    expect(result.sourceRef).toBe('story:3.6');
  });

  // AC 3, scenario 3: mauro_input → server returns 201 with confidenceLevel='authoritative'
  it('should return Insight with confidenceLevel authoritative for mauro_input regardless of sent value', async () => {
    const mockFetch = vi.mocked(fetch);
    const authoritativeInsight: Insight = {
      ...INGEST_INSIGHT,
      source: 'mauro_input',
      confidenceLevel: 'authoritative',
      sourceRef: null,
    };
    mockFetch.mockResolvedValue(makeResponse(authoritativeInsight, 201));

    const client = new BrainClient({ baseUrl: BASE_URL });
    const result = await client.ingest({
      source: 'mauro_input',
      content: 'Clientes preferem atendimento via WhatsApp a e-mail',
    });

    expect(result.confidenceLevel).toBe('authoritative');
    expect(result.source).toBe('mauro_input');
  });
});

describe('BrainClient error handling', () => {
  it('should throw BrainClientError with status 0 on network failure', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const client = new BrainClient({ baseUrl: BASE_URL });
    await expect(client.search('query')).rejects.toThrow(BrainClientError);
    await expect(client.search('query')).rejects.toMatchObject({ status: 0 });
  });

  it('should include apiKey in Authorization header when provided', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeResponse({ results: [] }));

    const client = new BrainClient({ baseUrl: BASE_URL, apiKey: 'test-key-123' });
    await client.search('query');

    const callArgs = mockFetch.mock.calls[0];
    const init = callArgs?.[1] as RequestInit;
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-key-123');
  });
});
