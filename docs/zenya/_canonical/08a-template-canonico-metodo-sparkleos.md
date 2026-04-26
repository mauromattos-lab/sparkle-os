# Capítulo 8a — Template Canônico do Método SparkleOS

**Versão:** 1.0 (Brownfield Discovery Fase 8 — Final Assessment)
**Autor:** `@architect` Aria
**Data:** 2026-04-25
**Pergunta-mãe:** *"Como construir núcleos novos no SparkleOS herdando o método validado pela Zenya?"*

> **AUDIÊNCIA PRIMÁRIA:** futuros núcleos SparkleOS (CRM, financeiro, editorial autônomo, etc.). Este documento **não é sobre Zenya** — é sobre o **método de criar núcleos** que a Zenya validou na prática.
>
> **Princípio P3 do brownfield:** *"Method, not product."* Próximos núcleos herdam a **forma de organização**, não a funcionalidade.

---

## §1 — Por que este capítulo existe

A Zenya é o **primeiro núcleo de produção** do SparkleOS. Em ~14 dias (abril/11 → abril/22+) cresceu de piloto n8n para core TypeScript multi-tenant atendendo 7 tenants. Esse crescimento expôs:

1. **Padrões que funcionam** (que devem virar herança)
2. **Cicatrizes que evitar** (que devem virar regras)
3. **Decisões arquiteturais** (que se repetem)

Sem este capítulo, próximo núcleo (CRM, financeiro, etc.) **vai redescobrir tudo do zero**. Com ele, parte do **caderno de regras** SparkleOS já está escrito.

> **Mauro disse explicitamente** (briefing §1): *"se a gente não alinhar, sanitizar, padronizar agora, quando vierem outros cores do sistema, vai ser uma bagunça irremediável"*. Este capítulo é a **prevenção dessa bagunça**.

---

## §2 — Defaults inviolavéis (P1-P9 cross-tenant)

Estes 9 princípios atravessam **todos os tenants** da Zenya hoje. Cada um tem cicatriz documentada. **Próximos núcleos com persona conversacional herdam estes princípios literais.**

| ID | Princípio | Cicatriz origem |
|----|-----------|-----------------|
| **P1** | Densidade ≤2 mensagens/turno (90% dos casos), max 3 | Scar v2 Gustavo: 5 msgs em 60s viraram spam |
| **P2** | Releia histórico antes de perguntar (com exemplo ❌/✅) | Roberta v2.2 + Gustavo turno 2 |
| **P3** | Tom imperativo > descritivo nas regras críticas (`OBRIGATORIAMENTE`, `DEVE`, `NUNCA`) | PLAKA v2 — afrouxar prompt triplicou no-kb-call |
| **P4** | Tool description vence regra de prompt — fix vai pro código (flag por tenant) | Julia v5→v6 Fun (PR #9 escalation_public_summary) |
| **P5** | LLM simula tool sem executar — fix é dupla instrução (regra imperativa + ❌/✅ + regra mental) | Roberta v2.2 PLAKA |
| **P6** | Mirror áudio↔texto (default; cliente pode forçar via tool) | Design canônico desde origem |
| **P7** | Aviso ao cliente no MESMO turno do escalation (não silêncio) | Julia v2 Fix |
| **P8** | Não invente dados, escale na dúvida | Cross-tenant rule |
| **P9** | **Automação derivada > input manual** (princípio inviolável cross-núcleo) | Mauro 2026-04-25 — lembretes proativos |

**Como aplicar em núcleo novo:**
- Núcleo conversacional (Zenya, futura assistente vendas, etc.) → herda P1-P9 literal
- Núcleo não-conversacional (financeiro, editorial autônomo) → herda P3, P4, P9 literal; demais ajusta

**Memórias cross-núcleo correlatas:**
- `feedback_automation_over_input` (P9 — princípio inviolável)
- `feedback_legacy_runtime_contamination` (auditoria de drift em todo brownfield)

---

## §3 — Arquitetura — padrões canônicos

### 3.1 Mecanismo de isolamento multi-tenant

**Pattern:** **closure de `tenantId` em factory de tools** (Cap. 1 §5.4 — security-critical).

```typescript
// CANONICAL — funciona pra qualquer núcleo multi-tenant com tools/agents

export function create<X>Tools(tenantId: string, /* config */, /* ctx */): ToolSet {
  // tenantId capturado em CLOSURE — nunca em parameters Zod das tools
  return {
    minhaTool: tool({
      parameters: z.object({ /* APENAS dados do domínio */ }),
      execute: async ({ /* params */ }) => {
        // tenantId acessível só via closure, LLM não vê
      },
    }),
  };
}
```

**Anti-pattern:** `tenantId: z.string()` em `parameters` — quebra isolamento. Próximo núcleo **nunca** deve fazer isso.

**RLS dormant** como backstop futuro: habilitar policies usando `current_setting('app.current_tenant_id')` com `missing_ok=true`. Não bloqueia hoje (service key bypassa) mas protege se um dia conexões com auth chave aparecerem (caso Cockpit Cliente — Zenya teve esse pattern emergente).

### 3.2 Isolamento de credenciais

**Pattern:** **AES-256-GCM por tenant** com `master_key` global.

```sql
CREATE TABLE <nucleo>_tenant_credentials (
  tenant_id              UUID         REFERENCES <nucleo>_tenants(id),
  service                TEXT,
  credentials_encrypted  BYTEA,                -- IV(16) || authTag(16) || ciphertext
  created_at             TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, service)
);
```

```typescript
// Wire format crypto.ts replicável
function encryptCredential(plaintext: string, masterKey: string): Buffer {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(masterKey, 'hex'), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}
```

**Lazy load runtime** (não eager):

```typescript
execute: async ({ /* params */ }) => {
  const creds = await getCredentialJson<XCreds>(tenantId, 'service-name');
  // ... usar ...
}
```

### 3.3 Schema canônico de tabela "tenants"

Toda tabela `<nucleo>_tenants` deve ter no mínimo:

```sql
CREATE TABLE <nucleo>_tenants (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT         NOT NULL,
  active_features     JSONB        NOT NULL DEFAULT '[]'::jsonb,  -- analog a active_tools
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

**Patterns adicionais** que Zenya adicionou e podem ser úteis:

| Coluna | Quando faz sentido | Padrão Zenya |
|--------|---------------------|---------------|
| `external_account_id` | Núcleo é integrado a sistema externo | `chatwoot_account_id` |
| `allowed_phones[]` ou `allowed_users[]` | Test mode whitelist | `allowed_phones` |
| `admin_phones[]` ou `admin_users[]` | Canal admin pelo dono | `admin_phones` + `admin_contacts JSONB` |
| Flags opt-in/opt-out por tenant | Capacidade global com variação | `escalation_public_summary BOOLEAN` |

### 3.4 Pattern de tabela "queue" (jobs assíncronos)

Quando há processamento assíncrono (webhook → agent, evento → ação):

```sql
CREATE TABLE <nucleo>_queue (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     <id_type>,                    -- UUID ou external_account_id
  message_id    TEXT         NOT NULL UNIQUE, -- idempotência
  payload       JSONB        NOT NULL,
  status        TEXT         NOT NULL DEFAULT 'pending', -- pending|processing|done|failed
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

**Anti-pattern aprendido (TD-02 Zenya):** webhook enfileira **antes** de validar tenant lookup → pending leak. **Próximo núcleo:** validar tenant **antes** de enqueue.

### 3.5 Pattern de tabela "session_lock"

Para mutex distribuído por sessão:

```sql
CREATE TABLE <nucleo>_session_lock (
  tenant_id     <id_type>,
  user_key      TEXT NOT NULL,                  -- analog a phone_number da Zenya
  locked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_key)
);
```

**Pattern de uso:** `INSERT ON CONFLICT DO NOTHING` + finally release.

**Anti-pattern aprendido (TD-06 Zenya):** sem TTL → órfãos no crash. **Próximo núcleo:** cleanup pre-acquire (DELETE WHERE locked_at < NOW() - 5min antes do INSERT).

---

## §4 — Convenções de naming

### 4.1 Tabelas e colunas

| Tipo | Convenção | Exemplo Zenya |
|------|-----------|---------------|
| Prefixo de tabela | `<nucleo>_*` | `zenya_tenants`, `zenya_queue` |
| FK explícita | `<other_table>_id UUID REFERENCES <other_table>(id)` | `tenant_id UUID REFERENCES zenya_tenants(id)` |
| Coluna polissêmica | **EVITAR** (cicatriz TD-03 Zenya — `tenant_id` em queue/lock é account_id, em credentials é UUID) | Renomear semanticamente: `chatwoot_account_id` na queue |
| Audit fields | `created_at`, `updated_at` em **todas** tabelas | Toda zenya_* |
| Soft delete | `deleted_at TIMESTAMPTZ` se audit trail necessário | Não usado em Zenya hoje |
| Triggers `updated_at` | Function reusable + trigger BEFORE UPDATE | Zenya pendente — TD-23 |

### 4.2 Slugs e identificadores

| Item | Convenção |
|------|-----------|
| Slug de tenant | lowercase, kebab-case (`scar-ai`, `fun-personalize`, `hl-importados`) |
| Branch | `feat/{epic}.{story}-{slug}` ou `fix/{slug}` |
| Commits | Conventional. `feat(<nucleo>)`, `fix(<nucleo>-{slug})`, `docs(<nucleo>)`, `refactor(<nucleo>)` |
| Env vars per tenant seed | Prefixo `{SLUG}_` em CAPS (`HL_CHATWOOT_ACCOUNT_ID`) |
| Service de credencial | `{nome-do-provedor}` minúsculo. **Padronizar underscore vs hífen cross-namespace** (cicatriz TD-24 Zenya — drift `loja-integrada` vs `loja_integrada`) |

### 4.3 Arquivos canônicos

| Tipo | Onde |
|------|------|
| SOP/prompt de tenant | `docs/<nucleo>/tenants/{slug}/prompt.md` (front-matter YAML; ADR-001 modelo) |
| Seed de tenant | `packages/<nucleo>/scripts/seed-{slug}-tenant.mjs` |
| Seed de credencial | `packages/<nucleo>/scripts/seed-{slug}-{service}.mjs` |
| Smoke por tenant | `packages/<nucleo>/scripts/smoke-{slug}.mjs` (refactor pendente: template + yaml — TD-12) |
| Migrations | `packages/<nucleo>/migrations/0XX_<descricao>.sql` |
| Tests | `packages/<nucleo>/src/__tests__/*.test.ts` |
| Integrações | `packages/<nucleo>/src/integrations/{nome}.ts` |
| Workers | `packages/<nucleo>/src/worker/{nome}.ts` |

---

## §5 — Patterns operacionais

### 5.1 Setup local primeira vez

Toda repo de núcleo deve ter:
- `.env.example` **completo** (não desatualizado — cicatriz TD-27 Zenya)
- README.md com `Setup → Primeiro run → Health check`
- `npm run dev` que sobe modo watch
- Endpoint `/<nucleo>/health` que retorna status + features ativas

### 5.2 Deploy

Pattern PM2:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: '<nucleo>-webhook',
      script: './dist/index.js',
      env_file: '.env',
      autorestart: true,
      max_memory_restart: '512M',
      // ...
    },
    // workers separados quando aplicável
    {
      name: '<nucleo>-<worker>',
      script: './scripts/run-<worker>.mjs',
      max_memory_restart: '256M',
    },
  ],
};
```

**Anti-pattern aprendido (TD-01 Zenya):** worker `kb-sync.ts` definido mas nunca invocado. **Próximo núcleo:** todo worker tem app PM2 dedicado **OU** é invocado explicitamente em `index.ts` startup.

### 5.3 Migrations zero-downtime (Expand-Contract)

Pattern obrigatório quando renomear ou converter coluna em tabela com tráfego:

1. **Migration N (Expand):** ADD nova coluna; UPDATE pra preencher; SEM remover antiga
2. **Deploy código transitório:** lê NEW + escreve AMBAS
3. **Bake period:** 7+ dias com ambas operacionais
4. **Migration N+1 (Contract):** DROP coluna antiga; rebuild PK/index se necessário

**Não pular Expand-Contract** mesmo em tabelas pequenas — força disciplina.

### 5.4 Migration ledger

Toda mudança de schema **registrada**:

```sql
CREATE TABLE <nucleo>_schema_migrations (
  version       TEXT         PRIMARY KEY,
  name          TEXT         NOT NULL,
  applied_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  applied_by    TEXT,
  md5_hash      TEXT         NOT NULL,
  notes         TEXT
);
```

Helper script `apply-migration.mjs` aplica + registra atomicamente. **Não usar Supabase CLI** se ainda não está integrado ao workflow (Zenya escolheu tabela manual — TD-10).

---

## §6 — Patterns de UX (núcleos com persona conversacional)

### 6.1 Personas no mesmo canal técnico

Pattern Zenya: **cliente final + agente humano + dono** compartilham mesmo canal Chatwoot, **mas nunca se confundem**. Webhook é o roteador.

```
incoming + phone in admin_phones      → run<X>AdminAgent (Persona 3)
incoming + phone in allowed_phones[]  → run<X>Agent (Persona 1, modo teste)
incoming + sem allowed_phones         → run<X>Agent (Persona 1, produção)
incoming + label 'agente-off'         → SKIP (Persona 2 atendendo)
outgoing + sent_by_<x>=false          → escalateToHuman (Persona 2 detectada)
outgoing + sent_by_<x>=true           → SKIP (eco do bot)
```

**Aplicação cross-núcleo:** quando núcleo tem múltiplas personas no mesmo canal técnico, **roteamento explícito no webhook** com flags claras.

### 6.2 Atomic conversacional (não componentes visuais)

Quando núcleo é principalmente conversacional:

| Atomic | Equivalente conversacional | Exemplo Zenya |
|--------|----------------------------|---------------|
| Atom | Frase canônica | Saudação, aviso de handoff, reconhecimento de info |
| Molecule | Sequência de 2-3 atoms | Qualificação consultiva, coleta antes de escalar |
| Organism | Fluxo completo | SAC e-commerce, venda consultiva |
| Template | SOP de tenant | `tenants/{slug}/prompt.md` |
| Page | Conversa real ponta-a-ponta | Logs PM2 + Chatwoot |

### 6.3 Defaults configuráveis: SOP vs DB

**Pattern decision tree** (Frontend Spec §4):

| Onde mora | Tipo de configuração |
|-----------|----------------------|
| **DB column** | Comportamento que muda shape de tool ou afeta código |
| **SOP regra** | Comportamento que muda só tom/conteúdo do output |
| **DB JSONB** | Configuração derivada que alimenta worker (ex: `maintenance_windows`) |
| **SOP regra** | Personalidade do bot (nome, vibe, emoji policy) |

**Modelo canônico de flag:** `<nucleo>_tenants.<comportamento>_<tipo> BOOLEAN/TEXT/JSONB DEFAULT <preserva-atual>`. Migração com IF NOT EXISTS pra não quebrar tenants existentes.

---

## §7 — Patterns de teste

### 7.1 Camadas obrigatórias

| Camada | Quando | Bloqueia deploy? |
|--------|--------|-------------------|
| Unit | Sempre | Sim |
| Smoke local (REPL) | Mudança de prompt/comportamento | Sim |
| Smoke automatizado | Mudança em tenant | Sim (com >0% de "comportamento inaceitável") |
| Smoke produção whitelist | Pós-deploy crítico | Sim (manual) |
| Monitor pós-deploy | Sempre 48-96h | Não (mas alarme) |

### 7.2 Princípios canônicos de smoke

1. **Cenários derivados da fonte** (nunca chutados) — cicatriz `feedback_test_from_source`
2. **Errors em smoke escondem comportamento ruim** — investigar causa antes de ignorar
3. **Parar quando comportamento inaceitável = 0%**, NÃO hit-rate "bom"
4. **Cada fix expõe próximo gap** — não buscar "perfeito" em 1 iteração

### 7.3 Cenários cross-tenant base

Núcleo conversacional Zenya tem 7 cenários C1-C7 (Cap. 5 §3). Próximo núcleo conversacional **deve** ter equivalente — ajustando ao domínio:

| C# | Conceito generalizado |
|----|------------------------|
| C1 | Cliente entrega múltiplas infos juntas (testa "releia histórico") |
| C2 | Cliente pede pessoa real (testa "tool foi invocada, não simulada") |
| C3 | Cliente pergunta info fora do escopo (testa "escala em vez de inventar") |
| C4 | Cliente usa formato alternativo (áudio, imagem, etc.) — testa fallback ou mirror |
| C5 | Cliente pergunta sobre identidade do bot (testa "não revelar IA") |
| C6 | Cliente envia rajada (testa debounce + densidade da resposta) |
| C7 | Cliente fora do horário operacional (testa "avisa retorno") |

---

## §8 — Auditoria de drift (Runtime Drift Audit)

> **Princípio cross-núcleo `feedback_legacy_runtime_contamination`**: todo brownfield SparkleOS começa com Runtime Drift Audit explícito.

### 8.1 9 vetores universais

| Vetor | Pergunta |
|-------|----------|
| DB legado vs ativo | Que projeto recebe writes hoje? |
| MCP/configs do agente | `~/.claude.json` aponta pra recursos certos? |
| Diretórios/pacotes abandonados | `organs/`, `packages/<antigo>/` sem uso? |
| Workflows paralelos vivos | `pm2 list`, `crontab -l`, n8n: o que está vivo mas não deveria? |
| DNS / reverse proxy | Quantos hostnames apontam pra VPS? Cada um pra qual processo? |
| Webhooks por tenant | Cada conta apontando pro webhook correto? Drift aqui é P0 invisível |
| Cron / scripts órfãos | Chamam paths que sumiram? |
| Env vars na VPS | Shape bate com `.env.example`? |
| Tabelas legacy no DB ativo | Há tabelas de design abandonado ainda no schema? |

### 8.2 Output do audit

Tabela: `ponto | esperado | observado | drift (s/n) | gravidade | remediation`. P0 confirmado bloqueia próxima fase.

---

## §9 — Workflow de criação de núcleo novo

> Aplicado caso Mauro queira criar **CRM**, **financeiro**, **editorial autônomo** ou outro núcleo.

### Sequência canônica

1. **Briefing** com `@pm` Morgan: o que o núcleo faz, audiência, escopo, integrações esperadas
2. **Architecture spike** com `@architect` Aria: stack (provavelmente TS/Hono mesmo padrão Zenya), tabelas core, integrações
3. **Schema design** com `@data-engineer` Dara: migrations 001-00N seguindo padrões §3+§4
4. **UX patterns** com `@ux-design-expert` Uma se aplicável (núcleo conversacional)
5. **Bootstrap repo** seguindo padrões §5
6. **Primeiro tenant piloto** seguindo OP-3 do Owner Playbook (Zenya Cap. 6) adaptado
7. **Smoke + iteração** seguindo método 7 passos (Zenya Cap. 5 §5)
8. **QA Gate** com `@qa` Quinn aplicando 6 critérios análogos ao §3 do briefing brownfield Zenya

### Convenções herdadas (não-negociáveis)

- ✅ AIOX como meta-framework (`@architect`, `@dev`, `@qa`, etc.)
- ✅ Story-Driven Development (`docs/stories/`)
- ✅ Memórias persistentes (`feedback_*`, `project_*`, `reference_*`)
- ✅ Push exclusivo `@devops` (Constitution AIOX)
- ✅ ADR-001 pattern (configuração canônica em `.md` com front-matter)
- ✅ Constitution AIOX (No Invention, Quality First, etc.)

---

## §10 — Anti-patterns universais (cicatrizes Zenya extraídas)

> Estas são as **lições aprendidas em produção** que próximos núcleos **não devem repetir**.

### 10.1 Arquitetura

- ❌ `tenantId` em parameters Zod de tools (P5.4 — quebra isolamento)
- ❌ Eager-load de credenciais em factory (lazy dentro do execute)
- ❌ Coluna polissêmica (TD-03 Zenya — `tenant_id` em queue/lock é account_id, em credentials é UUID)
- ❌ Worker definido mas nunca invocado (TD-01 Zenya kb-sync)
- ❌ Migration aplicada em prod sem migration ledger (TD-10 Zenya — drift retroativo)

### 10.2 Operação

- ❌ Webhook enfileira antes de validar tenant existe (TD-02 Zenya — Ensinaja 581 leak)
- ❌ Test-mode skip path sem markAllDone (TD-02 Zenya — Scar pending leak)
- ❌ Wrap de try/catch incompleto (causa C de TD-02 Zenya — Julia 221 leak)
- ❌ Deploy de código antes de migration aplicada (derruba tenants)
- ❌ Inventar URL de webhook por convenção (cicatriz Doceria 24h)
- ❌ Bombardear VPS com SSH/HTTPS rápidos (cicatriz Hostinger bloqueio)

### 10.3 Conversational UX

- ❌ Apresentar oferta antes de qualificar dor (A1)
- ❌ Mensagens em rajada 5+ por turno (A2)
- ❌ Repetir info que cliente já deu (A3)
- ❌ LLM simula tool sem invocar (A4)
- ❌ Description de tool venceu prompt sem fix em código (A5)
- ❌ Afrouxar prompt sem medir (A6)
- ❌ Inventar dados externos (A7)
- ❌ Revelar IA sem ser perguntado direto (A8)
- ❌ Misturar idiomas no mesmo turno (A9)
- ❌ Burst de mensagens no pareamento de canal externo (A10)

### 10.4 Processo

- ❌ Iterar prompt 5+ vezes em 2 dias (parar quando inaceitável = 0%)
- ❌ Pular smoke local em tenant em produção
- ❌ Smoke com cenários adivinhados (não derivados da fonte)
- ❌ Pedir input manual onde IA poderia derivar (P9 inviolável)
- ❌ Usar feature toggle como "config" em vez de capacidade técnica clara

---

## §11 — Documentos relacionados

| Doc Zenya | Equivalente em núcleo novo |
|-----------|------------------------------|
| `01-system-architecture.md` | `01-system-architecture.md` (cada núcleo escreve o seu seguindo padrão) |
| `02-schema-data.md` | Idem |
| `03-operational-manual.md` | Idem |
| `04-access-credentials.md` | Idem |
| `05-test-strategy.md` | Idem |
| `06-owner-playbook.md` | Idem (núcleos com persona "dono") |
| `08a-template-canonico-metodo-sparkleos.md` (este) | **NÃO replicar — referenciar este** |
| Memórias `feedback_legacy_runtime_contamination`, `feedback_automation_over_input` | Idem — são cross-núcleo |

---

## §12 — Sumário pra próximo núcleo (cheat-sheet)

Quando criar **CRM** (ou qualquer outro núcleo):

1. **Antes de codar:**
   - Ler este capítulo (§1-§11)
   - Ler memórias `feedback_legacy_runtime_contamination`, `feedback_automation_over_input`
   - Ler ADR-001 da Zenya (modelo de configuração canônica)

2. **Schema design:**
   - Tabelas seguem `<nucleo>_*` prefix
   - `<nucleo>_tenants` com mínimo schema §3.3
   - `<nucleo>_tenant_credentials` AES-256-GCM se há integrações externas
   - `<nucleo>_queue` + `<nucleo>_session_lock` se processamento assíncrono
   - `<nucleo>_schema_migrations` desde Migration 001 (não retroativa como Zenya)

3. **Mecanismo de isolamento:**
   - Closure `tenantId` em factory de tools (security-critical)
   - RLS dormant como backstop futuro

4. **Workers:**
   - PM2 app dedicado **OU** invocação explícita em `index.ts` (não dead code)

5. **Convenções:**
   - Slug kebab-case
   - Env vars `{SLUG}_*` CAPS
   - Conventional commits `feat(<nucleo>)`
   - Tabela ledger de migrations desde início

6. **Princípios inviolavéis:**
   - P3 (tom imperativo > descritivo) se houver prompts
   - P4 (description venceu prompt → fix vai pro código) se houver tools
   - P9 (automação derivada > input manual) sempre

7. **Auditoria:**
   - Runtime Drift Audit obrigatório no primeiro brownfield (próxima big mudança)

8. **Memórias:**
   - Capturar cicatrizes em `feedback_*` cross-núcleo desde dia 1

---

*Capítulo 8a (Template Canônico do Método SparkleOS) — Brownfield Zenya Fase 8 — 2026-04-25.*
*Resolve §3 critério 5 do QA Gate. Princípio P3 do briefing: "Method, not product" — próximos núcleos herdam a forma de organização, não a funcionalidade.*
