# Capítulo 1 — System Architecture

**Versão:** 0.2 (Draft, Brownfield Discovery Fase 1 + correções Fase 2/3)
**Autor:** `@architect` Aria
**Data:** 2026-04-25 (v0.1) → 2026-04-25 v0.2 (correções pós-Fase 2 Dara + decisões Mauro)
**Pergunta-mãe:** *"Como a Zenya funciona, ponta a ponta, hoje?"*

> **Substitui:** `docs/zenya/ZENYA-CONTEXT.md` (apêndice histórico — descreve era n8n) + parte do `docs/zenya/KNOWLEDGE-BASE.md`.
>
> **NUCLEUS-CONTRACT.md vira REESCRITA v2** (não deprecate puro): o design original de 2026-04-11 (porta 3002, endpoints `/flows`, `/clients`) **evoluiu organicamente** em produção pra `organs/zenya/dist/server.js` rodando na porta 3005 (PM2 process `zenya-api`, nginx `zenya.sparkleai.tech`), agora hospedando o **Cockpit Cliente Zenya — Epic 10 parcial**. NUCLEUS-CONTRACT v2 documenta a realidade.
>
> **ISOLATION-SPEC.md continua deprecated**: descreve schema `zenya_clients`/`zenya_conversations` com `data_isolation_key` que **nunca existiu em produção**. Mecanismo real é closure JS no tool-factory (§4.5) — Cap. 2 §4 detalha.
>
> **Correções v0.2 (2026-04-25):**
> - §3 e §9.3: `organs/zenya/` reclassificado de "abandonado/dead code" para **Cockpit Cliente Zenya parcial em produção**, com frontend Vercel (`mauro-mattos-projects-389957a6/zenya-cockpit`) consumindo
> - §11 D-F (zenya_client_users): "tabela órfã" → "tabela ATIVA do Cockpit, formalizada via Migration 008 aplicada 2026-04-25"
> - §11 D-B (admin_contacts): "drift sem migration" → ✅ Resolvida via Migration 008
> - §11 D-N (HL zero tráfego): "incidente suspeito" → "estado intencional — HL pausado por pedido do Hiago para ajustes"
> - §12: Epic 10 reclassificado de "Draft" para **"InProgress (parcial) — escopo (a) Cockpit do dono"**, com pré-requisito: brownfield Zenya core estabilizar primeiro

---

## §1 — Definição em uma frase

**Zenya** é uma atendente IA WhatsApp **multi-tenant** rodando em TypeScript/Hono (porta 3004 da VPS), que recebe webhooks Chatwoot, processa mensagens com GPT-4.1 + tools por tenant, e responde via Chatwoot → Z-API → WhatsApp. Hoje (2026-04-25): **7 tenants em produção** no core, 1 ainda em n8n.

---

## §2 — Diagrama E2E (mensagem do cliente)

```
┌──────────────────────┐                                              ┌─────────────────────┐
│  Cliente (WhatsApp)  │                                              │  Cliente (WhatsApp) │
│  envia mensagem      │                                              │  recebe resposta    │
└──────────┬───────────┘                                              └─────────▲───────────┘
           │                                                                    │
           ▼                                                                    │
┌──────────────────────┐                                              ┌─────────┴───────────┐
│   Z-API (instância   │ ◄────────────── Chatwoot fork fazer.ai ────► │   Z-API (envia)     │
│   por tenant)        │                                              └─────────▲───────────┘
└──────────┬───────────┘                                                        │
           │                                                                    │
           ▼                                                                    │
┌──────────────────────┐                                              ┌─────────┴───────────┐
│   Chatwoot           │  ── POST /webhook/chatwoot (event ─────────► │   Chatwoot          │
│  (UI do atendente +  │    message_created) ────────────────────────►│   POST /messages    │
│   webhook config)    │                                              │   (sent_by_zenya:t) │
└──────────────────────┘                                              └─────────▲───────────┘
                                                                                │
                                                                                │
           ┌─────────────────── api.sparkleai.tech ───────────────────┐        │
           │                                                          │        │
           ▼                                                          │        │
┌────────────────────────────────────────────────────────────────────┐│        │
│  VPS Hostinger (187.77.37.88) :3004 — pm2 process zenya-webhook    ││        │
│                                                                    ││        │
│   src/index.ts ── Hono app                                         ││        │
│       │                                                            ││        │
│       ├── GET  /zenya/health                                       ││        │
│       └── POST /webhook/chatwoot ── createWebhookRouter()          ││        │
│           │                                                        ││        │
│           ▼                                                        ││        │
│   ┌──────────────────────────────────────────────────────────┐    ││        │
│   │  worker/webhook.ts                                       │    ││        │
│   │   1. validatePayload (account.id, conv.id, sender.phone) │    ││        │
│   │   2. filtra activity/template → skip                     │    ││        │
│   │   3. message_type==='outgoing' (NÃO bot) → escalate      │    ││        │
│   │   4. label 'agente-off' → skip                           │    ││        │
│   │   5. enqueue() na zenya_queue                            │    ││        │
│   │   6. withSessionLock(account, phone) {                   │    ││        │
│   │        sleep(2500ms) // debounce                         │    ││        │
│   │        fetchPending → merge bursts → resolve audio       │    ││        │
│   │        loadTenantByAccountId (cache 5min)                │    ││        │
│   │        if admin_phones.includes(phone) → runAdminAgent   │    ││        │
│   │        if allowed_phones && !includes → skip (test mode) │    ││        │
│   │        if /reset → clearHistory + reply (test mode)      │    ││        │
│   │        runZenyaAgent()                                   │    ││        │
│   │        markAllDone(pendingIds)                           │    ││        │
│   │      } finally { releaseLock }                           │    ││        │
│   └──────────────┬───────────────────────────────────────────┘    ││        │
│                  ▼                                                 ││        │
│   ┌──────────────────────────────────────────────────────────┐    ││        │
│   │  agent/index.ts ── runZenyaAgent                         │    ││        │
│   │   markConversationRead, setTypingStatus(on)              │────┼┘        │
│   │   loadHistory (last 50 msgs)                             │    │         │
│   │   buildSystemPrompt (base + tenant SOP + Brasília time)  │    │         │
│   │   createTenantTools(tenantId, config, ctx)               │    │         │
│   │     ↑ tenantId via CLOSURE — nunca em schema Zod         │    │         │
│   │   generateText({ gpt-4.1, maxSteps: 15, tools })         │    │         │
│   │   saveHistory (user + assistant rows)                    │    │         │
│   │   audio? → ElevenLabs flash_v2_5 → sendAudioMessage      │────┼┘        │
│   │           (fallback texto se falhar)                     │    │         │
│   │   else → message-chunker (gpt-4.1-mini split + delays) ──┼────┘         │
│   │   finally setTypingStatus(off)                           │              │
│   └──────────────────────────────────────────────────────────┘              │
│                                                                              │
│   worker/agente-off-cleanup.ts                                               │
│     setInterval 1h → varre conv com label 'agente-off' há 72h+ idle → remove│
└──────────────────────────────────────────────────────────────────────────────┘
                              │                                       ▲
                              ▼                                       │
                ┌─────────────────────────────────────────────────────┴─────┐
                │   Supabase Postgres (uqpwmygaktkgbknhmknx)               │
                │     zenya_tenants, zenya_tenant_credentials,             │
                │     zenya_conversation_history, zenya_queue,             │
                │     zenya_session_lock, zenya_tenant_kb_entries          │
                └───────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────────────┐
                │   Externos (por tenant, via tools)   │
                │   • OpenAI (GPT-4.1, mini, Whisper)  │
                │   • ElevenLabs (eleven_flash_v2_5)   │
                │   • Google Calendar (OAuth refresh)  │
                │   • Google Sheets (Service Account)  │
                │   • Loja Integrada / Nuvemshop       │
                │   • UltraCash / Asaas                │
                │   • Z-API (labels nativas WA)        │
                └──────────────────────────────────────┘
```

**Legenda:** linhas sólidas = fluxo síncrono na request; linhas verticais grossas = side effects (escrita externa); ↑↓ = camadas de dados.

---

## §3 — Stack real

| Camada | Tecnologia | Versão / detalhe |
|--------|-----------|------------------|
| Linguagem | TypeScript ESM | strict mode, target ES2022, output `dist/` |
| HTTP framework | Hono | `^4.6.0` via `@hono/node-server` |
| AI SDK | Vercel AI SDK v4 | `ai@^4.3.16`, `@ai-sdk/openai@^1.3.22` |
| Modelo principal | `openai('gpt-4.1')` | `maxSteps: 15`, `system + messages + tools` |
| Modelos auxiliares | `gpt-4.1-mini` | `formatSSML` (TTS pre-process), `chunkAndSend` (split mensagens) |
| Transcrição | OpenAI Whisper API | `model=whisper-1`, `language=pt` |
| TTS | ElevenLabs | `eleven_flash_v2_5`, voice_id por env, SSML pré-formatado |
| DB | Supabase (PostgreSQL) | client `@supabase/supabase-js@^2.103.0`, REST sobre HTTPS, **service role key** (bypassa RLS — RLS dormant como backstop) |
| Schema validation | Zod | `^3.24.2` em todos os parâmetros de tools |
| Front-matter prompts | gray-matter | `^4.0.3` (lê `docs/zenya/tenants/{slug}/prompt.md`) |
| Process manager | PM2 | `ecosystem.config.cjs`, `max_memory_restart: 512M`, `autorestart: true` |
| WhatsApp gateway | Z-API (instância por tenant) | bridged via Chatwoot fork fazer.ai |
| Inbox / UI atendente | Chatwoot fazer.ai fork | `chatwoot.sparkleai.tech` (1 conta por tenant) |
| Endpoint público | `https://api.sparkleai.tech/webhook/chatwoot` | reverse proxy → VPS:3004 |

**O que NÃO está em uso (apesar de docs antigos sugerirem):**
- ❌ n8n como engine **principal** (era até 2026-04-22; hoje processo node `/usr/local/bin/n8n` ainda vivo na VPS mas Mauro confirmou "nada deveria funcionar no n8n" em 2026-04-25 — zombie que pode ser desligado)
- ❌ Tabelas `zenya_clients`, `zenya_conversations`, `data_isolation_key`, `set_config('app.current_client_key', ...)` (`ISOLATION-SPEC.md` — schema abandonado, **deprecated**)
- ⚠️ Drizzle ORM no `packages/zenya/` — briefing/docs antigos sugerem; **`packages/zenya` usa client REST direto** via `@supabase/supabase-js`. Mas **`organs/zenya/` (Cockpit) usa Drizzle** — referência: `organs/zenya/src/routes/clients.ts:5` (`getDb, schema` from `../db/client.js`)

**O que ESTÁ em uso e estava mal-documentado** (correções v0.2 — Fase 2 Dara):
- ✅ **`organs/zenya/`** roda como **PM2 process `zenya-api` na porta 3005** (script: `organs/zenya/dist/server.js`, uptime 5+ dias, nginx `zenya.sparkleai.tech` proxypass)
- ✅ **Endpoints reais hoje** (sucessor da "API Interna v1.0.0" do NUCLEUS-CONTRACT antigo):
  - `GET /health` — health check (n8n + Chatwoot + Postgres)
  - `GET /flows` — inventário n8n (legacy mas funcional via processo n8n vivo)
  - `POST /clients` — provisioning (⚠️ provavelmente broken: faz query em `zenya_clients` que não existe no DB)
  - `GET /cockpit/conversations` — Cockpit Cliente Zenya (lista conversas do tenant autenticado via `auth.uid` + `zenya_client_users`)
  - `GET /cockpit/metrics` — Cockpit (total + hoje conversações)
- ✅ **Front-end Vercel ativo**: `vercel.com/mauro-mattos-projects-389957a6/zenya-cockpit` consome `zenya.sparkleai.tech/cockpit/*`

**O que está em uso mas é zombie** (resíduo do "sistema antigo Mauro recomeçou aqui no OS"):
- ⚠️ Nginx site `runtime.sparkleai.tech` → `127.0.0.1:8001` — **porta sem listener** (sniff Fase 2 confirmou). Cleanup nginx config quando der (P2)
- ⚠️ Nginx site `portal.sparkleai.tech` → `127.0.0.1:3001` — idem

---

## §4 — Componentes principais

### 4.1 Webhook (`src/worker/webhook.ts`)

**Responsabilidade:** recepção e roteamento de eventos Chatwoot. Faz toda a lógica de filtros antes de delegar ao agente.

**Pontos de filtro (em ordem):**
1. Parse JSON do body — falha → `400 invalid JSON`.
2. Validação obrigatória — `message_type`, `account.id`, `conversation.id`. Se `message_type==='incoming'`, também `sender.phone_number`. Falha → `400 missing X`.
3. `activity`/`template` → `200 skipped` (eventos internos do Chatwoot).
4. `message_type==='outgoing'` → distingue bot (marcado `content_attributes.sent_by_zenya=true`) de humano. Humano (Chatwoot panel ou store phone via Z-API) → `escalateToHuman({source: 'human-reply'})`. Retorna `200 skipped`.
5. Label `agente-off` na conversa → `200 skipped`.
6. **Enqueue** na `zenya_queue` (idempotente por `message_id` UNIQUE).
7. **Lock + debounce + agent** — fire-and-forget (`void async ...`); webhook retorna `200 message_id` imediatamente.

**Contrato de input (Chatwoot webhook payload — campos relevantes):**

```typescript
interface ChatwootWebhookPayload {
  id?: number;
  content?: string | null;
  message_type?: 'incoming' | 'outgoing' | 'activity' | 'template';
  source_id?: string | null;          // wamid.xxx para mensagens externas
  account?: { id: string | number };  // chave de tenant lookup
  conversation?: { id: string | number; labels?: string[] };
  sender?: { phone_number?: string | null; name?: string; type?: string };
  meta?: { sender?: { phone_number?: string | null; name?: string } };
  content_attributes?: { sent_by_zenya?: boolean } & Record<string, unknown>;
  attachments?: Array<{ file_type?: string; data_url?: string }>;
  created_at?: number;
}
```

**Contrato de output:**

```jsonc
// Caminho normal
{ "ok": true, "message_id": "<chatwoot msg id ou fallback>" }

// Skipped
{ "ok": true, "skipped": true }
{ "ok": true, "skipped": true, "human_reply": true }

// Erro de validação
{ "error": "missing message_type" } // 400
```

**Race conditions tratadas:**
- **Burst de mensagens** (cliente envia 4 mensagens em sequência) → todas vão pra queue; debounce de 2.5s + `fetchPending` agrega; agente recebe input mergeado.
- **Concorrência por sessão** (mesmo cliente, mesma conv, 2 webhooks simultâneos) → `withSessionLock` garante que apenas 1 execução roda; o segundo webhook só enfileira (já que mensagem está na queue) e sai.

**Side effects observáveis:**
- `INSERT zenya_queue` (idempotente, `23505 → silent`)
- `INSERT zenya_session_lock` (idempotente, `23505 → returns false`)
- Em escalation `human-reply`: `addLabel('agente-off')` no Chatwoot + `addLabel humano` no Z-API + log

### 4.2 Queue (`src/worker/queue.ts`)

**Tabela:** `zenya_queue` (não `zenya_message_queue` como aparece em alguns docs antigos).

**API exportada:**

| Função | Side effect | Idempotência |
|--------|-------------|--------------|
| `enqueue({tenant_id, phone_number, message_id, payload})` | `INSERT` com status `pending` | `23505` (UNIQUE message_id) → no-op silencioso |
| `fetchPending(tenantId, phone)` | `SELECT message_id, payload WHERE status='pending' ORDER BY created_at ASC` | — |
| `markDone(messageId)` / `markAllDone(ids[])` | `UPDATE status='done'` | — |
| `markFailed(messageId)` / `markAllFailed(ids[])` | `UPDATE status='failed'` | — |
| `markProcessing(messageId)` | `UPDATE status='processing'` | (não usado no fluxo principal hoje — debt menor) |

**Status legais:** `pending` | `processing` | `done` | `failed`. Nenhum job de cleanup ou retry — registros ficam no banco indefinidamente. Ver §10 (gap).

### 4.3 Lock (`src/worker/lock.ts`)

**Tabela:** `zenya_session_lock`. PK composta `(tenant_id, phone_number)`. Padrão: `INSERT ON CONFLICT DO NOTHING` via Supabase REST (que retorna erro `23505` no conflict).

**API exportada:**

```typescript
acquireLock(tenantId, phone): Promise<boolean>          // false = já trancado
releaseLock(tenantId, phone): Promise<void>             // DELETE
withSessionLock(tenantId, phone, fn): Promise<{ locked }> // try/finally
```

**Risco residual conhecido (P1):** se o processo crashar entre `acquireLock` e o `finally` (e.g. OOM kill, segfault — improvável mas possível), o lock fica órfão. Não há TTL. Recovery hoje: `pm2 restart` + `DELETE FROM zenya_session_lock WHERE locked_at < now() - interval '5 min'` manual. Ver §10 (gap D-A).

### 4.4 Tenant config-loader (`src/tenant/config-loader.ts`)

**Cache duplo in-memory:** `byId` (UUID) e `byAccountId` (string) — TTL **5min**. Compartilham o mesmo `CacheEntry`. Sem invalidação programática (TODO ver §10 D8).

**Contrato `TenantConfig`:**

```typescript
interface TenantConfig {
  id: string;                                     // UUID
  name: string;
  system_prompt: string;
  active_tools: string[];                         // ex: ['google_calendar','ultracash']
  chatwoot_account_id: string;
  allowed_phones: string[];                       // [] = produção; populado = test mode
  admin_phones: string[];                         // [] = sem canal admin
  admin_contacts: Array<{ phone: string; name: string }>;
  escalation_public_summary?: boolean;            // default true; absent → true
}
```

**Funções:**

| Função | Quando é chamada |
|--------|------------------|
| `loadTenantByAccountId(accountId)` | Webhook → resolve tenant a partir do payload Chatwoot |
| `loadTenantConfig(tenantId)` | Outras camadas que já têm UUID (tools, kb-sync, agente-off-cleanup) |
| `clearTenantCache()` | Apenas em testes |

**Drift schema-vs-code conhecido:** a coluna `admin_contacts` é lida pelo `rowToConfig` (linha 63 do `config-loader.ts`) e usada por `runAdminAgent` para personalização — **mas não há migration commitada que crie a coluna**. Migrations 001-007 não definem `admin_contacts`. A coluna existe em produção (TENANT-PLAYBOOK §2 documenta como `jsonb`). Conclusão: foi adicionada via Management API ad-hoc, sem migration commitada. Catalogar como D-B.

### 4.5 Tool factory (`src/tenant/tool-factory.ts`)

**Mecanismo de isolamento (security-critical):**

```typescript
export function createTenantTools(tenantId, config, ctx): TenantTools {
  // tenantId, accountId, conversationId, phone capturados em CLOSURE.
  // NENHUMA tool tem tenantId / accountId / conversationId no schema Zod.
  // O LLM não pode pedir "execute essa tool com tenantId=X" — não existe esse parâmetro.
}
```

Esse é **o** mecanismo de isolamento de runtime. RLS está habilitado nas tabelas mas o backend usa `SUPABASE_SERVICE_KEY` (bypassa RLS) — RLS é backstop pra acesso direto/JWT-auth futuro, **não é o gate ativo**. O gate ativo é a closure JavaScript.

**Tools sempre disponíveis (base):**

| Tool | Descrição |
|------|-----------|
| `escalarHumano` | **Forma varia** com `escalation_public_summary`. Default true: pede `resumo` (mensagem pública `[ATENDIMENTO] ...`). False (PR #9, opt-in por tenant): silent — apenas labels |
| `enviarTextoSeparado` | Envia mensagem extra durante o turno |
| `refletir` | Chain-of-thought interno (no-op no execute) |
| `marcarFollowUp` | `addLabel('follow-up')` no Chatwoot |
| `alterarPreferenciaAudioTexto` | Atualiza `additional_attributes.preferencia_audio_texto` no contato |

**Tools opcionais (gate por `active_tools`):**

| `active_tools` flag | Integration source | Tools registradas |
|--------------------|--------------------|-------------------|
| `google_calendar` | `integrations/google-calendar.ts` | `buscarJanelasDisponiveis`, + 4 (criar, atualizar, etc.) |
| `asaas` | `integrations/asaas.ts` | cobranças (consulta + geração) |
| `loja_integrada` | `integrations/loja-integrada.ts` | `Buscar_produto`, `Detalhar_pedido_por_numero`, `Buscar_pedidos_por_cliente` (Fun Personalize) |
| `ultracash` | `integrations/ultracash.ts` | busca produto/estoque (HL Importados) |
| `nuvemshop` | `integrations/nuvemshop.ts` | order lookup (PLAKA) |
| `sheets_kb` | `integrations/sheets-kb.ts` | `consultarKBSheets` — lê **snapshot local** `zenya_tenant_kb_entries` (não Sheets em runtime) |

### 4.6 Agente principal (`src/agent/index.ts` — `runZenyaAgent`)

**Fluxo:**

1. `markConversationRead` (Chatwoot) — não-crítico, log warn se falhar.
2. `setTypingStatus('on')` — não-crítico.
3. `loadHistory(tenantId, phone, 50)` — últimas 50 (`order desc, then reverse`).
4. `buildSystemPrompt(config)` — substitui `{{current_datetime}}` (Brasília) e `{{client_sop}}` no template base.
5. `createTenantTools(tenantId, config, ctx)`.
6. `generateText({ model: 'gpt-4.1', maxSteps: 15, system, messages, tools, onStepFinish: log })`.
7. `saveHistory(tenantId, phone, userMsg, replyMsg)` — 2 INSERTs com timestamps `now()` e `now()+1ms` (hack para garantir ordem).
8. **Resposta** — formato decidido por:
   - `getContactAudioPreference(phone)` (lê `additional_attributes.preferencia_audio_texto` do contato Chatwoot)
   - Se `'audio'` ou (preference=null e input foi áudio) → ElevenLabs, `setTypingStatus('on', 'recording')`, `formatSSML` (gpt-4.1-mini), `generateAudio` (eleven_flash_v2_5), `sendAudioMessage`. Falha → fallback texto via `chunkAndSend`.
   - Se `'texto'` ou padrão → `chunkAndSend` (gpt-4.1-mini divide em até 5 partes; cada parte tem typing simulation calculado por `(60 * len/4.5) / 150` segundos, capped 25s).
9. `finally setTypingStatus('off')`.

**Gates implícitos no design:**
- `maxSteps: 15` limita custo por turn (proteção runaway tool calls)
- `chunk max 5` limita explosão de mensagens enviadas
- typing delay capped 25s evita stall

### 4.7 Admin agent (`src/agent/admin-agent.ts` — `runAdminAgent`)

**Quando dispara:** `phone in config.admin_phones`. Bypassa toda lógica de cliente — usa um conjunto **separado** de ferramentas, prompt próprio, histórico próprio (chave `admin:{phone}`, janela 20).

**Tools admin (todas hardcoded em `admin-agent.ts`, não passam por tool-factory):**

| Tool | Side effect |
|------|-------------|
| `consultar_metricas` | 4× GET /api/v1/accounts/{id}/conversations (today/open/resolved/labels=agente-off) |
| `listar_conversas_abertas` | GET conversations?status=open |
| `listar_escaladas` | GET conversations?labels[]=agente-off |

**Personalização:** `adminContacts.find(c => c.phone === phone).name` injeta nome no prompt admin ("Você está falando com Mauro.").

**Saída:** mesmo pipeline de chunk/audio do agente principal.

### 4.8 Memory (`src/agent/memory.ts`)

**Tabela:** `zenya_conversation_history`. Schema simples: `(tenant_id, phone_number, role: 'user'|'assistant', content, created_at)`.

| Função | Comportamento |
|--------|--------------|
| `loadHistory(tenantId, phone, limit=50)` | `ORDER created_at DESC LIMIT N` → `.reverse()` em memória |
| `saveHistory(tenantId, phone, userMsg, replyMsg)` | 2 INSERTs num batch; assistant `created_at = now() + 1ms` para garantir ordem |
| `clearHistory(tenantId, phone)` | `DELETE WHERE tenant_id AND phone_number` (usado por `/reset` em test mode) |

**Anti-pattern documentado:** `+1ms hack` em vez de coluna `seq` ou `id` ordenável. Trabalha hoje, frágil em alta concorrência. Catalogar D-C (P2).

### 4.9 Background workers

| Worker | Origem | Como roda hoje | Estado |
|--------|--------|----------------|--------|
| `agente-off-cleanup.ts` | `startAgenteOffCleanup()` invocado em `index.ts` | `setInterval(60min)` in-process do `zenya-webhook` | ✅ Ativo |
| `kb-sync.ts` (`startKbSyncLoop`) | **NÃO é invocado em `index.ts`**. `ecosystem.config.cjs` não tem app separado | **DEAD CODE em produção** — função existe, ninguém chama. KB da PLAKA pode estar desatualizada | ❌ Catalogar D-D (P0) |

> **Achado P0 da Fase 1:** `startKbSyncLoop` está implementado e tem `runKbSyncOnce` exportado, mas `packages/zenya/src/index.ts` só chama `startAgenteOffCleanup()`. `ecosystem.config.cjs` só sobe 1 app (`zenya-webhook`). Não há `scripts/run-kb-sync.mjs`. Resultado: a sincronização Sheets → `zenya_tenant_kb_entries` da PLAKA é **manual ou inexistente** desde a implementação. Verificar com Mauro/dono PLAKA na Fase 4.

---

## §5 — Contratos internos

### 5.1 Webhook input/output

Já documentado §4.1.

### 5.2 `runZenyaAgent` / `runAdminAgent`

```typescript
interface AgentParams {
  tenantId: string;        // UUID — closure-only, nunca exposto ao LLM
  accountId: string;       // string Chatwoot
  conversationId: string;  // string Chatwoot
  config: TenantConfig;
  message: string;         // mensagem mergeada após debounce
  phone: string;
  inputIsAudio?: boolean;
}

runZenyaAgent(params: AgentParams): Promise<void>
// throws → markAllFailed na queue + lock release no finally
```

### 5.3 `loadTenantByAccountId`

```typescript
loadTenantByAccountId(accountId: string): Promise<TenantConfig>
// throws: "No tenant for Chatwoot account_id: X — ..."
// Side effect: popula cache byId + byAccountId, TTL 5min
```

### 5.4 Tool factory (factory pattern para integrações)

**Pattern obrigatório para qualquer integração nova:**

```typescript
// integrations/{nome}.ts
import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { getCredentialJson } from '../tenant/credentials.js';

interface {Nome}Credentials { /* shape específico */ }

export function create{Nome}Tools(tenantId: string): ToolSet {
  return {
    {nomeDaTool}: tool({
      description: '...',
      parameters: z.object({ /* APENAS dados do domínio, NUNCA tenantId */ }),
      execute: async ({ /* params */ }) => {
        // Lazy-load creds dentro do execute (não no factory) — evita carregar
        // credenciais que talvez nunca sejam usadas no turno atual
        const creds = await getCredentialJson<{Nome}Credentials>(tenantId, '{nome}');
        // ... chamar API externa ...
        // Retornar shape conciso pra LLM consumir
      },
    }),
  };
}
```

**Guard no `tool-factory.ts`:**

```typescript
if (config.active_tools.includes('{nome}')) {
  Object.assign(tools, create{Nome}Tools(tenantId));
}
```

**Anti-patterns documentados:**
- ❌ `tenantId` em `parameters: z.object({ tenantId: z.string() })` → quebra isolamento, **nunca** fazer.
- ❌ Carregar credenciais no `createTools()` (eager) — load dentro de cada `execute`.
- ❌ Hardcode de tenantId em scripts de seed sem `applyTenantSeed`.
- ❌ Description de tool conflitando com prompt do tenant (cf. `feedback_tool_description_beats_tenant_prompt.md`, caso Fun PR #9 → fix foi flag opt-in `escalation_public_summary`).

### 5.5 `escalateToHuman`

```typescript
interface EscalationContext {
  tenantId: string;
  chatwoot: ChatwootParams;        // { url, accountId, conversationId, token }
  phone: string;
  source: 'tool' | 'human-reply';  // origem; usado em log
  summary?: string;                // opcional; postado como mensagem PÚBLICA se presente
}

escalateToHuman(ctx): Promise<void>
// Side effects:
//   1. Se ctx.summary → sendMessage (público — cliente vê) — não-crítico
//   2. addLabel('agente-off') no Chatwoot — CRÍTICO (silencia bot)
//   3. zapiAddLabel(humano) — não-crítico (degrades gracefully)
```

### 5.6 `escalation_public_summary` — duas formas da `escalarHumano`

| Flag (DB column) | Tool shape | Mensagem pública? |
|------------------|-----------|-------------------|
| `true` (default) | `parameters: { resumo: z.string() }` | Sim — `[ATENDIMENTO] ...` no canal (cliente vê) |
| `false` (opt-in) | `parameters: {}` | Não — só labels |

**Cicatriz:** Julia (Fun Personalize) reportou desconforto com `[ATENDIMENTO]` aparecendo na conversa. Tentativa inicial de regra no prompt **falhou** porque a description da tool sobrepunha. Fix definitivo: flag opt-in por tenant via PR #9 (migration 007 + bifurcação de shape no factory). → Memória `feedback_tool_description_beats_tenant_prompt.md`.

---

## §6 — Modos de execução (matriz por tenant)

| Dimensão | Valor | Comportamento |
|----------|-------|---------------|
| `active_tools` | `[]` | Prompt-only (Scar AI); só tools base |
| `active_tools` | `['sheets_kb']` ou `['nuvemshop','sheets_kb']` | Prompt + KB (PLAKA) — tool consulta snapshot local |
| `active_tools` | `['ultracash']` / `['loja_integrada']` / `['google_calendar']` / `['asaas']` | Prompt + integrações externas (HL, Fun, Doceria) |
| `allowed_phones` | `[]` | **Produção** — todos os números recebem resposta |
| `allowed_phones` | `['+55...', ...]` | **Test mode** — apenas listados; outros são silenciosamente ignorados; comando `/reset` disponível |
| `admin_phones` | `[]` | Sem canal admin |
| `admin_phones` | `['+55...']` | Mensagens desses números → `runAdminAgent` (não `runZenyaAgent`) |
| `escalation_public_summary` | `true` (default) | `escalarHumano` posta resumo público `[ATENDIMENTO]` |
| `escalation_public_summary` | `false` | Escalação silenciosa (só labels) |
| Input format | texto | reply texto via chunker (default) |
| Input format | áudio | reply áudio (mirror) — `formatSSML` → ElevenLabs → `sendAudioMessage` |
| Contact attr `preferencia_audio_texto` | `'audio'` | Sempre áudio |
| Contact attr `preferencia_audio_texto` | `'texto'` | Sempre texto |
| Contact attr `preferencia_audio_texto` | absent | Mirror do input |
| Label `agente-off` na conversa | qualquer | Bot silencia até remoção (manual ou auto-cleanup 72h) |

---

## §7 — Side effects (mapa)

### 7.1 Escrita no Chatwoot
- `POST /messages` (outgoing texto, marcado `sent_by_zenya: true`)
- `POST /messages` multipart (outgoing áudio, idem mark)
- `POST /labels` (replace via GET-then-POST — idempotente: no-op se label já existe)
- `POST /toggle_typing_status` (`'on'` / `'off'` / `'recording'`)
- `POST /update_last_seen` (mark read)
- `PATCH /contacts/{id}` (`additional_attributes.preferencia_audio_texto`)

### 7.2 Escrita no Supabase
| Tabela | Operações | Quem |
|--------|-----------|------|
| `zenya_tenants` | SELECT only no runtime; INSERT/UPSERT só via seeds | webhook + agent + admin |
| `zenya_tenant_credentials` | SELECT only no runtime; INSERT/UPSERT só via seeds de credencial | tools (lazy) |
| `zenya_conversation_history` | INSERT (saveHistory) + DELETE (clearHistory via /reset) | agent + admin agent |
| `zenya_queue` | INSERT (enqueue) + UPDATE status | webhook |
| `zenya_session_lock` | INSERT (acquire) + DELETE (release) | webhook |
| `zenya_tenant_kb_entries` | UPSERT (kb-sync — atualmente dead code em produção, ver §4.9) + SELECT (sheets-kb tool) | kb-sync worker + sheets-kb tool |

### 7.3 Externos (por turno do agente)
- OpenAI: 1× `gpt-4.1` (com `maxSteps`), 0-5× `gpt-4.1-mini` (chunker), 0-1× whisper, 0-1× SSML
- ElevenLabs: 0-1× TTS (somente se reply em áudio)
- Z-API: 0-1× addLabel `humano` (só em escalation; não-crítico)
- Tools-specific (per `active_tools`): Google Calendar / Sheets / Loja Integrada / Nuvemshop / UltraCash / Asaas

### 7.4 Z-API ↔ Chatwoot
A Zenya **não fala diretamente com Z-API** no fluxo principal — só Chatwoot. Z-API é usado apenas para labels nativas de WhatsApp (escalation `humano`) via `integrations/zapi-labels.ts`. O transporte WhatsApp ↔ Chatwoot é responsabilidade do fork fazer.ai do Chatwoot (configuração externa por inbox).

---

## §8 — Pontos de extensão (como adicionar X)

### 8.1 Adicionar **ferramenta base nova** (default em todos os tenants)

1. Implementar em `src/tenant/tool-factory.ts` dentro do bloco `const tools: TenantTools = { ... }` antes dos blocos `if (active_tools.includes(...))`.
2. Test em `__tests__/tool-factory.test.ts`.
3. Documentar no Capítulo 3 + Capítulo 5 (variantes de teste).

> **Atenção (cicatriz Fun Personalize):** se a tool tem comportamento que nem todos os tenants vão querer, considere desde o design uma flag opt-in/opt-out por tenant (column nova em `zenya_tenants` ou bit em config). Cf. `feedback_tool_description_beats_tenant_prompt.md`.

### 8.2 Adicionar **integração externa nova** (opt-in por tenant)

Padrão obrigatório (§5.4):

1. `src/integrations/{nome}.ts` exportando `create{Nome}Tools(tenantId): ToolSet`.
2. Credenciais: `zenya_tenant_credentials.service = '{nome}'`, JSON shape definido na interface `{Nome}Credentials`. Carregar com `getCredentialJson<{Nome}Credentials>(tenantId, '{nome}')` dentro do `execute` (lazy).
3. Script de seed de credencial: `scripts/seed-{slug}-{nome}.mjs` (referência: `seed-hl-ultracash.mjs`). Usar `applyTenantSeed` da `seed-common.mjs` quando aplicável; encryption via `crypto.ts` (D-E: hoje `seed-hl-ultracash.mjs` duplica `encryptCredential` — refatorar pra `seed-common.mjs`).
4. Testes em `__tests__/{nome}.test.ts` — happy path, erro de API, sanitização (sem vazar campos sensíveis tipo `custo_medio` na UltraCash).
5. Registrar guard em `tool-factory.ts`:
   ```typescript
   if (config.active_tools.includes('{nome}')) {
     Object.assign(tools, create{Nome}Tools(tenantId));
   }
   ```
6. Atualizar `active_tools` do tenant: `UPDATE zenya_tenants SET active_tools = active_tools || '"{nome}"'::jsonb WHERE chatwoot_account_id = X;`
7. **Build + reload obrigatório** (código novo): `npm run build && pm2 reload zenya-webhook`.

### 8.3 Adicionar **tenant novo (greenfield)**

Sequência (já capturada em RUNBOOK §3 e TENANT-PLAYBOOK §9 — promovidas ao Capítulo 3):

1. Chatwoot: criar conta + inbox WhatsApp + webhook → `https://api.sparkleai.tech/webhook/chatwoot` (event `message_created`).
2. Z-API: criar instância, parear via QR code (celular do cliente).
3. Prompt: `docs/zenya/tenants/{slug}/prompt.md` com front-matter YAML (ADR-001).
4. Seed: copiar `seed-scar-tenant.mjs` (template-prime), trocar prefixo env `{SLUG}_`, name, prompt path. Rodar `--dry-run` antes do real.
5. Credenciais (se houver integrações): scripts dedicados (Z-API obrigatório se quiser labels nativas; OAuth do Google calendar se aplicável).
6. Test mode whitelist: `allowed_phones` populado com admin + dono. Smoke local (`chat-tenant.mjs`) → smoke produção (whitelist) → liberar (`allowed_phones = '{}'`).
7. Monitorar 48h (`pm2 logs`).

### 8.4 Adicionar **migration de schema**

> **Crítico:** rodar migration **antes** do deploy do código que usa a coluna nova. Coluna inexistente no SELECT do `config-loader` derruba **todos os tenants** simultaneamente.

1. Adicionar `migrations/00X_descricao.sql`. Convenções:
   - `IF NOT EXISTS` em todo CREATE/ALTER (idempotência).
   - `COMMENT ON COLUMN ... IS '...'` documentando intenção.
   - Sem `DROP` sem cerimônia (preservar dados).
2. Aplicar via Management API com `SUPABASE_PAT` (no `.env` da VPS):
   ```bash
   curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
     -H "Authorization: Bearer $SUPABASE_PAT" \
     -H "Content-Type: application/json" \
     -d '{"query": "SEU SQL AQUI"}'
   ```
3. Atualizar código (`config-loader.rowToConfig`, tools que precisam, etc.).
4. Rodar tests + lint + typecheck.
5. Deploy: `npm run build && pm2 reload zenya-webhook`.

---

## §9 — O que NÃO existe (gaps explícitos vs. roadmap futuro)

> Catalogados aqui para que **agente novo** ou **dono** que lê este capítulo não assuma capacidades inexistentes.

### 9.1 Capacidades prometidas em contrato mas não implementadas no core

| Capacidade | Status | Evidência |
|-----------|--------|-----------|
| **Lembretes proativos** (cron lê agendamentos do tenant e dispara WhatsApp pelo Z-API) | ❌ Não implementada | Contrato Thainá Oliveira cláusula 1.2 (2026-04-25). Sem worker dedicado a isso. Catalogar D4 (briefing §11) — bloqueia go-live de qualquer tenant com lembrete |
| **Reset que limpa label `agente-off` no Chatwoot** | ❌ Falha conhecida | Sessão Gustavo 2026-04-24 travou: `/reset` limpa `zenya_conversation_history` mas não remove a label. Cliente final não consegue destravar. Catalogar D5 |
| **Métricas de custo OpenAI** (token usage por tenant, $/turno) | ❌ Não instrumentado | Briefing §11 D16 — nem `zenya_execution_log` nem `zenya_ai_usage`. Custo invisível |
| **Filtro de timestamp no admin agent** (não responder a sync histórico do Z-API após pareamento) | ❌ Bug conhecido | Sessão 2026-04-24: pareamento Z-API gerou rajada de `consultar_metricas` por mensagens reciclos do histórico. Catalogar D6 |

### 9.2 Capacidades existentes mas com forma frágil

| Item | Forma atual | Risco |
|------|-------------|-------|
| Lock de sessão sem TTL | `INSERT ON CONFLICT DO NOTHING` em `zenya_session_lock`; release no finally | Crash do processo deixa lock órfão. Recovery manual. |
| KB sync da PLAKA | `startKbSyncLoop` definido mas **não invocado** no `index.ts` nem no `ecosystem.config.cjs` | KB potencialmente desatualizada em produção |
| Cache 5min sem invalidação programática | Bust depende de `pm2 reload` ou esperar TTL | UPDATE de `zenya_tenants` demora até 5min para refletir |
| Validação de telefone | "olho humano" no seed — sem normalização | Casos com/sem `9` no DDD (BA, RJ, SP) podem ser inseridos inconsistentemente |
| `saveHistory` + 1ms hack | Garante ordem user-then-assistant | Se concorrência aumentar muito, ordem pode embaralhar |

### 9.3 Coisas que docs antigos descrevem — status real (revisado v0.2)

| Doc | O que ele descreve | Realidade |
|-----|--------------------|-----------|
| `NUCLEUS-CONTRACT.md` | API REST `organs/zenya/` porta 3002, endpoints `/flows`, `/clients`, `/flows/:id/run`, `/flows/:id/clone` | **EVOLUIU ORGANICAMENTE — não foi abandonado.** Hoje é `organs/zenya/dist/server.js` na **porta 3005** (não 3002), com endpoints `/health`, `/flows`, `/clients`, `/cockpit/*` ativos como **Cockpit Cliente Zenya — Epic 10 parcial**. Nginx `zenya.sparkleai.tech`. Rota `POST /clients` provavelmente broken (query em `zenya_clients` que não existe). **Necessita: NUCLEUS-CONTRACT v2** documentando realidade — não deprecate puro |
| `ISOLATION-SPEC.md` | Tabelas `zenya_clients`, `zenya_conversations` com `data_isolation_key` + RLS via `set_config('app.current_client_key', ...)` | **Nunca existiu** o schema descrito. Mecanismo real é closure JavaScript no tool-factory (§5.4). RLS está habilitada nas migrations 002+003 mas dormant (service key bypassa). **Deprecated** — Cap. 2 §4 (Dara) detalha a realidade |
| `ZENYA-CONTEXT.md` | "Zenya roda inteiramente em n8n" + tabela `n8n_historico_mensagens` | Era verdade até abril/22. Hoje 6/7 tenants no core (Ensinaja com cutover técnico incompleto, mas cliente não-prioritário). Tabela `zenya_conversation_history` substituiu. **Apêndice histórico** |
| `KNOWLEDGE-BASE.md` | 12 SCs (situações comuns) baseados em n8n + métricas de 2026-04-08 | Algumas SCs ainda valem; outras (ex: SC-09 lembrete) **nunca foram migradas** pro core. Dívida D4 (lembretes proativos) eleva isso a feature ativa pendente. **Reescrita** no Cap. 5 (Test Strategy) e Cap. 6 (Owner Playbook) |
| `FLOW-INVENTORY.md` | 15 fluxos n8n `Zenya Prime` numerados | Os 15 viraram capacidades no core (alguns), continuam em n8n (alguns), foram descartados (alguns) — sem mapa 1:1. **Reescrita** como mapa de capacidades atuais |

---

## §10 — Defasagem documental (catálogo gap-by-gap)

> Esta seção alimenta direto o **technical-debt-DRAFT.md** da Fase 4 e o decisão de "promover/apêndice/deprecate" da Fase 8.

| Doc atual | Veredito proposto | Motivo |
|-----------|-------------------|--------|
| `docs/zenya/ZENYA-CONTEXT.md` | **Apêndice histórico** (`_canonical/_appendix/B-historical-n8n-era.md`) | Descreve era n8n; substituído por este Capítulo 1 |
| `docs/zenya/NUCLEUS-CONTRACT.md` | **Deprecated** (`_canonical/_appendix/C-deprecated.md`) | Design intencional abandonado; nunca implementado |
| `docs/zenya/ISOLATION-SPEC.md` | **Deprecated** | Schema `zenya_clients`/`zenya_conversations` jamais existiu |
| `docs/zenya/ERROR-FALLBACK-MAP.md` | **Reescrito** no Capítulo 3 | Erros reais vivem em `worker/webhook.ts` + agentes; classes `ZenyaXxxError` não existem |
| `docs/zenya/KNOWLEDGE-BASE.md` | **Reescrito** no Capítulo 5 (Test) e parcialmente Capítulo 6 (Owner) | SCs/CBs herdados de n8n misturam coisas que valem com coisas que não migraram |
| `docs/zenya/BASELINE-PERFORMANCE.md` | **Reescrito** | Baseline de abril/8-11, n8n; precisa ser refeito com dados core (D16 — instrumentação ausente) |
| `docs/zenya/FLOW-INVENTORY.md` | **Reescrito como mapa de capacidades atuais** | Reorganização semântica completa |
| `docs/zenya/TENANT-PLAYBOOK.md` | **Promovido** ao Capítulo 2 (parte schema) + Capítulo 3 (parte operacional) | Doc de referência técnica do core (Fun) — bom estado, atualizar tabela §12 (clientes desatualizada) |
| `docs/zenya/RUNBOOK.md` | **Promovido** ao Capítulo 3 (Operational Manual) | Curto e útil (~210 linhas). Base do "como faço X" |
| `docs/zenya/TENANT-REFINEMENT-PLAYBOOK.md` | **Promovido** ao Capítulo 5 (Test Strategy) | Método de refino + 4 armadilhas com cicatrizes (P4) |
| `docs/zenya/SOP-FLOW-INVENTORY-UPDATE.md` | **Apêndice histórico** | SOP era n8n |
| `docs/zenya/tenants/{slug}/prompt.md` | **Mantido como está** (canônico ADR-001) | Referenciado no Capítulo 3 |
| `docs/zenya/contratos/` | **Promovido com convenção de pasta** documentada no Capítulo 6 (Owner Playbook) | Pasta jovem (Thainá hoje); precisa de regra de naming + retenção |
| `docs/zenya/{tenant}-import/` | **Apêndice histórico** | Imports n8n por tenant — útil até zerar Ensinaja |
| `docs/zenya/raw/` | **Apêndice histórico** | Idem |
| `docs/zenya/proposals/` | **Avaliar caso a caso na Fase 4** | PROP-001 TTL Postgres pode virar dívida ativa |
| `docs/zenya/templates/` | **Avaliar caso a caso na Fase 4** | Templates de propostas — uso ativo? |
| `docs/zenya/ip/` | **Mantido como apêndice de IP** | ZENYA-PROMPTS, ZENYA-LOGIC, ZENYA-ASSETS-REGISTRY — referência ativa de IP |

---

## §11 — Dívidas técnicas catalogadas na Fase 1

> Estas vão alimentar o `technical-debt-DRAFT.md` da Fase 4. Severidade preliminar — Quinn (QA) faz a calibração final na Fase 7.

### P0 — Bloqueia operação ou esconde risco crítico

| ID | Dívida | Cicatriz | Proposta de remediation |
|----|--------|----------|-------------------------|
| **D-D** | KB sync (`startKbSyncLoop`) é dead code em produção. PLAKA depende da snapshot local atualizada | Implementação T2.2b plaka-01; nenhum invocação posterior | Story dedicada Epic 18: criar `scripts/run-kb-sync.mjs` + `kb-sync` app no `ecosystem.config.cjs` (ou invocar dentro de `startAgenteOffCleanup` se preferir 1 processo) |
| **D2** (briefing) | MCP Supabase do Claude Code aponta pro Supabase legado bloqueado | Sessão 2026-04-25: queries retornam `Resource has been removed` | @devops corrige `~/.claude.json` project_ref → `uqpwmygaktkgbknhmknx` |
| **D5** (briefing) | `/reset` não limpa label `agente-off` | Sessão Gustavo 2026-04-24 | Story Epic 18: `/reset` chama `removeAgenteOffLabel` antes de `clearHistory` |
| **D4** (briefing) | Capacidade `lembretes proativos` inexistente; já contratada | Cláusula 1.2 contrato Thainá 2026-04-25 | Capacidade nova — Epic dedicado (potencial absorção do Epic 11 ou novo Epic 18.X) |
| **D1** (briefing) | Defasagem documental ampla (7 docs descrevem stack defasada) | Briefing §8a | Este brownfield resolve — Capítulo 1 já corrige `ZENYA-CONTEXT`, `NUCLEUS-CONTRACT`, `ISOLATION-SPEC`. Capítulos 2-6 resolvem o resto |

### P1 — Operacional ruim, mas não bloqueia

| ID | Dívida | Cicatriz | Proposta |
|----|--------|----------|----------|
| **D-A** | Lock sem TTL em `zenya_session_lock` | Risco residual; sem cicatriz documentada de órfão crítico | Migration: `locked_at` + cleanup periódico (ou cron `DELETE WHERE locked_at < now() - 5min`) |
| **D-B** | Coluna `admin_contacts` em `zenya_tenants` sem migration commitada | TENANT-PLAYBOOK §2 documenta; código usa; migration ausente | Migration 008 retroativa: `ALTER TABLE zenya_tenants ADD COLUMN IF NOT EXISTS admin_contacts JSONB NOT NULL DEFAULT '[]'`. Validar com Dara (Fase 2) |
| **D-E** | `seed-hl-ultracash.mjs` duplica `encryptCredential` em vez de usar `crypto.ts` ou um helper em `seed-common.mjs` | Drift de implementação criptográfica | Adicionar `encryptCredentialHex` em `seed-common.mjs`; refatorar `seed-hl-ultracash.mjs` |
| **D3** (briefing) | 7 seed scripts duplicados | Cada onboard cria nova cópia adaptada | Refatorar pra `scripts/seed-tenant.mjs --slug={X}` lendo um descriptor por tenant em `docs/zenya/tenants/{slug}/seed.yaml` |
| **D8** (briefing) | Cache 5min sem invalidação programática | Forçar = `pm2 reload` (manual) | Endpoint `/zenya/admin/cache/clear` (autenticado) ou `clearTenantCache` em `runZenyaAgent` ao detectar md5 mismatch |
| **D6** (briefing) | Burst admin no pareamento Z-API | Sessão 2026-04-24 | Filtrar mensagens com `created_at < (boot + threshold)` no admin agent |
| **D7** (briefing) | Validação de telefone tribal | Não documentada | Helper `normalizePhone(raw)` em `seed-common.mjs` + uso em todos seeds |
| **D11** (briefing) | Smoke ad-hoc por tenant | `smoke-template.mjs` existe; cada tenant copia | Refatorar `smoke-template.mjs` pra ler config por tenant em `docs/zenya/tenants/{slug}/smoke.yaml` |
| **D12** (briefing) | Plaka AEO contamina `packages/zenya/scripts/` e `packages/zenya/migrations/` | Boundary unclear | Mover `patch-plaka-triggers.mjs`, `kb-coverage-plaka.mjs`, `kb-smoke-plaka.mjs`, `seed-plaka-credentials.mjs`, `006_plaka_kb_entries.sql` pra `packages/aeo` ou pacote dedicado. Decidir com Dara (Fase 2) e PM (Fase 10) |

### P2 — Mantenabilidade

| ID | Dívida | Proposta |
|----|--------|----------|
| **D-C** | `saveHistory` +1ms hack | Adicionar coluna `seq SERIAL` em `zenya_conversation_history` ou ordenar por `(created_at, id)` |
| **D9** (briefing) | `update-funpersonalize-prompt.mjs` ad-hoc | Apagar (uso único, capacidade já está em `seed-fun-personalize-tenant.mjs` + ADR-001) |
| **D10** (briefing) | Iteração de prompt sem ciclo padronizado | Capítulo 5 documenta; já capturado no TENANT-REFINEMENT-PLAYBOOK |
| **D13** (briefing) | `chat-{tenant}-local.mjs` duplicado | Apagar duplicatas; `chat-tenant.mjs --tenant=X` é o canônico (Story 15.1) |
| **D14** (briefing) | `tenant/seed.ts` legado com `TenantSeed` type | Deprecate explicit; se não tiver consumer, deletar |
| **D15** (briefing) | `go-live-checklist.md` por tenant copy-paste | Template em `docs/stories/_templates/go-live-checklist.tmpl.md` + Capítulo 5 |
| **D16** (briefing) | Observabilidade core ausente | Tabelas `zenya_execution_log`, `zenya_ai_usage` (rec G1/G2 do baseline n8n) |
| **D17** (briefing) | `organs/zenya/` referenciado em docs | Resolvido por §9.3 e §10 deste capítulo (deprecates explícitos) |

---

## §12 — Recomendação técnica sobre Epics 10/11/12/14

> **Briefing §10 cap. 8 + §16:** licença explícita pra Aria recomendar fundir/descartar. Decisão final é de business (Mauro com PM Morgan na Fase 10).

| Epic | Camada | Status atual | Recomendação Aria | Justificativa técnica |
|------|--------|--------------|-------------------|-----------------------|
| **Epic 10** Cockpit do Cliente Zenya | 5 (Produto Horizontal) | **InProgress (parcial)** — corrigido v0.2 | **MANTER, com pré-requisito explícito** (Mauro 2026-04-25): brownfield Zenya core estabilizar antes de evoluir Cockpit | Já existe parcialmente em produção (`organs/zenya` PM2 + Vercel `mauro-mattos-projects-389957a6/zenya-cockpit`). Escopo confirmado: **(a) Cockpit do dono primeiro**, (b) multi-tenant Mauro super-admin futuramente. **Brownfield Zenya é pré-requisito** (Mauro: *"primeiro preciso da estrutura desse departamento da Zenya muito bem estruturado"*) |
| **Epic 11** Capacidades Globais (Vision, assistente do gestor) | 5 | Draft | **DESMEMBRAR** em capacidades atômicas. Absorver em Epic 18 (brownfield remediation) se forem habilitadores diretos | Escopo vago demais. Lembretes proativos (D4) e admin canal robusto (D6) são "capacidades globais" que precisam sair logo. "Vision" não tem cicatriz documentada — Mauro decide se mantém |
| **Epic 12** Produção de Conteúdo da Zenya | 9 (Conteúdo Zenya) | Draft | **DESCARTAR como epic de Zenya core**. Mover para epic de marketing institucional (fora do core operacional) ou arquivar | Briefing §6 confirma: escopo mal-definido; Mauro confirmou que **não** é "Zenya gera conteúdo PRA cliente" (isso é Plaka AEO Camada 8). Provavelmente é "marketing institucional da Zenya como produto" — pertence a outro escopo |
| **Epic 14** Onboarding Automático | 7 | Draft (depende de Epic 10) | **MANTER**, congelado até Epic 10 | Dependência técnica clara. Não-prioritário até Cockpit existir |

**Decisão técnica preliminar (sujeita a confirmação de business):** O Epic 18 (Brownfield Remediation) deveria absorver:
- Lembretes proativos (D4 — antes "Epic 11.X")
- KB sync produção (D-D)
- Reset com label clean (D5)
- Burst admin filter (D6)
- Migration retroativa `admin_contacts` (D-B)
- Lock TTL (D-A)
- Refactor seed canônico (D3)
- Boundary cleanup Plaka AEO (D12)
- Observabilidade core (D16)

Outros itens de **Epic 11 — "Capacidades Globais"** (Vision e assistente gestor avançado) só após Epic 18 fechado.

---

## §13 — Próximas fases (handoff de Aria pra Dara)

| Fase | Owner | Output esperado | Aguarda |
|------|-------|----------------|---------|
| **2 — Schema & Data** | `@data-engineer` Dara | `02-schema-data.md` (Capítulo 2) — DDL canônica, mecanismo real de isolamento, MCP fix proposal, validar `admin_contacts` no banco real, validar drift schema-vs-migrations | Handoff `.aiox/handoffs/handoff-architect-to-data-engineer-20260425-fase2.yaml` |
| **3 — UX Discovery** | `@ux-design-expert` Uma | `frontend-spec.md` — 3 personas (cliente WA / agente humano Chatwoot / dono via canal admin) — patterns conversacionais, áudio-mirror, escalação | Pode rodar paralelo a Fase 2 |
| **4 — Technical Debt Draft** | `@architect` Aria | `_canonical/_drafts/technical-debt-DRAFT.md` — consolida §11 deste cap. + achados de Dara/Uma + classificação P0/P1/P2 final | Aguarda fim das Fases 2 e 3 |

**Elicitação aberta para Mauro/Morgan (não-bloqueante, mas valiosa):**

1. **(Business)** Confirmar veredicto sobre Epic 12 — descartar como produto Zenya core ou ressuscitar com escopo claro?
2. **(Business)** Confirmar lista de capacidades Epic 11 que sobrevivem após desmembramento (além de lembretes proativos + admin robusto, há "Vision" / "assistente do gestor" como prioridade real?).
3. **(Operacional)** Confirmar status do KB sync da PLAKA — ele roda hoje? Se sim, **como**? Se não, há queixa de KB desatualizada da Roberta?
4. **(Operacional)** Coluna `admin_contacts` no banco — quando foi criada (ad-hoc via Management API)? Há outras colunas em produção sem migration commitada?

> Estas perguntas vão para o handoff yaml da Fase 2 e ficam disponíveis pro Mauro responder de forma assíncrona — não bloqueiam Dara nem Uma.

---

*Capítulo 1 (System Architecture) — versão 0.1, Fase 1 do Brownfield Discovery 2026-04-25.*
*Próxima revisão: ao fim da Fase 2 (schema validado por Dara) — corrigir nuances de §4.4 (drift `admin_contacts`) e §7.2 (operações reais validadas).*
