// Ingest endpoint unit tests — Story 3.6
// Tests: POST /brain/insights/ingest — source-specific validations, content validation, confidenceLevel override

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./db/insights.js', () => ({
  insertInsight: vi.fn(),
  countInsightsExcludingRejected: vi.fn(),
  findSimilarInsights: vi.fn(),
  findInsightById: vi.fn(),
  listInsights: vi.fn(),
  validateInsight: vi.fn(),
  rejectInsight: vi.fn(),
  applyInsight: vi.fn(),
  searchInsights: vi.fn(),
}));

vi.mock('./services/embedding.service.js', () => ({
  generateEmbedding: vi.fn(),
  checkEmbeddingServiceHealth: vi.fn(),
}));

import { insertInsight, countInsightsExcludingRejected, findSimilarInsights } from './db/insights.js';
import { generateEmbedding } from './services/embedding.service.js';
import { app } from './index.js';
import type { Insight } from './types/insight.js';

const mockInsertInsight = vi.mocked(insertInsight);
const mockCount = vi.mocked(countInsightsExcludingRejected);
const mockFindSimilar = vi.mocked(findSimilarInsights);
const mockGenerateEmbedding = vi.mocked(generateEmbedding);

const FAKE_EMBEDDING = Array.from({ length: 1024 }, (_, i) => i / 1024);

const BASE_INSIGHT: Insight = {
  id: 'test-ingest-id',
  source: 'agent_research',
  nucleusId: null,
  sourceRef: 'story:3.6',
  confidenceLevel: 'medium',
  content: 'Agentes devem incluir sourceRef ao ingerir pesquisa no Cérebro',
  summary: null,
  tags: [],
  embedding: FAKE_EMBEDDING,
  status: 'raw',
  qualityScore: null,
  validationNotes: null,
  validatedAt: null,
  validatedBy: null,
  applicationProof: null,
  appliedAt: null,
  canonicalId: null,
  isDuplicate: false,
  similarityScore: null,
  createdAt: '2026-04-12T00:00:00Z',
  updatedAt: '2026-04-12T00:00:00Z',
};

function post(path: string, body: unknown) {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateEmbedding.mockResolvedValue(FAKE_EMBEDDING);
  mockCount.mockResolvedValue(0);
  mockFindSimilar.mockResolvedValue([]);
});

describe('POST /brain/insights/ingest', () => {
  // AC 5: mauro_input sem sourceRef — deve aceitar (sourceRef opcional para Mauro)
  it('should accept mauro_input without sourceRef', async () => {
    const insight: Insight = { ...BASE_INSIGHT, source: 'mauro_input', confidenceLevel: 'authoritative', sourceRef: null };
    mockInsertInsight.mockResolvedValue(insight);

    const res = await post('/brain/insights/ingest', {
      source: 'mauro_input',
      content: 'Clientes preferem atendimento via WhatsApp',
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Insight;
    expect(body.confidenceLevel).toBe('authoritative');
  });

  // AC 5: mauro_input com confidenceLevel='medium' enviado — deve ser sobrescrito para 'authoritative'
  it('should override confidenceLevel to authoritative for mauro_input regardless of client value', async () => {
    const insight: Insight = { ...BASE_INSIGHT, source: 'mauro_input', confidenceLevel: 'authoritative', sourceRef: null };
    mockInsertInsight.mockResolvedValue(insight);

    const res = await post('/brain/insights/ingest', {
      source: 'mauro_input',
      content: 'Insight autoritativo de Mauro',
      confidenceLevel: 'medium', // client tries to override — must be ignored
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Insight;
    expect(body.confidenceLevel).toBe('authoritative');
  });

  // AC 5: agent_research sem sourceRef — deve retornar 400
  it('should reject agent_research without sourceRef with 400', async () => {
    const res = await post('/brain/insights/ingest', {
      source: 'agent_research',
      content: 'Pesquisa sem referência de origem',
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('sourceRef');
  });

  // AC 5: agent_research com sourceRef — deve aceitar com confidenceLevel='medium'
  it('should accept agent_research with sourceRef and return confidenceLevel medium', async () => {
    mockInsertInsight.mockResolvedValue(BASE_INSIGHT);

    const res = await post('/brain/insights/ingest', {
      source: 'agent_research',
      content: 'Padrão identificado: usuários abandonam fluxo após 3 perguntas consecutivas',
      sourceRef: 'story:3.6',
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Insight;
    expect(body.confidenceLevel).toBe('medium');
    expect(body.sourceRef).toBe('story:3.6');
  });

  // AC 6: content ausente — deve retornar 400
  it('should return 400 when content is missing', async () => {
    const res = await post('/brain/insights/ingest', {
      source: 'mauro_input',
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('content');
  });

  // AC 6: content vazio — deve retornar 400
  it('should return 400 when content is empty string', async () => {
    const res = await post('/brain/insights/ingest', {
      source: 'mauro_input',
      content: '   ', // whitespace only
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('content');
  });

  // AC 6: content excede 2000 chars — deve retornar 400
  it('should return 400 when content exceeds 2000 characters', async () => {
    const res = await post('/brain/insights/ingest', {
      source: 'mauro_input',
      content: 'a'.repeat(2001),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('2000');
  });
});
