# Capítulo 2 — Schema & Data

**Versão:** 0.1 (Draft, Brownfield Discovery Fase 2)
**Autor:** `@data-engineer` Dara
**Data:** 2026-04-25
**Pergunta-mãe:** *"Como os dados são organizados, isolados, persistidos, acessados com segurança?"*

> **Substitui:** `docs/zenya/ISOLATION-SPEC.md` (deprecated — descreve schema `zenya_clients`/`zenya_conversations` com `data_isolation_key` que **nunca existiu em produção**) e parte do `docs/zenya/TENANT-PLAYBOOK.md §2`.
>
> ⚠️ **Correção retroativa do Capítulo 1:** o Cap. 1 chamou `organs/zenya/` de "dead code" — **incorreto**. Audit Fase 2 confirmou: `organs/zenya/dist/server.js` está rodando como processo PM2 `zenya-api` em produção (porta 3005, nginx `zenya.sparkleai.tech`) há 5 dias. Hospeda Epic 10 (Cockpit Cliente Zenya) parcialmente implementado. Detalhes §6.2 e na Runtime Drift Audit (`_drafts/runtime-drift-audit.md`).

---

## §1 — Inventário real de tabelas no projeto ativo (`uqpwmygaktkgbknhmknx`)

**7 tabelas no schema `public`** (validado via Management API 2026-04-25):

| Tabela | Propósito | Migration repo | Status |
|--------|-----------|----------------|--------|
| `zenya_tenants` | Config canônica do tenant | 002 (parcial — coluna `admin_contacts` ausente) | ✅ Active |
| `zenya_tenant_credentials` | Credenciais por serviço (AES-256-GCM) | 002 | ✅ Active |
| `zenya_conversation_history` | Histórico cliente + admin | 003 | ✅ Active |
| `zenya_queue` | Fila de mensagens (debounce + idempotência) | 001 | ✅ Active (com queue leak — D-H) |
| `zenya_session_lock` | Lock distribuído por sessão | 001 | ✅ Active (com locks órfãos — D-A) |
| `zenya_tenant_kb_entries` | Snapshot KB Sheets (PLAKA) | 006 | ⚠️ Active mas KB **congelada** desde 2026-04-21 (D-D) |
| `zenya_client_users` | Mapping `auth.uid → tenant_id` (Cockpit Epic 10) | **AUSENTE** | ⚠️ Active sem migration (D-F) |

**0 tabelas legadas** (`n8n_*`, `zenya_clients`, `zenya_conversations` do design abandonado): nenhuma existe. ✅

**`supabase_migrations.schema_migrations` não existe** — Supabase migration tracking **não está em uso** (D-L novo, P1). Migrations no repo (`packages/zenya/migrations/001-007.sql`) são documentação histórica, sem ledger de aplicação.

---

## §2 — DDL canônica (estado real validado em produção)

> Esta é a DDL **factual** do banco hoje, derivada de `information_schema.columns` + `pg_indexes` + `pg_constraints`. Difere das migrations 001-007 do repo onde houver drift — diferenças catalogadas em §3.

### 2.1 `zenya_tenants`

```sql
CREATE TABLE zenya_tenants (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT         NOT NULL,
  system_prompt               TEXT         NOT NULL DEFAULT '',
  active_tools                JSONB        NOT NULL DEFAULT '[]'::jsonb,
  chatwoot_account_id         TEXT         NOT NULL UNIQUE,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  allowed_phones              TEXT[]       NOT NULL DEFAULT '{}'::text[],
  admin_phones                TEXT[]       NOT NULL DEFAULT '{}'::text[],
  admin_contacts              JSONB        NOT NULL DEFAULT '[]'::jsonb,  -- ⚠️ sem migration commitada (D-B)
  escalation_public_summary   BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX zenya_tenants_pkey ON zenya_tenants (id);
CREATE UNIQUE INDEX zenya_tenants_chatwoot_account_id_key ON zenya_tenants (chatwoot_account_id);
CREATE INDEX idx_zenya_tenants_account_id ON zenya_tenants (chatwoot_account_id);

ALTER TABLE zenya_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenants ON zenya_tenants
  USING ((id)::text = current_setting('app.current_tenant_id'::text, true));
```

### 2.2 `zenya_tenant_credentials`

```sql
CREATE TABLE zenya_tenant_credentials (
  tenant_id              UUID         NOT NULL REFERENCES zenya_tenants(id) ON DELETE CASCADE,
  service                TEXT         NOT NULL,
  credentials_encrypted  BYTEA        NOT NULL,  -- AES-256-GCM: IV(16) || authTag(16) || ciphertext
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, service)
);

CREATE UNIQUE INDEX zenya_tenant_credentials_pkey ON zenya_tenant_credentials (tenant_id, service);

ALTER TABLE zenya_tenant_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_credentials ON zenya_tenant_credentials
  USING ((tenant_id)::text = current_setting('app.current_tenant_id'::text, true));
```

### 2.3 `zenya_conversation_history`

```sql
CREATE TABLE zenya_conversation_history (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT         NOT NULL,                                     -- ⚠️ TEXT, não UUID! (D-G)
  phone_number  TEXT         NOT NULL,
  role          TEXT         NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zenya_history_session ON zenya_conversation_history (tenant_id, phone_number, created_at DESC);

ALTER TABLE zenya_conversation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_history ON zenya_conversation_history
  USING (tenant_id = current_setting('app.current_tenant_id'::text, true));
```

> **⚠️ Polissemia D-G:** `tenant_id` aqui é **UUID armazenado como TEXT**. O código (`saveHistory(tenantId, ...)`) passa o UUID do tenant convertido implicitamente. Sem FK por causa do tipo. Phone keys especiais: `admin:{phone}` para admin sessions.

### 2.4 `zenya_queue`

```sql
CREATE TABLE zenya_queue (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT         NOT NULL,        -- ⚠️ TEXT = chatwoot_account_id! (D-G)
  phone_number  TEXT         NOT NULL,
  message_id    TEXT         NOT NULL UNIQUE,
  payload       JSONB        NOT NULL,
  status        TEXT         NOT NULL DEFAULT 'pending',  -- pending|processing|done|failed
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zenya_queue_session ON zenya_queue (tenant_id, phone_number, status);
CREATE INDEX idx_zenya_queue_message_id ON zenya_queue (message_id);
CREATE UNIQUE INDEX zenya_queue_message_id_key ON zenya_queue (message_id);

ALTER TABLE zenya_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_queue ON zenya_queue
  USING (tenant_id = current_setting('app.current_tenant_id'::text, true));
```

> **⚠️ Polissemia D-G CRÍTICA:** `tenant_id` aqui é **chatwoot_account_id** (string `"1"`, `"2"`, …, `"7"`), **não UUID** do tenant. `webhook.ts` linha 152 passa `tenant_id: accountId`. Mesmo nome `tenant_id` mas semântica completamente diferente das outras tabelas. **Anti-pattern grave** — agente novo lê schema e assume UUID.

### 2.5 `zenya_session_lock`

```sql
CREATE TABLE zenya_session_lock (
  tenant_id     TEXT         NOT NULL,    -- ⚠️ TEXT = chatwoot_account_id (D-G)
  phone_number  TEXT         NOT NULL,
  locked_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, phone_number)
);

ALTER TABLE zenya_session_lock ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_lock ON zenya_session_lock
  USING (tenant_id = current_setting('app.current_tenant_id'::text, true));
```

> **⚠️ Sem TTL/cleanup:** lock órfão persiste indefinidamente após crash. Validação 2026-04-25: 2 locks com 8 dias e 5 dias de idade (D-A confirmado).

### 2.6 `zenya_tenant_kb_entries`

```sql
CREATE TABLE zenya_tenant_kb_entries (
  id                   BIGSERIAL    PRIMARY KEY,
  tenant_id            UUID         NOT NULL REFERENCES zenya_tenants(id) ON DELETE CASCADE,
  question_normalized  TEXT         NOT NULL,
  question_raw         TEXT         NOT NULL,
  answer               TEXT         NOT NULL,
  last_synced_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zenya_tenant_kb_entries_tenant_question ON zenya_tenant_kb_entries (tenant_id, question_normalized);
CREATE UNIQUE INDEX uq_zenya_tenant_kb_entries_tenant_question ON zenya_tenant_kb_entries (tenant_id, question_normalized);
CREATE INDEX idx_zenya_tenant_kb_entries_last_synced ON zenya_tenant_kb_entries (tenant_id, last_synced_at DESC);

-- ⚠️ RLS NÃO habilitada nesta tabela (inconsistência menor com as outras zenya_*)
```

> **⚠️ KB congelada:** PLAKA tem 260 entries com `last_synced_at = 2026-04-21 21:19+00` em **todas** as linhas. Ou seja: 1 sync executado em 2026-04-21 (provavelmente `runKbSyncOnce` chamado manualmente ao seedar credencial), e nada depois. Confirma D-D — `startKbSyncLoop` nunca foi invocado em produção.

### 2.7 `zenya_client_users` (descoberta da Fase 2 — Cockpit Epic 10)

```sql
CREATE TABLE zenya_client_users (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL,
  tenant_id   UUID         NOT NULL REFERENCES zenya_tenants(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX idx_zenya_client_users_tenant_id ON zenya_client_users (tenant_id);
CREATE INDEX idx_zenya_client_users_user_id ON zenya_client_users (user_id);

ALTER TABLE zenya_client_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_user_self_only ON zenya_client_users
  USING (user_id = auth.uid());
```

**Propósito:** mapeia Supabase `auth.users.id` → `zenya_tenants.id`. Consumida pelo `clientAuthMiddleware` em `organs/zenya/src/middleware/client-auth.ts` — middleware do **Cockpit Cliente Zenya** (`organs/zenya/src/routes/cockpit.ts`).

**RLS ativa e funcional** — esta é a única tabela onde `auth.uid()` faz sentido (Cockpit usa Supabase Auth, não service key). Validação:
- 1 linha hoje: `user_id=1654470a... → tenant_id=aa84a906... (Zenya Prime)`
- Mapeamento de teste do Mauro

---

## §3 — Drift schema-vs-migrations (catálogo completo)

| ID | Drift | Repo migration | Realidade produção | Severidade |
|----|-------|----------------|---------------------|------------|
| **D-B** | Coluna `zenya_tenants.admin_contacts` JSONB NOT NULL DEFAULT `'[]'::jsonb` | **Ausente** em 001-007 | **Existe** em prod | P1 — migration 008 retroativa |
| **D-F** | Tabela inteira `zenya_client_users` + RLS policy `client_user_self_only` + 2 índices | **Ausente** em 001-007 | **Existe** em prod (1 linha) | P1 — migration 008 retroativa documentando tabela do Cockpit |
| **D-L** | `supabase_migrations.schema_migrations` | Esperado (Supabase padrão) | **Não existe** | P1 — migrations no repo são doc-only, sem ledger; investigar como aplicar daqui em diante |
| **D-G** | `tenant_id` polissêmico — TEXT (account_id) em queue/lock/history vs UUID em credentials/kb_entries | Migrations definem assim | Conforme migrations | **P0** — anti-pattern grave; refactor necessário |
| **D-K** | `updated_at` sem trigger BEFORE UPDATE | Migrations não criam trigger | Coluna existe mas nunca atualiza automaticamente | P2 — adicionar trigger ou usar `moddatetime` extension |

### 3.1 Migration 008 retroativa — ✅ APLICADA 2026-04-25

**Status:** aplicada em produção (autorização Mauro 2026-04-25 "podemos fazer essa migration entao pra alinhar os estados") via Management API. Validação pós: `admin_contacts` (column) e `zenya_client_users` (table) listados.

**Arquivo no repo:** `packages/zenya/migrations/008_zenya_admin_contacts_and_client_users.sql`

```sql
-- Migration 008: Retroativa — colunas e tabela criadas em produção sem migration commitada
-- Objetivo: alinhar repo com realidade produção sem alterar dados.
-- Idempotente: usa IF NOT EXISTS em tudo. Seguro re-rodar.

-- Coluna admin_contacts (já existe em prod, formaliza)
ALTER TABLE zenya_tenants
  ADD COLUMN IF NOT EXISTS admin_contacts JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN zenya_tenants.admin_contacts IS
  'Array de {phone, name} para personalizar saudação do admin agent. JSONB pra evitar nova tabela.';

-- Tabela zenya_client_users (Cockpit Epic 10 — Cockpit Cliente Zenya)
CREATE TABLE IF NOT EXISTS zenya_client_users (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL,
  tenant_id   UUID         NOT NULL REFERENCES zenya_tenants(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT zenya_client_users_user_id_tenant_id_key UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_zenya_client_users_tenant_id ON zenya_client_users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_zenya_client_users_user_id ON zenya_client_users (user_id);

ALTER TABLE zenya_client_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS client_user_self_only
  ON zenya_client_users
  FOR ALL TO PUBLIC
  USING (user_id = auth.uid());

COMMENT ON TABLE zenya_client_users IS
  'Mapping auth.users.id → zenya_tenants.id usado pelo Cockpit Cliente Zenya (organs/zenya). Não consumido pelo packages/zenya core.';
```

---

## §4 — Mecanismo de isolamento (real vs intencional)

### 4.1 O que está **ATIVO em runtime hoje**

**Closure JavaScript no tool-factory** (`packages/zenya/src/tenant/tool-factory.ts`):

```typescript
export function createTenantTools(tenantId, config, ctx): TenantTools {
  // tenantId capturado em CLOSURE — nunca em parameters Zod das tools.
  // O LLM não pode invocar uma tool com tenantId=X porque esse parâmetro não existe no schema.
  return { /* tools com tenantId acessível só via closure */ };
}
```

Esse é o **único gate ativo de isolamento entre tenants**. RLS **não bloqueia nada hoje** porque o backend usa `SUPABASE_SERVICE_KEY` que bypassa RLS.

Validação Q31 produção: `current_setting('app.current_tenant_id', true) → null`, `current_user → postgres`. Confirma RLS dormant.

### 4.2 O que está **HABILITADO mas DORMENTE**

RLS está habilitada em 6 das 7 tabelas:

| Tabela | RLS habilitada | RLS forçada | Policy ativa | Notas |
|--------|---------------|------------|--------------|-------|
| `zenya_tenants` | ✅ | ❌ | `tenant_isolation_tenants` | dormant |
| `zenya_tenant_credentials` | ✅ | ❌ | `tenant_isolation_credentials` | dormant |
| `zenya_conversation_history` | ✅ | ❌ | `tenant_isolation_history` | dormant |
| `zenya_queue` | ✅ | ❌ | `tenant_isolation_queue` | dormant |
| `zenya_session_lock` | ✅ | ❌ | `tenant_isolation_lock` | dormant |
| `zenya_tenant_kb_entries` | **❌** | ❌ | nenhuma | inconsistência menor |
| `zenya_client_users` | ✅ | ❌ | `client_user_self_only` (auth.uid()) | **ATIVA via Cockpit** — service key bypassa, mas Cockpit usa anon/authed key |

**Comportamento:** todas policies usam `current_setting('app.current_tenant_id', true)` (com `missing_ok=true`). Sem set_config, retorna NULL → policy bloqueia tudo. Como service key bypassa, nada é bloqueado em runtime do core. **RLS é backstop teórico** — protege apenas se alguém um dia conectar com chave non-service.

### 4.3 O que estava **PROJETADO em 2026-04-11** mas **NUNCA EXISTIU** (deprecated)

`docs/zenya/ISOLATION-SPEC.md` descreve:
- ❌ Tabela `zenya_clients` com `data_isolation_key` UUID
- ❌ Tabela `zenya_conversations` com `isolation_key`
- ❌ Policy usando `current_setting('app.current_client_key')` (note: `client_key`, não `tenant_id`)
- ❌ Helper `set_config('app.current_client_key', key, TRUE)` chamado por `listConversations` antes de cada query

**Nada disso existe hoje.** O design original do `organs/zenya/` era esse, mas foi abandonado. A realidade convergiu para closure-no-código + RLS dormant. ISOLATION-SPEC.md vai pra `_appendix/C-deprecated.md`.

### 4.4 RLS forçada (proposta futura — não-bloqueante)

Para que RLS deixe de ser dormant e vire defesa real:

```sql
-- Forçar RLS mesmo para owners e service role
ALTER TABLE zenya_tenants FORCE ROW LEVEL SECURITY;
-- ... (mesma coisa em outras tabelas)
```

**Não recomendado fazer agora** — quebraria todas as queries do `packages/zenya` que usam service key. Refactor seria: migrar app pra setar `app.current_tenant_id` antes de cada query (similar ao design abandonado, mas com `tenant_id` ao invés de `client_key`). Custo alto, ROI baixo enquanto closure funciona. Catalogar como dívida P3 (consideração futura, não-bloqueante).

---

## §5 — Encryption (AES-256-GCM)

**Algoritmo:** `aes-256-gcm` (Node.js `crypto`)
**Wire format:** `IV(16 bytes) || authTag(16 bytes) || ciphertext` em coluna `BYTEA`
**Master key:** `ZENYA_MASTER_KEY` (env, 64-char hex = 32 bytes)
**Implementação canônica:** `packages/zenya/src/tenant/crypto.ts`

### 5.1 Padrão de seed de credencial nova

Referência: `packages/zenya/scripts/seed-hl-ultracash.mjs` (criptografia inline) — **a refatorar (D-E)** para usar helper de `seed-common.mjs`.

```js
// PADRÃO ATUAL (a evoluir):
const credentialValue = { api_key: process.env.X_API_KEY, /* ... */ };
const plaintext = JSON.stringify(credentialValue);
const encrypted = encryptCredential(plaintext, process.env.ZENYA_MASTER_KEY);
const encryptedHex = `\\x${encrypted.toString('hex')}`;

await sb.from('zenya_tenant_credentials').upsert({
  tenant_id: tenantId,
  service: 'X',
  credentials_encrypted: encryptedHex,
  updated_at: new Date().toISOString(),
}, { onConflict: 'tenant_id,service' });
```

### 5.2 Padrão de leitura

```typescript
import { getCredentialJson } from '../tenant/credentials.js';

// Lazy: só carrega quando a tool é executada (não no factory)
const creds = await getCredentialJson<MyServiceCreds>(tenantId, 'service-name');
```

`getCredentialJson` faz: SELECT BYTEA → cast pra Buffer → `decryptCredential(buf, masterKey)` → `JSON.parse`.

### 5.3 Inventário real de credenciais por tenant (2026-04-25)

| Tenant | Serviços com credencial | Bytes encrypted | Created | Updated |
|--------|--------------------------|-----------------|---------|---------|
| Zenya Prime | `zapi` | 191 | 2026-04-19 | — |
| Julia (Fun) | `loja-integrada` | 122 | 2026-04-16 | — |
| PLAKA | `nuvemshop` | 166 | 2026-04-21 | 2026-04-21 |
| PLAKA | `sheets_kb` | 2664 | 2026-04-21 | 2026-04-21 |
| HL Importados | `ultracash` | 107 | 2026-04-23 | 2026-04-23 |
| Doceria | (nenhuma) | — | — | — |
| Scar AI | (nenhuma) | — | — | — |

**Achados:**
- **HL Importados não tem credencial `zapi`** — escalation Z-API label nativa (`humano`) silenciosamente não funciona (degradação graceful via `try/catch warn`). Idem PLAKA, Julia, Doceria, Scar.
- **Apenas Zenya Prime tem `zapi`**. Pra Mauro decidir: quer Z-API labels nativas em todos? Ou só Prime?
- **Drift de nome de serviço D-I:** Julia tem service `loja-integrada` (hífen) mas `active_tools` usa `loja_integrada` (underscore). Funciona porque `tool-factory.ts` checa `active_tools.includes('loja_integrada')` e `loja-integrada.ts` faz `getCredentialJson(tenantId, 'loja-integrada')`. Inconsistência confunde — padronizar pra underscore em ambos.

### 5.4 Plano de rotação (proposta — gap atual)

**Hoje:** sem plano. Master key trocada exige re-encrypt de todas as credenciais (decrypt com chave antiga → encrypt com nova).

**Proposta** (Capítulo 4 — Access & Credentials Map detalhará):
- Coluna `key_version` (smallint) em `zenya_tenant_credentials`
- 2 master keys ativas durante rotação (`ZENYA_MASTER_KEY` + `ZENYA_MASTER_KEY_PREV`)
- Re-encrypt em batch incremental
- Frequência sugerida: 1× ao ano + após qualquer suspeita de comprometimento

---

## §6 — Estado real de produção (factual)

### 6.1 Tenants com tráfego real (últimos 7 dias)

Volume validado em `zenya_conversation_history`:

| Tenant | account_id | Mensagens 7d | Distinct phones | Lifetime | Last msg |
|--------|-----------|--------------|-----------------|----------|----------|
| Julia (Fun Personalize) | 5 | **738** | **127** | 846 | 2026-04-25 13:22 |
| Doceria & Padaria Dona Geralda | 3 | 68 | 10 | 68 | 2026-04-25 14:32 |
| Zenya Prime | 1 | 58 | 4 | 78 | 2026-04-24 17:38 |
| Scar AI — GuDesignerPro | 7 | 18 | 2 | 18 | 2026-04-25 02:28 |
| **PLAKA Acessórios** | **2** | **0** | **0** | **0** | — |
| **HL Importados** | **6** | **0** | **0** | **0** | — |

> **Atualizado 2026-04-25 (resposta Mauro):**
> - **HL Importados em PAUSA por pedido do cliente** (Hiago) — ajustes pendentes. Não é drift, é estado intencional. Cred `ultracash` seedada permanece. Reativar quando Hiago voltar.
> - **PLAKA aguarda Mauro comprar número novo pra parear Z-API** — estado intencional pré-onboarding. Confirmado.
> - **Ensinaja (account 4) NÃO é prioridade** — cliente Douglas com pagamento pendente, aguarda informações há 2 semanas. Resíduo técnico (581 pending acumulados) fica catalogado mas não-urgente. Ver §6.2.

### 6.2 Conta Chatwoot 4 — webhook drift Ensinaja (rebaixado: P2 — cliente não-prioritário)

> **Atualizado 2026-04-25 (resposta Mauro):** rebaixado de P0 pra P2. Cliente Ensinaja (Douglas) está com pagamento pendente, aguarda informações do cliente há ~2 semanas. Mauro retirou prioridade. **Decisão:** não rodar seed do Ensinaja. O resíduo técnico abaixo permanece ativo mas catalogado, não-bloqueante.

**Account 4 = "Ensinaja - Douglas"** (campo `payload->'account'->>'name'` da queue).

**Achado:** o Chatwoot da conta 4 está enviando webhooks pro core (`api.sparkleai.tech/webhook/chatwoot`) **mesmo sem tenant seedado** no `zenya_tenants`.

**Resultado:** mensagens chegam, `enqueue()` insere na queue com `tenant_id='4'` (account_id), depois `loadTenantByAccountId('4')` falha com "No tenant for Chatwoot account_id: 4", erro vai pro `console.error`, mensagens ficam **`pending` pra sempre**.

**Volume vazado:** **581 mensagens pending da account 4** desde 2026-04-16. Última de hoje 2026-04-25 14:50 (Maik Oliveira). **Tráfego real de cliente do Ensinaja não está sendo atendido pelo core, e supostamente está sendo atendido pelo n8n** (que ainda roda na VPS — confirmado processo `node /usr/local/bin/n8n` ativo).

**Decisão urgente** (business + operacional):
1. Webhook do Chatwoot conta 4 deve apontar pra `n8n.sparkleai.tech` (não pra core)? OU
2. Cutover Ensinaja já estava em andamento? Seedar tenant 4 imediatamente OU
3. Reverter webhook config da conta 4 pro n8n

→ **Bloqueio Fase 7 (QA Gate):** este achado precisa ser resolvido antes de validar que o brownfield está em estado "saneado". 581 mensagens reais de clientes em estado de limbo é incidente em produção, não dívida arquitetural.

### 6.3 Volume PM2 / processos VPS

| Processo PM2 | Script | Porta | Uptime | Cwd | Propósito |
|--------------|--------|-------|--------|-----|-----------|
| `zenya-webhook` | `packages/zenya/dist/index.js` | 3004 | 2 dias | `/root/SparkleOS/packages/zenya` | Recebe Chatwoot webhooks; agente principal |
| `zenya-api` | `organs/zenya/dist/server.js` | 3005 | 5 dias | `/root/SparkleOS/organs/zenya` | **Cockpit Cliente Zenya (Epic 10)** + endpoints `/health`, `/flows`, `/clients` |
| `n8n` (sistema) | `/usr/local/bin/n8n` | 5678 | (tempo total) | n/a | Engine n8n (Ensinaja + provavelmente legado de Doceria/HL/PLAKA) |

**Nginx reverse proxy:**

| Hostname | Backend | Notas |
|----------|---------|-------|
| `api.sparkleai.tech` | (não no audit — implícito 3004) | Webhook do core |
| `zenya.sparkleai.tech` | `127.0.0.1:3005` (zenya-api/organs) | Cockpit + APIs `/flows`, `/clients` |
| `runtime.sparkleai.tech` | `127.0.0.1:8001` | Desconhecido — investigar |
| `portal.sparkleai.tech` | `127.0.0.1:3001` | Desconhecido — investigar |

**Cron órfãos:** ✅ limpo (`# Sparkle crons removidos`).

### 6.4 Locks órfãos (D-A confirmado)

| Tenant (account_id) | Phone | Locked at | Idade |
|---------------------|-------|-----------|-------|
| 5 (Julia) | +5511999546669 | 2026-04-16 19:15 | **8 dias 19h** |
| 5 (Julia) | +5521999911664 | 2026-04-20 12:11 | **5 dias 02h** |

Cleanup imediato proposto (não destrutivo — só remove órfãos):

```sql
DELETE FROM zenya_session_lock WHERE locked_at < NOW() - INTERVAL '5 minutes';
```

**Solução estrutural** (Story Epic 18): adicionar TTL via job periódico OU ajustar `acquireLock` pra fazer `DELETE existing WHERE locked_at < NOW() - 5min` antes do INSERT.

### 6.5 Queue stats (D-H confirmado — vazamento contínuo)

| Status | Total | Tenant 1 | Tenant 3 | **Tenant 4 (Ensinaja)** | Tenant 5 (Julia) | Tenant 7 (Scar) |
|--------|-------|----------|----------|-------------------------|------------------|-----------------|
| `done` | 1.061 | 53 | 44 | 0 | 942 | 22 |
| `pending` | **875** | 1 | 1 | **581** ⚠️ | 259 | 34 |
| `failed` | 17 | 1 | 0 | 0 | 16 | 0 |

**Causas identificadas/hipóteses do leak:**

| Causa | Evidência |
|-------|-----------|
| Tenant lookup failure (account 4 sem tenant) | 581 pending — D-J novo |
| Test mode skip path em `webhook.ts` linha 238 (`return` sem `markAllDone`) | Plausível para Scar (34 pending — está em test mode) |
| Race entre `fetchPending` e `markAllDone`: mensagens novas chegam após fetch e nunca são pegas | Plausível para Julia (259 pending em produção sem test mode) |
| Erro não-tratado em runZenyaAgent que escapa do try/catch externo | Plausível em alguns casos |

### 6.6 KB sync (D-D confirmado)

PLAKA tem 260 entries em `zenya_tenant_kb_entries` com **`last_synced_at = 2026-04-21 21:19+00`** em todas as linhas. Hoje 2026-04-25 — **KB congelada há 4 dias**.

`startKbSyncLoop` está implementado em `packages/zenya/src/worker/kb-sync.ts` mas:
- Não é invocado em `packages/zenya/src/index.ts` (só `startAgenteOffCleanup` é)
- Não há app no `ecosystem.config.cjs` para esse worker
- Não há `scripts/run-kb-sync.mjs`

Conclusão: o sync único de 21/04 foi `runKbSyncOnce` chamado **manualmente** (provavelmente quando `seed-plaka-credentials.mjs` foi rodado). Daí pra frente, **nenhum sync mais**. Se Roberta/Isa atualizar a planilha do PLAKA, **nada chega ao bot**.

---

## §7 — Cache strategy (in-memory, 5min TTL)

### 7.1 Caches in-memory ativos no `packages/zenya`

| Cache | Onde | Chave | TTL | Side effect |
|-------|------|-------|-----|-------------|
| Tenant config | `tenant/config-loader.ts` (`byId` + `byAccountId`) | UUID e chatwoot_account_id | 5 min | Hit miss → SELECT zenya_tenants |
| KB lookup | `integrations/sheets-kb.ts` | `tenantId + question_normalized` | 5 min | Hit miss → SELECT zenya_tenant_kb_entries |
| Nuvemshop pedido | `integrations/nuvemshop.ts` | `storeId + numero` | 1 min | Hit miss → GET Nuvemshop API |

### 7.2 Justificativa (5 min config)

- **Pro:** reduz round-trips ao banco em alta concorrência
- **Pro:** custo: tradeoff razoável entre freshness e perf
- **Contra:** UPDATE de `zenya_tenants` (ex: prompt update via seed) leva até 5min para propagar
- **Contra:** sem invalidação programática — depende de `pm2 reload zenya-webhook` para forçar (D8)

### 7.3 Proposta de invalidação programática (D8 remediation)

Opção 1 — endpoint admin no zenya-webhook:
```typescript
app.post('/zenya/admin/cache/clear', authMiddleware, (c) => {
  clearTenantCache();
  return c.json({ cleared: true });
});
```
+ chamada no fim do `seed-X-tenant.mjs` se rodando local.

Opção 2 — listening Postgres `LISTEN/NOTIFY`:
```typescript
// No startup do worker
supabase.from('zenya_tenants').on('UPDATE', () => clearTenantCache()).subscribe();
```
Mais elegante mas exige Supabase Realtime habilitado (que já está, schema `realtime` existe).

---

## §8 — Janela de histórico (50 cliente / 20 admin)

`packages/zenya/src/agent/index.ts`:
```typescript
const history = await loadHistory(tenantId, phone);  // limit default = 50
```

`packages/zenya/src/agent/admin-agent.ts`:
```typescript
const history = await loadHistory(config.id, adminSessionKey, 20);  // explicit limit = 20
```

**Justificativa:**
- **50 cliente:** balanço entre contexto útil (cliente fala em rodadas, ~25 turnos cabem) e custo de tokens (50 mensagens × ~50 tokens médio ≈ 2.5k tokens só de history por turn).
- **20 admin:** admin é sessão de comando rápido, não conversação longa.

**Anti-pattern documentado D-C:** `saveHistory` usa `now() + 1ms` na linha 88 do `memory.ts` para garantir ordem user→assistant. Hack frágil sob alta concorrência. Refactor: coluna `seq SERIAL` ou ordenação composta `(created_at, id)`.

---

## §9 — Modos de query (matriz de uso)

### 9.1 SDK Supabase (`@supabase/supabase-js`) — runtime principal

```typescript
import { createClient } from '@supabase/supabase-js';
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// Padrão de uso em packages/zenya
await sb.from('zenya_tenants').select('id, name').eq('chatwoot_account_id', X).single();
```

- **Auth:** service key (bypass RLS)
- **Transport:** HTTPS REST (PostgREST)
- **Onde:** `packages/zenya/src/db/client.ts` singleton; usado por todos os workers/agents
- **Limitações:** sem `SELECT FOR UPDATE SKIP LOCKED` (por isso o lock usa `INSERT ON CONFLICT`)

### 9.2 Management API (PAT) — operações DDL

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "SEU SQL"}'
```

- **Auth:** PAT (`SUPABASE_PAT` em `.env` da VPS e `.env` raiz do repo)
- **Escopo:** project owner — DDL, query arbitrária
- **Onde usar:** rodar migrations, queries operacionais, validações (este Cap. 2 inteiro foi montado assim)
- **NÃO commitar** PAT em repo público

### 9.3 MCP Supabase (Claude Code) — hoje BROKEN (D2)

`~/.claude.json` (config do Claude Code) provavelmente aponta `project_ref` pro projeto **legado** `gqhdspayjtiijcqklbys`. Como esse projeto foi removido (sonda Q17 retornou "Resource has been removed"), MCP retorna erro pra qualquer query.

**Fix proposto (devops-only):** alterar `~/.claude.json` → `project_ref: "uqpwmygaktkgbknhmknx"`. Manutenção @devops, não @data-engineer.

**Workaround atual:** usar Management API direto via `curl` (regra MCP-usage.md aplicada com bom senso). Funcionou pra esta Fase 2 inteira.

### 9.4 Direct PG (`psql`, port 5432) — não usado

Hostinger não expõe 5432 publicamente; conexão exigiria pooler `:6543`. Sem caso de uso atual.

---

## §10 — Backup/recovery strategy

### 10.1 Estado atual

**Backup automático:** Supabase Free tier oferece backup diário 7-day retention (auto). Não validado em prod — sondar via dashboard.

**Backup manual:** ad-hoc via `.ai/backups/{slug}-system_prompt-YYYYMMDD-HHMM.sql` (mencionado em RUNBOOK §6 Opção B). Apenas pra `system_prompt` por tenant. Dados (history/queue) sem backup manual.

**Snapshot pré-migration:** sem padrão estabelecido. RUNBOOK não menciona. **Gap crítico** se Migration 008 retroativa for aplicada.

### 10.2 Proposta (Capítulo 4 detalhará)

| Política | Frequência | Retenção | Onde |
|----------|-----------|----------|------|
| Snapshot DDL completo (schema only) | 1× semana | 4 semanas | `.ai/backups/schema-YYYY-WW.sql` (commitar) |
| Backup `system_prompt` por tenant pré-update | Cada update | indefinido (git) | `.ai/backups/{slug}-system_prompt-{ts}.sql` (gitignored) |
| `pg_dump` data completo via Management API | Mensal | 6 meses | S3/local rotativo |

---

## §11 — Catálogo de queries operacionais

### 11.1 Diagnóstico rápido

```sql
-- Tenants ativos resumo
SELECT id, name, chatwoot_account_id, jsonb_array_length(active_tools) AS tools_count,
       array_length(allowed_phones,1) AS test_phones, array_length(admin_phones,1) AS admin_count
FROM zenya_tenants ORDER BY chatwoot_account_id;

-- Mensagens últimos 7 dias por tenant (cuidado: cast UUID→TEXT pelo D-G)
SELECT t.name, COUNT(*) AS msgs_7d, COUNT(DISTINCT phone_number) AS phones,
       MAX(h.created_at) AS last_msg
FROM zenya_conversation_history h
JOIN zenya_tenants t ON t.id::text = h.tenant_id
WHERE h.created_at > NOW() - INTERVAL '7 days'
GROUP BY t.name ORDER BY msgs_7d DESC;

-- Queue stats por tenant (cuidado: aqui tenant_id = chatwoot_account_id pelo D-G)
SELECT tenant_id AS chatwoot_account_id, status, COUNT(*) AS count
FROM zenya_queue
GROUP BY tenant_id, status
ORDER BY tenant_id, status;

-- KB last sync
SELECT t.name, COUNT(*) AS entries, MAX(kb.last_synced_at) AS last_sync,
       NOW() - MAX(kb.last_synced_at) AS sync_age
FROM zenya_tenant_kb_entries kb
JOIN zenya_tenants t ON t.id = kb.tenant_id
GROUP BY t.name;

-- Locks órfãos (>5min) — D-A
SELECT tenant_id AS chatwoot_account_id, phone_number, locked_at,
       NOW() - locked_at AS age
FROM zenya_session_lock
WHERE locked_at < NOW() - INTERVAL '5 minutes'
ORDER BY locked_at;

-- Pending mais antigos (top 20) — D-H
SELECT tenant_id AS chatwoot_account_id, phone_number, message_id, created_at,
       NOW() - created_at AS age,
       payload->'account'->>'name' AS account_name
FROM zenya_queue WHERE status='pending'
ORDER BY created_at LIMIT 20;
```

### 11.2 Cleanup operacional (com cuidado)

```sql
-- ⚠️ Limpar locks órfãos (seguro, idempotente)
DELETE FROM zenya_session_lock WHERE locked_at < NOW() - INTERVAL '5 minutes';

-- ⚠️ Marcar pending velhos como failed (depois de investigar causa por tenant)
-- ESPECIFICAR tenant — nunca rodar cego
UPDATE zenya_queue SET status='failed', updated_at=NOW()
WHERE status='pending'
  AND created_at < NOW() - INTERVAL '24 hours'
  AND tenant_id = 'X'  -- chatwoot_account_id
  RETURNING id;
```

---

## §12 — Catálogo final de dívidas (Schema & Data — Fase 2)

> Estas são **as dívidas adicionadas/refinadas pela Fase 2**. Vão alimentar `_canonical/_drafts/technical-debt-DRAFT.md` (Fase 4 — Aria).

### Novas dívidas P0 detectadas na Fase 2

| ID | Dívida | Cicatriz/Evidência | Proposta |
|----|--------|---------------------|----------|
| **D-G** | `tenant_id` polissêmico — TEXT(account_id) em queue/lock/history; UUID em credentials/kb_entries | Schema validado + código webhook.ts:152, lock.ts, agent/index.ts | Refactor longo (Epic 18 wave maior): renomear coluna em queue/lock pra `chatwoot_account_id`; converter `tenant_id` em conversation_history pra UUID + FK |
| **D-H** | Queue leak — 875 pending acumulados em 9 dias | Q24 + Q26 produção | (1) Story prioritária: webhook.ts linha 238 chamar `markAllDone(pendingIds)`. (2) Cleanup script. (3) Investigar 259 da Julia (não-test-mode) |
| **D-J** | Account Chatwoot 4 (Ensinaja) → core sem tenant seedado, 581 pending | Q24 + Q30 produção | **DECISÃO MAURO IMEDIATA**: webhook do Ensinaja deveria apontar pra n8n? Se sim, devops corrige no Chatwoot conta 4. Se cutover já é pro core, seedar tenant + prompt |

### Dívidas P0/P1 confirmadas pela Fase 2 (já listadas em Cap. 1)

| ID | Status |
|----|--------|
| **D-D** KB sync dead | ✅ Confirmado P0. PLAKA congelada em 2026-04-21 21:19. 4 dias sem sync |
| **D-A** Locks órfãos | ✅ Confirmado P1. 2 locks ativos (8d e 5d) |
| **D-B** `admin_contacts` sem migration | ✅ Confirmado P1. Migration 008 retroativa proposta §3.1 |
| **D-F** `zenya_client_users` sem migration | ✅ Confirmado P1 (revisado: tabela do Cockpit Epic 10 ATIVO, não órfã). Migration 008 idem |
| **D2** MCP Supabase fantasma | ✅ Confirmado. Projeto legado removido — fix simples no `~/.claude.json` |

### Novas dívidas P1 detectadas na Fase 2

| ID | Dívida | Proposta |
|----|--------|----------|
| **D-L** | `supabase_migrations.schema_migrations` não existe — sem ledger de migrations | Investigar: usar Supabase CLI `supabase migration up`? Ou tabela manual `zenya_migrations_log`? |
| **D-M** | Cap. 1 incorreto sobre `organs/zenya/` (chamou de "dead code") | Aria atualiza Cap. 1 quando voltar (Fase 4) |
| **D-N** | HL Importados sem tráfego no core (cutover supostamente OK) | Investigar com Mauro: Z-API pareada? Webhook conta 6 aponta pro core? |

### Dívidas P2 catalogadas

| ID | Dívida |
|----|--------|
| **D-K** | `updated_at` sem trigger BEFORE UPDATE — coluna existe mas nunca atualiza |
| **D-I** | Drift de naming `loja-integrada` (cred service) vs `loja_integrada` (active_tools flag) |
| RLS em `zenya_tenant_kb_entries` ausente | Inconsistência menor com outras tabelas |

---

## §13 — Elicitações abertas (resposta Mauro)

Estas vão pro handoff de retorno (`handoff-data-engineer-to-architect-20260425-fase2-return.yaml`):

| ID | Pergunta | Bloqueante quando |
|----|----------|-------------------|
| **E-1** (P0) | Conta Chatwoot 4 (Ensinaja) — webhook deve apontar pro core ou n8n? Cutover Ensinaja em andamento? | Fase 7 (QA Gate) — incidente em produção |
| **E-2** (P0) | HL Importados — Z-API ainda pareada? Por que zero tráfego no core desde cutover de 2026-04-22? | Fase 4 (Tech Debt) |
| **E-3** | PLAKA — zero tráfego no core é esperado (conta bloqueada/onboarding) ou problema? | Fase 4 |
| **E-4** | Quem implementou Cockpit Cliente Zenya (organs/zenya — zenya-api PM2)? Está pra ficar? Front-end roda em qual Vercel? | Fase 4 (afeta scoping Epic 10) |
| **E-5** | Hosts `runtime.sparkleai.tech` (8001) e `portal.sparkleai.tech` (3001) — quais serviços? Em escopo do brownfield? | Fase 4 |
| **E-6** | Quer Z-API credencial em todos os tenants (label nativa `humano`)? Hoje só Zenya Prime tem | Fase 4 |
| **E-7** | KB sync da PLAKA — Roberta/Isa atualizou planilha após 21/04? Há queixa de KB desatualizada? | Fase 4 (validar urgência D-D) |
| **E-8** | Migration 008 retroativa (formaliza `admin_contacts` + `zenya_client_users`) — pode aplicar agora? Ou aguardar Story Epic 18? | Aplicação imediata vs. Epic 18 |

---

## §14 — Próximas fases

Esta Fase 2 entrega:
- ✅ `02-schema-data.md` (este doc)
- ✅ `_drafts/runtime-drift-audit.md` (separadinho — vai pra apêndice)
- ✅ `handoff-data-engineer-to-architect-20260425-fase2-return.yaml` (avisa Aria das correções no Cap. 1)

**Decisão de paralelismo:** Fase 3 (Uma — UX Discovery) pode ser disparada **em paralelo** após Mauro disparar `@ux-design-expert`. Não depende deste capítulo.

**Fase 5 (DB Specialist Review)** — também minha responsabilidade — vai revisar este Cap. 2 + propor fixes priorizados após Aria consolidar tudo no Cap. 4 (Technical Debt Draft).

---

*Capítulo 2 (Schema & Data) — versão 0.1, Fase 2 do Brownfield Discovery 2026-04-25.*
*Próxima revisão: ao fim da Fase 4 (Aria consolida) — esperar Aria ratificar/ajustar §12 e responder E-1 a E-8.*
