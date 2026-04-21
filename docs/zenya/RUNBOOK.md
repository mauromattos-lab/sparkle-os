# Zenya — Runbook Operacional

Guia rápido de operação (ação em < 15 min). Para entender **o quê** é um tenant e **por quê** o design é assim, leia o [TENANT-PLAYBOOK](./TENANT-PLAYBOOK.md). Este runbook é **como fazer**.

---

## Índice rápido

| Quero… | Seção |
|--------|-------|
| Corrigir um erro no prompt de um cliente em produção | [§1 Atualizar prompt](#1-atualizar-prompt-de-um-cliente-em-produção) |
| Migrar um cliente do n8n pro core | [§2 Migrar do n8n pro core](#2-migrar-um-cliente-do-n8n-pro-core-zenya) |
| Adicionar um cliente totalmente novo | [§3 Onboarding de cliente novo](#3-onboarding-de-cliente-novo) |
| Adicionar uma integração (ferramenta) a um cliente existente | [§4 Adicionar integração](#4-adicionar-integração-a-um-cliente-existente) |
| Desativar temporariamente o bot em uma conversa | [§5 Label `agente-off`](#5-desativar-o-bot-numa-conversa-label-agente-off) |
| Rolar o prompt para versão anterior (rollback de emergência) | [§6 Rollback de prompt](#6-rollback-de-emergência-de-prompt) |
| Validar que tudo continua funcionando após um deploy | [§7 Smoke test pós-deploy](#7-smoke-test-pós-deploy) |

---

## 1. Atualizar prompt de um cliente em produção

**Quando usar:** cliente pede ajuste no tom, correção de informação, novo FAQ.

1. Editar `docs/zenya/tenants/{slug}/prompt.md`
2. Incrementar `version` no front-matter YAML se a mudança for material
3. Commit + push: `git commit -m "chore(zenya-{slug}): atualiza prompt vN→vN+1"`
4. Entrar na VPS e rodar dry-run:
   ```bash
   cd /root/SparkleOS && git pull
   cd packages/zenya && node scripts/seed-{slug}-tenant.mjs --dry-run
   ```
   → Output deve mostrar `md5` novo (diferente do anterior — senão ninguém editou o texto de verdade)
5. Rodar update real:
   ```bash
   node scripts/seed-{slug}-tenant.mjs
   ```
6. Aguardar até 5 minutos (cache de tenant do core). Próxima mensagem já pega o novo prompt. **Não precisa `pm2 reload`.**

**Tempo total:** 5–10 min
**Risco:** baixo — `updateTenantPrompt()` só toca `system_prompt`, preserva admins e tools
**Validação:** após 5 min, mandar 1 mensagem de teste como admin do tenant

---

## 2. Migrar um cliente do n8n pro core Zenya

**Quando usar:** cliente já tem bot rodando em n8n (fazer.ai) e precisa migrar para o core.

### Fase A — Extrair e canonizar o prompt
1. Exportar o workflow n8n (JSON) → salvar em `docs/zenya/{slug}-import/secretaria-vN.json`
2. Identificar o nó principal (`Secretária vN` ou equivalente), copiar o `systemMessage`
3. Criar `docs/zenya/tenants/{slug}/prompt.md` com front-matter YAML no padrão ADR-001
4. Portar o conteúdo literal. Substituir interpolações n8n:
   - `{{ $now.format(...) }}` → **remover** (core injeta hora de Brasília automaticamente)
   - `{{ $('Info').item.json.nome }}` → **remover** (nome do contato já vem do payload Chatwoot)
5. Validar com ferramentas de busca: nomes de ferramentas (ex: `Escalar_humano` vs `escalarHumano`) — decidir se traduz ou mantém alias

### Fase B — Preparar o tenant no core
1. Criar script `packages/zenya/scripts/seed-{slug}-tenant.mjs` copiando `seed-scar-tenant.mjs` como template. Ajustar:
   - `name` do tenant
   - Prefixo das env vars (`{SLUG}_CHATWOOT_ACCOUNT_ID`, `{SLUG}_ADMIN_PHONES`, etc.)
   - Path default do prompt
   - `active_tools` necessárias
2. Se o cliente tem integração customizada (não existente no core), implementar em `packages/zenya/src/integrations/{nome}.ts` seguindo o padrão de `ultracash.ts` ou `loja-integrada.ts`. Registrar no `tool-factory.ts` atrás de `active_tools.includes('...')`.
3. Commit + push de tudo.

### Fase C — Configurar infra externa
1. **Chatwoot:**
   - Criar conta (ou usar existente) — anotar `account_id`
   - Criar inbox WhatsApp
   - Configurar labels padrão: `agente-off`, `follow-up`, `testando-agente`
   - Configurar webhook → `https://api.sparkleai.tech/webhook/chatwoot` (evento `message_created`)
2. **Z-API:** criar instância, parear com WhatsApp do cliente via QR Code (exige celular do cliente)
3. **Credenciais criptografadas** (`zenya_tenant_credentials`): rodar `seed-zapi-credentials.mjs` (Z-API) e scripts análogos para outras integrações (ex: `seed-hl-ultracash.mjs`)

### Fase D — Executar
1. Dry-run na VPS: `node scripts/seed-{slug}-tenant.mjs --dry-run` — confirmar md5 e estrutura
2. Seed real: `node scripts/seed-{slug}-tenant.mjs`
3. `pm2 reload zenya-webhook` (só se foi adicionada integração nova no código) — senão, cache expira em 5 min
4. Smoke test ([§7](#7-smoke-test-pós-deploy))

### Fase E — Cutover e standby do n8n
1. No painel do n8n, **desativar** os workflows do cliente (toggle off)
2. Monitorar `pm2 logs zenya-webhook -f` por 30 min após o cutover
3. Manter workflows n8n em standby por 7 dias. Se tudo estável, deletar.

**Tempo total:** 4–8h (depende da complexidade das integrações)
**Template de referência:** [`docs/stories/hl-onboarding-01/README.md`](../stories/hl-onboarding-01/README.md)

---

## 3. Onboarding de cliente novo

Mesma coisa que §2, **exceto** a Fase A (não tem n8n pra importar). Fluxo:

1. Reunião com o cliente: pegar briefing (tom, escopo, integrações, FAQ)
2. Escrever `docs/zenya/tenants/{slug}/prompt.md` do zero seguindo estrutura do §4 do PLAYBOOK
3. Resto igual §2 (Fases B → E)

**Template de referência:** [`docs/stories/scar-ai-onboarding-01/README.md`](../stories/scar-ai-onboarding-01/README.md) — primeiro tenant completamente greenfield (sem n8n prévio).

---

## 4. Adicionar integração a um cliente existente

### 4.1 Integração já existente no core (só ativar)
Exemplo: ativar `google_calendar` num cliente que ainda não usa.

1. Editar `zenya_tenants.active_tools` via SQL:
   ```sql
   UPDATE zenya_tenants
   SET active_tools = active_tools || '"google_calendar"'::jsonb
   WHERE chatwoot_account_id = '{X}';
   ```
2. Adicionar credenciais em `zenya_tenant_credentials` se a ferramenta exigir (ex: Google Calendar OAuth)
3. Atualizar o `prompt.md` do cliente pra mencionar a capacidade ([§1](#1-atualizar-prompt-de-um-cliente-em-produção))
4. Cache expira em 5 min — testar

### 4.2 Integração nova (não existe no core)
1. Implementar em `packages/zenya/src/integrations/{nome}.ts` seguindo o padrão: função factory que retorna `ToolSet` com `tenantId` via closure (nunca expor tenantId pro LLM)
2. Testes unitários em `packages/zenya/src/__tests__/{nome}.test.ts` — mínimo: happy path, erro de API, sanitização de dados sensíveis
3. Registrar no `tool-factory.ts`: `if (config.active_tools.includes('{nome}')) { Object.assign(tools, create{Nome}Tools(tenantId)); }`
4. Build + deploy: `npm run build && pm2 reload zenya-webhook` (este SIM precisa de reload porque é código novo)
5. Ativar no cliente (§4.1)

**Referência:** `packages/zenya/src/integrations/ultracash.ts` — exemplo recente de integração nova (UltraCash/HL).

---

## 5. Desativar o bot numa conversa (label `agente-off`)

**Quando usar:** humano da equipe está assumindo a conversa e quer que o bot pare de responder.

### Via Chatwoot (qualquer agente)
1. Abrir a conversa no Chatwoot
2. Adicionar a label `agente-off`
3. Pronto — webhook ignora todas as mensagens dessa conversa enquanto a label estiver ativa

### Via WhatsApp Business (celular do admin)
1. Adicionar a label nativa `humano` à conversa
2. Z-API sincroniza com Chatwoot → label `agente-off` é aplicada automaticamente

**Auto-remoção:** após 72h sem mensagem de agente, a label é removida automaticamente. Bot volta a responder.

### Reativar o bot manualmente
- Chatwoot: remover a label `agente-off`
- Cache Chatwoot é instantâneo nesse caso

---

## 6. Rollback de emergência de prompt

**Quando usar:** acabei de subir um prompt novo e deu regressão visível no comportamento do bot.

### Opção A — Git (recomendado, reversível)
1. Localizar o commit anterior: `git log --oneline docs/zenya/tenants/{slug}/prompt.md`
2. Reverter só esse arquivo: `git checkout {commit_anterior} -- docs/zenya/tenants/{slug}/prompt.md`
3. Commit + push: `git commit -m "revert(zenya-{slug}): rollback prompt pra {commit}"`
4. Rodar seed como §1 — em 5 min o bot volta ao comportamento antigo

### Opção B — SQL direto (mais rápido, menos auditável)
1. Se tiver backup SQL do prompt anterior (`.ai/backups/{slug}-system_prompt-YYYYMMDD-HHMM.sql`), aplicar via Management API:
   ```bash
   SQL=$(cat .ai/backups/{slug}-system_prompt-*.sql)
   curl -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
     -H "Authorization: Bearer $SUPABASE_PAT" \
     -H "Content-Type: application/json" \
     -d "$(jq -n --arg q "$SQL" '{query:$q}')"
   ```
2. **Obrigatório pós-rollback SQL:** sincronizar o `.md` com o estado revertido no banco (edit + commit) em ≤24h. Senão o repo diverge do banco.

**Cache expira em 5 min — não precisa `pm2 reload`.**

---

## 7. Smoke test pós-deploy

Depois de qualquer mudança (prompt update, integração nova, deploy de código):

1. `pm2 logs zenya-webhook --lines 50` — nenhum erro red-flagged
2. Mandar 1 mensagem de um número **admin** do tenant
   - Esperado: resposta dentro do padrão, sem erros no log
3. Se a mudança envolve integração: testar a ferramenta específica
   - Ex: adicionou `nuvemshop` → perguntar status de um pedido conhecido
4. Se a mudança é prompt: comparar resposta com expectativa (tom consistente, sem regressão)
5. Checar 1 conversa recente real (não-admin) pra garantir que não houve side effect

**Se qualquer passo falhar:** rollback imediato ([§6](#6-rollback-de-emergência-de-prompt)), investigar, tentar de novo.

---

## Convenções

| Item | Convenção |
|------|-----------|
| `{slug}` | minúsculo, kebab-case. Ex: `fun-personalize`, `hl-importados`, `scar-ai`, `plaka`, `zenya-prime` |
| Branch de trabalho | `feature/{slug}-{objetivo}` — ex: `feature/plaka-kb-sync` |
| Commits | Conventional. Prefixo `feat(zenya)` / `fix(zenya-{slug})` / `docs(zenya)` / `refactor(zenya)` |
| Env vars por tenant | Prefixo `{SLUG}_` em caps. Ex: `HL_CHATWOOT_ACCOUNT_ID`, `PLAKA_CHATWOOT_ACCOUNT_ID` |
| Prompt canônico | `docs/zenya/tenants/{slug}/prompt.md` — **única** fonte de verdade |
| Seed do tenant | `packages/zenya/scripts/seed-{slug}-tenant.mjs` |
| Credenciais | `packages/zenya/scripts/seed-{slug}-{service}.mjs` (ex: `seed-zapi-credentials.mjs`) |

---

## Referências

- Arquitetura e princípios: [TENANT-PLAYBOOK.md](./TENANT-PLAYBOOK.md)
- Padrão de prompts: [ADR-001](../architecture/adr/ADR-001-zenya-prompt-storage.md)
- Rule de governança: `.claude/rules/zenya-tenant-prompts.md`
- Utilitário compartilhado de seeds: `packages/zenya/scripts/lib/seed-common.mjs`
- Tenants ativos e seus prompts: [TENANT-PLAYBOOK §12](./TENANT-PLAYBOOK.md#12-clientes-ativos)
