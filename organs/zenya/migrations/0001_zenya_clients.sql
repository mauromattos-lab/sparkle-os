-- Migration: 0001_zenya_clients
-- Story: 2.4 — Processo de Provisionamento de Novo Cliente Zenya

CREATE TABLE IF NOT EXISTS zenya_clients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id          TEXT UNIQUE,
  name                 TEXT NOT NULL,
  whatsapp_number      TEXT NOT NULL,
  n8n_workflow_ids     TEXT[] NOT NULL DEFAULT '{}',
  chatwoot_inbox_id    INTEGER,
  status               TEXT NOT NULL DEFAULT 'active',
  data_isolation_key   TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  provisioned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  provisioned_by       TEXT NOT NULL,
  metadata             JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_zenya_clients_status
  ON zenya_clients (status);

CREATE INDEX IF NOT EXISTS idx_zenya_clients_isolation_key
  ON zenya_clients (data_isolation_key);
