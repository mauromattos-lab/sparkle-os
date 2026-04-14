-- Migration 003: Zenya conversation history
-- Separate from n8n's n8n_historico_mensagens — no shared tables during parallel migration
-- Safe to run multiple times (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS zenya_conversation_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT        NOT NULL,
  phone_number TEXT        NOT NULL,
  role         TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fetch last N messages per session (ordered by created_at DESC, then reversed in app)
CREATE INDEX IF NOT EXISTS idx_zenya_history_session
  ON zenya_conversation_history (tenant_id, phone_number, created_at DESC);

-- RLS: same pattern as other zenya tables
ALTER TABLE zenya_conversation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS tenant_isolation_history
  ON zenya_conversation_history
  USING (tenant_id = current_setting('app.current_tenant_id', true));
