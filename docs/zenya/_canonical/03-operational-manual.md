# Capítulo 3 — Operational Manual

**Versão:** 1.0 (Brownfield Discovery Fase 8)
**Autor:** `@architect` Aria
**Data:** 2026-04-25
**Pergunta-mãe:** *"Como faço X?"* — qualquer operação técnica recorrente no core Zenya.

> **Promove:** `docs/zenya/RUNBOOK.md` (§1-7) + `docs/zenya/TENANT-PLAYBOOK.md` (§9-10) + adiciona seção §0 (setup local) e §11 (cross-tenant operations) que faltavam.
>
> **Estrutura de cada operação:** **Gatilho · Pré-requisitos · Passo a passo (comandos exatos) · Validação · Anti-pattern · Quem faz**.

---

## §0 — Setup local primeira vez (gap fechado)

**Gatilho:** novo `@dev` ou contribuidor entra no projeto.

**Pré-requisitos:**
- Node.js 22+ (mesma versão do PM2 prod — `pm2 describe zenya-api` mostra `node.js version 22.22.2`)
- Git
- Acesso ao repo (clone OK)
- `.env` válido (pedir pra Mauro ou copiar de outra máquina; nunca commitar)

**Passo a passo:**

```bash
# 1. Clonar o repo
git clone https://github.com/mauromattos-lab/SparkleOS.git
cd SparkleOS

# 2. Configurar .env do core Zenya
cp packages/zenya/.env.example packages/zenya/.env
# Editar packages/zenya/.env preenchendo (peça as keys reais ao Mauro):
#   SUPABASE_URL=https://uqpwmygaktkgbknhmknx.supabase.co
#   SUPABASE_SERVICE_KEY=eyJ... (service role key)
#   ZENYA_MASTER_KEY=64-hex-chars
#   OPENAI_API_KEY=sk-proj-...
#   CHATWOOT_BASE_URL=https://chatwoot.sparkleai.tech
#   CHATWOOT_API_TOKEN=...
#   ELEVENLABS_API_KEY=sk_...
#   ELEVENLABS_VOICE_ID=...
#   GOOGLE_CLIENT_ID=...
#   GOOGLE_CLIENT_SECRET=...

# 3. Instalar dependências do core
cd packages/zenya
npm install

# 4. Subir o webhook em modo dev (auto-reload)
npm run dev
# Esperado: "[zenya] Webhook server running on port 3004"
#           "[agente-off-cleanup] Started — checks every hour..."

# 5. Validar que o servidor respondeu
curl http://localhost:3004/zenya/health
# Esperado: { "ok": true, "service": "zenya", ... }
```

**Validação:**
- `/zenya/health` retorna `200 ok:true`
- Logs não mostram erros vermelhos
- Conseguir rodar suite de testes: `npm test` → 100% pass

**Anti-pattern:**
- ❌ Rodar `npm run dev` sem ter copiado `.env` — fail-fast com `Missing required environment variables`
- ❌ Commitar `.env` (está no `.gitignore` — manter)
- ❌ Usar `SUPABASE_URL` apontando pro projeto **legado** `gqhdspayjtiijcqklbys` — esse projeto **foi removido**; sempre o ativo `uqpwmygaktkgbknhmknx`

**Quem faz:** `@dev` (qualquer dev novo entrando) — autonomamente.

---

## §1 — Atualizar prompt de tenant em produção

**Gatilho:** cliente pede ajuste no tom, correção de info, novo FAQ; ou cicatriz documentada gera v.X+1.

**Pré-requisitos:**
- Acesso SSH à VPS (`ssh sparkle-vps`)
- Tenant já existe em `zenya_tenants` (validar via Cap. 2 §11.1 query "Tenants ativos")
- `SUPABASE_PAT` no `.env` da VPS (já existe)
- Edição local do prompt já feita

**Passo a passo:**

```bash
# 1. (Local) Editar docs/zenya/tenants/{slug}/prompt.md
# Bumpar version no front-matter YAML se mudança material

# 2. (Local) Commit + push
git add docs/zenya/tenants/{slug}/prompt.md
git commit -m "feat(zenya-{slug}): atualiza prompt vN→vN+1 — {motivo}"
git push origin main  # ou via PR — @devops

# 3. (VPS) Pull + dry-run
ssh sparkle-vps
cd /root/SparkleOS && git pull
cd packages/zenya
node scripts/seed-{slug}-tenant.mjs --dry-run
# Output esperado: md5 NOVO (diferente do anterior)
# Se md5 igual → ninguém editou texto; abortar

# 4. (VPS) Validar md5 do banco vs .md (brownfield obrigatório)
PROMPT_MD5_LOCAL=$(grep -oE 'md5: [a-f0-9]+' /tmp/dry-run-output.txt | tail -1 | cut -d' ' -f2)
PROMPT_MD5_DB=$(curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d "{\"query\":\"SELECT md5(system_prompt) FROM zenya_tenants WHERE chatwoot_account_id='X';\"}")
# Se MD5 do banco DIVERGIR do .md original (não do novo) → drift; backup primeiro:
# psql ou Management API: SELECT system_prompt INTO /tmp/backup-{slug}-{ts}.txt

# 5. (VPS) Aplicar real
node scripts/seed-{slug}-tenant.mjs

# 6. Aguardar 5min (cache TTL) — não precisa pm2 reload pra prompt update
# Próxima mensagem do cliente já pega prompt novo
```

**Validação:**
- Mandar 1 mensagem de teste pelo número admin do tenant
- Resposta deve refletir mudança esperada
- `pm2 logs zenya-webhook --lines 50` sem erros

**Anti-pattern:**
- ❌ Editar `zenya_tenants.system_prompt` direto no banco sem atualizar o `.md` (drift; ADR-001 violado) — exceção: rollback emergencial seguido de PR sincronizando `.md` em ≤24h
- ❌ Hardcode de prompt em `seed-X-tenant.mjs` em vez de gray-matter `.md` (memória `zenya-tenant-prompts`)
- ❌ Pular `--dry-run` em tenant em produção (cicatriz: prompt errado em 7 tenants)
- ❌ `pm2 reload zenya-webhook` desnecessário — só pra cache rebust manual em emergência

**Quem faz:** `@dev` aplica prompt change; `@devops` se push direto na main; `@qa` valida pós-deploy se mudança material.

**Tempo:** 5-10 min.

---

## §2 — Migrar tenant do n8n pro core

**Gatilho:** cliente legado em n8n precisa migrar pro core TypeScript.

**Status atual:** apenas Ensinaja resta em n8n (estado intencional — cliente Douglas com pagamento pendente, aguarda info dele há 2 semanas; ver TD-I1 do Tech Debt). Nenhum cutover novo planejado.

**Pré-requisitos:**
- Workflow n8n exportado (JSON) salvo em `docs/zenya/{slug}-import/`
- Cliente avisado da janela de manutenção
- Backup do prompt n8n atual

**Passo a passo:**

### Fase A — Extrair e canonizar prompt
1. Exportar workflow n8n → `docs/zenya/{slug}-import/secretaria-vN.json`
2. Identificar nó principal (`Secretária vN`); copiar `systemMessage`
3. Criar `docs/zenya/tenants/{slug}/prompt.md` com front-matter YAML (ADR-001)
4. **Substituir interpolações n8n:**
   - `{{ $now.format(...) }}` → **remover** (core injeta hora Brasília automático)
   - `{{ $('Info').item.json.nome }}` → **remover** (nome do contato vem do payload Chatwoot)
5. **Aplicar princípios cross-tenant** (Cap. 5):
   - Densidade ≤2 msgs/turno (P1) — adicionar regra crítica se ausente
   - Releia histórico (P2) — adicionar com exemplo ❌/✅
   - Tom imperativo > descritivo (P3) — revisar regras críticas
   - Dupla instrução pra escalations (P5) — verificar `escalarHumano`

### Fase B — Preparar tenant no core
1. Criar `packages/zenya/scripts/seed-{slug}-tenant.mjs` copiando `seed-scar-tenant.mjs`
2. Ajustar:
   - `name` do tenant (ex: 'Ensina Já Rede de Educação')
   - Prefixo env vars (`{SLUG}_CHATWOOT_ACCOUNT_ID`, etc.)
   - Path default do prompt
   - `active_tools` necessárias
3. Se cliente tem **integração custom** (não-existente no core): implementar em `packages/zenya/src/integrations/{nome}.ts` seguindo Cap. 1 §8.2 (factory closure tenantId + lazy creds)
4. Commit + push

### Fase C — Configurar infra externa
1. **Chatwoot:**
   - Criar conta (ou usar existente) — anotar `account_id`
   - Criar inbox WhatsApp
   - Configurar labels padrão: `agente-off`, `follow-up`, `testando-agente`
   - Webhook → `https://api.sparkleai.tech/webhook/chatwoot` (event `message_created`)

> **⚠️ URL CRÍTICA:** apenas `api.sparkleai.tech/webhook/chatwoot`. **Nunca** `zenya.sparkleai.tech` — esse aponta pro `zenya-api` (Cockpit Cliente Zenya), que **não tem `/webhook/chatwoot`**. Cicatriz Doceria: 24h downtime em 2026-04-23 por URL errada (memória `feedback_verify_before_assume`).

2. **Z-API:** criar instância, parear via QR code (celular do cliente)
3. **Credenciais por tenant** (`zenya_tenant_credentials`): rodar scripts dedicados (ex: `seed-zapi-credentials.mjs`, `seed-{slug}-{service}.mjs`)

### Fase D — Executar
1. Dry-run VPS: `node scripts/seed-{slug}-tenant.mjs --dry-run`
2. Seed real: `node scripts/seed-{slug}-tenant.mjs`
3. `pm2 reload zenya-webhook` (só se foi adicionada integração nova no código)
4. Smoke test (§7)

### Fase E — Cutover e standby
1. n8n: **desativar** workflows do cliente (toggle off) **ANTES** de trocar webhook do Chatwoot — evita double-processing
2. Trocar webhook Chatwoot conta X pra `https://api.sparkleai.tech/webhook/chatwoot`
3. Monitorar `pm2 logs zenya-webhook -f` por 30 min
4. Manter workflows n8n em standby por 7 dias; deletar se estável

**Validação:**
- Mensagem de teste do número admin entra no core (ver `pm2 logs`)
- Tool calls esperadas dispararam
- Resposta chega via Chatwoot ↔ Z-API ↔ WhatsApp

**Anti-pattern:**
- ❌ Trocar webhook **antes** de desativar n8n → double-processing (cliente recebe 2 respostas)
- ❌ Pular Fase A (canonização do prompt) — perde aprendizados cross-tenant
- ❌ Webhook em `zenya.sparkleai.tech` em vez de `api.sparkleai.tech` (cicatriz Doceria 24h)
- ❌ Esquecer credencial Z-API se cliente quer label nativa "humano" no WhatsApp Business (TD-29 wishlist)

**Quem faz:** `@dev` (Fases A, B, D); `@devops` (Fase C, E); `@qa` (Fase E validação); `@architect` se integração custom (Fase B).

**Tempo:** 4-8h dependendo da complexidade das integrações.

---

## §3 — Onboarding de cliente novo (greenfield)

**Gatilho:** novo cliente fechado contrato; vai entrar no core direto (decisão Mauro 2026-04-20: novos clientes nunca mais em n8n).

**Pré-requisitos:** todos do §2 Fase B-E, **menos** Fase A (não tem n8n pra importar).

**Passo a passo:**

1. **Reunião de briefing** com cliente: pegar tom, escopo, integrações, FAQ típicos, horário de atendimento humano, política de escalação
2. **Escrever** `docs/zenya/tenants/{slug}/prompt.md` do zero seguindo Cap. 5 (template SOP) — aplicar princípios P1-P9 cross-tenant
3. **Resto:** Fase B-E do §2 (idêntico)

**Variantes por tipo de tenant** (Cap. 5 §3 detalha smoke específico):

| Tipo | Exemplo real | `active_tools` | Tempo onboarding |
|------|-------------|----------------|------------------|
| **Prompt-only** | Scar AI | `[]` | 4-6h |
| **Prompt + KB** | PLAKA (futuro) | `[nuvemshop, sheets_kb]` | 8-12h |
| **Prompt + KB + integrações** | Fun, HL, Doceria | `[loja_integrada]` etc. | 12-24h |

**Tenants atípicos:** consultar `@architect` antes de tratar como greenfield padrão.

**Quem faz:** `@pm` faz briefing; `@architect` decide arquitetura; `@dev` implementa; `@qa` valida com smoke; `@devops` deploy.

**Tempo total:** 4-24h conforme complexidade.

---

## §4 — Adicionar integração nova ao core (não-existente hoje)

**Gatilho:** tenant precisa de integração com sistema externo que ainda não existe (ex: novo CRM, ERP, plataforma de pagamento).

**Pré-requisitos:**
- API documentada (ou conta sandbox pra explorar)
- Credenciais do cliente (cliente provê)
- Decisão `@architect` se integração é "global" (cabe pro core) ou "específica" (só esse cliente)

**Passo a passo:**

```typescript
// 1. Implementar packages/zenya/src/integrations/{nome}.ts
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
        // Lazy-load creds (não no factory)
        const creds = await getCredentialJson<{Nome}Credentials>(tenantId, '{nome}');
        // ... chamar API ...
        return { /* shape conciso pra LLM */ };
      },
    }),
  };
}
```

```typescript
// 2. Registrar guard em packages/zenya/src/tenant/tool-factory.ts
if (config.active_tools.includes('{nome}')) {
  Object.assign(tools, create{Nome}Tools(tenantId));
}
```

```bash
# 3. Testes em packages/zenya/src/__tests__/{nome}.test.ts
# Mínimo: happy path + erro de API + sanitização (sem vazar campos sensíveis)

# 4. Script de seed de credencial: packages/zenya/scripts/seed-{slug}-{nome}.mjs
# Referência: seed-hl-ultracash.mjs
# CUIDADO: TD-14 — usar helper `encryptCredentialHex` em seed-common.mjs (após Wave 2 do Epic 18)
# Hoje: copiar lógica de seed-hl-ultracash.mjs

# 5. Build + deploy
ssh sparkle-vps
cd /root/SparkleOS && git pull
cd packages/zenya && npm install && npm run build
pm2 reload zenya-webhook  # OBRIGATÓRIO porque é código novo

# 6. Ativar no tenant
# UPDATE zenya_tenants SET active_tools = active_tools || '"{nome}"'::jsonb WHERE chatwoot_account_id = X;
# Cache 5min expira automaticamente
```

**Validação:**
- Test unit OK
- Smoke específico: invocar a tool no REPL local (`chat-tenant.mjs --tenant=X`) e ver log `[agent] tool=X args=... → result`
- Validar que dados sensíveis (ex: `custo_medio` UltraCash, `chave_pix`) **não** aparecem no resultado retornado pro LLM

**Anti-pattern:**
- ❌ `tenantId` em `parameters` do schema Zod — quebra isolamento (Cap. 1 §5.4 — security critical)
- ❌ Eager-load de creds no `createXTools()` — usar lazy dentro do `execute`
- ❌ Description de tool conflitando com prompt do tenant (cicatriz Fun PR #9 — Frontend Spec P4)
- ❌ Vazar campos sensíveis pro LLM (cicatriz UltraCash: `custo_medio` e `preco_compra` nunca devem chegar ao agente)

**Quem faz:** `@architect` decide e desenha; `@dev` implementa; `@qa` valida.

**Tempo:** 1-3 dias dependendo da complexidade da API externa.

---

## §5 — Adicionar integração existente a um tenant

**Gatilho:** tenant quer ativar integração que já existe no core (ex: Google Calendar pra Doceria).

**Passo a passo:**

```sql
-- Via Management API ou Supabase Studio
UPDATE zenya_tenants
SET active_tools = active_tools || '"google_calendar"'::jsonb
WHERE chatwoot_account_id = 'X';

-- Cache 5min expira automático — testa com mensagem real
```

```bash
# Se a integração precisa de credencial:
# Rodar script dedicado, ex:
ssh sparkle-vps
cd /root/SparkleOS/packages/zenya
GCAL_TENANT_ID=<uuid> GCAL_CLIENT_SECRET=... node scripts/seed-{slug}-google-calendar.mjs

# Atualizar prompt do cliente pra mencionar a capacidade nova (§1)
```

**Validação:** smoke específico pela ferramenta nova (ex: cliente pergunta "tem horário amanhã?" → bot consulta Calendar).

**Quem faz:** `@dev`.

**Tempo:** 30 min - 2h.

---

## §6 — Rodar migration no banco (VPS Supabase)

**Gatilho:** mudança de schema (nova coluna, nova tabela, alteração de FK).

**⚠️ ORDEM CRÍTICA:** rodar migration **antes** do deploy do código que usa a coluna. Coluna inexistente no SELECT do `config-loader` derruba **todos** os tenants.

**Pré-requisitos:**
- Arquivo `packages/zenya/migrations/0XX_descricao.sql` criado, idempotente (`IF NOT EXISTS`), com `COMMENT ON`
- Snapshot/backup mental do schema antes (TD-10 quando ledger funcional)

**Passo a passo:**

```bash
# OPÇÃO A — Via Management API (recomendado, funciona de qualquer lugar)
SQL=$(cat packages/zenya/migrations/0XX_xxx.sql)
curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$SQL" '{query:$q}')"

# OPÇÃO B — Via apply-migration.mjs (após TD-10 implementada — Wave 2 Epic 18)
cd packages/zenya
node scripts/apply-migration.mjs migrations/0XX_xxx.sql
# Aplica + registra automaticamente em zenya_schema_migrations com md5

# Validar
curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name FROM information_schema.columns WHERE table_name=''zenya_X'' AND column_name=''nova_coluna'';"}'

# DEPOIS de migration aplicada → deploy de código:
ssh sparkle-vps
cd /root/SparkleOS && git pull
cd packages/zenya && npm install && npm run build
pm2 reload zenya-webhook
```

**Validação:**
- Information_schema mostra coluna/tabela nova
- `pm2 logs zenya-webhook --lines 100` sem erros pós-reload
- Smoke test (§7)

**Anti-pattern:**
- ❌ Deploy código antes de migration → derruba TODOS os tenants
- ❌ Migration sem `IF NOT EXISTS` (não-idempotente — fail se rodada 2x)
- ❌ Aplicar via Supabase Studio UI (sem registro/audit) — usar Management API
- ❌ Esquecer `COMMENT ON COLUMN/TABLE` (perde rastreabilidade do "porquê")

**Quem faz:** `@data-engineer` Dara desenha + valida; `@devops` ou `@dev` aplica.

**Tempo:** 5-30 min.

---

## §7 — Smoke test pós-deploy

**Gatilho:** depois de qualquer mudança que possa afetar produção (prompt, integração, deploy de código, migration).

**Passo a passo:**

```bash
# 1. Logs sem erros
ssh sparkle-vps 'pm2 logs zenya-webhook --lines 50'
# Esperado: nenhum red-flag (Error stack, throw...)

# 2. Health check
curl https://api.sparkleai.tech/webhook/chatwoot/zenya/health  # ou
ssh sparkle-vps 'curl http://localhost:3004/zenya/health'
# Esperado: { "ok": true, ... }

# 3. Mensagem real do número admin do tenant
# Pelo seu WhatsApp pessoal, manda pro número do tenant
# Esperado: bot responde dentro de 5-15s, no padrão do tenant
```

**Cenários cross-tenant obrigatórios** (Cap. 5 §3.1 detalha):
- C1 — Cliente entrega 3 infos juntas → bot **não** repete (Princípio P2)
- C2 — Cliente pede pessoa explicitamente → bot escala (P5+P7)
- C3 — Cliente pergunta info fora do KB/prompt → bot escala (P8)
- C4 — Cliente manda áudio → bot responde áudio (P6 mirror)
- C5 — Cliente pergunta "você é robô?" → bot mantém persona (A8)
- C6 — Cliente envia 5 mensagens em 30s → bot agrega (debounce P1)
- C7 — Cliente fora do horário → bot avisa retorno

**Quem faz:** `@qa` Quinn valida; `@dev` participa se mudança técnica.

**Tempo:** 5-15 min.

---

## §8 — Aplicar/remover label `agente-off`

**Gatilho:** humano da equipe quer assumir conversa OU bot escalou e precisa reativar.

### 8.1 Aplicar (humano assume)

**Via Chatwoot UI:**
1. Abrir conversa
2. Adicionar label `agente-off`
3. Pronto — webhook ignora todas mensagens dessa conversa enquanto label estiver ativa

**Via WhatsApp Business (celular do admin):**
1. Adicionar label nativa `humano` à conversa no WhatsApp
2. Z-API sincroniza com Chatwoot → label `agente-off` aplicada automaticamente
3. **Pré-requisito:** tenant precisa ter cred Z-API seedada (hoje só Zenya Prime tem — TD-29)

**Via auto-detecção em human-reply:**
- Humano responde **direto pelo Chatwoot panel ou pelo celular do dono** (Z-API mirror)
- Webhook detecta `outgoing && !sent_by_zenya` → adiciona `agente-off` automaticamente
- Evento registrado como `escalation source = 'human-reply'`

**Guarda Story 18.23 — outgoing antes do primeiro incoming não dispara `agente-off`:**
- A regra de auto-detecção tem **uma exceção crítica**: se a `outgoing` chega numa conversa que ainda **não tem nenhum `incoming`** do cliente, `agente-off` **não é aplicada**
- Sinal usado: `payload.conversation.messages_count <= 1` (essa é a única mensagem da conversa até agora)
- Motivo: a "Mensagem de saudação automática" do **WhatsApp Business app** (configurável pelo dono do número) sai como `outgoing` automaticamente quando alguém clica num **Click-to-WhatsApp ad** (Instagram/Facebook), antes do cliente responder. Sem essa guarda, o bot silenciava o lead inteiro
- Webhook retorna `{ ok: true, skipped: true, reason: 'outgoing_before_first_incoming' }` e log `[zenya] outgoing_before_first_incoming — conv=… messages_count=…`
- Edge case: se Chatwoot legado **não** envia `messages_count`, fallback é a regra antiga (aplica `agente-off`). Chatwoot v3+ envia o campo consistentemente

### 8.2 Remover (bot volta a atender)

**Manual (Chatwoot):** remover label `agente-off`. Cache imediato — próxima mensagem o bot pega.

**Auto-cleanup 72h:** se conversa não teve mensagem de agente nos últimos 72h, label removida automaticamente pelo worker `agente-off-cleanup.ts`. Janela 72h é fixa cross-tenant (decisão Mauro 2026-04-25); muda conforme demanda no onboarding (TD futuro — ainda não implementado).

**Anti-pattern:**
- ❌ Aplicar label e nunca tirar — conversas ficam órfãs (auto-cleanup mitiga em 72h)
- ❌ Remover label durante atendimento ativo do humano — bot volta e atrapalha (Z-API confunde-se)

**Quem faz:** atendente humano.

**Tempo:** instantâneo.

---

## §9 — Rollback de emergência de prompt

**Gatilho:** acabou de subir prompt novo + deu regressão visível em produção.

### Opção A — Via Git (recomendado, reversível)

```bash
# Localizar commit anterior
git log --oneline docs/zenya/tenants/{slug}/prompt.md

# Reverter só esse arquivo
git checkout {commit_anterior} -- docs/zenya/tenants/{slug}/prompt.md

# Commit + push
git commit -m "revert(zenya-{slug}): rollback prompt pra {commit}"
git push origin main

# Aplicar (mesmo fluxo do §1)
ssh sparkle-vps
cd /root/SparkleOS && git pull
cd packages/zenya && node scripts/seed-{slug}-tenant.mjs
# Cache 5min expira automático — bot volta ao comportamento antigo
```

### Opção B — SQL direto (mais rápido, menos auditável)

```bash
# Se tiver backup pré-mudança (.ai/backups/{slug}-system_prompt-YYYYMMDD-HHMM.sql)
SQL=$(cat .ai/backups/{slug}-system_prompt-*.sql)
curl -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$SQL" '{query:$q}')"

# OBRIGATÓRIO pós-rollback SQL: sincronizar .md em ≤24h via PR
# Senão repo diverge do banco (drift permanente)
```

**Validação:** §7 smoke imediato.

**Quem faz:** `@dev` em emergência; `@devops` se push direto na main.

**Tempo:** 5 min (Opção A) ou 2 min (Opção B).

---

## §10 — Debugar "bot não respondeu"

**Gatilho:** dono ou cliente reporta que enviou mensagem e bot não respondeu.

**Fluxo de diagnóstico** (em ordem):

```bash
# 1. Logs em tempo real
ssh sparkle-vps 'pm2 logs zenya-webhook --lines 200'
# Procurar: erro com nome do tenant ou phone do cliente

# 2. Verificar fila pendente do cliente
PHONE="+5511999..."
ACCOUNT="3"  # chatwoot_account_id
curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d "{\"query\":\"SELECT message_id, status, created_at FROM zenya_queue WHERE tenant_id='$ACCOUNT' AND phone_number='$PHONE' ORDER BY created_at DESC LIMIT 10;\"}"

# Status possíveis:
# - 'pending' há mais que 5min → travou (queue leak TD-02 OU lock órfão TD-06)
# - 'failed' → erro no agente (ver logs do timestamp)
# - 'done' → bot processou; problema é Chatwoot/Z-API (passo 4)

# 3. Verificar lock órfão
curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d "{\"query\":\"SELECT * FROM zenya_session_lock WHERE tenant_id='$ACCOUNT' AND phone_number='$PHONE';\"}"

# Se lock há mais que 5min:
curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d "{\"query\":\"DELETE FROM zenya_session_lock WHERE tenant_id='$ACCOUNT' AND phone_number='$PHONE';\"}"

# 4. Verificar label agente-off na conversa (Chatwoot UI ou via API)
# Se label aplicada → bot está silenciado intencionalmente; humano precisa atender ou remover label
#
# 4a. Comando `/reset` — comportamento por modo (Story 18.2):
# - Test mode (allowed_phones populado + número admin na lista):
#     /reset limpa histórico de memória + REMOVE label `agente-off` automaticamente
#     + responde com mensagem variant baseada no outcome:
#       • Label removida: "🔄 Memória zerada + bot reativado. Nova conversa!"
#       • Label já ausente: "🔄 Memória zerada. Nova conversa!"
#       • Chatwoot falhou: "🔄 Memória zerada. Se o bot não responder, peça pro admin remover 'agente-off'."
#     Permite cliente em teste (Gustavo/Ryan/etc.) destravar conversa SEM acesso ao Chatwoot.
# - Production mode (allowed_phones vazio):
#     /reset NÃO tem tratamento especial — bot trata como mensagem qualquer (responde via prompt).
#     Decisão deliberada: evita porta de abuse onde clientes em prod descobririam comando pra forçar re-engajamento.

# 5. Verificar test mode
curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d "{\"query\":\"SELECT name, allowed_phones FROM zenya_tenants WHERE chatwoot_account_id='$ACCOUNT';\"}"
# Se allowed_phones populado e PHONE não está na lista → bot ignorou intencionalmente (test mode)

# 6. Validar conversa real chegou no Chatwoot
# Chatwoot UI → conta correta → conversa do phone
# Se mensagem está no Chatwoot mas zenya_queue está vazio → webhook não chegou
# → checar Chatwoot Settings > Integrations > Webhooks (URL deve ser api.sparkleai.tech/webhook/chatwoot)

# 7. Validar resposta voltou pro cliente
# Se zenya_queue está 'done' mas cliente não recebeu → problema Z-API
# → checar painel Z-API se instância está conectada
```

**Anti-pattern:**
- ❌ Reiniciar PM2 sem investigar (`pm2 restart zenya-webhook`) — apaga lock + perde state da queue, mascarando o problema raiz
- ❌ Deletar mensagens da queue sem investigar — perde audit trail
- ❌ Inventar URL de webhook (cicatriz Doceria — sempre `api.sparkleai.tech`)

### Path: "validar tenant antes de enqueue" (Story 18.5 / Fix 1)

**Sintoma:** webhook retorna `400 {error: 'unknown_tenant', accountId: <X>}` e mensagem do cliente nunca aparece em `zenya_queue`.

**Diagnóstico:** o `account_id` do payload Chatwoot não corresponde a nenhum registro em `zenya_tenants` (lookup falhou em `loadTenantByAccountId`). Story 18.5 valida o tenant ANTES de `enqueue` para evitar mensagens órfãs em `pending` (era 66% do leak histórico — TD-02).

**Ação:**

```bash
# 1. Confirmar account_id que falhou nos logs
ssh sparkle-vps 'pm2 logs zenya-webhook --lines 500 | grep "No tenant for account_id"'
# Procurar: [zenya] No tenant for account_id=X — webhook rejected

# 2. Verificar se tenant existe
curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d "{\"query\":\"SELECT id, name, chatwoot_account_id FROM zenya_tenants WHERE chatwoot_account_id='X';\"}"

# 3a. Se tenant existe mas account_id está errado na config Chatwoot:
#     → corrigir o accountId no Chatwoot Settings > Integrations > Webhooks
# 3b. Se tenant não existe:
#     → seed do tenant (scripts/seed-{tenant}-tenant.mjs) ou criar registro
```

**Log a procurar:** `[zenya] No tenant for account_id=X — webhook rejected: <erro>`.

**Quem faz:** `@dev` Dex investiga; `@devops` se for config Chatwoot.

---

**Quem faz:** `@dev` Dex investiga; `@devops` se infra (Z-API, nginx, VPS); `@qa` Quinn se padrão repetitivo (vira issue).

**Tempo:** 5-30 min.

---

## §11 — Cross-tenant operations (gap fechado)

> Operações que afetam **múltiplos tenants** simultaneamente. **Maior cuidado** — erro derruba toda produção.

### 11.1 Deploy de código novo

```bash
# Qualquer mudança em packages/zenya/src/* afeta todos os tenants
ssh sparkle-vps
cd /root/SparkleOS && git pull
cd packages/zenya && npm install && npm run build

# A partir de Story 18.4, há 2 apps PM2:
#   1. zenya-webhook   — recebe Chatwoot webhooks, processa mensagens, fala com LLM
#   2. zenya-kb-sync   — sincroniza Google Sheets → zenya_tenant_kb_entries (15min loop)
# Apps são independentes: falha em um não derruba o outro.

pm2 reload zenya-webhook   # reload graceful do webhook
pm2 reload zenya-kb-sync   # reload graceful do worker KB sync (se .env ou run-kb-sync.mjs mudou)

# OU reload ambos via ecosystem (zero-downtime para os 2):
pm2 reload ecosystem.config.cjs

# Validação cross-tenant: §7 smoke em pelo menos 2-3 tenants ativos
# Validação KB sync: pm2 logs zenya-kb-sync --lines 30 (ciclo a cada 15min)
```

### 11.1.5 Operações específicas zenya-kb-sync (Story 18.4)

```bash
# Verificar status
pm2 list | grep zenya-kb-sync   # deve estar online, restarts <5, memória <256M

# Logs
pm2 logs zenya-kb-sync --lines 50   # últimos sync ciclos

# Sync ad-hoc (debug, sem PM2)
ssh sparkle-vps
cd /root/SparkleOS/packages/zenya
node scripts/run-kb-sync.mjs --once                 # 1 ciclo todos tenants
node scripts/run-kb-sync.mjs --tenant=<uuid>        # 1 tenant específico

# Validar último sync no banco
SELECT MAX(last_synced_at) AS last_sync, NOW() - MAX(last_synced_at) AS age
FROM zenya_tenant_kb_entries;
# Esperado: age < 16 minutos. Se >30min, worker provavelmente parou — check logs.

# Restart manual se ciclo travou (raro)
pm2 restart zenya-kb-sync
```

**Quem precisa Sheets sync ativo:** tenants com credencial `sheets_kb` em `zenya_tenant_credentials`. Hoje: PLAKA. Outros tenants podem ser adicionados sem código novo (basta cadastrar credencial — worker pega no próximo ciclo).

### 11.2 Mudança em pattern compartilhado (factory tools, prompt base, agente)

Mais arriscado — pode quebrar comportamento sem aviso.

**Protocolo:**
1. PR review obrigatório (não solo)
2. Smoke local em **N tenants representativos** (mínimo: 1 prompt-only + 1 com KB + 1 com integração custom) via `chat-tenant.mjs --tenant=X`
3. Deploy fora de horário comercial (mín. 22h-08h)
4. Monitor `pm2 logs -f` por 30min pós-deploy
5. Rollback plan pronto: `git revert` + reload

### 11.3 Migration que altera tabela compartilhada

```bash
# Coluna nova em zenya_tenants afeta TODOS os tenants
# Coluna nova em zenya_conversation_history afeta TODOS

# Protocolo zero-downtime (Expand-Contract):
# 1. Migration ADD COLUMN com DEFAULT (nada quebra)
# 2. Deploy código que LÊ nova coluna (com fallback pro default)
# 3. Backfill se necessário
# 4. Deploy código que requer nova coluna NOT NULL
# 5. Migration NOT NULL constraint (se aplicável)

# Detalhado: Cap. 2 §3.1 (Migration 008 retroativa é exemplo) + DB Specialist Review §4 (TD-03 plano)
```

### 11.4 Sanity check periódico

Recomendação: rodar `*health-check` toda 2ª feira de manhã.

```bash
# Tenants ativos
SELECT id, name, chatwoot_account_id, jsonb_array_length(active_tools) AS tools, array_length(allowed_phones,1) AS test_phones FROM zenya_tenants ORDER BY chatwoot_account_id;

# Volume última semana
SELECT t.name, COUNT(*) AS msgs FROM zenya_conversation_history h JOIN zenya_tenants t ON t.id::text=h.tenant_id WHERE h.created_at > NOW()-INTERVAL '7 days' GROUP BY t.name ORDER BY msgs DESC;

# Queue stats
SELECT status, COUNT(*) FROM zenya_queue GROUP BY status;

# Locks órfãos
SELECT * FROM zenya_session_lock WHERE locked_at < NOW()-INTERVAL '5 min';

# KB sync (PLAKA)
SELECT MAX(last_synced_at), NOW()-MAX(last_synced_at) AS staleness FROM zenya_tenant_kb_entries;
```

**Quem faz:** `@architect` ou `@data-engineer` cross-tenant ops; `@devops` deploy; `@pm` se decisão de produto envolvida.

---

## §12 — Catálogo de queries operacionais (apêndice)

> Promovido de Cap. 2 §11 — referência rápida em 1 lugar.

### Diagnóstico

```sql
-- Tenants ativos resumo
SELECT id, name, chatwoot_account_id,
       jsonb_array_length(active_tools) AS tools_count,
       array_length(allowed_phones,1) AS test_phones,
       array_length(admin_phones,1) AS admin_count,
       escalation_public_summary
FROM zenya_tenants ORDER BY chatwoot_account_id;

-- Mensagens últimos 7 dias (CUIDADO: cast UUID→TEXT por causa de TD-03 polissemia)
SELECT t.name, COUNT(*) AS msgs_7d, COUNT(DISTINCT phone_number) AS phones,
       MAX(h.created_at) AS last_msg
FROM zenya_conversation_history h
JOIN zenya_tenants t ON t.id::text = h.tenant_id
WHERE h.created_at > NOW() - INTERVAL '7 days'
GROUP BY t.name ORDER BY msgs_7d DESC;

-- Queue stats por tenant (CUIDADO: aqui tenant_id = chatwoot_account_id pelo TD-03)
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

-- Locks órfãos (>5min)
SELECT tenant_id AS chatwoot_account_id, phone_number, locked_at,
       NOW() - locked_at AS age
FROM zenya_session_lock
WHERE locked_at < NOW() - INTERVAL '5 minutes';

-- Pending mais antigos (top 20)
SELECT tenant_id AS chatwoot_account_id, phone_number, message_id, created_at,
       NOW() - created_at AS age,
       payload->'account'->>'name' AS account_name
FROM zenya_queue WHERE status='pending'
ORDER BY created_at LIMIT 20;
```

### Cleanup operacional (com cuidado — exigem GO Mauro)

```sql
-- ⚠️ Limpar locks órfãos (seguro, idempotente)
DELETE FROM zenya_session_lock WHERE locked_at < NOW() - INTERVAL '5 minutes';

-- ⚠️ Marcar pending velhos como failed (especificar tenant — nunca rodar cego)
UPDATE zenya_queue SET status='failed', updated_at=NOW()
WHERE status='pending'
  AND created_at < NOW() - INTERVAL '24 hours'
  AND tenant_id = 'X'  -- chatwoot_account_id
  RETURNING id;
```

---

*Capítulo 3 (Operational Manual) — Brownfield Zenya Fase 8 — 2026-04-25.*
*Resolve Q-01 do QA Gate. 12 operações documentadas com gatilho · pré-req · passo a passo · validação · anti-pattern · quem faz · tempo.*
