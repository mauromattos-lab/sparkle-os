-- Migration: 0001_agent_contexts
-- Story: 1.3 — Persistência de Contexto dos Agentes
-- ADR: docs/adrs/adr-002-context-store.md

CREATE TABLE IF NOT EXISTS agent_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  story_id TEXT,
  work_state JSONB NOT NULL DEFAULT '{}',
  decision_log JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_contexts_agent_created
  ON agent_contexts (agent_id, created_at DESC);
