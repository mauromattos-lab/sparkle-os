-- Migration 008: Retroativa — formaliza estruturas criadas em produção sem migration commitada.
-- Aplicada em produção (uqpwmygaktkgbknhmknx) em 2026-04-25 durante Brownfield Discovery
-- Fase 2 (Dara), com autorização explícita de Mauro.
--
-- O QUE FAZ:
--   - Adiciona coluna `zenya_tenants.admin_contacts` (já existia em prod, formaliza no repo)
--   - Cria tabela `zenya_client_users` (já existia em prod — Cockpit Cliente Zenya / Epic 10
--     parcial em organs/zenya. Mapeia auth.users.id → zenya_tenants.id)
--
-- IDEMPOTENTE: usa IF NOT EXISTS em tudo. Não modifica dados existentes.
-- Seguro re-rodar.
--
-- POR QUÊ retroativa: as duas estruturas foram criadas direto via Management API em prod
-- (Story 7.X / Cockpit Epic 10 inicial) sem o arquivo SQL correspondente sendo commitado.
-- Migrations no repo eram doc-only (sem ledger supabase_migrations.schema_migrations) —
-- ver D-L no Capítulo 2 do canon brownfield.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Coluna admin_contacts em zenya_tenants
-- ─────────────────────────────────────────────────────────────────────────────
-- Array de {phone, name} para personalizar saudação do admin agent.
-- JSONB pra evitar nova tabela; cardinalidade pequena (1-3 admins por tenant).
ALTER TABLE zenya_tenants
  ADD COLUMN IF NOT EXISTS admin_contacts JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN zenya_tenants.admin_contacts IS
  'Array de {phone, name} para personalizar saudação do admin agent. Consumido por src/agent/admin-agent.ts.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabela zenya_client_users (Cockpit Cliente Zenya — Epic 10)
-- ─────────────────────────────────────────────────────────────────────────────
-- Mapping auth.users.id → zenya_tenants.id usado pelo middleware
-- clientAuthMiddleware do organs/zenya (zenya-api PM2, porta 3005).
-- Front-end consumidor: vercel.com/mauro-mattos-projects-389957a6/zenya-cockpit
-- NÃO consumido pelo packages/zenya core (webhook).

CREATE TABLE IF NOT EXISTS zenya_client_users (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL,
  tenant_id   UUID         NOT NULL REFERENCES zenya_tenants(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT zenya_client_users_user_id_tenant_id_key UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_zenya_client_users_tenant_id ON zenya_client_users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_zenya_client_users_user_id  ON zenya_client_users (user_id);

ALTER TABLE zenya_client_users ENABLE ROW LEVEL SECURITY;

-- RLS: usuário só vê suas próprias linhas (auth.uid() = user_id).
-- Diferente das outras tabelas zenya_* (que usam tenant_isolation via current_setting,
-- dormant porque service key bypassa). Aqui auth.uid() é do Supabase Auth real,
-- usado pelo Cockpit que conecta com chave anon/authed (não service key).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'zenya_client_users'
      AND policyname = 'client_user_self_only'
  ) THEN
    CREATE POLICY client_user_self_only
      ON zenya_client_users
      FOR ALL TO PUBLIC
      USING (user_id = auth.uid());
  END IF;
END$$;

COMMENT ON TABLE zenya_client_users IS
  'Mapping auth.users.id → zenya_tenants.id. Consumida pelo Cockpit Cliente Zenya (organs/zenya). Não consumida pelo packages/zenya core.';
