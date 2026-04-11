# SOP-2.4-A — Provisionar Novo Cliente Zenya

**Versão:** 1.0  
**Data:** 2026-04-11  
**Autor:** @dev (Dex)  
**Story de origem:** 2.4 — Processo de Provisionamento de Novo Cliente Zenya  
**Revisão:** @architect (Quality Gate pendente)

---

## Objetivo

Provisionar um novo cliente Zenya de forma repetível e rastreável, criando automaticamente o flow n8n (clone do template), o inbox no Chatwoot e o registro no Postgres com `dataIsolationKey` único.

---

## Pré-requisitos

- [ ] `DATABASE_URL` configurado e acessível
- [ ] `N8N_BASE_URL` e `N8N_API_KEY` configurados
- [ ] `CHATWOOT_BASE_URL`, `CHATWOOT_USER_TOKEN` e `CHATWOOT_ACCOUNT_ID` configurados
- [ ] Migration `0001_zenya_clients.sql` aplicada no Supabase
- [ ] Flow template `01. Secretária v3` (ID: `r3C1FMc6NIi6eCGI`) existe no n8n
- [ ] Aprovação de Mauro obtida antes de provisionar cliente novo

---

## Responsável

Mauro (aprovação) + agente AIOS ou `@dev` (execução via API).

---

## Passo a Passo

### Passo 1 — Executar o endpoint de provisionamento

```bash
curl -X POST http://localhost:3001/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nome do Cliente",
    "whatsappNumber": "+5511999999999",
    "provisionedBy": "@dev"
  }'
```

**Resposta esperada (201):**
```json
{
  "id": "uuid-do-cliente",
  "name": "Nome do Cliente",
  "whatsappNumber": "+5511999999999",
  "n8nWorkflowIds": ["id-do-workflow-clonado"],
  "chatwootInboxId": 123,
  "status": "active",
  "dataIsolationKey": "uuid-de-isolamento",
  "provisionedAt": "2026-04-11T00:00:00.000Z",
  "provisionedBy": "@dev",
  "metadata": {}
}
```

O sistema executa automaticamente:
1. Clone do flow `01. Secretária v3` no n8n com nome `{nome} - Secretária v3`
2. Criação do inbox `{nome}` no Chatwoot (tipo: api)
3. INSERT na tabela `zenya_clients` com `dataIsolationKey` único

---

### Passo 2 — Verificação pós-provisionamento

- [ ] **n8n:** acessar o painel n8n e confirmar que o novo workflow aparece com nome correto e status inativo
- [ ] **Chatwoot:** acessar o painel Chatwoot e confirmar que o inbox foi criado com nome correto
- [ ] **Postgres:** executar `SELECT * FROM zenya_clients WHERE name = 'Nome do Cliente'` e verificar todos os campos

---

### Passo 3 — Configuração manual pós-clone (Mauro)

> ⚠️ **ATENÇÃO:** O clone do flow n8n **NÃO** preserva credenciais nem variáveis de ambiente. Esta etapa é obrigatória e deve ser realizada por Mauro.

1. Acessar o painel n8n
2. Abrir o workflow clonado (`{nome} - Secretária v3`)
3. Reconfiguar todas as credenciais (OpenAI, Z-API, Chatwoot, etc.)
4. Configurar as variáveis de ambiente específicas do cliente
5. Conectar o inbox Z-API ao inbox Chatwoot criado (Z-API config → OUT de scope desta story)
6. Ativar o workflow após configuração completa

---

## Troubleshooting

### Erro: `n8n API error fetching template`
- **Causa:** Flow template `r3C1FMc6NIi6eCGI` não encontrado no n8n
- **Solução:** Verificar se o flow existe no n8n; se necessário, atualizar o ID em `clients.ts`

### Erro: `Chatwoot API error creating inbox`
- **Causa:** Credenciais Chatwoot inválidas ou instância inacessível
- **Solução:** Verificar `CHATWOOT_BASE_URL`, `CHATWOOT_USER_TOKEN`, `CHATWOOT_ACCOUNT_ID`
- **Compensação automática:** O sistema deleta o clone n8n antes de retornar o erro

### Erro: `database connection error` / `Failed to create client record`
- **Causa:** Falha na conexão com o Postgres / Supabase
- **Solução:** Verificar `DATABASE_URL` e conectividade com Supabase
- **Compensação automática:** O sistema deleta o clone n8n e o inbox Chatwoot antes de retornar o erro

### Erro: Falha na compensação (log `[compensation] Failed to...`)
- **Causa:** Erro durante rollback de recurso já criado
- **Impacto:** Recurso órfão criado (workflow n8n ou inbox Chatwoot sem cliente registrado)
- **Solução manual:**
  1. Identificar o recurso pelo log de erro
  2. Deletar manualmente no painel n8n ou Chatwoot
  3. Registrar o incidente no ADR Registry se necessário

---

## Verificação de Saúde

Para listar todos os clientes provisionados:
```bash
curl http://localhost:3001/clients
```

Verificar campos `status` (active/paused/offboarded) e `dataIsolationKey` para cada cliente.

---

## Referências

- Story: `docs/stories/2.4.story.md`
- Schema: `organs/zenya/src/db/schema.ts`
- Migration: `organs/zenya/migrations/0001_zenya_clients.sql`
- Endpoint: `organs/zenya/src/routes/clients.ts`
- SOP relacionado (onboarding/isolamento): `docs/sops/sop-onboarding-cliente-zenya.md`
