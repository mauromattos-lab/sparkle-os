-- Migration 006: zenya_tenant_kb_entries — snapshot de base de conhecimento (Sheets → Postgres)
-- Implementa AD-2 do plaka-01 implementation.yaml: Google Sheets KB é sincronizado
-- periodicamente (cron 15min) pra uma tabela local, eliminando quota risk e latência
-- externa a cada pergunta. Lookups viram SELECT local sub-10ms.
--
-- Origem: docs/stories/plaka-01/spec/implementation.yaml task T1.1
-- ADR-relevant: architecturalNote #4 (complexity.json) — snapshot elimina quota risk

CREATE TABLE IF NOT EXISTS zenya_tenant_kb_entries (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES zenya_tenants(id) ON DELETE CASCADE,
  question_normalized TEXT NOT NULL,
  question_raw TEXT NOT NULL,
  answer TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zenya_tenant_kb_entries_tenant_question
  ON zenya_tenant_kb_entries (tenant_id, question_normalized);

CREATE INDEX IF NOT EXISTS idx_zenya_tenant_kb_entries_last_synced
  ON zenya_tenant_kb_entries (tenant_id, last_synced_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_zenya_tenant_kb_entries_tenant_question
  ON zenya_tenant_kb_entries (tenant_id, question_normalized);

COMMENT ON TABLE zenya_tenant_kb_entries IS
  'Snapshot local da base de conhecimento (Google Sheets) de cada tenant. Sincronizado via worker kb-sync (15min). Lookups sub-10ms.';
