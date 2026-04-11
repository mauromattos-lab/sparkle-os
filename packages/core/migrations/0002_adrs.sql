-- Migration: 0002_adrs
-- Story: 1.4 — ADR Registry
-- ADR: docs/adrs/adr-001-repository-structure.md

CREATE TABLE IF NOT EXISTS adrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  context TEXT,
  decision TEXT,
  rationale TEXT,
  alternatives JSONB NOT NULL DEFAULT '[]',
  consequences TEXT,
  created_by TEXT,
  story_id TEXT,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adrs_number ON adrs (number);
