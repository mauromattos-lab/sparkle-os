-- Migration: 0003_pending_decisions
-- Story: 1.6 — Protocolo de Escalação para Mauro

CREATE TABLE IF NOT EXISTS pending_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  context TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  requested_by TEXT NOT NULL,
  story_id TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_decisions_status
  ON pending_decisions (status, created_at);
