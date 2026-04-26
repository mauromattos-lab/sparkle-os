# Runtime Drift Audit — Brownfield Zenya 2026-04-25

**Autor:** `@data-engineer` Dara
**Fase:** 2 (Schema & Data Discovery)
**Trigger:** Confirmação de Mauro 2026-04-25 — *"sistema antigo SparkleOS pode ter pontas vivas (DB legado, n8n, organs/, DNS, env, cron). MCP errado é exemplo, não exceção."*
**Princípio:** memória `feedback_legacy_runtime_contamination.md` — todo brownfield SparkleOS faz Runtime Drift Audit explícito antes de considerar saneado.

---

## Sumário executivo

| Vetor | Drift detectado? | Severidade | Bloqueante Fase 7? |
|-------|------------------|-----------|---------------------|
| Supabase legado (escrita dupla) | ❌ Não — projeto `gqhdspayjtiijcqklbys` foi **removido** | n/a | Não |
| Supabase MCP do agente | ✅ Sim — aponta pro projeto removido | P1 | Não (workaround: Management API direto) |
| Tabelas legadas n8n no DB ativo | ❌ Não — apenas `zenya_*` no schema public | n/a | Não |
| `organs/zenya/` no repo | ✅ **Existe** — mas **NÃO é dead code** | P0 (correção doc) | Não |
| `organs/zenya/` na VPS — processo PM2 ativo | ✅ **Existe + ativo** (zenya-api, 5d uptime) | P0 (correção Cap. 1) | Não |
| n8n ativo na VPS | ✅ Sim — processo node `/usr/local/bin/n8n` rodando | OK (Ensinaja precisa) | Não |
| **Webhook conta 4 (Ensinaja) → core sem tenant** | ✅ Drift técnico — 581 pending acumulados | ~~P0~~ **rebaixado P2** | Não — cliente Douglas não é prioridade (resposta Mauro 2026-04-25; aguarda info dele há 2 semanas, com pgto pendente) |
| HL Importados sem tráfego no core | ✅ Estado intencional | OK | **Pausado por pedido do Hiago para ajustes** (resposta Mauro) |
| PLAKA sem tráfego no core | ✅ Estado intencional | OK | **Aguarda Mauro comprar número novo pra parear Z-API** (resposta Mauro) |
| DNS — `runtime.sparkleai.tech` (8001) e `portal.sparkleai.tech` (3001) | ✅ **Nginx aponta pra portas mortas** (sniff confirmou: nenhum listener) | P2 (zombie config) | Sistema antigo Mauro recomeçou aqui no OS — sem impacto, limpar nginx config quando der |
| Cron órfãos | ❌ Limpo (`# Sparkle crons removidos`) | n/a | Não |
| Env vars VPS vs `.env.example` | ✅ Sim — várias vars não documentadas | P2 | Atualizar exemplo |
| PM2 processos | ✅ 2 ativos: `zenya-webhook` + `zenya-api` (Cockpit Epic 10 — Vercel: `mauro-mattos-projects-389957a6/zenya-cockpit`) | Mapeado | Manter ambos |
| Crypto / encryption | ❌ Sem drift | n/a | Não |
| `tenant_id` polissemia | ✅ Sim — TEXT vs UUID com mesmo nome | P0 (refactor longo) | Story Epic 18 |
| **Migration 008 (D-B + D-F)** | ✅ Aplicada 2026-04-25 | **resolvido** | Repo + banco alinhados |

**Conclusão revisada (pós-respostas Mauro 2026-04-25):**
- ✅ **Zero drifts P0 bloqueantes** — Ensinaja rebaixado P2, HL/PLAKA confirmados como estado intencional, runtime/portal são zombies sem impacto.
- ✅ **D-B + D-F resolvidos** — Migration 008 aplicada (arquivo `packages/zenya/migrations/008_zenya_admin_contacts_and_client_users.sql` + DDL em prod).
- ⚠️ **Bloqueio Fase 7 removido.** Gate APPROVED viável após Aria atualizar Cap. 1 (correção sobre `organs/zenya` Cockpit ativo + status Epic 10 parcial).
- 📋 **Resíduo técnico ativo (não-bloqueante):** webhook Ensinaja conta 4 continua acumulando ~10 pending/dia. Catalogado em backlog (decisão de quando desconectar webhook ou marcar pending failed).

---

## §1 — Supabase legado (`gqhdspayjtiijcqklbys`)

### O que foi auditado
Sonda direta via Management API (Q17 Fase 2):
```bash
curl -X POST "https://api.supabase.com/v1/projects/gqhdspayjtiijcqklbys/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT current_database(), current_user, version();"}'
```

### Resultado
```json
{"message": "Resource has been removed"}
```

### Conclusão
- ✅ Projeto legado **removido** do Supabase
- ✅ Drift de **escrita dupla descartado** — projeto não existe mais como recurso ativo
- ⚠️ MCP do Claude Code (`~/.claude.json`) ainda referencia o `project_ref` legado → daí erro `"Resource has been removed"` em qualquer query MCP. **D2 mantém-se válido, mas escopo reduzido a "fix simples no config do agente"**, não risco de exfiltração de dados.

**Remediation D2 (devops-only):** alterar `~/.claude.json` → `project_ref: "uqpwmygaktkgbknhmknx"`. ETA: 5 min. Não bloqueia brownfield (workaround: Management API direto via curl, usado em toda Fase 2).

---

## §2 — Tabelas legadas no DB ativo

### O que foi auditado
```sql
-- Q20 Fase 2
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name NOT LIKE 'zenya_%'
ORDER BY table_name;

-- Q21 Fase 2
SELECT schema_name FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
ORDER BY schema_name;
```

### Resultado
- **Q20:** `[]` — zero tabelas non-zenya_* no schema public
- **Q21:** Apenas schemas defaults Supabase (`auth`, `extensions`, `graphql`, `graphql_public`, `pgbouncer`, `public`, `realtime`, `storage`, `vault`)

### Conclusão
✅ **Sem drift.** Não há `n8n_historico_mensagens`, `zenya_clients`, `zenya_conversations`, ou qualquer outra tabela legacy no projeto ativo. Schema público é 100% Zenya nativo.

---

## §3 — `organs/zenya/` (no repo + na VPS)

### O que foi auditado

**Repo (local):**
```bash
ls organs/
# zenya/  (com tsconfig.json, src/, node_modules/, dist/)
```

**VPS:**
```bash
ssh sparkle-vps 'ls -la /root/SparkleOS/organs/'
# total 12
# drwxr-xr-x 6 root root 4096 Apr 21 13:53 zenya
```

**Processo PM2 (`pm2 describe zenya-api`):**
- script path: `/root/SparkleOS/organs/zenya/dist/server.js`
- exec cwd: `/root/SparkleOS/organs/zenya`
- status: online, uptime 5 dias, restarts 1 (estável)
- created at: 2026-04-20 06:58 UTC

**Nginx:**
```nginx
# /etc/nginx/sites-enabled/zenya-api
server {
    listen 80;
    server_name zenya.sparkleai.tech;
    location / { proxy_pass http://127.0.0.1:3005; ... }
}
```

**Código `organs/zenya/src/index.ts`:**
```typescript
app.use('/cockpit/*', cors({ origin: ALLOWED_ORIGINS or *.vercel.app }));
app.route('/health', healthRouter);
app.route('/flows', flowsRouter);
app.route('/clients', clientsRouter);
app.route('/cockpit', cockpitRouter);  // GET /cockpit/conversations + /cockpit/metrics
```

### Conclusão

⚠️ **DRIFT DE DOCUMENTAÇÃO P0 — Cap. 1 (Aria) precisa correção:**

- `organs/zenya/` **NÃO é dead code** como Cap. 1 afirma (§9.3 lista entre coisas que "nunca existiram em produção" — incorreto).
- **É um serviço ATIVO** que hospeda **Cockpit Cliente Zenya — Epic 10** parcialmente implementado.
- Endpoints **funcionais hoje:**
  - `GET /health` — health check (n8n + Chatwoot + Postgres)
  - `GET /cockpit/conversations` — lista conversações do tenant autenticado
  - `GET /cockpit/metrics` — total + hoje conversações
- Endpoint **provavelmente quebrado:**
  - `POST /clients` — faz query em `zenya_clients` que **não existe** no DB ativo (vai dar erro de tabela inexistente em runtime)
- Endpoint **dependente do n8n:**
  - `GET /flows` — depende do processo n8n (que está rodando)

### Recomendação Aria (Fase 4)

Atualizar Cap. 1 §9.3 e §10:
- **Não** marcar `organs/zenya/` como deprecated
- Reclassificar Epic 10 (Cockpit) de "Draft" para "**InProgress (parcial)**"
- Documentar `organs/zenya/` como **segundo serviço HTTP** do projeto Zenya, distinto do `packages/zenya/` (webhook)
- NUCLEUS-CONTRACT.md continua **deprecated** (descrevia design abandonado), MAS a tabela "API Interna v1.0.0" do NUCLEUS-CONTRACT corresponde **literalmente** às rotas atuais do `organs/zenya/` — provavelmente o design de 2026-04-11 evoluiu organicamente em vez de ser abandonado. Reescrever NUCLEUS-CONTRACT v2 ao invés de deprecate seria mais honesto.

---

## §4 — n8n na VPS

### O que foi auditado
```bash
ssh sparkle-vps 'pgrep -af n8n | head -10'
```

### Resultado
```
1412305 node /usr/local/bin/n8n
1412521 node ... @n8n+task-runner ... start.js
3139757 postgres: UoMoFuuaMGHc348M n8n 10.0.2.3(34786) idle
```

### Conclusão
✅ n8n **vivo e ativo** na VPS. Processo principal + task-runner + 1 conexão Postgres dedicada (IP interno `10.0.2.3`).

**Necessário pra:** Ensinaja (último tenant em n8n por design), provavelmente outros workflows internos legados.

**⚠️ Risco:** n8n pode estar processando webhooks da conta Chatwoot 4 (Ensinaja) **em paralelo** com o core. Se sim, comportamento é não-determinístico — depende de qual processa primeiro. Validar se Chatwoot conta 4 manda webhook pra **2 destinos** (core + n8n) ou só pra core (que está acumulando 581 pending). Pergunta E-1.

---

## §5 — Webhook drift Chatwoot conta 4 (Ensinaja) — P0 CRÍTICO

### O que foi auditado
```sql
SELECT phone_number, payload->>'message_type' AS type,
       payload->'sender'->>'name' AS sender_name,
       payload->'account'->>'name' AS account_name,
       created_at
FROM zenya_queue
WHERE tenant_id='4' AND status='pending'
ORDER BY created_at DESC LIMIT 3;
```

### Resultado
```json
[
  {"phone_number":"+5512988116906","type":"incoming","sender_name":"jesus está cuidando 😞🙏","account_name":"Ensinaja - Douglas","created_at":"2026-04-25 14:50:43..."},
  {"phone_number":"+5512996087976","type":"incoming","sender_name":"Maik Oliveira","account_name":"Ensinaja - Douglas","created_at":"2026-04-25 14:49:11..."},
  {"phone_number":"+5512996087976","type":"incoming","sender_name":"Maik Oliveira","account_name":"Ensinaja - Douglas","created_at":"2026-04-25 14:48:33..."}
]
```

### Conclusão
🔴 **DRIFT CRÍTICO — INCIDENTE EM PRODUÇÃO HOJE.**

- Conta Chatwoot 4 = **"Ensinaja - Douglas"** está enviando webhooks pra `api.sparkleai.tech/webhook/chatwoot`
- O `webhook.ts` recebe → `enqueue()` (status=pending) → `loadTenantByAccountId('4')` falha porque **não há tenant para account 4** no `zenya_tenants`
- Erro vai pro `console.error` do void async catch (linha 268 webhook.ts), mensagem fica **`pending` pra sempre**
- **581 mensagens** vazaram desde 2026-04-16 — **9 dias de tráfego de cliente real do Ensinaja em limbo**
- **Tráfego AINDA chegando em 2026-04-25 14:50** (último log, há minutos da execução deste audit)
- Hipóteses sobre o que está atendendo o cliente Ensinaja:
  - **n8n** (que está vivo na VPS) provavelmente atende em paralelo se Chatwoot conta 4 envia webhook tb pra `n8n.sparkleai.tech/webhook/...`
  - **Ninguém** se Chatwoot conta 4 só envia pro core. Cliente do Ensinaja está sendo **ignorado** há 9 dias

### Bloqueio Fase 7
**APPROVED gate exige resolução deste incidente.** Decisão Mauro/devops:
1. **Cutover Ensinaja já estava em curso?** Seedar tenant + prompt + drenar fila pending
2. **Webhook configurado errado por engano?** Devops corrige no Chatwoot conta 4 → reverter pra n8n
3. **Híbrido?** Ensinaja tem webhook duplo (core + n8n) por algum motivo (test parallel)? Limpar

→ Pergunta **E-1** no handoff de retorno (P0).

---

## §6 — HL Importados sem tráfego (cutover supostamente OK)

### O que foi auditado
```sql
-- Q22, Q23, Q29 Fase 2
SELECT COUNT(*) FROM zenya_conversation_history
WHERE tenant_id IN (SELECT id::text FROM zenya_tenants WHERE chatwoot_account_id='6');
-- 0

SELECT COUNT(*) FROM zenya_queue WHERE tenant_id='6';
-- 0
```

### Resultado
- `zenya_conversation_history` tenant_id correspondente a HL: **0 mensagens**
- `zenya_queue` tenant_id='6': **0 mensagens** (nem pending nem done nem failed)

### Conclusão
🔴 **Drift suspeito P0** — HL Importados deveria estar em produção desde "cutover 2026-04-22 23h" (briefing §9), mas core nunca recebeu webhook nenhum dessa conta.

Hipóteses:
1. **Z-API HL despareada** após "instabilidade Z-API observada" pós-cutover (memória `project_tenant_roster.md`) e **nunca re-pareada**
2. **Webhook Chatwoot conta 6 não aponta pra `api.sparkleai.tech`** (config drift, possivelmente apontando pra `zenya.sparkleai.tech` pelo histórico — onde organs/zenya não tem `/webhook/chatwoot`)
3. **Hiago não está mandando mensagens** — bot operacional mas cliente não engaja
4. **Z-API ainda apontando pra n8n** — webhook config errado

→ Pergunta **E-2** no handoff de retorno (P0).

---

## §7 — PLAKA sem tráfego (provável esperado)

### O que foi auditado
Mesmas queries que §6 — PLAKA também tem 0 mensagens em tudo.

### Conclusão
⚠️ Drift **provavelmente esperado** — memória `project_plaka.md` (referência rápida do MEMORY.md) indica conta bloqueada, em onboarding com número novo. Briefing §9 cita PLAKA "Produção" mas pode ser estado intencional sem tráfego ainda.

→ Pergunta **E-3** (não-bloqueante).

---

## §8 — DNS / reverse proxy

### O que foi auditado
```bash
ssh sparkle-vps 'ls /etc/nginx/sites-enabled/ && cat /etc/nginx/sites-enabled/*'
```

### Resultado mapeado

| Hostname | Backend (proxy_pass) | Notas |
|----------|----------------------|-------|
| `api.sparkleai.tech` | (não no audit — implícito :3004) | **Webhook do core** Zenya. Confirmar com Mauro qual conf nginx |
| `zenya.sparkleai.tech` | `127.0.0.1:3005` (zenya-api) | **Cockpit Cliente Zenya** + APIs `/flows`, `/clients` |
| `runtime.sparkleai.tech` | `127.0.0.1:8001` | **Desconhecido** — investigar |
| `portal.sparkleai.tech` | `127.0.0.1:3001` | **Desconhecido** — investigar |
| `n8n.sparkleai.tech` | (não está no nginx ativo) | n8n está vivo (port 5678 default) mas sem proxy nginx visível — pode ter outro arquivo de config (ex: `/etc/nginx/conf.d/`) ou estar exposto via outro mecanismo |

### Conclusão
- 4 hostnames `*.sparkleai.tech` mapeados
- 2 desconhecidos (`runtime` e `portal`) — **fora do escopo do brownfield**, mas catalogar
- **Não foi possível confirmar** se há proxy `n8n.sparkleai.tech` (se sim, pode estar em outro arquivo nginx)

→ Pergunta **E-5** (não-bloqueante; relevante pra escopo do brownfield).

---

## §9 — Cron órfãos

### Resultado
```
=== Crontab root ===
# Sparkle crons removidos

=== Cron daily/hourly ===
/etc/cron.daily: apport apt-compat dpkg logrotate man-db sysstat
/etc/cron.hourly: (vazio)
```

### Conclusão
✅ **Sem drift.** Crontab root explicitamente limpo (comentário "Sparkle crons removidos"). Cron.daily só com pacotes Debian default. Cron.hourly vazio.

---

## §10 — Env vars VPS vs `.env.example`

### O que foi auditado
```bash
ssh sparkle-vps 'cd /root/SparkleOS/packages/zenya && grep -oE "^[A-Z_]+" .env | sort -u'
```

### Resultado (shape only — sem valores)
```
CHATWOOT_API_TOKEN, CHATWOOT_BASE_URL, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID,
GOOGLE_CLIENT_ID, NUVEMSHOP_ACCESS_TOKEN, NUVEMSHOP_USER_ID, OPENAI_API_KEY,
PLAKA_ADMIN_CONTACTS, PLAKA_ADMIN_PHONES, PLAKA_ALLOWED_PHONES, PLAKA_CHATWOOT_ACCOUNT_ID,
PLAKA_KB_RANGES, PLAKA_KB_SPREADSHEET_ID, PLAKA_SHEETS_SA_PATH,
SUPABASE_PAT, SUPABASE_PROJECT_REF, SUPABASE_SERVICE_KEY, SUPABASE_URL,
ZENYA_DEBOUNCE_MS, ZENYA_MASTER_KEY, ZENYA_PORT
```

### Conclusão

⚠️ **Drift de documentação P2.** `.env.example` (29 linhas) documenta apenas:
- ZENYA_PORT, SUPABASE_URL, SUPABASE_SERVICE_KEY, ZENYA_MASTER_KEY, OPENAI_API_KEY, CHATWOOT_BASE_URL, CHATWOOT_API_TOKEN, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

VPS tem (entre outras):
- `SUPABASE_PAT`, `SUPABASE_PROJECT_REF` — usados em scripts/operação
- `ZENYA_DEBOUNCE_MS` — referenciado em código (`webhook.ts`)
- `NUVEMSHOP_*` (2 vars) — provavelmente para `chat-plaka-local.mjs` ou similar (sem ler de DB)
- `PLAKA_*` (6 vars) — para `seed-plaka-tenant.mjs` rodar
- `PLAKA_SHEETS_SA_PATH` — **importante**: aponta pra arquivo JSON local com Service Account do Sheets KB

**Atenção sensível:** `PLAKA_SHEETS_SA_PATH` indica há **arquivo de credencial em filesystem da VPS** (não em `zenya_tenant_credentials`). Pra Mauro decidir — convém migrar pro padrão criptografado do banco?

**Remediation P2:** atualizar `.env.example` com todas as vars necessárias. Categorizar: CORE, OPCIONAL, POR-TENANT-SEED.

---

## §11 — PM2 processos

### Resultado
| Process | Script | Uptime | Mem | Restarts |
|---------|--------|--------|-----|----------|
| `zenya-webhook` (id 0) | `packages/zenya/dist/index.js` | 2 dias | 189 MB | 42 |
| `zenya-api` (id 1) | `organs/zenya/dist/server.js` | 5 dias | 91.5 MB | 1 |

### Conclusão
- ✅ 2 processos online, mapeados
- ⚠️ **`zenya-webhook` com 42 restarts em 2 dias** (~21/dia). Sintoma de instabilidade. Possíveis causas:
  - OOM kills (max_memory_restart 512M definido, processo em 189MB — folga grande, improvável)
  - Erros não-tratados que crashem o processo
  - Manual restarts (cada deploy = `pm2 reload`, mas reload != restart)
- **Catalogar como achado P1 a investigar:** `pm2 logs zenya-webhook --lines 200 --err` pra ver causa de restart

---

## §12 — `tenant_id` polissemia (D-G — confirmado P0)

### Evidência
- `zenya_tenants.id` = UUID
- `zenya_tenant_credentials.tenant_id` = UUID + FK pra zenya_tenants(id)
- `zenya_tenant_kb_entries.tenant_id` = UUID + FK pra zenya_tenants(id)
- `zenya_client_users.tenant_id` = UUID + FK pra zenya_tenants(id)
- `zenya_conversation_history.tenant_id` = **TEXT** (mas armazena UUID — sem FK)
- `zenya_queue.tenant_id` = **TEXT** (armazena chatwoot_account_id como string)
- `zenya_session_lock.tenant_id` = **TEXT** (armazena chatwoot_account_id como string)

### Como detectei
Q10 e Q15 da bateria 2 falharam com `ERROR: 42883: operator does not exist: uuid = text` ao tentar `JOIN zenya_conversation_history h JOIN zenya_tenants t ON t.id = h.tenant_id`. Tive que usar `::text` cast pra unir.

### Impacto operacional
- Agente novo lê schema, vê `zenya_queue.tenant_id` e assume "vai ser UUID do tenant". **Errado** — é o `chatwoot_account_id`.
- Foreign keys impossíveis nas tabelas TEXT (sem garantia referencial).
- Queries que cruzam queue/lock com tenants exigem cast ou interpretação cuidadosa.

### Refactor proposto (Story Epic 18 — wave maior)

**Opção A — Renomear nas tabelas onde semântica é diferente:**
```sql
ALTER TABLE zenya_queue RENAME COLUMN tenant_id TO chatwoot_account_id;
ALTER TABLE zenya_session_lock RENAME COLUMN tenant_id TO chatwoot_account_id;
-- zenya_conversation_history.tenant_id continua TEXT (é UUID-as-text), mas adicionar FK
ALTER TABLE zenya_conversation_history
  ADD CONSTRAINT zenya_conversation_history_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES zenya_tenants(id);  -- vai falhar — UUID vs TEXT
```

**Opção B — Converter tudo para UUID consistente:**
```sql
ALTER TABLE zenya_queue
  ADD COLUMN tenant_uuid UUID;
UPDATE zenya_queue q
  SET tenant_uuid = (SELECT id FROM zenya_tenants WHERE chatwoot_account_id = q.tenant_id);
ALTER TABLE zenya_queue DROP COLUMN tenant_id;
ALTER TABLE zenya_queue RENAME COLUMN tenant_uuid TO tenant_id;
ALTER TABLE zenya_queue ADD CONSTRAINT ... FOREIGN KEY (tenant_id) REFERENCES zenya_tenants(id);
-- (E ajustar webhook.ts pra fazer lookup do UUID antes de enqueue)
```

**Recomendação Aria/PM:** Opção A é mais segura (rename + comments) e preserva semântica histórica. Opção B é mais elegante mas exige refactor de código grande (webhook.ts, lock.ts, queue.ts) + zero-downtime migration. **Decisão de Aria/Morgan na Fase 8/10.**

---

## Resumo final — bloqueios para Fase 7

Para o QA Gate (Quinn — Fase 7) marcar **APPROVED**:

### Decisões Mauro pendentes (bloqueantes)
1. **E-1 (P0):** Webhook conta 4 (Ensinaja) — drenar/seedar/redirect? Incidente em produção
2. **E-2 (P0):** HL Importados — Z-API/webhook funcionando?

### Não-bloqueantes para Fase 7 (mas relevantes Fase 4/8/10)
3. E-3 a E-8 (perguntas em §13 do Cap. 2)
4. Migração 008 retroativa (D-B + D-F)
5. Refactor `tenant_id` polissemia (Opção A vs B — Aria + PM)

### Não-bloqueantes (P2 / cosméticos)
- D-K (`updated_at` sem trigger)
- D-I (`loja-integrada` vs `loja_integrada` naming)
- RLS em `zenya_tenant_kb_entries`
- `.env.example` desatualizado

---

*Runtime Drift Audit — Brownfield Zenya, Fase 2 (Schema & Data Discovery), 2026-04-25.*
*Próxima revisão: ao fim da Fase 4 (Aria consolida em technical-debt-DRAFT.md).*
