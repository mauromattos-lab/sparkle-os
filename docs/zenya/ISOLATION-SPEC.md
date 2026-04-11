# Zenya — Modelo de Isolamento de Dados por Cliente

**Story:** 2.7 — Isolamento de Dados por Cliente na Zenya  
**Responsável:** @data-engineer (Dara)  
**Data:** 2026-04-11

---

## 1. Visão Geral

A Zenya atende múltiplos clientes em uma única instância do banco de dados (Supabase/PostgreSQL). Para garantir que os dados de um cliente **nunca** sejam visíveis para outro — mesmo por bug de query ou erro de programação — o sistema usa **Row-Level Security (RLS)** nativo do PostgreSQL.

O modelo é simples: cada cliente tem uma `data_isolation_key` única (UUID), gerada no provisionamento. Essa chave é armazenada em `zenya_conversations.isolation_key` e usada como filtro pela policy RLS.

---

## 2. Tabelas com Isolamento

| Tabela | RLS Ativo | Policy |
|--------|-----------|--------|
| `zenya_conversations` | **Sim** | `zenya_client_isolation` |
| `zenya_clients` | Não | — |

> `zenya_clients` não precisa de RLS: acesso via `SERVICE_ROLE` (operações de provisionamento, agentes internos). Conversas são o dado sensível do usuário final.

---

## 3. Schema da Tabela `zenya_conversations`

```sql
CREATE TABLE zenya_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES zenya_clients(id),
  isolation_key     TEXT NOT NULL,          -- igual a zenya_clients.data_isolation_key
  chatwoot_conv_id  INTEGER,
  content           JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. Policy RLS

```sql
ALTER TABLE zenya_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY zenya_client_isolation ON zenya_conversations
  AS PERMISSIVE FOR ALL
  TO PUBLIC
  USING (isolation_key = current_setting('app.current_client_key', TRUE));
```

**Como funciona:**
- `current_setting('app.current_client_key', TRUE)` lê a variável de sessão `app.current_client_key`
- O segundo parâmetro `TRUE` significa "missing_ok" — se a variável não estiver configurada, retorna `NULL` em vez de lançar erro
- `isolation_key = NULL` nunca é verdadeiro → sem key configurada, nenhuma linha é retornada
- A policy se aplica a todas as operações: SELECT, INSERT, UPDATE, DELETE

---

## 5. Como Configurar a Key em Runtime

**Padrão obrigatório:** antes de qualquer operação em `zenya_conversations`, o código DEVE chamar `set_config`:

```typescript
// Usando o helper do módulo de conversações (recomendado)
import { listConversations, insertConversation } from '../db/conversations.js';

// Buscar conversas do cliente A
const conversations = await listConversations(client.dataIsolationKey);

// Inserir nova conversa para cliente A
const conv = await insertConversation(client.dataIsolationKey, {
  clientId: client.id,
  chatwootConvId: 123,
  content: { transcript: '...' },
});
```

**Internamente, o helper executa:**
```typescript
await db.execute(sql`SELECT set_config('app.current_client_key', ${isolationKey}, TRUE)`);
```

> **Nunca** faça queries diretas em `zenya_conversations` sem passar pelo helper. Sem `set_config`, a RLS bloqueia e retorna 0 registros.

---

## 6. Compatibilidade com Supabase Connection Pooler

O Supabase free tier usa **Transaction mode** no pooler (não Session mode).

- `set_config('app.current_client_key', key, TRUE)` — o `TRUE` indica `is_local=TRUE`
- `is_local=TRUE` significa que a configuração é válida apenas dentro da **transação atual**
- Compatível com Transaction mode: a key é configurada e consumida na mesma transação

> **Atenção:** Não usar `is_local=FALSE`, pois em Transaction mode cada pool de conexão pode ser compartilhado entre requests — vazaria a key para outros clientes.

---

## 7. Fluxo de Provisionamento → Isolamento

```
1. POST /clients (Story 2.4)
   → Core gera dataIsolationKey = crypto.randomUUID()
   → INSERT zenya_clients ... data_isolation_key = 'uuid-gerado'

2. Salvar conversa (Story 2.7)
   → set_config('app.current_client_key', client.dataIsolationKey, TRUE)
   → INSERT zenya_conversations ... isolation_key = client.dataIsolationKey
   → RLS garante que isolation_key = app.current_client_key ✓

3. Buscar conversas
   → set_config('app.current_client_key', client.dataIsolationKey, TRUE)
   → SELECT * FROM zenya_conversations
   → RLS filtra automaticamente: apenas linhas do cliente ativo ✓
```

---

## 8. O Que Acontece Sem a Key

| Cenário | Comportamento |
|---------|--------------|
| `set_config` não foi chamado | `current_setting` retorna `NULL` → RLS bloqueia → 0 resultados |
| Key inválida (não pertence a nenhum cliente) | Nenhuma linha tem `isolation_key` igual → 0 resultados |
| Conexão como `service_role` (Supabase) | RLS bypass — acesso total. Usar apenas para operações administrativas |

> O comportamento padrão seguro é **falhar silenciosamente com 0 resultados** — não há erro explícito quando a key não está configurada. Isso é intencional: evita expor informação sobre a estrutura dos dados.

---

## 9. Referências

- Migration: `organs/zenya/migrations/0002_zenya_conversations_rls.sql`
- Schema Drizzle: `organs/zenya/src/db/schema.ts` → `zenyaConversations`
- Helper de acesso: `organs/zenya/src/db/conversations.ts`
- Testes de isolamento: `organs/zenya/src/db/isolation.test.ts`
- Provisionamento: `docs/sops/sop-provisionar-cliente-zenya.md`
