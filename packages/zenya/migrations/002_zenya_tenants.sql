-- Migration 002: Zenya tenant tables + RLS
-- Safe to run multiple times (IF NOT EXISTS, no DROP statements)

-- Tenant registry: one row per client
CREATE TABLE IF NOT EXISTS zenya_tenants (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  system_prompt       TEXT        NOT NULL DEFAULT '',
  active_tools        JSONB       NOT NULL DEFAULT '[]',
  chatwoot_account_id TEXT        NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zenya_tenants_account_id
  ON zenya_tenants (chatwoot_account_id);

-- Per-tenant credentials: stored AES-256-GCM encrypted
-- credentials_encrypted = IV (16 bytes) || authTag (16 bytes) || ciphertext
CREATE TABLE IF NOT EXISTS zenya_tenant_credentials (
  tenant_id              UUID        NOT NULL REFERENCES zenya_tenants(id) ON DELETE CASCADE,
  service                TEXT        NOT NULL,
  -- service examples: 'google_calendar', 'asaas', 'elevenlabs', 'loja_integrada'
  credentials_encrypted  BYTEA       NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, service)
);

-- -------------------------------------------------------
-- Row Level Security
-- Backend uses service role key (bypasses RLS) but still
-- filters by tenant_id in application code.
-- RLS acts as a database-level backstop for future JWT-auth
-- or direct DB access.
-- -------------------------------------------------------

ALTER TABLE zenya_tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE zenya_tenant_credentials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE zenya_queue                ENABLE ROW LEVEL SECURITY;
ALTER TABLE zenya_session_lock         ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS (default Supabase behaviour — explicit for clarity)
-- These policies apply to non-service-role connections only.

-- zenya_tenants: accessible when tenant id matches session variable
CREATE POLICY IF NOT EXISTS tenant_isolation_tenants
  ON zenya_tenants
  USING (id::TEXT = current_setting('app.current_tenant_id', true));

-- zenya_tenant_credentials: same isolation
CREATE POLICY IF NOT EXISTS tenant_isolation_credentials
  ON zenya_tenant_credentials
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- zenya_queue: tenant_id column (TEXT) matches session variable
CREATE POLICY IF NOT EXISTS tenant_isolation_queue
  ON zenya_queue
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- zenya_session_lock: same
CREATE POLICY IF NOT EXISTS tenant_isolation_lock
  ON zenya_session_lock
  USING (tenant_id = current_setting('app.current_tenant_id', true));
