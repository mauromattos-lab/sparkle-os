# Technical Debt Draft — Brownfield Zenya

**Versão:** 0.2 (Draft + 4 dívidas P3 catalogadas pela Story 18.1)
**Autor:** `@architect` Aria → `@pm` Morgan (atualização 2026-04-26 pós-Story 18.1)
**Data:** 2026-04-25 (v0.1) → 2026-04-26 (v0.2 — TD-29 a TD-32 da Story 18.1)
**Inputs consolidados:**
- Briefing original `aria-discovery-input-20260425.md` §11 (D1-D17)
- Cap. 1 — System Architecture (Aria, Fase 1) §11
- Cap. 2 — Schema & Data (Dara, Fase 2) §12 + handoff de retorno
- Frontend Spec (Uma, Fase 3) §7 anti-patterns + §11 elicitations + handoff de retorno
- Runtime Drift Audit (Dara, Fase 2)
- Decisões Mauro 2026-04-25 (5/5 elicitations resolvidas + 5 das primeiras-rodada Dara)

> Este doc é **input direto da Fase 7 (QA Gate)** e da **Fase 10 (PM Master Plan + Epic 18)**. Aqui consolido **toda dívida** em catálogo único, classificação P0/P1/P2/P3 e waves de remediation. Fase 5 (DB Specialist Review — Dara) e Fase 6 (UX Specialist Review — Uma) revisam antes do gate.

---

## §1 — Sumário executivo

### Catálogo total
**~30 dívidas mapeadas** nas Fases 1-3. Após consolidação (deduplicação + reclassificação pós-Mauro):

| Severidade final | Dívidas | Status |
|------------------|---------|--------|
| **P0 (operação ou risco crítico)** | 5 | Wave 1 obrigatória antes de cliente novo |
| **P1 (sistêmico, escala)** | 11 | Wave 2 antes de escalar a >10 tenants |
| **P2 (mantenabilidade)** | 9 | Wave 3-4 conforme bandwidth |
| **P3 (cosmético/futuro)** | 7 | Backlog (3 originais + 4 detectados na Story 18.1: TD-29 lint config, TD-30 CodeRabbit WSL, TD-31 Vercel auto-deploy, TD-32 branch fantasma) |
| **Resolvidas durante o brownfield** | 4 | Wave 0 (já feita) |
| **Esperadas/intencionais (não-drift)** | 3 | Não vai pra epic |

### Mudanças mais críticas vs. estado pré-brownfield

1. **Migration 008 aplicada** (D-B + D-F resolvidas) → schema repo agora alinhado com produção
2. **Cap. 1 corrigido** (D-M resolvida) → `organs/zenya` documentado como Cockpit Cliente Zenya parcial em produção
3. **9 princípios universais** de UX conversacional cataloged (P1-P9 do Frontend Spec) — vão pro template canônico (Cap. 8a)
4. **Ensinaja, HL, PLAKA reclassificados como esperados** (não incidentes) → Wave 1 fica menor
5. **Cockpit não pausa** — Epic 10 confirmado como InProgress parcial; brownfield Zenya é pré-requisito

---

## §2 — Catálogo unificado de dívidas

> ID Original = onde foi catalogado primeiro. Consolidação removeu duplicatas (D5≡D-O resolvida em ID único, etc.). Cada dívida tem cicatriz factual ou evidência de produção.

### 2.1 P0 — Bloqueia operação ou esconde risco crítico

| ID | Dívida | Cicatriz / Evidência | Wave |
|----|--------|----------------------|------|
| **TD-01** | **KB sync (`startKbSyncLoop`) é dead code em produção.** PLAKA depende de snapshot local, mas worker não está sendo invocado em `index.ts` nem como app PM2 separado. Validação Fase 2: PLAKA tem 260 entries com `last_synced_at = 2026-04-21 21:19+00` (1 sync único, executado manualmente quando cred foi seedada). | `packages/zenya/src/worker/kb-sync.ts` define `startKbSyncLoop` mas nunca é chamado. `ecosystem.config.cjs` só sobe `zenya-webhook`. | **Wave 1** |
| **TD-02** | **Queue leak — 875 mensagens em `pending` acumuladas.** Causa principal: `webhook.ts` linha 238 (test-mode skip path) não chama `markAllDone(pendingIds)`. Causas secundárias: race entre `fetchPending` e `markAllDone`; falhas de tenant lookup. | Q24 Fase 2: tenant 5 (Julia) 259 pending + tenant 7 (Scar) 34 pending + tenant 4 (Ensinaja drift) 581 pending. Mais antigos têm 9 dias. | **Wave 1** |
| **TD-03** | **`tenant_id` polissêmico em schema.** Em `zenya_queue`/`zenya_session_lock`/`zenya_conversation_history` é **TEXT** (= chatwoot_account_id em queue/lock; UUID-as-text em history). Em `zenya_tenant_credentials`/`zenya_tenant_kb_entries`/`zenya_client_users` é **UUID com FK**. Mesmo nome, semântica diferente. Anti-pattern grave para agente novo lendo schema. | Cap. 2 §3.1 + §12 + Q10/Q15 da Fase 2 (queries falharam com `uuid = text`). | **Wave 2** (refactor longo) |
| **TD-04** | **Capacidade `lembretes proativos` inexistente.** Cláusula 1.2 contrato Thainá Oliveira (2026-04-25) promete. Worker outbound não existe. Bloqueia go-live de qualquer tenant com agenda + lembrete. | Memória `project_lead_micropigmentacao.md`. Princípio P9 (`feedback_automation_over_input.md`) define shape: derivado de Calendar, não input manual; exceção legítima — janela de manutenção pós-procedimento via config one-time onboarding. | **Wave 3** (capacidade nova, não bug) |
| **TD-05** | **Defasagem documental ampla** (D1 do briefing). 7 docs em `docs/zenya/` descreviam stack n8n / `organs/zenya/` adapter / RLS data_isolation_key — irreal. Agente novo lia e ficava perdido. | `ZENYA-CONTEXT`, `NUCLEUS-CONTRACT`, `ISOLATION-SPEC`, `ERROR-FALLBACK-MAP`, `KNOWLEDGE-BASE`, `BASELINE-PERFORMANCE`, `FLOW-INVENTORY`. | **Wave 0** ✅ resolvida em curso pelo brownfield (Cap. 1+2+3 publicados; Cap. 4-6 vêm na Fase 8) |

### 2.2 P1 — Sistêmico, escala

| ID | Dívida | Cicatriz / Evidência | Wave |
|----|--------|----------------------|------|
| **TD-06** | **Lock de sessão sem TTL.** `zenya_session_lock` cresce; crash do processo deixa órfão. | Fase 2 Q12: 2 locks Julia ativos há 8d e 5d. | Wave 1 (cleanup imediato + TTL) |
| **TD-07** | **`/reset` não limpa label `agente-off`.** Cliente em test mode com label aplicada por humano fica travado: `/reset` zera história mas bot continua silencioso. | Sessão Gustavo 2026-04-24 (Scar AI, briefing D5). Frontend Spec Fase 3 confirmou. | Wave 1 |
| **TD-08** | **Burst de mensagens admin no pareamento Z-API.** Z-API sincroniza histórico → cada msg vira webhook → admin agent responde rajada. | Sessão 2026-04-24 com Mauro. Briefing D6 + Frontend Spec A10. | Wave 1 |
| **TD-09** | **7 seed scripts duplicados** (`seed-{tenant}-tenant.mjs`). Cada onboard nova cópia adaptada. | Briefing D3. Validado: prime, fun-personalize, hl, plaka, doceria, ensinaja, scar (7 cópias). | Wave 2 (refactor pra `seed-tenant.mjs --slug=X` lendo descriptor por tenant) |
| **TD-10** | **`supabase_migrations.schema_migrations` não existe.** Sistema de tracking de migrations do Supabase NÃO está em uso. Migrations no repo são doc-only (sem ledger). Drift latente. | Fase 2 Q4 falhou com `relation does not exist`. | Wave 2 (decidir: Supabase CLI, tabela manual, ou ferramenta externa) |
| **TD-11** | **Cache 5min sem invalidação programática.** UPDATE de `zenya_tenants` demora até 5min para refletir; força = `pm2 reload` manual. | Briefing D8. `tenant/config-loader.ts` TTL hardcoded. | Wave 2 (endpoint admin OU LISTEN/NOTIFY Postgres) |
| **TD-12** | **Smoke ad-hoc por tenant.** `smoke-template.mjs` (Story 15.2) existe mas cada tenant copia. | Briefing D11. 4 cópias hoje (doceria, ensinaja, hl, scar). | Wave 2 |
| **TD-13** | **Plaka AEO contamina `packages/zenya/scripts/` e `packages/zenya/migrations/`.** Boundary unclear entre Zenya core e Plaka AEO (camada 8). | Briefing D12. Arquivos: `patch-plaka-triggers.mjs`, `kb-coverage-plaka.mjs`, `kb-smoke-plaka.mjs`, `seed-plaka-credentials.mjs`, `006_plaka_kb_entries.sql`. | Wave 2 (mover pra `packages/aeo` ou pacote dedicado) |
| **TD-14** | **`seed-hl-ultracash.mjs` duplica `encryptCredential`** (cópia local em vez de usar `crypto.ts` ou helper em `seed-common.mjs`). Drift de implementação criptográfica. | Cap. 1 D-E. | Wave 2 (`seed-common.mjs` ganha `encryptCredentialHex`) |
| **TD-15** | **Validação de telefone tribal.** Formato com/sem `9` no DDD decidido por olho humano. | Briefing D7. PLAKA `allowed_phones: ['+5575992160632', '+557592160632']` (com e sem 9 — confirma ambiguidade) | Wave 2 (helper `normalizePhone` em `seed-common.mjs`) |
| **TD-16** | **Iteração de prompt sem ciclo padronizado.** Scar v2 → v3 saiu por handoff manual `@pm` → `@dev`. Cada cycle inventa workflow. | Briefing D10. Validado em 5+ tenants. Princípio P3+P5 do Frontend Spec já documenta o método. | Wave 2 (formalizar em Cap. 5) |

### 2.3 P2 — Mantenabilidade

| ID | Dívida | Wave |
|----|--------|------|
| **TD-17** | `saveHistory` +1ms hack para ordem user→assistant. Frágil sob alta concorrência. (Cap. 1 D-C) | Wave 3 |
| **TD-18** | `update-funpersonalize-prompt.mjs` ad-hoc — script único pra UM tenant, viola princípio canônico. (Briefing D9) | Wave 3 (deletar — capacidade já em `seed-fun-personalize-tenant.mjs`) |
| **TD-19** | `chat-{tenant}-local.mjs` duplicado (4 cópias) apesar de `chat-tenant.mjs` genérico (Story 15.1). (Briefing D13) | Wave 3 (deletar duplicatas) |
| **TD-20** | `tenant/seed.ts` legado com `TenantSeed` type — ADR-001 substituiu por gray-matter `.md`. (Briefing D14) | Wave 3 (deprecate explicit; deletar se sem consumer) |
| **TD-21** | `go-live-checklist.md` por tenant copy-paste. (Briefing D15) | Wave 3 (template em `docs/stories/_templates/`) |
| **TD-22** | **Observabilidade core ausente.** Sem `zenya_execution_log`, `zenya_ai_usage`. Custo OpenAI invisível. (Briefing D16 + Frontend Spec D-S) | Wave 3 (instrumentação base + tool admin avançada) |
| **TD-23** | `updated_at` sem trigger BEFORE UPDATE. Coluna existe mas nunca atualiza automaticamente em todas as tabelas zenya_*. (Cap. 2 D-K) | Wave 4 |
| **TD-24** | Drift naming `loja-integrada` (cred service, hífen) vs `loja_integrada` (active_tools flag, underscore). (Cap. 2 D-I) | Wave 4 (padronizar pra underscore em ambos) |
| **TD-25** | RLS habilitada em todas zenya_* exceto `zenya_tenant_kb_entries` (inconsistência menor). (Cap. 2) | Wave 4 |

### 2.4 P3 — Cosmético / futuro / não-bloqueante

| ID | Dívida | Wave |
|----|--------|------|
| **TD-26** | Nginx config zombie: `runtime.sparkleai.tech` (8001) e `portal.sparkleai.tech` (3001) apontam pra portas mortas. Mauro: "sistema antigo recomeçado aqui no OS". (Cap. 2 §6.3) | Wave 4 (limpar nginx config quando der) |
| **TD-27** | `.env.example` desatualizado vs `.env` real (várias vars não documentadas: `SUPABASE_PAT`, `PLAKA_*`, `NUVEMSHOP_*`, etc.). | Wave 4 (atualizar .env.example com categorias CORE / OPCIONAL / POR-TENANT-SEED) |
| **TD-28** | n8n vivo na VPS (processo `node /usr/local/bin/n8n` rodando). Mauro: "nada deveria funcionar no n8n". | Wave 4 (desligar n8n + remover service quando confirmado zero dependência. Resolver após Ensinaja sair definitivamente) |
| **TD-29** | **`packages/zenya/eslint.config.js` faltando** — ESLint v9 não acha config; `npm run lint` falha com erro de migração. Script `"lint": "eslint src/"` no package.json não funcional. Detectado pelo Gage no pre-push da Story 18.1 (2026-04-26). Não-bloqueante (typecheck + tests cobrem 90% do gate manual), mas impede CI lint check formal. | Wave 4 (criar `eslint.config.js` com flat config v9; reusar configs do AIOX se existirem) |
| **TD-30** | **CodeRabbit CLI não instalado no WSL** deste ambiente. Detectado pelo Quinn no gate Story 18.1 (2026-04-26). Configurado nos agent yamls (@dev, @qa, @architect, @data-engineer, @devops) mas comando `which coderabbit` retorna "não instalado". Review manual rigoroso substitui pra stories S; mas stories M+ (TD-02 queue leak, TD-04 lembretes proativos, TD-22 observabilidade) têm risco de regressão sem auto-scan. | Wave 4 (instalar CodeRabbit CLI no WSL Ubuntu via `curl -fsSL https://cli.coderabbit.ai/install.sh \| sh`; validar com `coderabbit auth status`) |
| **TD-31** | **Vercel auto-deploy do repo SparkleOS pra projeto `sparkle-os-zenya`** — detectado no PR #14 da Story 18.1 (Vercel deployment status check apareceu mesmo sendo Zenya core hospedado em VPS Hostinger, não Vercel). Provavelmente intencional pro Cockpit Cliente (`zenya-cockpit`), mas projeto `sparkle-os-zenya` separado é confuso — quê deploya o quê? | Wave 4 (auditar Vercel project settings; se `sparkle-os-zenya` é zombie/duplicado de `zenya-cockpit`, deletar; se for outro propósito, documentar no Cap. 1 §3 + ZENYA-CANONICAL convenções) |
| **TD-32** | **Branch fantasma local `feat/zenya-18.2-reset-label`** apontando pro mesmo commit `d7b037b` da Story 18.1 — local-only, não-pushed. Origem: criada acidentalmente em sessão anterior pelo Gage. Cleanup minor. | Backlog (cleanup local: `git branch -D feat/zenya-18.2-reset-label` quando der). **Risco se não limpar**: confundir Gage da Story 18.2 quando criar branch certa |

### 2.5 Dívidas resolvidas durante o brownfield (Wave 0)

| ID | Dívida original | Resolução |
|----|-----------------|-----------|
| **TD-R1** | D-B Cap. 1: coluna `zenya_tenants.admin_contacts` sem migration commitada | ✅ Migration 008 aplicada 2026-04-25 (autorização Mauro) — arquivo `packages/zenya/migrations/008_zenya_admin_contacts_and_client_users.sql` |
| **TD-R2** | D-F Cap. 2: tabela `zenya_client_users` sem migration commitada (Cockpit Epic 10) | ✅ Migration 008 idem |
| **TD-R3** | D-M Cap. 2: Cap. 1 incorreto sobre `organs/zenya` ("dead code") | ✅ Cap. 1 v0.2 corrigido nesta Fase 4 (§3, §9.3, §12) |
| **TD-R4** | D2 briefing: MCP Supabase do Claude Code aponta pro projeto removido | ⚠️ **Parcialmente** — sonda Q17 confirmou projeto legado removido (escrita dupla descartada). Falta correção do `~/.claude.json` do agente — devops-only, fora deste brownfield. **Workaround usado nesta Fase 2: Management API direto via curl** (funcionou 100%) |

### 2.6 Estados intencionais (não-drift)

| ID | "Dívida" original | Status real |
|----|-------------------|-------------|
| **TD-I1** | D-J: Ensinaja webhook drift conta 4 (581 pending) | **Cliente não-prioritário** (resposta Mauro 2026-04-25): Douglas com pagamento pendente, aguarda info dele há 2 semanas. Webhook Chatwoot conta 4 continua apontando pro core e gera ~10 pending/dia. Pode ser limpo (marcar `failed`) ou desconectado quando Mauro decidir. **Backlog não-bloqueante** |
| **TD-I2** | D-N: HL Importados zero tráfego no core | **Pausado por pedido do Hiago** (resposta Mauro): cliente solicitou pause pra ajustes. Cred `ultracash` permanece. Reativar quando Hiago voltar |
| **TD-I3** | PLAKA zero tráfego no core | **Aguarda Mauro comprar número novo** pra parear Z-API. Onboarding pré-deploy |

---

## §3 — Waves de remediation

> Sequência ordenada. **Cada wave tem critério de saída**. Mauro/PM Morgan decide quando avançar pra próxima na Fase 10.

### Wave 0 — Em curso pelo próprio brownfield ✅

**Status: parcialmente done (4/5 itens entregues nesta sessão).**

- ✅ Migration 008 aplicada (TD-R1 + TD-R2)
- ✅ Cap. 1 v0.2 corrigido (TD-R3)
- ✅ Princípios cross-tenant catalogados em memória persistente (P9 `feedback_automation_over_input` + `feedback_legacy_runtime_contamination`)
- ✅ Runtime Drift Audit completo
- 🟡 Capítulos 4-6 do canon (Operational Manual, Access&Credentials, Test Strategy, Owner Playbook) — pendentes Fase 8

**Critério de saída Wave 0:** Fase 8 fechada (canon ZENYA-CANONICAL.md completo + apêndices históricos + template canônico).

### Wave 1 — Pre-launch (antes de qualquer cliente novo)

**Pré-requisito antes de aceitar tenant N+1 no core.**

| Story candidato | TD | Esforço estimado | Risco |
|-----------------|-----|-----------------|-------|
| Fix queue leak | TD-02 | M (1-2 dias) — webhook.ts linha 238 + cleanup script + smoke | Baixo (idempotente) |
| KB sync ativo | TD-01 | M (1-2 dias) — script + ecosystem PM2 ou cron | Baixo |
| `/reset` limpa label | TD-07 | S (3-4h) — reset path chama `removeAgenteOffLabel` | Baixo |
| Lock TTL + cleanup | TD-06 | S (3-4h) — DELETE periódico ou pré-acquire cleanup | Baixo |
| Burst admin filter | TD-08 | S (3-4h) — filtrar `created_at < (boot + threshold)` | Baixo |

**Critério de saída Wave 1:** smoke cross-tenant rodando sem leak, KB sync com `last_synced_at < 30min`, lock count em estado estável, escalation reset funcional.

### Wave 2 — Robustez (antes de >10 tenants)

| Story candidato | TD | Esforço estimado | Risco |
|-----------------|-----|-----------------|-------|
| `tenant_id` rename (Opção A) | TD-03 | L (3-5 dias) — migration + refactor webhook/lock/queue + smoke completo | Médio (cuidado com zero-downtime) |
| Seed canônico unificado | TD-09 | M (2-3 dias) — `seed-tenant.mjs --slug=X` + descriptor por tenant em `tenants/{slug}/seed.yaml` | Baixo |
| Migration ledger | TD-10 | M (1-2 dias) — Supabase CLI integration ou tabela `zenya_migrations_log` | Baixo |
| Cache invalidação | TD-11 | S (4-8h) — endpoint admin `/zenya/admin/cache/clear` autenticado | Baixo |
| Smoke template canônico | TD-12 | M (2 dias) — refactor `smoke-template.mjs` com `tenants/{slug}/smoke.yaml` | Baixo |
| Boundary cleanup Plaka AEO | TD-13 | M (2-3 dias) — mover scripts pra `packages/aeo` (ou outro), atualizar referências | Médio (depende decisão Aria + PM se Plaka AEO mantém ou descarta — ver §4) |
| Helper crypto comum | TD-14 | S (2-3h) — `seed-common.mjs.encryptCredentialHex` + refactor seed-hl-ultracash | Baixo |
| `normalizePhone` helper | TD-15 | S (2-3h) | Baixo |
| Iteração de prompt formalizada | TD-16 | M — Cap. 5 do canon (sem código novo) | n/a (doc) |

**Critério de saída Wave 2:** onboarding de tenant novo em ≤30min sem cópia-cola, migration ledger funcional, smoke padrão.

### Wave 3 — Capacidades novas (pós-Wave 2)

| Story candidato | TD | Esforço |
|-----------------|-----|---------|
| Lembretes proativos (P9 derivado) | TD-04 | XL (1-2 semanas) — worker `outbound-reminders.ts` + Calendar reading + Z-API/Chatwoot dispatch + filter agente-off + maintenance_windows config |
| Observabilidade core | TD-22 | L — `zenya_execution_log` + `zenya_ai_usage` + tools admin avançadas |
| Ações operacionais admin | (Frontend Spec D-R) | M-L — tools admin novas: `pausarBot`, `agendarCampanha`, `atualizarPromptRapido` |
| Cleanup P2 menores | TD-17 a TD-21 | S each — atomicamente |

### Wave 4 — Cosmético / cleanup

| Story | TD | Esforço |
|-------|-----|---------|
| `updated_at` triggers | TD-23 | S |
| Naming `loja_integrada` | TD-24 | S |
| RLS `kb_entries` | TD-25 | S |
| Nginx config cleanup | TD-26 | S (devops) |
| `.env.example` atualizado | TD-27 | S |
| Desligar n8n | TD-28 | M (após Ensinaja sair definitivamente) |

---

## §4 — Recomendação técnica sobre Epics 10/11/12/14 (revisada pós-Mauro)

> Briefing §10 cap. 8 dá licença pra Aria recomendar fundir/descartar. Mauro confirmou direção em 2026-04-25.

| Epic | Camada | Status pré-brownfield | Recomendação revisada Aria | Justificativa |
|------|--------|----------------------|---------------------------|---------------|
| **Epic 10** Cockpit | 5 | Draft | **InProgress (parcial) — escopo (a) Cockpit do dono primeiro, (b) multi-tenant Mauro futuramente.** Pré-requisito: brownfield Zenya core estabilizar. Não pausar `zenya-api` PM2 | Mauro confirmou direção; já existe parcialmente em produção; correção doc Cap. 1 v0.2 |
| **Epic 11** Capacidades Globais | 5 | Draft | **Desmembrar.** Lembretes proativos (TD-04) sai do Epic 11 e vira Story dedicada na Wave 3 do Epic 18. Demais capacidades (Vision, assistente avançado) só após Wave 3 fechada — sem cicatriz, fora do escopo agora | Lembretes têm cicatriz real (contrato Thainá) e princípio P9 (`feedback_automation_over_input`). Vision/assistente sem cicatriz = especulação |
| **Epic 12** Produção de Conteúdo | 9 | Draft | **DESCARTAR como produto Zenya core.** Mauro confirmou no briefing que "não é Zenya gera conteúdo PRA cliente". Mover pra epic de marketing institucional fora do core ou arquivar | Escopo confuso desde origem; sem cicatriz; fora do escopo "departamento Zenya" que Mauro quer estabilizar |
| **Epic 14** Onboarding Auto | 7 | Draft (depende Epic 10) | **MANTER, congelado até Epic 10 Wave (a) estabilizar e Wave 2 do Epic 18 fechar.** Onboarding auto exige seed canônico (TD-09) + Cockpit operacional | Dependência clara; conservadora |
| **Epic 18 — NOVO** Brownfield Remediation | — | (a criar) | **Materializar via PM Morgan na Fase 10.** Absorve Waves 1, 2, 3 do §3 deste doc | Centraliza remediation deste brownfield |

**Epics referenciados como camadas paralelas (mantém):**
- Epic 5+6 (AEO Plaka) — camada 8, fora do escopo Zenya
- Epic 13 (Capacidades de nicho) — camada 6, sob demanda real
- Epic 15 (Método refino) — Done, base do Cap. 5
- Epic 16 (Refino brownfield Fun) — Done
- Epic 17 (Refino brownfield demais) — Draft, depende de Wave 1/2 do Epic 18 + Ensinaja

---

## §5 — Dependências entre waves

```
Wave 0 (em curso) ✅
  └─ Capítulos 1-3 publicados
        └─ Wave 1 (pre-launch)
              ├─ TD-01 KB sync
              ├─ TD-02 queue leak
              ├─ TD-06 lock TTL
              ├─ TD-07 reset+label
              └─ TD-08 admin burst
                    │
                    └─ Wave 2 (robustez)
                          ├─ TD-03 tenant_id refactor
                          ├─ TD-09 seed canônico
                          ├─ TD-10 migration ledger
                          ├─ TD-11 cache invalidação
                          ├─ TD-12 smoke canônico
                          ├─ TD-13 boundary AEO
                          ├─ TD-14 crypto helper
                          ├─ TD-15 normalizePhone
                          └─ TD-16 iteração formalizada
                                │
                                └─ Wave 3 (capacidades novas)
                                      ├─ TD-04 lembretes proativos ⭐ (capacidade contratada Thainá)
                                      ├─ TD-22 observabilidade
                                      ├─ Frontend D-R ações operacionais admin
                                      └─ TD-17 a TD-21 cleanup P2
                                            │
                                            └─ Wave 4 (cosmético)
                                                  ├─ TD-23 updated_at triggers
                                                  ├─ TD-24 naming loja_integrada
                                                  ├─ TD-25 RLS kb_entries
                                                  ├─ TD-26 nginx cleanup
                                                  ├─ TD-27 .env.example
                                                  └─ TD-28 desligar n8n
```

**Caminhos críticos:**
- TD-02 (queue leak) é pré-requisito de qualquer cliente novo entrando no core (caso contrário, mais leak)
- TD-04 (lembretes) é pré-requisito de fechar contrato Thainá (cláusula 1.2 promete a capacidade)
- TD-13 (boundary Plaka AEO) é pré-requisito de qualquer refactor cross-package futuro (CRM, financeiro, editorial)

---

## §6 — Decisões pendentes pra PM Morgan (Fase 10)

| Decisão | Contexto | Recomendação Aria |
|---------|----------|-------------------|
| **Materializar Epic 18** | Brownfield gera ~22 stories (Waves 1+2+3+4). Quem dona? Sequência? | Epic 18 owned por PM Morgan; sub-stories owned por @dev / @data-engineer / @ux-design-expert conforme escopo |
| **TD-13 boundary Plaka AEO** | Mover pra `packages/aeo` ou outro pacote? Plaka AEO está em camada 8 separada do core Zenya | Mover pra `packages/aeo` (criar se não existir); ADR-002 documenta separação |
| **TD-03 `tenant_id` polissemia — Opção A vs B** | A = rename (queue/lock pra `chatwoot_account_id`); B = converter tudo pra UUID | **A** (rename). Conserva semântica histórica; menos código pra mudar; zero-downtime mais fácil |
| **TD-04 Lembretes proativos — onde rodam?** | Worker no PM2 separado vs. dentro do `zenya-webhook` vs. cron VPS | Worker PM2 separado (`zenya-reminders`). Isolation de falhas; reload independente |
| **Cockpit Cliente Zenya — quem mantém?** | Hoje é "antes da hora, processo perdido". Mauro quer **brownfield Zenya antes** de retomar | Manter `zenya-api` rodando. Story de "auditoria do Cockpit" entra em Wave 3 do Epic 18 (após core estável). NUCLEUS-CONTRACT v2 reescrito na Fase 8 |

---

## §7 — Estado das elicitations (todas resolvidas)

| ID | Pergunta | Decisão Mauro | Doc onde está |
|----|----------|---------------|---------------|
| Cap. 2 E-1 | Ensinaja webhook | Cliente não-prioritário, pagamento pendente | TD-I1 |
| Cap. 2 E-2 | HL zero tráfego | Pausado por cliente | TD-I2 |
| Cap. 2 E-3 | PLAKA zero tráfego | Aguarda número novo | TD-I3 |
| Cap. 2 E-4 | Cockpit quem? | Cliente/dono primeiro, multi-tenant Mauro depois | §4 Epic 10 |
| Cap. 2 E-5 | runtime/portal hosts | Sistema antigo recomeçado, sem nada rodando | TD-26 |
| Cap. 2 E-6 | Z-API cred em todos | Wishlist Epic futuro | Backlog (não TD) |
| Cap. 2 E-7 | KB PLAKA atualizada | Não mexida ainda | TD-01 não-urgente pra PLAKA hoje |
| Cap. 2 E-8 | Migration 008 aplicar | GO recebido, aplicada | TD-R1 + TD-R2 |
| Frontend U-1 | Lembretes proativos | Derivado de agendamento, não input | TD-04 + P9 princípio canônico |
| Frontend U-2 | Densidade cross-tenant | ≤2 default cross-tenant | Frontend Spec P1 |
| Frontend U-3 | Emoji policy | Default livre + opt-out por tenant | Frontend Spec §11 |
| Frontend U-4 | Cockpit persona | Cliente/dono primeiro | §4 Epic 10 |
| Frontend U-5 | Auto-cleanup 72h | Default fixo, mudar conforme demanda | TD futuro (não Wave 1-4) |

---

## §8 — Próximas fases

**Imediato:**
- **Fase 5 (Dara — DB Specialist Review):** revisa Cap. 2 + TD-01, TD-03, TD-06, TD-10, TD-11, TD-15, TD-23, TD-25 — aprova proposals
- **Fase 6 (Uma — UX Specialist Review):** revisa Frontend Spec + TD-04 (P9 derivado), TD-07 (reset), TD-08 (burst), TD-22 (observabilidade), Frontend D-P/D-Q/D-R/D-T

Podem rodar **paralelas** após este doc publicado.

**Sequencial:**
- **Fase 7 (Quinn — QA Gate):** aplica os 6 critérios de sucesso do briefing §3 contra o canon completo. Verdict: APPROVED | NEEDS WORK
- **Fase 8 (Aria — Final Assessment + Template Canônico):** consolida Capítulos 3-6 do canon + extrai template do método pros próximos núcleos
- **Fase 9 (Alex — Executive Report):** resumo executivo <=2 páginas
- **Fase 10 (PM Morgan):** materializa Epic 18 com waves desta seção §3 + decisões §6

---

*Technical Debt Draft — Brownfield Zenya, Fase 4, 2026-04-25.*
*Próxima revisão: feedback Fases 5 e 6 (Dara/Uma reviewers).*
