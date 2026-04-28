# Epic 18 — Brownfield Remediation Zenya

**Status:** Draft
**Owner:** `@pm` Morgan
**Origem:** Brownfield Discovery 2026-04-25 (Mini-gate APPROVED final 57/60)
**Inputs:** `docs/zenya/_canonical/_drafts/technical-debt-DRAFT.md` (Aria Fase 4) + `db-specialist-review.md` (Dara Fase 5) + `ux-specialist-review.md` (Uma Fase 6) + `executive-report.md` (Atlas Fase 9)
**Camada:** 2 (Migração + Saneamento — extends Epic 7)
**Antecessor:** Epic 7 (cutover n8n→core, 9/10 — Ensinaja não-prioritário fica em pausa)

---

## Propósito

Materializar o saneamento técnico catalogado pelo Brownfield Discovery em **stories executáveis** seguindo Story Development Cycle do AIOX. Sequência em **4 waves** com critérios de saída claros.

**Princípio P3 do brownfield (`feedback_legacy_runtime_contamination`):** todo brownfield SparkleOS começa com Runtime Drift Audit explícito. Já feito.

**Princípio P9 (`feedback_automation_over_input`):** automação derivada > input manual. Já materializado em TD-04 (lembretes derivados de Calendar).

---

## Goals

1. **Wave 1 — Pre-launch:** estancar leaks ativos, fix bugs visíveis. Bloqueante antes de aceitar cliente novo no core.
2. **Wave 2 — Robustez:** onboarding de tenant ≤30min sem cópia-cola; refactor estrutural (polissemia, ledger).
3. **Wave 3 — Capacidades novas:** lembretes proativos (Thainá), observabilidade, ações operacionais admin.
4. **Wave 4 — Cosmético:** cleanup de baixa prioridade conforme bandwidth.

---

## Critérios de saída por wave

| Wave | Critério mensurável |
|------|----------------------|
| **Wave 1** | Smoke cross-tenant sem leak; KB sync com `last_synced_at < 30min`; lock count em estado estável; reset funcional; queue pending residual <50 |
| **Wave 2** | Onboarding novo tenant ≤30min sem cópia-cola; migration ledger funcional registrando todas migrations (009-014+); cache invalidation cross-instance funcionando |
| **Wave 3** | Lembretes proativos disparam com sucesso pra ≥1 tenant em produção; admin agent expõe custo OpenAI mensal + métricas avançadas; Frontend D-R 3 fases concluídas |
| **Wave 4** | Backlog de cosméticos zerado conforme bandwidth |

---

## Inventário de stories

### Wave 1 — Pre-launch (7 stories, 5-7 dias úteis com paralelismo)

| Story | Título | TD | Esforço | Owner principal |
|-------|--------|-----|---------|-----------------|
| [18.1](./epic-18-brownfield-remediation/18.1.story.md) | Lock TTL com cleanup pre-acquire | TD-06 | S (3-4h) | `@dev` Dex |
| [18.2](./epic-18-brownfield-remediation/18.2.story.md) | `/reset` limpa label `agente-off` + mensagem refinada | TD-07 + UX-1 | S (3-4h) | `@dev` Dex |
| [18.3](./epic-18-brownfield-remediation/18.3.story.md) | Burst admin filter no pareamento Z-API | TD-08 | S (3-4h) | `@dev` Dex |
| [18.4](./epic-18-brownfield-remediation/18.4.story.md) | KB sync ativo (worker PM2 dedicado) | TD-01 | M (1d) | `@dev` Dex + `@data-engineer` Dara |
| [18.5](./epic-18-brownfield-remediation/18.5.story.md) | Queue leak fix consolidado (4 causas) | TD-02 | M-L (2-3d) | `@dev` Dex |
| [18.20](./epic-18-brownfield-remediation/18.20.story.md) | Guard handoff_promise enforcement (cross-tenant) | concern HL-01 waiver | M (1-1.5d) | `@dev` Dex + `@architect` Aria |
| [18.23](./epic-18-brownfield-remediation/18.23.story.md) | Anti-eco não aplica agente-off em outgoing antes do primeiro incoming (cross-tenant blocker Click-to-WA ads) | reporte Gustavo 2026-04-26 | S (3-5h) | `@dev` Dex + `@architect` Aria |

### Wave 2 — Robustez (11 stories, 10-15 dias úteis)

| Story | Título | TD | Esforço | Owner principal |
|-------|--------|-----|---------|-----------------|
| [18.6](./epic-18-brownfield-remediation/18.6.story.md) | `tenant_id` rename Expand-Contract | TD-03 | L (3-5d) | `@data-engineer` Dara + `@dev` Dex |
| [18.7](./epic-18-brownfield-remediation/18.7.story.md) | Seed canônico unificado | TD-09 | M (2-3d) | `@dev` Dex |
| [18.8](./epic-18-brownfield-remediation/18.8.story.md) | Migration ledger manual | TD-10 | M (1-2d) | `@data-engineer` Dara |
| [18.9](./epic-18-brownfield-remediation/18.9.story.md) | Cache invalidação via NOTIFY/LISTEN | TD-11 | S (4-8h) | `@data-engineer` Dara |
| [18.10](./epic-18-brownfield-remediation/18.10.story.md) | Smoke template canônico (yaml por tenant) | TD-12 | M (2d) | `@dev` Dex |
| [18.11](./epic-18-brownfield-remediation/18.11.story.md) | Boundary cleanup Plaka AEO | TD-13 | M (2-3d) | `@architect` Aria + `@dev` Dex |
| [18.12](./epic-18-brownfield-remediation/18.12.story.md) | Crypto helper em seed-common | TD-14 | S (2-3h) | `@dev` Dex |
| [18.13](./epic-18-brownfield-remediation/18.13.story.md) | normalizePhone com libphonenumber-js | TD-15 | S (4h) | `@dev` Dex |
| [18.14](./epic-18-brownfield-remediation/18.14.story.md) | Iteração de prompt formalizada (doc) | TD-16 | S (2h, doc only) | `@architect` Aria |
| [18.22](./epic-18-brownfield-remediation/18.22.story.md) | Pipeline padronizado de onboarding tenant (CLI) | (orchestrator) | M-L (3-5d) | `@dev` Dex + `@architect` Aria + `@data-engineer` Dara |
| [18.24](./epic-18-brownfield-remediation/18.24.story.md) | TTS qualidade por-tenant (modelo expressivo + voice curada + settings) | reporte Gustavo 2026-04-26 | M (1-2d) | `@data-engineer` Dara + `@dev` Dex + curadoria Mauro |

### Wave 3 — Capacidades novas (5 stories, 3-4 semanas)

| Story | Título | TD | Esforço | Owner principal |
|-------|--------|-----|---------|-----------------|
| [18.15](./epic-18-brownfield-remediation/18.15.story.md) | Lembretes proativos derivados (capacidade Thainá) | TD-04 | XL (1-2 sem) | `@architect` Aria + `@dev` Dex |
| [18.16](./epic-18-brownfield-remediation/18.16.story.md) | Observabilidade core (execution_log + ai_usage_daily) | TD-22 | L (4-5d) | `@data-engineer` Dara + `@dev` Dex |
| [18.17](./epic-18-brownfield-remediation/18.17.story.md) | Ações operacionais admin (D-R 3 fases) | Frontend D-R | M-L (5-8d) | `@dev` Dex + `@ux-design-expert` Uma |
| [18.18](./epic-18-brownfield-remediation/18.18.story.md) | P2 cleanup agrupado | TD-17/TD-18/TD-19/TD-20/TD-21 | M (3-5d agrupados) | `@dev` Dex |
| [18.21](./epic-18-brownfield-remediation/18.21.story.md) | Bot lê contexto de "responder mensagem" do WhatsApp (in_reply_to) | (cross-tenant UX) | S (4-8h) | `@dev` Dex |

### Wave 4 — Cosmético (1 story agrupada, backlog conforme bandwidth)

| Story | Título | TDs | Esforço | Owner |
|-------|--------|------|---------|-------|
| [18.19](./epic-18-brownfield-remediation/18.19.story.md) | Cosmetic cleanup + n8n shutdown | TD-23, TD-24, TD-25, TD-26, TD-27, TD-28 | M (3-5d agrupados) | `@dev` Dex + `@devops` Gage |

**Total:** 24 sub-stories (19 originais + 3 absorvidas em 2026-04-26: 18.20 engine-hardening, 18.21 quoted-message-context, 18.22 onboarding-pipeline — drafts pré-brownfield órfãos do Epic 11 desmembrado + 2 novas 2026-04-27: 18.23 anti-eco saudação automática WA Business — reporte Gustavo cross-tenant blocker; 18.24 TTS qualidade por-tenant — reporte Gustavo + diagnóstico Aria).

---

## Cronograma proposto (com paralelismo)

```
Sprint 1 (5-7 dias) — Wave 1
├── 18.1, 18.2, 18.3 (S — paralelos, ~4h cada) — Dia 1-2
├── 18.4 (M — sequencial após 18.3) — Dia 3
└── 18.5 (M-L — última) — Dia 4-7

Sprint 2 (10-15 dias) — Wave 2
├── 18.7-18.13 (paralelizáveis em duplas) — Dia 1-10
└── 18.6 tenant_id (depende coordenação deploy) — Dia 6-15
└── 18.14 (doc only) — qualquer momento

Sprint 3 (3-4 semanas) — Wave 3
├── 18.16 observabilidade (foundation pra outras) — Semana 1
├── 18.15 lembretes proativos — Semana 2-3
├── 18.17 ações admin — Semana 2-4
└── 18.18 P2 cleanup — paralelo

Wave 4 — backlog (sem prazo)
└── 18.19 — agrupado conforme bandwidth
```

**Total Wave 1 + 2:** ~5 semanas pra Zenya pronta pra escala.

---

## Decisões já travadas (do brownfield)

| Decisão | Origem | Status |
|---------|--------|--------|
| TD-03 Opção A (rename) vs B (UUID consistency) | DB Specialist Review §4 | **Opção A confirmada** com plano Expand-Contract |
| TD-04 onde rodam lembretes | UX/DB Specialist Reviews | **Worker PM2 separado** (`zenya-reminders`) |
| Lembretes derivados de Calendar (não input manual) | Decisão Mauro 2026-04-25 + memória `feedback_automation_over_input` | **Princípio P9 inviolável** |
| Maintenance windows config one-time onboarding | Mesma decisão | Coluna `zenya_tenants.maintenance_windows JSONB` proposta |
| Densidade ≤2 cross-tenant default | Decisão Mauro 2026-04-25 | Cap. 8a + Frontend Spec P1 |
| Emoji livre default + opt-out por SOP | Decisão Mauro 2026-04-25 | Cap. 8a |
| Cleanup `agente-off` 72h fixo cross-tenant | Decisão Mauro 2026-04-25 | Mantém regra atual |
| Cockpit (Epic 10) brownfield Zenya é pré-requisito | Decisão Mauro 2026-04-25 | Story de auditoria Cockpit em Wave 3 (após Wave 1+2) |
| Migration 008 retroativa | Aplicada 2026-04-25 (autorização Mauro) | ✅ Done — `packages/zenya/migrations/008_*.sql` |

---

## Decisões pendentes pro Mauro (consolidadas)

Atendidas pelo handoff Atlas Fase 9. Recapitulando:

1. ✅ Materializar Epic 18 — **este doc**
2. ✅ TD-13 Boundary Plaka AEO — Story 18.11 detalha
3. ✅ TD-03 Opção A — confirmada
4. ✅ TD-04 worker PM2 separado — confirmado
5. ✅ Cockpit auditoria — Wave 3 Story 18.17 absorve

**Sem decisões pendentes adicionais.**

---

## Recomendações sobre outros Epics

| Epic | Status novo | Justificativa |
|------|-------------|---------------|
| **Epic 7** Zenya como Órgão Nativo | InProgress (9/10) — Ensinaja pausado pelo cliente | Story 7.8 (Ensinaja) fica em backlog até Douglas voltar |
| **Epic 10** Cockpit do Cliente Zenya | **InProgress (parcial)** — corrigido | Cockpit existe parcialmente em produção; brownfield Zenya é pré-requisito de evolução |
| **Epic 11** Capacidades Globais | **DESMEMBRADO** | Lembretes proativos saíram pra Story 18.15. Vision/assistente avançado sem cicatriz → fora escopo |
| **Epic 12** Produção de Conteúdo | **DESCARTADO como produto Zenya core** | Confirmado por Mauro: escopo mal-definido. Mover pra epic de marketing institucional fora do core |
| **Epic 14** Onboarding Automático | **CONGELADO** até Epic 10 Wave (a) + Epic 18 Wave 2 | Depende de Cockpit + seed canônico unificado |
| **Epic 17** Refino brownfield demais tenants | Mantém Draft | Wave A (PLAKA, Scar) já em produção; Wave B (HL/Doceria) absorvida pelo brownfield. Epic 17 fica residual |

---

## Pattern operacional canônico — 6 steps (aprendizado Story 18.1)

> **Origem:** Story 18.1 (2026-04-26) — Mauro reforçou `feedback_process_integrity` ("não quero o caminho rápido, quero o certo"). Quinn formalizou 6 steps no gate yaml. **Stories 18.2-18.19 herdam explicitamente este pattern.**

Toda story do Epic 18 segue **estes 6 steps obrigatórios pós-implementação**:

### Step 1 — `@devops` cria PR formal (não push direto na main)

- Branch feature: `feat/<wave>.<story>-<slug>` (ex: `feat/18.2-reset-label`)
- `git push -u origin feat/...` (nunca push direto em main)
- `gh pr create` com title conventional + body completo (link story file + link gate file + summary + test plan)
- CI passar (Vercel previews + futuras checks)
- Self-review do diff no GitHub UI (mesmo solo, anotado)
- **Squash-merge** na main (mantém histórico limpo)
- Delete da branch após merge

### Step 2 — Deploy VPS com snapshot SQL prévio

- Snapshot SQL pré-deploy salvo em arquivo timestampado (rollback se necessário)
- `ssh sparkle-vps` → `git pull origin main` → `npm install` → `npm run build` → `npm test` (valida no env de produção)
- `pm2 reload zenya-webhook` (graceful, sem downtime)
- `pm2 logs --lines 30` + `curl /zenya/health` (smoke imediato)

### Step 3 — Operações destrutivas (cleanup, migration, etc.)

**Sem exceção:**
- **DRY-RUN obrigatório primeiro** (todo script destrutivo em prod tem `--dry-run` flag)
- Validar output: deve mostrar EXATAMENTE o que esperamos modificar
- Se mostrar diferente: PARAR e investigar
- **GO Mauro explícito** antes de rodar real (não autoassumir)
- Executar real
- Validar pós-SQL com count/integrity check

### Step 4 — Smoke estruturado pós-deploy

**Cenário definido, não improvisado:**
- Pré-smoke checklist: pm2 list ok, logs limpos, métricas baseline registradas
- Mensagem real do número admin pelo WhatsApp
- Validar: bot responde 5-15s; pm2 logs mostra fluxo esperado; métricas pós conferem

### Step 5 — Monitor **48h** (não 24h)

**2× mais conservador que recomendação inicial:**
- Métricas específicas por story
- Alarmes definidos (lock count, queue stats, error logs, user-impact)
- **Rollback procedure documentado** se métricas ficarem fora do envelope

### Step 6 — Marcar Done com sign-off Mauro

**Pré-requisitos antes de Done:**
- ✅ PR merged
- ✅ Deploy VPS OK
- ✅ Operações destrutivas executadas (se aplicável)
- ✅ Smoke pós-deploy OK
- ✅ 48h monitor sem regressão
- ✅ **Sign-off Mauro explícito**

Procedure:
- Edit story file: Status: 'Ready for Review' → 'Done'
- Add changelog na story
- Atualizar Tech Debt Draft TD correspondente → status 'Resolved'
- Atualizar canon (Cap. apropriado) marcando capacidade como 'em produção'

---

## Workflow execução SDC (passos 1-5 de cada story)

Cada sub-story segue ciclo padrão:

```
@sm *draft → @po *validate → @dev *develop → @qa *gate → @devops *push
(Draft)      (Ready)         (InProgress)    (InReview)    (Done)
```

**Recomendação:** Wave 1 começa **imediatamente** após este Epic 18 ser publicado. Não há razão técnica pra esperar.

---

## Memórias persistentes correlatas

| Memória | Aplicação |
|---------|-----------|
| `feedback_legacy_runtime_contamination` | Pattern pra todo brownfield futuro fazer Runtime Drift Audit |
| `feedback_automation_over_input` | P9 do canon — gate de design de toda feature/tool nova |
| `feedback_test_from_source` | Smoke deriva da fonte (Wave 1 Story 18.5; Wave 2 Story 18.10) |
| `feedback_llm_simulates_tool` | Anti-pattern A4 cross-tenant (Wave 1 Story 18.5; Wave 3 Story 18.15) |
| `feedback_prompt_iteration_reveals` | Iteração de prompt sem buscar "perfeito" (Wave 2 Story 18.14) |
| `feedback_tool_description_beats_tenant_prompt` | P4 — fix vai pro código com flag (referência) |
| `feedback_verify_before_assume` | Cicatriz Doceria 24h (referência operacional) |
| `feedback_vps_no_burst` | Cuidado SSH em deploy de waves múltiplas |
| `feedback_agent_decides_technical` | Agentes especialistas decidem técnico autonomamente |

---

## Encerramento do Brownfield Discovery

Este Epic 18 publicado **encerra oficialmente o Brownfield Discovery 2026-04-25**.

**Próximas ações pós-Fase 10:**
1. Brownfield Discovery → status: ✅ **Done**
2. Epic 18 → status: ✅ **Ready** (sub-stories 18.1-18.5 imediatamente disponíveis pra `@dev`)
3. Mauro decide cronograma de execução (sequencial vs paralelo) — recomendação: começar Wave 1 imediatamente
4. `@sm` River pode draft adicional de stories se algum gap aparecer durante execução

---

## Changelog

| Versão | Data | Autor | Mudança |
|--------|------|-------|---------|
| 1.0 | 2026-04-26 | `@pm` Morgan | Criação do Epic 18. Materializa saneamento do Brownfield Discovery 2026-04-25. |
| 1.1 | 2026-04-26 | `@pm` Morgan | Auditoria de inventário pós-Story 18.1: 4 gaps encontrados (Story 18.2 missing file + 3 drafts órfãos do Epic 11 desmembrado). Promovidas: 18.2 (consolidação), 18.20 (engine-hardening, Wave 1), 18.21 (quoted-message-context, Wave 3), 18.22 (onboarding-pipeline, Wave 2). Total 19 → 22 stories. |
| 1.2 | 2026-04-27 | `@sm` River | Adicionada Story 18.23 (Wave 1) — Anti-eco não aplica agente-off em outgoing antes do primeiro incoming. Causa-raiz identificada por `@pm` Morgan em `webhook.ts:184-211` após reporte do Gustavo (Scar AI) de 2 leads de Click-to-WhatsApp ad ficarem sem resposta da Scar (saudação automática WA Business confunde anti-eco). Cross-tenant blocker. Total 22 → 23 stories. |
| 1.3 | 2026-04-27 | `@architect` Aria | Adicionada Story 18.24 (Wave 2) — TTS qualidade por-tenant. Diagnóstico após reporte Gustavo "áudio Scar muito IA, artificial, longo, sem expressão" + briefing Mauro "voz natural, jovem, descolada". Solução: trocar `eleven_flash_v2_5` → `eleven_multilingual_v2` (defaults globais), adicionar coluna `tts_config JSONB` em `zenya_tenants` (override per-tenant), curadoria de `voice_id` ElevenLabs library pra Scar (Mauro). Esforço M (1-2d). Total 23 → 24 stories. |

---

*Epic 18 (Brownfield Remediation Zenya) — Materializado pela Fase 10 do Brownfield Discovery — 2026-04-26.*
