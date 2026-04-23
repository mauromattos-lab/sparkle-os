# Story engine-hardening-01 — Guard em software no webhook: promessa de handoff sem invocação de `escalarHumano`

**Status:** Draft — aguarda validação @po (`*validate-story-draft`) e decisão de Epic de destino.
**Criado por:** @pm Morgan — 2026-04-22
**Owner (quando Ready):** @dev (implementação) · @qa (gate) · @architect (revisão de design se mudança afetar agent-loop)
**Prioridade:** **P1 pós-cutover HL** (executar após janela de monitoring 96h do HL estabilizar — previsão de início: 2026-04-26 ou antes se HL estabilizar)
**Origem:** Handoff QA→DevOps do cutover HL Importados (2026-04-22). Gate HL `PASS with concerns` — concern #1 (flakiness ~20% na invocação de `escalarHumano`) foi aceito via waiver com fix planejado *nesta story*.
**Epic de destino:** **Epic 11 — Capacidades Globais da Zenya** (story 11.3). Decisão 2026-04-22 @pm + Mauro: absorver em Epic existente de Camada 5 (Produto Horizontal) ao invés de criar Epic novo — guard é capacidade global que beneficia todos tenants. Ver [EPIC-11-INDEX.md](../EPIC-11-INDEX.md).

---

## Contexto

Durante o refino brownfield do tenant HL Importados (story `hl-onboarding-01`, smoke 2026-04-22), observou-se uma flakiness de ~20% na invocação da função `escalarHumano`: o LLM (Gemini Flash 2.0) **promete** handoff no corpo da mensagem ("vou te transferir para um atendente humano agora") mas **não invoca** a tool `escalarHumano`. O cliente fica esperando, a thread não é transferida pra labels corretas no Chatwoot, e o humano não é notificado.

Esse comportamento **não é exclusivo do HL**. O mesmo padrão foi observado em Julia (Prime), PLAKA (Roberta) e Scar AI (Gustavo) em produção. É uma propriedade do agent-loop atual que delega 100% à decisão do LLM sem guard em software.

**Iteração de prompt não resolve completamente** — as versões v1→v4.3 do prompt HL incluíram checklist binário explícito ("SE prometer handoff, ENTÃO INVOCAR escalarHumano"). A última medição (smoke 2026-04-22) mostrou reliability ~75%, equivalente ao baseline dos outros tenants. Conclusão do QA: o ceiling de prompt foi atingido; próximo salto exige **enforcement programático**.

**Princípio:** comportamento crítico (escalação a humano) não pode depender apenas da probabilidade do LLM chamar a tool certa. Se o texto promete a ação, o engine força a chamada.

---

## Acceptance Criteria

### AC1 — Detecção textual de promessa de handoff
Dado que o LLM gerou uma resposta textual (`assistantMessage`), quando o conteúdo contém padrões de promessa de handoff para humano (lista configurável por tenant, com defaults PT-BR + EN), então o engine deve classificar essa mensagem como `intent: handoff_promised` antes de despachá-la ao Chatwoot.

Padrões default (PT-BR) — extensível por tenant:
- "vou (te )?(transferir|encaminhar|passar) (pra|para) (um|uma) (atendente|humano|pessoa|colega)"
- "um (atendente|humano) (vai|irá|entrará em contato|te ajudar[áa])"
- "em breve (um|uma) (atendente|humano)"
- (lista completa em código, com testes por padrão)

### AC2 — Enforcement: se promessa detectada E `escalarHumano` não foi invocada
Dado que AC1 classificou a mensagem como `handoff_promised`, quando a mesma resposta do LLM **não contém** uma chamada a `escalarHumano` na lista de tool_calls, então o engine deve:
1. **Invocar `escalarHumano` programaticamente** com parâmetros default (motivo: `"handoff_promised_in_text"`, label: `agente-off`, follow-up: `true`).
2. Logar `[guard] tenant=<slug> handoff_forced conversation=<id> reason=promised_without_invocation` (nível WARN).
3. Manter a mensagem original de resposta ao cliente **sem modificação** (o cliente já recebeu a promessa; o engine apenas garante o side-effect).

### AC3 — Opt-out por tenant
Dado que um tenant possa legitimamente prometer handoff sem escalação (ex: fluxo de agendamento onde "atendente entra em contato em até 24h"), quando o tenant tiver flag `guards.handoff_promise_enforcement: false` na config, então AC2 não deve disparar — apenas AC1 (log informativo).

Default: `guards.handoff_promise_enforcement: true` para todos os tenants em core.

### AC4 — Cobertura de testes
Testes unitários cobrindo:
- Detecção positiva: cada padrão default PT-BR + EN resulta em `handoff_promised`.
- Falso negativo intencional: "um atendente **já** te respondeu" NÃO dispara (passado, não promessa).
- Enforcement: promessa + tool_call ausente → `escalarHumano` invocada.
- Opt-out: promessa + flag off → só log.
- Idempotência: promessa + tool_call presente → não invoca duas vezes.

Mínimo: 15 testes; cobertura do módulo `guards/handoff-promise.ts` >= 90%.

### AC5 — Smoke cross-tenant
Após deploy, rodar smoke dos 4 tenants em core (Prime, PLAKA, Fun, HL) e verificar:
- Reliability de `escalarHumano` invocada quando prometida: **>= 95%** (vs baseline ~75-80%).
- Zero regressão nos demais cenários (produtos, busca, agendamento).
- Observar logs `[guard] handoff_forced` aparecendo em runs que antes falhariam.

### AC6 — Documentação
- `docs/zenya/engine/guards/handoff-promise.md` — explica o guard, padrões detectados, opt-out, como adicionar padrão por tenant.
- Entrada em `docs/zenya/CHANGELOG.md` marcando breaking-safe (default é enforcement — tenants que dependiam da flakiness precisam opt-out explicitamente).

### AC7 — Rollback simples
Flag global `ENGINE_GUARD_HANDOFF_PROMISE_ENABLED=true|false` (env var) que desliga o guard em runtime. Default `true` em produção. Documentado no runbook de incidentes.

---

## Escopo — IN

- Novo módulo `packages/zenya/src/guards/handoff-promise.ts` (detector + enforcer).
- Integração no loop principal do webhook (`packages/zenya/src/webhook.ts` ou equivalente — @architect confirma ponto de injeção).
- Configuração por tenant (leitura de `tenants.guards` ou campo equivalente — @data-engineer confirma shape no Supabase).
- Testes unitários + integração do guard.
- Smoke cross-tenant pós-deploy.
- Documentação do guard.

## Escopo — OUT

- Outros guards (ex: detecção de promessa de entrega sem tool de pedido) — cada guard vira story própria, esta é **apenas** handoff.
- Mudanças no prompt dos tenants — prompts atuais permanecem, o guard é complementar (defense in depth).
- Dashboards de observabilidade (concern #2 do gate HL) — escopo separado.
- Refatoração maior do agent-loop — mudança cirúrgica, não refactor.
- Guards em LLM (ex: segundo passe do LLM pra validar) — custoso e ortogonal; só software-side.

---

## Dependências

- ✅ HL onboarding Done (AC9 cutover + monitoring 96h estabilizado) — garante baseline do fix medível.
- ✅ Epic 16 Done (Fun Personalize refinada — usado como tenant de comparação no smoke cross-tenant).
- ⚠️ Config shape em `tenants.guards` — se não existir, @data-engineer adiciona migration na Phase 1 da story.
- ⚠️ Acesso `@architect` para validar ponto de injeção no loop (5-10min review).

---

## Complexidade

**T-shirt:** M (medium) — ~1-1.5 dia de @dev.

**5 dimensões:**
| Dimensão | Score (1-5) | Notas |
|----------|------------|-------|
| Scope | 3 | 2-3 arquivos novos + 1 alteração cirúrgica no webhook |
| Integration | 2 | Sem APIs externas novas — apenas chamada interna a `escalarHumano` |
| Infrastructure | 2 | 1 flag env + 1 campo no tenant config (migration pequena) |
| Knowledge | 3 | Requer entendimento do agent-loop; @dev já refinou 4 tenants |
| Risk | 4 | Mudança afeta TODOS os tenants em produção — smoke + rollback simples são mandatórios |

**Total: 14 → STANDARD** (Spec Pipeline completo se for formalizar; se YOLO, @dev + @architect review pré-merge).

---

## Business Value

- **Redução mensurável de tickets "cliente esperando":** estimativa ~20% das promessas de handoff hoje ficam órfãs. Com ~N escalações/dia por tenant, fix direto em qualidade percebida.
- **Aplicabilidade horizontal:** 1 story cobre 4 tenants em core hoje (Prime, PLAKA, Fun, HL) e todos os futuros (Ensinaja, Doceria, Scar pós-cutover).
- **Confiança do cliente no onboarding:** remove a objeção "às vezes não transfere" que Hiago (HL) e Roberta (PLAKA) já mencionaram anedoticamente.
- **Habilita próximo patamar do playbook Epic 15:** refino por iteração de prompt tem ceiling; guards em software abrem caminho novo.

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Falso positivo: guard escala quando não deveria (ex: "o atendente já te respondeu no email") | M | Regex cuidadosa + teste explícito do caso + opt-out por tenant + flag global de rollback |
| Regressão em tenant que dependia da flakiness pra fluxo legítimo | B | Opt-out + smoke cross-tenant obrigatório pré-deploy |
| Performance (regex em toda mensagem) | B | Regex simples, O(n) no tamanho da mensagem. Benchmark <1ms esperado |
| Conflito com prompt dos tenants (prompt manda não prometer mas LLM promete mesmo assim) | B | É exatamente o caso que o guard resolve — não é risco, é feature |

---

## Definition of Done

- [ ] Módulo `guards/handoff-promise.ts` implementado com 15+ testes passando, cobertura >= 90%.
- [ ] Integração no webhook.ts mergeada com review de @architect.
- [ ] Migration de config `tenants.guards.handoff_promise_enforcement` aplicada (default `true`).
- [ ] Flag env `ENGINE_GUARD_HANDOFF_PROMISE_ENABLED` documentada.
- [ ] Smoke cross-tenant executado (Prime + PLAKA + Fun + HL): reliability >= 95% em cada um.
- [ ] Gate @qa PASS (com ou sem concerns).
- [ ] Documentação `docs/zenya/engine/guards/handoff-promise.md` publicada.
- [ ] Changelog atualizado.
- [ ] Concern #1 do gate `hl-onboarding-01-pre-cutover.yml` marcado como **resolvido** com link pra esta story.

---

## Changelog

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-04-22 | @pm Morgan | Criação em Draft a partir do handoff QA→DevOps HL Importados. Story cross-tenant derivada do concern #1 do gate `hl-onboarding-01-pre-cutover`. |
| 2026-04-22 | @pm Morgan + Mauro | Decisão de Epic Placement: **Epic 11 (story 11.3)**. Epic 11 já cobre "capacidades que beneficiam todos os clientes" (Camada 5 — Produto Horizontal). Descartado Epic 18 novo — diretriz Mauro: zerar epics, não esticar com novos. Epic 11 index atualizado com linha 11.3. |
