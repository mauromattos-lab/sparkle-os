-- Migration 001: Collective Brain — Insights + HNSW + Auxiliary Tables
-- Source: docs/architecture/cerebro-coletivo.md §4
-- ADR: docs/adrs/ADR-005-cerebro-coletivo-stack.md
-- Story: 3.2 — Captura de Insights da Zenya

-- Extension (already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Main table: insights
-- ============================================================
CREATE TABLE IF NOT EXISTS insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origin
  source          TEXT NOT NULL CHECK (source IN ('zenya_operation', 'agent_research', 'mauro_input')),
  nucleus_id      TEXT,
  source_ref      TEXT,
  confidence_level TEXT NOT NULL DEFAULT 'medium'
                  CHECK (confidence_level IN ('authoritative', 'high', 'medium')),

  -- Content
  content         TEXT NOT NULL CHECK (char_length(content) <= 2000),
  summary         TEXT CHECK (char_length(summary) <= 200),
  tags            TEXT[] DEFAULT '{}',

  -- Vector (Voyage-3 = 1024 dims — ADR-005)
  embedding       vector(1024),

  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'raw'
                  CHECK (status IN ('raw', 'validated', 'applied', 'rejected')),

  -- Validation
  quality_score   NUMERIC(3,2) CHECK (quality_score BETWEEN 0 AND 1),
  validation_notes TEXT,
  validated_at    TIMESTAMPTZ,
  validated_by    TEXT,

  -- Application (FR6 — full cycle mandatory)
  application_proof JSONB,
  applied_at      TIMESTAMPTZ,

  -- Canonicalization (cerebro-coletivo.md §7)
  canonical_id    UUID REFERENCES insights(id),
  is_duplicate    BOOLEAN NOT NULL DEFAULT false,
  similarity_score NUMERIC(4,3),

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HNSW index for semantic search
-- ADR-005: HNSW chosen over IVFFLAT — no training needed, better for <100k vectors
-- m=16 (connections per node), ef_construction=64 (build quality)
CREATE INDEX IF NOT EXISTS insights_embedding_hnsw_idx
  ON insights USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Auxiliary indexes
CREATE INDEX IF NOT EXISTS insights_source_idx ON insights (source);
CREATE INDEX IF NOT EXISTS insights_status_idx ON insights (status);
CREATE INDEX IF NOT EXISTS insights_nucleus_idx ON insights (nucleus_id);
CREATE INDEX IF NOT EXISTS insights_confidence_idx ON insights (confidence_level);
CREATE INDEX IF NOT EXISTS insights_canonical_idx ON insights (canonical_id)
  WHERE canonical_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS insights_created_idx ON insights (created_at DESC);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS insights_updated_at ON insights;
CREATE TRIGGER insights_updated_at
  BEFORE UPDATE ON insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Auxiliary table: zenya_execution_log (G1 — BASELINE-PERFORMANCE.md)
-- Stores n8n execution data for insight extraction
-- ============================================================
CREATE TABLE IF NOT EXISTS zenya_execution_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         TEXT NOT NULL,
  flow_name       TEXT NOT NULL,
  execution_id    TEXT,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error')),
  duration_ms     INTEGER,
  started_at      TIMESTAMPTZ NOT NULL,
  finished_at     TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zenya_exec_flow_idx ON zenya_execution_log (flow_id);
CREATE INDEX IF NOT EXISTS zenya_exec_started_idx ON zenya_execution_log (started_at DESC);
CREATE INDEX IF NOT EXISTS zenya_exec_status_idx ON zenya_execution_log (status);

-- ============================================================
-- Auxiliary table: zenya_ai_usage (G2 — BASELINE-PERFORMANCE.md)
-- Tracks AI token usage per call for cost monitoring
-- ============================================================
CREATE TABLE IF NOT EXISTS zenya_ai_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id           TEXT NOT NULL,
  execution_id      TEXT,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens      INTEGER NOT NULL,
  cost_usd          NUMERIC(10,6),
  conversation_id   TEXT,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zenya_ai_flow_idx ON zenya_ai_usage (flow_id);
CREATE INDEX IF NOT EXISTS zenya_ai_recorded_idx ON zenya_ai_usage (recorded_at DESC);
