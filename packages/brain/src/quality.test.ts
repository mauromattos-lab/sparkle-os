// Quality Service unit tests — Story 3.3
// Tests: 3 dimensions, calculateQualityScore, threshold behavior

import { describe, it, expect } from 'vitest';
import {
  assessSpecificity,
  assessEvidence,
  assessRelevance,
  assessQuality,
  calculateQualityScore,
  QUALITY_THRESHOLD,
} from './services/quality.service.js';

describe('assessSpecificity', () => {
  it('should return high score for content with numeric metrics', () => {
    const score = assessSpecificity('Fluxo executado em 1200ms com taxa de 95% de sucesso');
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it('should return high score for content with large numbers', () => {
    const score = assessSpecificity('Processadas 1500 conversas no mês');
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it('should return low score for vague content', () => {
    const score = assessSpecificity('Às vezes o fluxo sempre falha quando todos os usuários tentam');
    expect(score).toBeLessThan(0.5);
  });

  it('should return medium score for mixed content', () => {
    const score = assessSpecificity('Geralmente executado em 500ms');
    expect(score).toBeGreaterThanOrEqual(0.4);
    expect(score).toBeLessThan(0.9);
  });

  it('should return medium-low for content without metrics and without vague words', () => {
    const score = assessSpecificity('O fluxo de atendimento falhou');
    expect(score).toBeGreaterThanOrEqual(0.3);
    expect(score).toBeLessThan(0.7);
  });
});

describe('assessEvidence', () => {
  it('should return high score when sourceRef and numeric data present', () => {
    const score = assessEvidence('Fluxo falhou 3 vezes consecutivas', 'exec-abc123');
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it('should return medium score when only sourceRef present', () => {
    const score = assessEvidence('Fluxo falhou sem dados numéricos', 'exec-abc123');
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThan(0.9);
  });

  it('should return medium score when only numeric data present', () => {
    const score = assessEvidence('Taxa de 85% de sucesso', null);
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThan(0.9);
  });

  it('should return low score when no sourceRef and no numeric data', () => {
    const score = assessEvidence('O fluxo teve problemas', null);
    expect(score).toBeLessThan(0.4);
  });
});

describe('assessRelevance', () => {
  it('should return high score when nucleusId and SparkleOS tags present', () => {
    const score = assessRelevance(['zenya', 'atendimento', 'sucesso'], 'zenya');
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it('should return medium score when only nucleusId present', () => {
    const score = assessRelevance(['generic', 'tag'], 'zenya');
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThan(0.9);
  });

  it('should return medium score when only relevant tags present', () => {
    const score = assessRelevance(['chatwoot', 'webhook', 'fluxo'], null);
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThan(0.9);
  });

  it('should return low score when no nucleusId and no relevant tags', () => {
    const score = assessRelevance(['test', 'data'], null);
    expect(score).toBeLessThan(0.4);
  });
});

describe('calculateQualityScore', () => {
  it('should return average of 3 dimensions', () => {
    const score = calculateQualityScore({ specificity: 0.9, evidence: 0.6, relevance: 0.9 });
    expect(score).toBe(0.8); // (0.9 + 0.6 + 0.9) / 3 = 0.8
  });

  it('should round to 2 decimal places', () => {
    const score = calculateQualityScore({ specificity: 0.9, evidence: 0.9, relevance: 0.2 });
    // (0.9 + 0.9 + 0.2) / 3 = 0.6666... → 0.67
    expect(score).toBe(0.67);
  });

  it('should return 0.0 for all zeros', () => {
    expect(calculateQualityScore({ specificity: 0, evidence: 0, relevance: 0 })).toBe(0);
  });

  it('should return 1.0 for all ones', () => {
    expect(calculateQualityScore({ specificity: 1, evidence: 1, relevance: 1 })).toBe(1);
  });
});

describe('assessQuality (full assessment)', () => {
  it('should assess high-quality zenya insight correctly', () => {
    const criteria = assessQuality(
      'Fluxo "Atendimento Principal" executado em 1200ms com status success',
      'exec-abc123',
      ['zenya', 'atendimento', 'sucesso'],
      'zenya',
    );

    expect(criteria.specificity).toBeGreaterThanOrEqual(0.8);
    expect(criteria.evidence).toBeGreaterThanOrEqual(0.8);
    expect(criteria.relevance).toBeGreaterThanOrEqual(0.8);
  });

  it('should produce score >= threshold for high-quality insight', () => {
    const criteria = assessQuality(
      'Fluxo "Atendimento" executado em 500ms — 95% sucesso',
      'exec-001',
      ['zenya', 'atendimento'],
      'zenya',
    );
    const score = calculateQualityScore(criteria);
    expect(score).toBeGreaterThanOrEqual(QUALITY_THRESHOLD);
  });

  it('should produce score < threshold for low-quality insight', () => {
    const criteria = assessQuality(
      'Às vezes o sistema tem problemas',
      null,
      ['generico'],
      null,
    );
    const score = calculateQualityScore(criteria);
    expect(score).toBeLessThan(QUALITY_THRESHOLD);
  });
});

describe('QUALITY_THRESHOLD', () => {
  it('should be 0.6', () => {
    expect(QUALITY_THRESHOLD).toBe(0.6);
  });
});
