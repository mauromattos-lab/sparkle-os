-- Migration: 0004_cost_events
-- Story: 1.8 — Rastreamento de Custo por Operação

CREATE TABLE IF NOT EXISTS cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  model TEXT,
  units NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  story_id TEXT,
  session_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_events_agent_created
  ON cost_events (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cost_events_created
  ON cost_events (created_at DESC);
