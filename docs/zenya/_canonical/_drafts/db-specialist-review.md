# DB Specialist Review — Brownfield Zenya

**Versão:** 0.1 (Draft, Brownfield Discovery Fase 5)
**Autor:** `@data-engineer` Dara
**Data:** 2026-04-25
**Inputs:** Cap. 1 v0.2 + Cap. 2 + Runtime Drift Audit + Technical Debt Draft (Aria, Fase 4)
**Pergunta-mãe:** *"Os items de DB do tech debt estão bem diagnosticados? Os fixes propostos são corretos, seguros e priorizados certo?"*

> Esta review **valida ou refina** as 9 dívidas de DB que entram no Epic 18: TD-01, TD-02, TD-03, TD-06, TD-10, TD-11, TD-15, TD-22, TD-23, TD-24, TD-25. Pra cada uma: SQL exato, riscos, esforço, ROI, validação proposta. Achados novos da Fase 5 ficam destacados.

---

## §1 — Sumário executivo da review

### O que mudou desde a Fase 4 (achados novos)

| # | Achado | Impacto na priorização |
|---|--------|-------------------------|
| 1 | **TD-02 (queue leak) tem 4 causas distintas, não 2** | Fix mais robusto necessário; não basta `markAllDone` no test-skip |
| 2 | **TD-02 dado novo: 221 das 259 pending Julia são de phones SEM history** | Failure path **antes** do try/catch interno é a causa principal (não race) |
| 3 | **TD-02 Scar 100% confirmado test-mode-skip leak** | Top 5 phones com pending são todos NÃO-whitelist; fix simples cobre isso |
| 4 | **Tabelas zenya_* são todas <5MB** | Migrations DDL são instantâneas em runtime; risco real é coordenação com deploy de código |
| 5 | **Zero functions/triggers custom em produção** | Workspace limpo; podemos introduzir helpers (`update_updated_at`, `cleanup_session_locks`) sem conflito |
| 6 | **Migration ledger ausente confirmado (TD-10)** | Sem `supabase_migrations.schema_migrations`; estado real é "tribal" — qualquer diff DDL futuro corre risco |

### Aprovações vs revisões propostas pra cada TD

| TD | Status pós-review | Mudança vs Fase 4 |
|----|-------------------|-------------------|
| TD-01 KB sync | ✅ **Aprovado fix** com proposta concreta detalhada (worker dedicado PM2) | Esforço refinado: M (1 dia, era 1-2d) |
| TD-02 Queue leak | ⚠️ **Refinar fix** — 4 causas, não 2. Esforço sobe pra M-L | Esforço sobe: M-L (2-3 dias) |
| TD-03 `tenant_id` polissemia | ✅ **Aprovado Opção A (rename)** + plano zero-downtime detalhado | Esforço confirmado: L (3-5 dias) |
| TD-06 Lock TTL | ✅ **Aprovado**. Recomendo cleanup pre-acquire (não worker periódico) | Esforço: S (3-4h) |
| TD-10 Migration ledger | ✅ **Aprovado.** Recomendo tabela manual `zenya_schema_migrations` + Supabase CLI futuro | Mudança: tabela manual primeiro, CLI depois |
| TD-11 Cache invalidação | ✅ **Aprovado.** Recomendo Postgres LISTEN/NOTIFY (não endpoint admin) | Mudança: LISTEN/NOTIFY > endpoint |
| TD-15 normalizePhone | ✅ **Aprovado.** Adicionar libphonenumber-js dependency | Esforço: S (4h, lib externa) |
| TD-22 Observabilidade | ✅ **Aprovado.** Schema proposto detalhado §10 | — |
| TD-23 `updated_at` triggers | ✅ **Aprovado.** Function reusable + trigger em 6 tabelas | Esforço: S (2h, antes era 1h) |
| TD-24 naming `loja_integrada` | ⚠️ **Recomendo P3 (não P2)** — drift cosmético, sem impacto operacional | Severidade reduzida |
| TD-25 RLS `kb_entries` | ✅ **Aprovado.** | Esforço: S (1h) |

---

## §2 — TD-01 — KB sync dead code (P0, Wave 1)

### Diagnóstico aprovado

`packages/zenya/src/worker/kb-sync.ts` exporta `startKbSyncLoop()` e `runKbSyncOnce()`, mas **nenhum** dos dois é invocado em runtime:
- `packages/zenya/src/index.ts` linha 66 só chama `startAgenteOffCleanup()` — não `startKbSyncLoop()`
- `packages/zenya/ecosystem.config.cjs` só sobe app `zenya-webhook` — sem app pra KB sync
- Não há `scripts/run-kb-sync.mjs` no repo (mencionado no comentário do código mas inexistente)

Validação Fase 5: `zenya_tenant_kb_entries` tem 260 entries com `last_synced_at = 2026-04-21 21:19+00` em todas as linhas. Sync único de 21/04 (provavelmente `runKbSyncOnce` rodado manualmente quando seed-plaka-credentials.mjs criou a credencial).

### Proposta concreta de fix

**Decisão:** worker PM2 separado, **não** dentro do `zenya-webhook` (isolation de falhas; KB sync pode crash em rate limit Sheets sem derrubar o webhook).

**Arquivos a criar/editar:**

```
packages/zenya/scripts/run-kb-sync.mjs          # entry point (novo)
packages/zenya/ecosystem.config.cjs             # adicionar 2º app (editar)
packages/zenya/src/worker/kb-sync.ts            # ajustar exports/CLI flag (editar)
```

**`scripts/run-kb-sync.mjs`** (novo):

```javascript
#!/usr/bin/env node
// Worker dedicado de KB sync — roda como app PM2 separado.
//
// Uso:
//   node scripts/run-kb-sync.mjs              # loop infinito (15min)
//   node scripts/run-kb-sync.mjs --once       # 1 sync e sai (debug)
//   node scripts/run-kb-sync.mjs --tenant=X   # sync só de 1 tenant (debug)

import 'dotenv/config';
import { startKbSyncLoop, runKbSyncOnce, syncTenantKB } from '../dist/worker/kb-sync.js';

const args = process.argv.slice(2);
const onceFlag = args.includes('--once');
const tenantFlag = args.find(a => a.startsWith('--tenant='));

if (tenantFlag) {
  const tenantId = tenantFlag.split('=')[1];
  console.log(`[run-kb-sync] sync isolado tenant=${tenantId}`);
  const report = await syncTenantKB(tenantId);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.errors.length > 0 ? 1 : 0);
}

if (onceFlag) {
  console.log('[run-kb-sync] modo --once');
  const reports = await runKbSyncOnce();
  console.log(`done — ${reports.length} tenants`);
  process.exit(0);
}

console.log('[run-kb-sync] iniciando loop infinito (15min interval)');
await startKbSyncLoop();
```

**`ecosystem.config.cjs`** — adicionar 2º app:

```javascript
module.exports = {
  apps: [
    {
      name: 'zenya-webhook',
      script: './dist/index.js',
      // ... config existente ...
    },
    {
      name: 'zenya-kb-sync',
      script: './scripts/run-kb-sync.mjs',
      env_file: '.env',
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 60000,                      // 1min entre restarts (não-urgente)
      out_file: './logs/kb-sync-out.log',
      error_file: './logs/kb-sync-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '256M',
    },
  ],
};
```

### Validação

1. Pre-deploy local: `node scripts/run-kb-sync.mjs --once` — confirmar `last_synced_at` atualiza
2. Post-deploy: `pm2 list` confirma `zenya-kb-sync` online; `pm2 logs zenya-kb-sync --lines 20` confirma sync a cada 15min
3. Validação SQL após 30min: `SELECT MAX(last_synced_at) FROM zenya_tenant_kb_entries WHERE tenant_id = (SELECT id FROM zenya_tenants WHERE chatwoot_account_id='2');` deve mostrar `< 30min ago`

### Riscos

| Risco | Mitigação |
|-------|-----------|
| Sheets API rate limit | Worker tem `try/catch` no `runKbSyncOnce`; tolera falhas silenciosamente; `restart_delay: 60s` no PM2 evita restart loop |
| Service Account expira | Erro vai pra `logs/kb-sync-error.log`; alarme manual hoje (TD-22 instrumentação resolveria) |
| Sync sobrescreve mudanças manuais | KB já é "snapshot" — fonte da verdade é Sheets. Mudanças manuais em `zenya_tenant_kb_entries` são perdidas no próximo sync (intencional) |

### Esforço refinado

**M — 1 dia** (script + ecosystem + deploy + validação). Era 1-2d na Fase 4 — refinado pra 1d porque não há refactor do worker em si.

---

## §3 — TD-02 — Queue leak (P0, Wave 1) — REFINADO

### Diagnóstico revisado pós-Fase 5

A Fase 4 catalogou 2 causas. Validação Fase 5 (queries DB-V2/V3/V4/V8/V9) revelou **4 causas distintas** com proporções diferentes:

| Causa | Proporção (875 total) | Mecanismo |
|-------|------------------------|-----------|
| **A — Tenant lookup failure** | 581 (66%) | Account 4 (Ensinaja) — webhook sem tenant seedado; `loadTenantByAccountId` lança; erro escapa |
| **B — Test-mode-skip leak** | 34 (4%) | Account 7 (Scar) — webhook.ts linha 238 `return` sem `markAllDone(pendingIds)`. Top 5 phones todos fora `allowed_phones=['+557488614688']` |
| **C — Failure path antes do try/catch interno** | 221 (25%) | Account 5 (Julia) — exception em `fetchPending`, `transcribeAudio`, `loadTenantByAccountId`, `getContactAudioPreference`, etc. **escapa** do `withSessionLock` antes do `try { runZenyaAgent }`. 60 phones distintos, **nenhum** com history `done` |
| **D — Race condition** | 38 (4%) | Account 5 (Julia) — mensagem nova chega DEPOIS do `fetchPending` da sessão atual; `markAllDone` só marca os IDs do fetch; nova fica `pending`. Phone tem history `done` (provando que sessão funciona normal) |

> **Causa C é a mais grave** porque é não-determinística (depende de erro transitório de Whisper / Supabase / Chatwoot). Pico de **163 pending num único dia (2026-04-17)** sugere bug correlacionado a deploy/instabilidade.

### Proposta de fix consolidado

**5 mudanças cirúrgicas em `packages/zenya/src/worker/webhook.ts`:**

#### Fix 1 — Validar tenant **antes** de enqueue (resolve causa A)

```typescript
// ANTES (linha 109-156):
const accountId = String(payload.account!.id);
// ... validações ...
await enqueue({ tenant_id: accountId, ... });
// Lock + agent ...
// loadTenantByAccountId no meio do withSessionLock — se falhar, msg fica pending

// DEPOIS:
const accountId = String(payload.account!.id);
// Pre-check tenant ANTES de enfileirar (cache 5min protege contra DDoS no DB)
let tenantConfig;
try {
  tenantConfig = await loadTenantByAccountId(accountId);
} catch (err) {
  console.warn(`[zenya] No tenant for account_id=${accountId} — rejecting webhook`);
  return c.json({ error: 'unknown_tenant' }, 400);
}

// SÓ ENTÃO enfileira
await enqueue({ tenant_id: accountId, ... });
```

**Impacto causa A:** account 4 (Ensinaja) volta a retornar 400 imediatamente; nada fica pending. 581 já existentes precisam cleanup separado.

#### Fix 2 — Test-mode-skip path chama markAllDone (resolve causa B)

```typescript
// linha 237-238 (test mode skip)
if (config.allowed_phones.length > 0 && !config.allowed_phones.includes(phone)) {
  console.log(`[zenya] Test mode — ignored ${phone} (not in allowed list for tenant ${config.name})`);
+ await markAllDone(pendingIds);  // marca como processado (decisão: ignorar = sucesso silencioso)
  return;
}
```

**Decisão semântica:** `done` em vez de `failed` — porque o webhook fez seu trabalho corretamente (decidiu ignorar por test mode). Distinção importante pro alarme/observabilidade não sinalizar falsa instabilidade.

**Impacto causa B:** Scar 34 zera; futuros tenants em test mode não acumulam.

#### Fix 3 — Wrapper try/finally robusto (resolve causa C)

```typescript
// Toda a lógica DENTRO de withSessionLock vai pra try/finally
void (async () => {
  await withSessionLock(accountId, phone, async () => {
    let pendingIds: string[] = [];
    try {
      await sleep(DEBOUNCE_MS);
      const pending = await fetchPending(accountId, phone);
      pendingIds = pending.map((m) => m.message_id);

      // ... resolução de áudio, loadTenant, agent ...
      // QUALQUER erro aqui dentro vai pro catch unificado

      await markAllDone(pendingIds);
    } catch (err) {
      // Marca FALHADAS antes de re-throw
      if (pendingIds.length > 0) {
        await markAllFailed(pendingIds).catch(() => {});  // best-effort
      }
      throw err;
    }
  });
})().catch((err) => {
  console.error(`[zenya] Agent error for message ${messageId}:`, err);
});
```

**Mudanças semânticas:**
- `pendingIds` declarado **fora** do try → disponível no catch
- `markAllFailed` no catch é **best-effort** (`.catch(() => {})`) — se DB tá fora do ar, não dá pra fazer nada
- Mensagens nunca ficam órfãs em `pending`, sempre vão pra `failed` ou `done`

**Impacto causa C:** 221 Julia vão pra `failed` (ou ficam em estado consistente). Erros transitórios (Whisper timeout, Chatwoot 5xx) são contabilizáveis no alarme.

#### Fix 4 — Detectar messages adicionadas durante o turno (mitiga causa D)

```typescript
// Após primeiro fetchPending + processamento:
await markAllDone(pendingIds);

// Re-fetch pra ver se chegou alguma DURANTE o processamento
const stillPending = await fetchPending(accountId, phone);
if (stillPending.length > 0) {
  console.log(`[zenya] ${stillPending.length} messages arrived during processing — will be picked by next webhook`);
  // Não processar agora (já gastamos LLM call deste turno).
  // Próximo webhook entrante vai tomar lock + processar.
}
```

**Decisão pragmática:** mensagens que chegam durante o processamento ficam pra próximo turno. Custo: pequena latência adicional (debounce 2.5s da próxima). Benefício: simplicidade + previsibilidade.

**Impacto causa D:** 38 Julia ficam em `pending` até webhook seguinte chegar (que vai pegá-las via `fetchPending`). Não acumulam mais.

#### Fix 5 — Cleanup script imediato (zerar legacy)

Script de uma só execução pra normalizar as 875 atuais:

```javascript
// packages/zenya/scripts/cleanup-stale-queue.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const STALE_HOURS = 24;

const { data, error } = await sb
  .from('zenya_queue')
  .update({ status: 'failed', updated_at: new Date().toISOString() })
  .eq('status', 'pending')
  .lt('created_at', new Date(Date.now() - STALE_HOURS * 3600 * 1000).toISOString())
  .select('tenant_id, count(*)', { count: 'exact', head: false });

console.log(`Marked ${data?.length ?? 0} stale-pending → failed`);
```

**Validação:** após cleanup, `SELECT status, COUNT(*) FROM zenya_queue GROUP BY status;` deve mostrar `pending` < 50 (apenas mensagens recentes).

### Riscos

| Risco | Mitigação |
|-------|-----------|
| Fix 1 quebra integração que envia webhook teste | Logs `[zenya] No tenant for account_id=X` permitem detecção rápida |
| Fix 3 mascara erros transitórios | Não — erros vão pro `console.error` no catch externo + `markAllFailed`. TD-22 (observabilidade) resolve a parte de monitoramento estruturado |
| Cleanup script (Fix 5) marca como failed mensagens que **deveriam** ser processadas | Limite de 24h é conservador; mensagens recentes (<24h) ficam intactas. Mauro autoriza antes de rodar |

### Esforço

**M-L — 2-3 dias.** Era M (1-2d) na Fase 4. Aumenta porque agora cobre 4 causas com testes específicos pra cada path.

### Validação proposta

1. Smoke local com cenários:
   - Test-mode tenant com phone fora whitelist → `done`
   - Tenant inexistente → 400 + zero pending
   - Erro forçado em `transcribeAudio` (mock) → `failed`, lock liberado
   - Burst de 5 mensagens → 1 done + 4 pending → próximo webhook pega 4 pending
2. Pre-prod: deploy + run cleanup script + monitor 24h
3. Cron (futuro Wave 2): script que alarme se `pending` > 50 ou `failed` > 100/h

---

## §4 — TD-03 — `tenant_id` polissêmico (P0/P1, Wave 2) — Opção A aprovada

### Diagnóstico aprovado + adendo

A polissemia é confirmada. Adendo da Fase 5: **2052 linhas em `zenya_queue` é ínfimo** — migração é instantânea em runtime. Risco real é coordenação com deploy de código.

### Decisão técnica: Opção A (rename) — aprovada

Razão: preserva semântica histórica, código é mais simples (refactor aditivo + drop), zero-downtime mais previsível.

### Plano zero-downtime detalhado (4 passos)

**Migration 009 — Adicionar colunas duplicadas (idempotente, expand):**

```sql
-- 009: Polissemia tenant_id — Fase Expand (adiciona aliases sem remover)

-- zenya_queue: tenant_id é chatwoot_account_id, renomear semanticamente
ALTER TABLE zenya_queue
  ADD COLUMN IF NOT EXISTS chatwoot_account_id TEXT;
UPDATE zenya_queue SET chatwoot_account_id = tenant_id
  WHERE chatwoot_account_id IS NULL;
-- Não NOT NULL ainda — esperar código alinhar
COMMENT ON COLUMN zenya_queue.chatwoot_account_id IS
  'Identificador do Chatwoot account (string). Substitui tenant_id desta tabela; tenant_id permanece por compat até migração 010.';

-- Idem zenya_session_lock
ALTER TABLE zenya_session_lock
  ADD COLUMN IF NOT EXISTS chatwoot_account_id TEXT;
UPDATE zenya_session_lock SET chatwoot_account_id = tenant_id
  WHERE chatwoot_account_id IS NULL;
COMMENT ON COLUMN zenya_session_lock.chatwoot_account_id IS
  'Idem zenya_queue. Substitui tenant_id.';

-- zenya_conversation_history: tenant_id aqui é UUID-as-text, MANTÉM (já é semântica certa)
-- Mas adiciona FK que faltava (estava sem por causa do tipo)
-- Estratégia: novo column tenant_uuid UUID com cast, migrate code, drop tenant_id depois
ALTER TABLE zenya_conversation_history
  ADD COLUMN IF NOT EXISTS tenant_uuid UUID;
UPDATE zenya_conversation_history
  SET tenant_uuid = tenant_id::uuid
  WHERE tenant_uuid IS NULL;
ALTER TABLE zenya_conversation_history
  ADD CONSTRAINT zenya_conversation_history_tenant_uuid_fkey
  FOREIGN KEY (tenant_uuid) REFERENCES zenya_tenants(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE zenya_conversation_history
  VALIDATE CONSTRAINT zenya_conversation_history_tenant_uuid_fkey;
```

**Step 2 — Deploy código alinhado (lê NEW + escreve NEW + escreve OLD por compat):**

Código transitório:
```typescript
// queue.ts — durante deploy
async function enqueue(msg) {
  await sb.from('zenya_queue').insert({
    tenant_id: msg.chatwoot_account_id,           // OLD (compat)
    chatwoot_account_id: msg.chatwoot_account_id, // NEW
    // ... resto ...
  });
}
async function fetchPending(accountId, phone) {
  return sb.from('zenya_queue').select(...)
    .eq('chatwoot_account_id', accountId);  // lê NEW (mais correto semanticamente)
    // OBS: queries que usam tenant_id antigo continuam funcionando porque os 2 cols têm o mesmo valor
}
```

**Migration 010 — Drop colunas antigas (contract — após 7 dias estáveis):**

```sql
-- 010: Polissemia tenant_id — Fase Contract (remove aliases obsoletos)
-- ATENÇÃO: rodar APENAS após confirmar zero código lendo tenant_id nas tabelas migradas

ALTER TABLE zenya_queue DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE zenya_session_lock DROP COLUMN IF EXISTS tenant_id;
-- Recriar PK em zenya_session_lock (era composta com tenant_id)
ALTER TABLE zenya_session_lock DROP CONSTRAINT IF EXISTS zenya_session_lock_pkey;
ALTER TABLE zenya_session_lock ADD PRIMARY KEY (chatwoot_account_id, phone_number);

ALTER TABLE zenya_conversation_history DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE zenya_conversation_history RENAME COLUMN tenant_uuid TO tenant_id;
-- Recriar índice
DROP INDEX IF EXISTS idx_zenya_history_session;
CREATE INDEX idx_zenya_history_session
  ON zenya_conversation_history (tenant_id, phone_number, created_at DESC);
```

### Riscos

| Risco | Mitigação |
|-------|-----------|
| Deploy quebra leitura intermediária | Step 2 lê **NEW** mas escreve **AMBOS** — durante janela, dados em ambas colunas. Rollback do código → DB ainda funciona |
| `tenant_id::uuid` cast falha em conversation_history | Validação pre-migration: `SELECT COUNT(*) FROM zenya_conversation_history WHERE tenant_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-...';` deve retornar 0 |
| FK NOT VALID + VALIDATE separadas | Por design — `NOT VALID` permite deploy rápido (não escaneia tabela), `VALIDATE` faz check de integridade depois sem lock pesado |
| PK rebuild em session_lock | Tabela tem 1-2 linhas (locks ativos) — DROP+CREATE PK é instantâneo |

### Esforço

**L — 3-5 dias** (1 dia migration 009, 2 dias deploy de código, 7 dias bake, 1 dia migration 010 + cleanup). Lock de schema só durante migrations; runtime fica sempre operacional.

### Recomendação alternativa

**Considerar adiar pra Wave 2 final** (depois de TD-09 seed canônico — refactor aproveita rename). Reduz coordenação simultânea de schema + código de seed.

---

## §5 — TD-06 — Lock TTL (P1, Wave 1)

### Decisão técnica: cleanup pre-acquire (não worker periódico)

**Razão:** mais simples, 1 query a mais por acquire (lock é raro path), zero processo extra rodando, zero coordenação cross-deployment.

### Proposta concreta

**Editar `packages/zenya/src/worker/lock.ts`:**

```typescript
const STALE_LOCK_AGE_MS = 5 * 60 * 1000;  // 5min

export async function acquireLock(accountId, phone): Promise<boolean> {
  const sb = getSupabase();

  // Cleanup pre-acquire: remove órfão se existir
  await sb
    .from('zenya_session_lock')
    .delete()
    .eq('chatwoot_account_id', accountId)  // após TD-03 rename
    .eq('phone_number', phone)
    .lt('locked_at', new Date(Date.now() - STALE_LOCK_AGE_MS).toISOString());

  // Tenta acquire normal
  const { error } = await sb.from('zenya_session_lock').insert({
    chatwoot_account_id: accountId,
    phone_number: phone,
  });

  if (error) {
    if (error.code === '23505') return false;  // lock vivo (não-órfão)
    throw new Error(`Lock acquisition failed: ${error.message}`);
  }
  return true;
}
```

**Cleanup imediato dos 2 órfãos atuais:**

```sql
-- Cleanup imediato (autorizado por Mauro quando rodar)
DELETE FROM zenya_session_lock
WHERE locked_at < NOW() - INTERVAL '5 minutes'
RETURNING tenant_id, phone_number, locked_at;
```

### Riscos

| Risco | Mitigação |
|-------|-----------|
| Race condition entre cleanup e acquire | DELETE com `WHERE locked_at <` é atômico; se duas instâncias tentam acquire simultâneo, INSERT ON CONFLICT garante mutex |
| 5min é muito alto pra tenants com latência baixa | Configurável via env `ZENYA_LOCK_TTL_MS` se algum tenant pedir |

### Esforço

**S — 3-4h** (edit `lock.ts` + test + cleanup script + deploy).

---

## §6 — TD-10 — Migration ledger (P1, Wave 2) — refinamento

### Decisão técnica: tabela manual primeiro, Supabase CLI depois

**Por que não Supabase CLI direto:**
- Supabase CLI exige link com projeto + autenticação local
- Mauro já demonstrou preferência por Management API (PAT) em scripts
- CLI requer Docker pra dev local — fricção desnecessária

### Proposta concreta

**Migration 011 — Tabela de ledger:**

```sql
-- 011: Migration ledger manual (não usar supabase_migrations.schema_migrations
-- porque Supabase CLI não está em uso)

CREATE TABLE IF NOT EXISTS zenya_schema_migrations (
  version       TEXT         PRIMARY KEY,    -- "001", "008", etc.
  name          TEXT         NOT NULL,        -- "zenya_admin_contacts_and_client_users"
  applied_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  applied_by    TEXT,                         -- "Dara via Management API", "Dev via npm script"
  md5_hash      TEXT         NOT NULL,        -- md5 do conteúdo do .sql, pra detectar drift
  notes         TEXT
);

-- Backfill com migrations conhecidas (001-008)
INSERT INTO zenya_schema_migrations (version, name, applied_at, applied_by, md5_hash, notes)
VALUES
  ('001', 'zenya_tables', '2026-04-15'::timestamptz, 'unknown', 'pre-ledger', 'backfill estimado — antes do ledger existir'),
  ('002', 'zenya_tenants', '2026-04-15'::timestamptz, 'unknown', 'pre-ledger', 'idem'),
  ('003', 'zenya_conversation_history', '2026-04-15'::timestamptz, 'unknown', 'pre-ledger', 'idem'),
  ('004', 'zenya_tenant_test_mode', '2026-04-16'::timestamptz, 'unknown', 'pre-ledger', 'idem'),
  ('005', 'zenya_admin_phones', '2026-04-18'::timestamptz, 'unknown', 'pre-ledger', 'idem'),
  ('006', 'plaka_kb_entries', '2026-04-21'::timestamptz, 'unknown', 'pre-ledger', 'idem'),
  ('007', 'zenya_escalation_public_summary', '2026-04-23'::timestamptz, 'unknown', 'pre-ledger', 'idem'),
  ('008', 'zenya_admin_contacts_and_client_users', '2026-04-25'::timestamptz, 'Dara via Management API', 'computed-on-apply', 'aplicada durante brownfield Fase 2 — autorização Mauro')
ON CONFLICT (version) DO NOTHING;
```

**Helper script `packages/zenya/scripts/apply-migration.mjs`:**

```javascript
#!/usr/bin/env node
// Aplica migration via Management API + registra em zenya_schema_migrations.
// Uso: node scripts/apply-migration.mjs migrations/009_xxx.sql

import 'dotenv/config';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

const file = process.argv[2];
if (!file) { console.error('Uso: apply-migration.mjs <path>'); process.exit(1); }

const sql = await fs.readFile(file, 'utf-8');
const md5 = crypto.createHash('md5').update(sql).digest('hex');
const filename = path.basename(file, '.sql');
const [version, ...nameParts] = filename.split('_');
const name = nameParts.join('_');

// 1. Aplica migration
const applyRes = await fetch(
  `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.SUPABASE_PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  },
);
const applyResult = await applyRes.json();
if (!applyRes.ok) {
  console.error('FALHA na migration:', applyResult);
  process.exit(1);
}

// 2. Registra no ledger
const ledgerSql = `
  INSERT INTO zenya_schema_migrations (version, name, applied_by, md5_hash, notes)
  VALUES ('${version}', '${name}', 'apply-migration.mjs', '${md5}', NULL)
  ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), md5_hash = EXCLUDED.md5_hash, notes = COALESCE(EXCLUDED.notes, zenya_schema_migrations.notes);
`;
const ledgerRes = await fetch(
  `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.SUPABASE_PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ledgerSql }),
  },
);

console.log(`✅ Migration ${version} (${name}) aplicada e registrada (md5=${md5})`);
```

### Esforço

**M — 1-2 dias** (migration 011 + script + backfill + doc no Cap. 3).

---

## §7 — TD-11 — Cache invalidação (P1, Wave 2) — refinamento

### Decisão técnica: Postgres LISTEN/NOTIFY (não endpoint admin)

**Razão:** `realtime` schema já existe no Supabase (Q21 Fase 2 confirmou). Setup mínimo. Funciona automaticamente — qualquer UPDATE em `zenya_tenants` notifica todas as instâncias do `zenya-webhook`.

### Proposta concreta

**Migration 012 — Trigger de notify:**

```sql
-- 012: Notify on zenya_tenants change → cache invalidation cross-instance

CREATE OR REPLACE FUNCTION notify_tenant_changed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'zenya_tenant_changed',
    json_build_object(
      'tenant_id', NEW.id,
      'chatwoot_account_id', NEW.chatwoot_account_id,
      'op', TG_OP
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER zenya_tenants_notify_change
AFTER INSERT OR UPDATE OR DELETE ON zenya_tenants
FOR EACH ROW EXECUTE FUNCTION notify_tenant_changed();
```

**Editar `packages/zenya/src/tenant/config-loader.ts`:**

```typescript
import { getSupabase } from '../db/client.js';

// Subscrever ao iniciar (chamado de index.ts)
export function subscribeTenantChanges(): void {
  const sb = getSupabase();
  sb.channel('zenya_tenant_changed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'zenya_tenants' },
      (payload) => {
        const newRow = payload.new as { id?: string; chatwoot_account_id?: string };
        const oldRow = payload.old as { id?: string; chatwoot_account_id?: string };

        // Invalida ambos caches (UUID + accountId), considerando que o ID pode ter mudado
        if (newRow.id) byId.delete(newRow.id);
        if (oldRow.id) byId.delete(oldRow.id);
        if (newRow.chatwoot_account_id) byAccountId.delete(newRow.chatwoot_account_id);
        if (oldRow.chatwoot_account_id) byAccountId.delete(oldRow.chatwoot_account_id);

        console.log(`[zenya] Cache invalidation triggered for tenant changes`);
      },
    )
    .subscribe();
}
```

**Editar `packages/zenya/src/index.ts`:**

```typescript
import { subscribeTenantChanges } from './tenant/config-loader.js';

if (process.env['VITEST'] === undefined) {
  validateEnv();
  // ... server start ...
  startAgenteOffCleanup();
  subscribeTenantChanges();  // novo
}
```

### Riscos

| Risco | Mitigação |
|-------|-----------|
| Realtime channel pode cair | Cache TTL 5min ainda atua como fallback |
| Performance impact | Notify é fire-and-forget no DB (overhead < 1ms por UPDATE) |
| Ordem de mensagens não-garantida | Não importa — invalidation é idempotente (delete) |

### Esforço

**S — 4-8h** (migration + 2 file edits + test).

---

## §8 — TD-15 — `normalizePhone` (P1, Wave 2)

### Decisão técnica: usar `libphonenumber-js` (não regex caseira)

**Razão:** ambiguidade BR (DDD com/sem 9, Bahia/Rio podem variar) é resolvida pela lib (banco de dados oficial Google). Regex caseira nunca cobre todos os casos.

### Proposta concreta

```bash
cd packages/zenya
npm install libphonenumber-js
```

**Adicionar em `packages/zenya/scripts/lib/seed-common.mjs`:**

```javascript
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Normaliza telefone brasileiro pra formato E.164 sempre com 9 (mobile).
 * Aceita: "11999999999", "+5511999999999", "(11) 99999-9999", "5511999999999"
 * Retorna: "+5511999999999"
 *
 * @throws Error se o número não puder ser normalizado para BR mobile válido
 */
export function normalizePhoneBR(raw) {
  const cleaned = String(raw).replace(/\D/g, '');

  // Adiciona 55 se não tem
  const withCountry = cleaned.startsWith('55') ? cleaned : '55' + cleaned;

  let phoneNumber;
  try {
    phoneNumber = parsePhoneNumber('+' + withCountry, 'BR');
  } catch (err) {
    throw new Error(`Telefone inválido: ${raw} — ${err.message}`);
  }

  if (!phoneNumber.isValid()) {
    throw new Error(`Telefone inválido: ${raw} (E.164: ${phoneNumber.format('E.164')})`);
  }

  // Garante mobile com 9 (lib já faz, mas dupla validação)
  const e164 = phoneNumber.format('E.164');
  return e164;
}

/**
 * Idem normalizePhoneBR mas tolera erros — retorna original se não conseguir parsear.
 * Útil pra logs/preview, não pra dados que vão pra DB.
 */
export function normalizePhoneBRSoft(raw) {
  try {
    return normalizePhoneBR(raw);
  } catch {
    return String(raw);
  }
}
```

**Backfill (uma vez) dos `allowed_phones` e `admin_phones` existentes:**

Script `scripts/backfill-normalize-phones.mjs` que aplica `normalizePhoneBR` em todos os tenants e UPDATE no banco. Dry-run primeiro.

### Esforço

**S — 4h** (lib install + helper + script backfill + doc no Cap. 4).

---

## §9 — TD-22 — Observabilidade core (P2, Wave 3)

### Schema proposto

**Migration 013 — Tabelas de observabilidade:**

```sql
-- 013: Observabilidade core — execution log + AI usage

-- Log de execução de cada turno do agente
CREATE TABLE IF NOT EXISTS zenya_execution_log (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES zenya_tenants(id),
  conversation_id   TEXT         NOT NULL,                          -- Chatwoot conversation_id
  phone_number      TEXT         NOT NULL,
  agent_kind        TEXT         NOT NULL CHECK (agent_kind IN ('zenya', 'admin')),
  message_id        TEXT,                                           -- de zenya_queue, se aplicável
  -- Inputs/outputs
  input_text        TEXT,                                           -- texto após resolução de áudio
  input_is_audio    BOOLEAN      NOT NULL DEFAULT false,
  output_text       TEXT,
  output_is_audio   BOOLEAN      NOT NULL DEFAULT false,
  -- LLM stats
  tools_invoked     JSONB        NOT NULL DEFAULT '[]',              -- [{name, args, result_preview}]
  tokens_input     INTEGER,
  tokens_output    INTEGER,
  steps_used       INTEGER,                                          -- de maxSteps
  -- Timing
  started_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  duration_ms       INTEGER,
  -- Status
  status            TEXT         NOT NULL CHECK (status IN ('success', 'error', 'fallback_text')),
  error_message     TEXT,
  -- Side effects
  escalation_triggered  BOOLEAN  NOT NULL DEFAULT false,
  escalation_source     TEXT     CHECK (escalation_source IN ('tool', 'human-reply') OR escalation_source IS NULL)
);

CREATE INDEX idx_zenya_execution_log_tenant_started
  ON zenya_execution_log (tenant_id, started_at DESC);
CREATE INDEX idx_zenya_execution_log_status_started
  ON zenya_execution_log (status, started_at DESC) WHERE status != 'success';
CREATE INDEX idx_zenya_execution_log_phone_started
  ON zenya_execution_log (phone_number, started_at DESC);

ALTER TABLE zenya_execution_log ENABLE ROW LEVEL SECURITY;
-- (policy seguindo pattern dos outros — usando current_setting('app.current_tenant_id'))

-- AI usage (rollup daily — o execution_log é granular)
CREATE TABLE IF NOT EXISTS zenya_ai_usage_daily (
  tenant_id         UUID         NOT NULL REFERENCES zenya_tenants(id),
  day               DATE         NOT NULL,
  model             TEXT         NOT NULL,                          -- 'gpt-4.1', 'gpt-4.1-mini', 'whisper-1', 'eleven_flash_v2_5'
  invocations       INTEGER      NOT NULL DEFAULT 0,
  tokens_input      BIGINT       NOT NULL DEFAULT 0,
  tokens_output     BIGINT       NOT NULL DEFAULT 0,
  cost_usd_estimate NUMERIC(12,6) NOT NULL DEFAULT 0,                -- estimativa baseada em pricing público
  PRIMARY KEY (tenant_id, day, model)
);

CREATE INDEX idx_zenya_ai_usage_day ON zenya_ai_usage_daily (day DESC);

ALTER TABLE zenya_ai_usage_daily ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE zenya_execution_log IS
  'Log granular de cada turn de agente. Retenção sugerida: 30 dias (cleanup periódico).';
COMMENT ON TABLE zenya_ai_usage_daily IS
  'Rollup diário de uso de modelos AI por tenant. Calculado por job noturno a partir de zenya_execution_log. Custo é estimativa baseada em pricing público dos providers.';
```

### Volume estimado

7 tenants × ~50 turnos/dia médios × 30 dias = ~10.500 rows/mês. Trivial em Postgres.

### Esforço

**L — 4-5 dias** total: migration + instrumentação no `agent/index.ts` e `admin-agent.ts` + job de rollup + tools admin novas (`consultar_metricas_avancadas`, `consultar_custo_mensal`).

---

## §10 — TD-23 — `updated_at` triggers (P2, Wave 4)

### Proposta concreta

**Migration 014 — Function reusable + triggers em todas tabelas com `updated_at`:**

```sql
-- 014: updated_at automation via triggers

CREATE OR REPLACE FUNCTION zenya_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar nas 6 tabelas que têm updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'zenya_tenants',
    'zenya_tenant_credentials',
    'zenya_queue',
    'zenya_tenant_kb_entries'
    -- zenya_conversation_history e zenya_session_lock NÃO têm updated_at
    -- zenya_client_users NÃO tem updated_at (só created_at)
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER IF NOT EXISTS %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION zenya_set_updated_at();',
      tbl || '_updated_at',
      tbl
    );
  END LOOP;
END $$;
```

> Postgres pré-15 não suporta `CREATE TRIGGER IF NOT EXISTS`; alternativa robusta: `DROP TRIGGER IF EXISTS ... CASCADE; CREATE TRIGGER ...`. Validar versão do Supabase antes (provavelmente PG16+, suporta).

### Esforço

**S — 2h** (migration + smoke "UPDATE row e ver `updated_at` mudou").

---

## §11 — TD-24 — Naming `loja_integrada` (rebaixar pra P3)

### Recomendação: P3 não P2

**Justificativa:** drift puramente cosmético, sem impacto operacional. `tool-factory.ts` `active_tools.includes('loja_integrada')` (underscore) e `loja-integrada.ts` `getCredentialJson(tenantId, 'loja-integrada')` (hífen) coexistem hoje sem problema. Mudar requer:
- UPDATE em `zenya_tenant_credentials` (mudar `service` em todas linhas existentes)
- Rebuild + deploy de código
- Smoke test
- Coordenação que nada quebra

ROI: muito baixo. Recomendo **adiar pra dia que outro tenant precisar de `loja_integrada`** (próximo onboarding com Loja Integrada). Aí padroniza tudo de uma vez.

### Esforço se decidir fazer

S — 2h (migration UPDATE + edit `loja-integrada.ts` linha 4 comment + edit `loja_integrada` constants).

---

## §12 — TD-25 — RLS em `zenya_tenant_kb_entries` (P2, Wave 4)

### Proposta

```sql
-- Adicionar à migration 014 (ou separate):

ALTER TABLE zenya_tenant_kb_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_kb_entries
  ON zenya_tenant_kb_entries
  FOR ALL TO PUBLIC
  USING ((tenant_id)::text = current_setting('app.current_tenant_id'::text, true));

COMMENT ON POLICY tenant_isolation_kb_entries ON zenya_tenant_kb_entries IS
  'Mesma policy que outras zenya_*. Dormant em runtime do core (service key bypassa). Backstop para JWT auth futuro.';
```

### Esforço

**S — 1h** (migration + smoke test impersonate).

---

## §13 — Achados secundários da Fase 5

### S-1 — Trigger pra invalidar cache cross-instance JÁ pode ser exercitado

Migration 012 (TD-11) traz infraestrutura LISTEN/NOTIFY. Podemos aproveitar para outras notificações futuras: lembretes proativos (D4), alertas de queue overflow, etc. Catalogar como **pattern arquitetural** no Cap. 3 (Operational Manual).

### S-2 — Cleanup de mensagens `done` antigas (sem dívida formal)

`zenya_queue` cresce monotonicamente. 5MB hoje, mas em 6 meses com 50 tenants pode virar GB. Recomendo cron mensal:

```sql
DELETE FROM zenya_queue WHERE status='done' AND updated_at < NOW() - INTERVAL '90 days';
```

**Não é bloqueante.** Vai pra Wave 4 ou backlog.

### S-3 — `zenya_session_lock` PK precisa ajuste durante migration 010 (TD-03)

Já catalogado em §4 Migration 010 — `DROP CONSTRAINT zenya_session_lock_pkey` + `ADD PRIMARY KEY (chatwoot_account_id, phone_number)`.

### S-4 — RLS pattern futuro pós-Cockpit

Hoje RLS é dormant (service key bypassa). Quando Cockpit Cliente Zenya escalar (Epic 10 Wave a+b), conexões com Supabase Auth (não service key) vão começar a chegar. RLS atual (`current_setting('app.current_tenant_id')`) **não funciona** porque essa session var não é setada em conexões web — precisa-se mudar pra usar `auth.uid()` cruzando com `zenya_client_users`.

**Não é dívida hoje.** Vira Story dedicada quando Epic 10 evoluir (Wave 3+ do Epic 18 ou epic separado).

---

## §14 — Resposta às elicitations da Aria (handoff Fase 5)

| ID Aria | Pergunta | Resposta Dara |
|---------|----------|---------------|
| **D5-1** | TD-03 — Opção A vs B? | **Opção A** confirmada (rename). §4 detalha plano zero-downtime |
| **D5-2** | TD-01 KB sync — onde rodar? | Worker PM2 separado (`zenya-kb-sync`). §2 detalha |
| **D5-3** | TD-06 Lock TTL — pre-acquire ou worker? | **Pre-acquire**. §5 detalha |

---

## §15 — Sequência recomendada de execução (refinamento da Wave 1)

A Wave 1 do Epic 18 (proposta Aria) ganha sequência preferida pra **minimizar coordenação de deploys**:

1. **TD-06 lock TTL** (S, 3-4h) — começa pequeno, aprende mecânica de PR/deploy/smoke
2. **TD-07 reset+label** (S, 3-4h) — paralelo a 1
3. **TD-08 admin burst filter** (S, 3-4h) — paralelo a 1
4. **TD-01 KB sync** (M, 1d) — primeiro item de novo processo PM2
5. **TD-02 queue leak** (M-L, 2-3d) — fix mais complexo, exige mais smoke

**Total:** ~5-7 dias úteis de trabalho concentrado, ou 1-2 sprints com paralelismo time.

---

## §16 — Próximas fases

Esta review desbloqueia:

- **Fase 6 (Uma — UX Specialist Review)** já liberada (paralela)
- **Fase 7 (Quinn — QA Gate)** consome Cap. 1 v0.2 + Cap. 2 + Frontend Spec + Tech Debt Draft + esta review + UX Specialist Review (Fase 6)
- **Fase 8 (Aria — Final Assessment + Template Canônico)** consume tudo acima + verdict de Quinn

**Handoff de retorno** pra Aria em `.aiox/handoffs/handoff-data-engineer-to-architect-20260425-fase5-return.yaml` com sumário das decisões aprovadas/refinadas + 3 SQL files prontos pra implementação (migrations 009-014).

---

*DB Specialist Review — Brownfield Zenya, Fase 5, 2026-04-25.*
*Decisões consolidadas: 8 TDs aprovados, 1 refinado em escopo (TD-02), 1 rebaixado (TD-24 P2→P3). Plano zero-downtime detalhado pra TD-03.*
