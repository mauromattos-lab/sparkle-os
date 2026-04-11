-- Migration: 0002_zenya_conversations_rls
-- Story: 2.7 — Isolamento de Dados por Cliente na Zenya

CREATE TABLE IF NOT EXISTS zenya_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES zenya_clients(id),
  isolation_key     TEXT NOT NULL,
  chatwoot_conv_id  INTEGER,
  content           JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zenya_conversations_client
  ON zenya_conversations (client_id);

CREATE INDEX IF NOT EXISTS idx_zenya_conversations_isolation_key
  ON zenya_conversations (isolation_key);

-- Habilitar RLS
ALTER TABLE zenya_conversations ENABLE ROW LEVEL SECURITY;

-- Policy de isolamento: apenas registros com isolation_key correspondente ao
-- app.current_client_key configurado na sessão são visíveis.
-- is_local=TRUE garante compatibilidade com Supabase Transaction pooler mode.
DROP POLICY IF EXISTS zenya_client_isolation ON zenya_conversations;
CREATE POLICY zenya_client_isolation ON zenya_conversations
  AS PERMISSIVE FOR ALL
  TO PUBLIC
  USING (isolation_key = current_setting('app.current_client_key', TRUE));
