# SOP-1.10-A — Onboarding de Novo Cliente Zenya

**Versão:** 1.0  
**Data:** 2026-04-11  
**Autor:** @dev (Dex)  
**Story de origem:** 1.10 — Base de Segurança e Isolamento  
**Revisão:** @qa (PASS)

---

## Objetivo

Garantir que cada novo cliente Zenya seja registrado no sistema com isolamento correto de dados desde o primeiro momento, sem possibilidade de vazamento cross-tenant.

---

## Pré-requisitos

- [ ] Supabase com migration 0005_tenants_rls.sql aplicada
- [ ] `INTERNAL_API_TOKEN` configurado em `.env`
- [ ] Nome e slug do novo cliente definidos por Mauro
- [ ] RLS habilitado nas tabelas de dados de cliente (verificar seção 3)

---

## Responsável

Mauro (aprovação) + @dev (execução técnica quando necessário).

> **ATENÇÃO:** Este processo cria um novo tenant. Toda operação de criação de tenant requer aprovação de Mauro — ver `SOP-1.6-A` sobre escalação obrigatória.

---

## Passos

### Passo 1 — Criar registro na tabela `tenants`

```sql
-- Executar no Supabase SQL Editor
INSERT INTO tenants (name, slug, status)
VALUES ('Nome do Cliente', 'slug-do-cliente', 'active')
RETURNING id, name, slug, status, created_at;
```

Salvar o `id` retornado — este é o `tenant_id` que será usado em todas as operações do cliente.

**Resultado esperado:** Linha inserida com UUID único gerado automaticamente.

---

### Passo 2 — Verificar que RLS está ativa

```sql
-- Verificar políticas ativas no Supabase
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

Conferir que cada tabela de dados de cliente (`tenant_data_example` e futuras) aparece com `tenant_isolation_policy`.

**Resultado esperado:** Cada tabela de cliente listada com policy ativa.

---

### Passo 3 — Testar isolamento antes de ativar

Executar o seguinte teste no Supabase SQL Editor:

```sql
-- Simular acesso SEM contexto de tenant
SET app.current_tenant_id = '';
SELECT COUNT(*) FROM tenant_data_example;
-- Esperado: 0 (nenhum dado visível sem contexto)

-- Simular acesso COM o tenant correto
SET app.current_tenant_id = '{uuid-do-novo-tenant}';
SELECT COUNT(*) FROM tenant_data_example WHERE tenant_id = '{uuid-do-novo-tenant}';
-- Esperado: 0 (tenant novo, sem dados ainda)

-- Simular tentativa de acesso a dados de outro tenant
SET app.current_tenant_id = '{uuid-de-outro-tenant}';
SELECT * FROM tenant_data_example WHERE tenant_id = '{uuid-do-novo-tenant}';
-- Esperado: 0 (RLS bloqueia acesso cross-tenant)
```

**Resultado esperado:** Todos os três queries retornam 0 — isolamento confirmado.

---

### Passo 4 — Propagar tenant_id nas operações

Nas operações subsequentes que envolvem dados do cliente, sempre definir o contexto de tenant antes das queries:

```typescript
// Padrão para operações com contexto de tenant
// (implementar no Epic 2 quando tabelas específicas da Zenya forem criadas)
await db.execute(sql`SET LOCAL app.current_tenant_id = ${tenantId}`);
// ... queries de dados do cliente ...
```

> Nota: `SET LOCAL` dura apenas até o fim da transação. Em modo sem transação, usar `SET` (dura até o fim da conexão).

**Resultado esperado:** Todas as queries de dados de cliente têm contexto de tenant explícito.

---

### Passo 5 — Registrar custo do onboarding

```typescript
// Registrar evento de custo se operação envolveu chamadas pagas
await recordCost({
  agentId: 'dev',
  operationType: 'storage_write',
  units: 1,
  unitCost: 0,  // Supabase free tier para tenants iniciais
  metadata: { action: 'tenant_creation', tenantSlug: 'slug-do-cliente' },
}).catch((err) => console.error('Cost tracking failed:', err));
```

**Resultado esperado:** Evento de custo registrado para auditoria.

---

## Resultado Final

Após o processo:
1. Registro em `tenants` com UUID único
2. RLS confirmado ativo para o novo tenant
3. Teste de isolamento passando (sem acesso cross-tenant)
4. `tenant_id` salvo para uso nas stories do Epic 2+

---

## Troubleshooting

| Problema | Causa Provável | Solução |
|----------|---------------|---------|
| RLS não aparece em pg_policies | Migration não aplicada | Executar `supabase db push` |
| Teste de isolamento retorna dados de outro tenant | RLS não habilitado na tabela | `ALTER TABLE {tabela} ENABLE ROW LEVEL SECURITY` |
| `current_setting` throws "unrecognized configuration parameter" | Postgres < 12 ou Supabase sem suporte | Usar `current_setting('app.current_tenant_id', TRUE)` com segundo arg TRUE (retorna NULL em vez de error) |
| Slug conflita | Outro tenant com mesmo slug | Escolher slug único — ex: adicionar sufixo de data |

---

## Histórico de Revisões

| Data | Versão | Mudança | Autor |
|------|--------|---------|-------|
| 2026-04-11 | 1.0 | Criação | @dev (Dex) |
