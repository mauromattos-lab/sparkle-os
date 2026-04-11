-- Migration: 0005_tenants_rls
-- Story: 1.10 — Base de Segurança e Isolamento
-- Nota: RLS policies requerem execução no Supabase com permissões de superuser

-- Tabela de tenants (clientes Zenya)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status);

-- Exemplo de tabela isolada por tenant (template para Epic 2+)
-- ATENÇÃO: Esta tabela é apenas demonstrativa — tabelas reais vêm no Epic 2
-- Serve para validar o padrão RLS antes de criar tabelas de produção
CREATE TABLE IF NOT EXISTS tenant_data_example (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de exemplo
ALTER TABLE tenant_data_example ENABLE ROW LEVEL SECURITY;

-- Policy de isolamento: agente só acessa dados do tenant no contexto atual
-- current_setting retorna NULL (não erro) quando variável não está definida
-- O COALESCE('00000000-0000-0000-0000-000000000000'::UUID) impede acesso sem contexto
CREATE POLICY tenant_isolation_policy ON tenant_data_example
  USING (
    tenant_id = COALESCE(
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID,
      '00000000-0000-0000-0000-000000000000'::UUID
    )
  );

-- Grant para o role do aplicativo (ajustar conforme role do Supabase)
-- ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- (tenants em si não tem RLS — é tabela administrativa)
