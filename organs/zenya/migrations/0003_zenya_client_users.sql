-- Migration: 0003_zenya_client_users
-- Story: 10.1 — Auth de Clientes — Supabase Auth + sessão por tenant
-- Nota: referencia zenya_tenants (schema real de produção), não zenya_clients

CREATE TABLE IF NOT EXISTS zenya_client_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES zenya_tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_zenya_client_users_user_id
  ON zenya_client_users (user_id);

CREATE INDEX IF NOT EXISTS idx_zenya_client_users_tenant_id
  ON zenya_client_users (tenant_id);

ALTER TABLE zenya_client_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_user_self_only ON zenya_client_users;
CREATE POLICY client_user_self_only ON zenya_client_users
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE zenya_client_users IS
  'Vínculo entre usuários Supabase Auth e tenants Zenya. Base do cockpit do cliente (Epic 10).';
