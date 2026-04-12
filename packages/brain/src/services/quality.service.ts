// Quality Validation Service — 3 dimensions for v1
// Source: docs/architecture/cerebro-coletivo.md §5 (Pipeline de Validação)
// Story 3.3 — Validação de Qualidade do Conhecimento

export const QUALITY_THRESHOLD = 0.6; // Revisável após 50+ validações reais — Story 3.7

export interface QualityCriteria {
  specificity: number; // 0.0–1.0: específico e acionável vs. genérico
  evidence: number;    // 0.0–1.0: baseado em dado real vs. suposição
  relevance: number;   // 0.0–1.0: relevante para operação SparkleOS
}

/**
 * Score final = média aritmética das 3 dimensões (pesos iguais para v1).
 * Revisão de pesos prevista em Story 3.7 após dados reais.
 */
export function calculateQualityScore(criteria: QualityCriteria): number {
  const score = (criteria.specificity + criteria.evidence + criteria.relevance) / 3;
  // Round to 2 decimal places (matches NUMERIC(3,2) in schema)
  return Math.round(score * 100) / 100;
}

// --- Dimensão 1: Especificidade ---
// Específico = números com unidade, percentuais, durations, nomes de fluxos, IDs
const SPECIFICITY_METRICS_PATTERN = /\d+\s*(%|ms|s\b|min\b|h\b|x\b|vez\b|vezes\b)|\d{3,}/i;
const SPECIFICITY_VAGUE_WORDS = /\b(sempre|nunca|todos|nenhum|às vezes|geralmente|talvez|provavelmente|às?\s+vezes|normalmente|comumente)\b/i;

export function assessSpecificity(content: string): number {
  const hasMetrics = SPECIFICITY_METRICS_PATTERN.test(content);
  const hasVagueLanguage = SPECIFICITY_VAGUE_WORDS.test(content);

  if (hasMetrics && !hasVagueLanguage) return 0.9;
  if (hasMetrics && hasVagueLanguage) return 0.6;
  if (!hasMetrics && !hasVagueLanguage) return 0.4;
  return 0.2; // vague language without any metrics
}

// --- Dimensão 2: Evidência ---
// Alta evidência = rastreável (sourceRef presente) + dados numéricos no conteúdo
const HAS_NUMERIC_DATA = /\d+/;

export function assessEvidence(content: string, sourceRef: string | null): number {
  const hasSourceRef = sourceRef !== null && sourceRef.trim().length > 0;
  const hasNumericData = HAS_NUMERIC_DATA.test(content);

  if (hasSourceRef && hasNumericData) return 0.9;
  if (hasSourceRef || hasNumericData) return 0.6;
  return 0.2; // sem rastreabilidade nem dados concretos
}

// --- Dimensão 3: Relevância para SparkleOS ---
// Alta relevância = nucleusId preenchido + tags relacionadas ao domínio
const SPARKLE_DOMAIN_TERMS = /\b(zenya|chatwoot|n8n|fluxo|flow|atendimento|escalação|escalacao|insight|sparkle|nucleus|núcleo|nucleo|whatsapp|webhook|conversa)\b/i;

export function assessRelevance(tags: string[], nucleusId: string | null): number {
  const hasNucleusId = nucleusId !== null && nucleusId.trim().length > 0;
  const tagString = tags.join(' ');
  const hasRelevantTags = SPARKLE_DOMAIN_TERMS.test(tagString);

  if (hasNucleusId && hasRelevantTags) return 0.9;
  if (hasNucleusId || hasRelevantTags) return 0.6;
  return 0.2; // sem vínculo com o domínio SparkleOS
}

/**
 * Avalia as 3 dimensões de qualidade de um insight.
 * Retorna QualityCriteria para inspeção individual das dimensões.
 */
export function assessQuality(
  content: string,
  sourceRef: string | null,
  tags: string[],
  nucleusId: string | null,
): QualityCriteria {
  return {
    specificity: assessSpecificity(content),
    evidence: assessEvidence(content, sourceRef),
    relevance: assessRelevance(tags, nucleusId),
  };
}
