// Apply route unit tests — Story 3.4
// Tests: PATCH /:id/apply — FR6 application proof, status transitions, validation

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

import { findInsightById, applyInsight } from './db/insights.js';
import { app } from './index.js';
import type { Insight, ApplicationProof } from './types/insight.js';

const mockFindInsightById = vi.mocked(findInsightById);
const mockApplyInsight = vi.mocked(applyInsight);

const VALID_METRIC = {
  name: 'taxa_escalacao',
  value: 12.5,
  unit: '%',
  measuredAt: '2026-04-11T10:00:00Z',
};

const VALID_RESULT_METRIC = {
  name: 'taxa_escalacao',
  value: 8.0,
  unit: '%',
  measuredAt: '2026-04-12T10:00:00Z',
};

const VALID_PROOF: ApplicationProof = {
  appliedAt: '2026-04-12T10:00:00Z',
  appliedBy: '@dev',
  changeDescription: 'Ajuste no fluxo de triagem para reduzir escalações',
  baselineMetric: VALID_METRIC,
  resultMetric: VALID_RESULT_METRIC,
  improvementPercent: -36,
  storyId: null,
  nucleusId: 'zenya',
  evidenceRef: null,
};

const VALIDATED_INSIGHT: Insight = {
  id: 'insight-validated',
  source: 'zenya_operation',
  nucleusId: 'zenya',
  sourceRef: 'exec-001',
  confidenceLevel: 'high',
  content: 'Taxa de escalação caiu 36% após ajuste no fluxo',
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
};

const APPLIED_INSIGHT: Insight = {
  ...VALIDATED_INSIGHT,
  status: 'applied',
  applicationProof: VALID_PROOF,
  appliedAt: '2026-04-12T10:00:00Z',
};

const RAW_INSIGHT: Insight = {
  ...VALIDATED_INSIGHT,
  id: 'insight-raw',
  status: 'raw',
  qualityScore: null,
  validationNotes: null,
  validatedAt: null,
  validatedBy: null,
};

const REJECTED_INSIGHT: Insight = {
  ...VALIDATED_INSIGHT,
  id: 'insight-rejected',
  status: 'rejected',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /brain/insights/:id/apply', () => {
  it('should apply insight with valid proof (validated → applied)', async () => {
    mockFindInsightById.mockResolvedValue(VALIDATED_INSIGHT);
    mockApplyInsight.mockResolvedValue(APPLIED_INSIGHT);

    const res = await app.request('/brain/insights/insight-validated/apply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationProof: VALID_PROOF }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as Insight;
    expect(body.status).toBe('applied');
    expect(body.applicationProof).toEqual(VALID_PROOF);
    expect(mockApplyInsight).toHaveBeenCalledWith('insight-validated', VALID_PROOF);
  });

  it('should return 400 when insight is raw (not validated)', async () => {
    mockFindInsightById.mockResolvedValue(RAW_INSIGHT);

    const res = await app.request('/brain/insights/insight-raw/apply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationProof: VALID_PROOF }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('validated');
    expect(mockApplyInsight).not.toHaveBeenCalled();
  });

  it('should return 400 when insight is rejected', async () => {
    mockFindInsightById.mockResolvedValue(REJECTED_INSIGHT);

    const res = await app.request('/brain/insights/insight-rejected/apply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationProof: VALID_PROOF }),
    });

    expect(res.status).toBe(400);
    expect(mockApplyInsight).not.toHaveBeenCalled();
  });

  it('should return 404 when insight does not exist', async () => {
    mockFindInsightById.mockResolvedValue(null);

    const res = await app.request('/brain/insights/nonexistent/apply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationProof: VALID_PROOF }),
    });

    expect(res.status).toBe(404);
    expect(mockApplyInsight).not.toHaveBeenCalled();
  });

  it('should return 400 when applicationProof is missing', async () => {
    const res = await app.request('/brain/insights/insight-validated/apply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ someOtherField: 'value' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('applicationProof');
    expect(mockFindInsightById).not.toHaveBeenCalled();
  });

  it('should return 400 when baselineMetric is missing required field', async () => {
    const invalidProof = {
      ...VALID_PROOF,
      baselineMetric: { name: 'taxa', value: 10 }, // missing unit and measuredAt
    };

    const res = await app.request('/brain/insights/insight-validated/apply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationProof: invalidProof }),
    });

    expect(res.status).toBe(400);
    expect(mockFindInsightById).not.toHaveBeenCalled();
  });

  it('should return 400 when improvementPercent is missing', async () => {
    const { improvementPercent: _, ...proofWithoutPercent } = VALID_PROOF;
    void _;

    const res = await app.request('/brain/insights/insight-validated/apply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationProof: proofWithoutPercent }),
    });

    expect(res.status).toBe(400);
  });

  it('should accept negative improvementPercent (reduction is also a valid metric)', async () => {
    mockFindInsightById.mockResolvedValue(VALIDATED_INSIGHT);
    mockApplyInsight.mockResolvedValue({
      ...APPLIED_INSIGHT,
      applicationProof: { ...VALID_PROOF, improvementPercent: -50 },
    });

    const proofWithNegative = { ...VALID_PROOF, improvementPercent: -50 };

    const res = await app.request('/brain/insights/insight-validated/apply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationProof: proofWithNegative }),
    });

    expect(res.status).toBe(200);
  });

  it('should return applicationProof as object (not string) in response', async () => {
    mockFindInsightById.mockResolvedValue(VALIDATED_INSIGHT);
    mockApplyInsight.mockResolvedValue(APPLIED_INSIGHT);

    const res = await app.request('/brain/insights/insight-validated/apply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationProof: VALID_PROOF }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as Insight;
    // applicationProof must be an object, not a JSON string
    expect(typeof body.applicationProof).toBe('object');
    expect(body.applicationProof).not.toBeNull();
    expect((body.applicationProof as ApplicationProof).appliedBy).toBe('@dev');
  });
});
