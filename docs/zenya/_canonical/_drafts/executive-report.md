# Executive Report — Brownfield Zenya

**Para:** Mauro
**De:** `@analyst` Atlas (Fase 9 do Brownfield Discovery)
**Data:** 2026-04-25
**Resumo:** estado da Zenya pós-saneamento + decisões pra você + cronograma proposto.

---

## Página 1 — O que aconteceu nos últimos 6 dias

### Onde a Zenya estava

7 tenants em produção (Prime, PLAKA, Doceria, Fun/Julia, HL, Scar AI, + Ensinaja em n8n), 14 dias após nascer como piloto n8n virar core TS. Migração foi rápida e bem-sucedida em entrega — **mas deixou rastro fragmentado**: 17 docs descrevendo realidades diferentes, drift entre código e documentação, capacidades quebradas silenciosamente em produção (queue acumulando 875 mensagens órfãs há 9 dias, KB do PLAKA congelada há 4 dias, locks órfãos da Julia há 5-8 dias). Você mesmo disse: *"se a gente não alinhar agora, quando vierem outros núcleos, vai ser uma bagunça irremediável."*

### O que o brownfield entregou

**Canon completo** em `docs/zenya/_canonical/` substituindo o caos documental anterior:

| Capítulo | Pra que serve |
|----------|----------------|
| 1 — System Architecture | Como a Zenya funciona ponta-a-ponta |
| 2 — Schema & Data | Como os dados são organizados/isolados/persistidos |
| 3 — Operational Manual | "Como faço X?" — 12 operações com comando exato |
| 4 — Access & Credentials | Catálogo de credenciais por tier + plano de rotação |
| 5 — Test Strategy | Método de refino 7 passos + cenários cross-tenant obrigatórios |
| 6 — Owner Playbook | "O que faço quando X?" — 9 fluxos canônicos do dono (você) |
| 8a — Template Canônico | **Herança pros próximos núcleos** (CRM, financeiro, etc.) — princípio "method, not product" |

### O que foi descoberto (achados pesados)

| Achado | Impacto real |
|--------|--------------|
| **581 mensagens do Ensinaja em queue há 9 dias** | Webhook conta 4 já apontava pro core mas tenant nunca foi seedado. Cliente Douglas (que está com pgto pendente) em silêncio invisível. **Não-prioritário** confirmado por você |
| **221 mensagens da Julia "perdidas" no caminho** | Causa real: bug no try/catch interno do agente — diferente da hipótese inicial. Fix consolidado em 5 mudanças em `webhook.ts` |
| **`organs/zenya/` NÃO é dead code** | Está rodando há 5 dias em produção como Cockpit Cliente Zenya parcial (Vercel `mauro-mattos-projects-389957a6/zenya-cockpit`) — Cap. 1 foi **corrigido retroativamente** |
| **KB sync da PLAKA não está rodando** | Worker existe no código mas nunca foi invocado. KB congelada em 21/04 — só não dói porque Roberta não atualizou planilha |
| **`tenant_id` é polissêmico no schema** | Em 3 tabelas significa `chatwoot_account_id`; em 3 outras significa UUID do tenant. Confunde qualquer agente novo |
| **Supabase legado removido** | Risco de escrita dupla **descartado** factualmente — projeto antigo nem existe mais |
| **2 princípios cross-núcleo extraídos como memória persistente** | `feedback_legacy_runtime_contamination` (todo brownfield faz audit explícito) + `feedback_automation_over_input` (IA infere, não pede input redundante). Vão valer pra todo núcleo SparkleOS futuro |

### O que foi resolvido durante o brownfield

- ✅ Migration 008 aplicada formalizando `admin_contacts` + `zenya_client_users` (autorização sua)
- ✅ Cap. 1 corrigido retroativamente (organs/zenya, Cockpit, Epic 10 InProgress parcial)
- ✅ 17 docs antigos classificados (promovidos / reescrita / apêndice histórico / deprecated)
- ✅ Estados intencionais clarificados (HL pausado pelo cliente, PLAKA aguarda número novo, Ensinaja não-prioritário) → não são incidentes
- ✅ Mini-gate **APPROVED final 57/60** (era 49/60 antes da Fase 8)

### Por que isso destrava o futuro

A herança em **Cap. 8a** captura o método de criar núcleos no SparkleOS — princípios, patterns, anti-patterns, convenções, workflow. Quando você começar **CRM**, **financeiro**, **editorial autônomo**, parte do caderno já está escrito. **Sem isso**, próximo núcleo redescobre tudo do zero (custo: ~14 dias × N núcleos de "achar onde está a bagunça"). **Com isso**, próximo núcleo nasce com o método validado.

---

## Página 2 — Decisões pendentes + cronograma

### 5 decisões pendentes pra você (ou pra Morgan no Epic 18)

| # | Decisão | Recomendação técnica |
|---|---------|----------------------|
| **1** | Materializar Epic 18 (Brownfield Remediation) | Owner: PM Morgan. Sub-stories owned por dev/data-engineer/ux conforme escopo. Wave 1 prioritária |
| **2** | TD-13 Boundary Plaka AEO (`patch-plaka-triggers.mjs`, etc. contaminam `packages/zenya/`) | Mover pra `packages/aeo` + ADR-002 documentando separação |
| **3** | TD-03 polissemia `tenant_id` — Opção A (rename) ou B (UUID consistency) | **Opção A** confirmada por Dara — preserva semântica, zero-downtime mais previsível |
| **4** | TD-04 Lembretes proativos — onde rodam | Worker PM2 separado (`zenya-reminders`) — isolation de falhas |
| **5** | Cockpit (Epic 10) — quem mantém | Story "auditoria Cockpit" em Wave 3 do Epic 18 (após core estável). Pré-requisito: brownfield Zenya estabilizar primeiro (sua decisão) |

### Recomendações sobre Epics 10/11/12/14

| Epic | Decisão recomendada |
|------|---------------------|
| **Epic 10** Cockpit do Cliente Zenya | **MANTER InProgress (parcial).** Cliente/dono primeiro; multi-tenant pra você depois (a+b futuramente). Brownfield Zenya é pré-requisito (você confirmou) |
| **Epic 11** Capacidades Globais | **DESMEMBRAR.** Lembretes proativos (TD-04) sai pra Story dedicada Wave 3 do Epic 18. "Vision" e "assistente avançado" sem cicatriz documentada → fora do escopo até aparecer demanda real |
| **Epic 12** Produção de Conteúdo | **DESCARTAR como produto Zenya core.** Você confirmou no briefing que escopo está mal-definido. Mover pra epic de marketing institucional fora do core ou arquivar |
| **Epic 14** Onboarding Automático | **MANTER congelado** até Epic 10 Wave (a) + Wave 2 do Epic 18 fecharem (depende de Cockpit + seed canônico unificado) |
| **Epic 18 — NOVO** | **Materializar via PM Morgan na Fase 10** absorvendo Waves 1-3 do Tech Debt Draft |

### Cronograma proposto Epic 18

| Wave | Foco | Duração | TDs principais | Critério de saída |
|------|------|---------|-----------------|-------------------|
| **Wave 1 — Pre-launch** | Estancar leaks ativos, fix bugs visíveis | **5-7 dias úteis** (1-2 sprints) | TD-06 lock TTL · TD-07 reset+label · TD-08 admin burst · TD-01 KB sync · TD-02 queue leak | Smoke cross-tenant sem leak; KB sync atualizado em <30min; reset funcional |
| **Wave 2 — Robustez** | Onboarding ≤30min sem cópia-cola; refactor estrutural | **10-15 dias úteis** | TD-03 tenant_id · TD-09 seed canônico · TD-10 migration ledger · TD-11 cache invalidação · TD-12 smoke template · TD-13 boundary AEO · + helpers | Pronto pra escalar a 10+ tenants sem esforço manual proporcional |
| **Wave 3 — Capacidades novas** | Lembretes proativos (Thainá), observabilidade, ações admin | **3-4 semanas** | TD-04 lembretes derivados · TD-22 observabilidade · D-R ações admin | Capacidade contratada Thainá entregue + métricas/custo visíveis pra você |
| **Wave 4 — Cosmético** | Cleanup de baixa prioridade | **Backlog conforme bandwidth** | TD-23 a TD-28 | — |

**Observação importante:** Wave 1 é **pré-requisito antes de aceitar tenant N+1 no core**. Sem ela, o leak da queue continua acumulando e KB do PLAKA fica congelada.

### Custo estimado de fazer

- **Wave 1:** 5-7 dias úteis de trabalho focado (1-2 sprints com paralelismo de @dev e @data-engineer)
- **Wave 2:** 10-15 dias úteis (~3 semanas com paralelismo)
- **Wave 3:** 3-4 semanas (capacidades novas)
- **Wave 4:** sem prazo — conforme aparecer demanda

**Total Wave 1 + 2:** ~5 semanas pra ter Zenya **pronta pra escala**.

### O que isso te dá

Após Wave 1: **Zenya operacionalmente saneada** — você pode aceitar próximo cliente sem nervosismo de "será que o leak da queue vai explodir".

Após Wave 2: **Onboarding industrializado** — novo cliente entra em ~30min sem cópia-cola de scripts. Você (ou um operador) consegue fazer.

Após Wave 3: **Capacidades contratadas entregues** — lembretes proativos liberam o caso Thainá; observabilidade te dá controle de custo OpenAI mensal pelo canal admin (você pergunta pelo WhatsApp e bot responde).

Após Wave 4 (qualquer momento): **núcleo limpo pra você começar CRM/financeiro/editorial** — Cap. 8a (Template Canônico) já te dá o método validado pra construir.

### Próximo passo

**Disparar `@pm` Morgan pra Fase 10** — ela materializa o Epic 18 com sub-stories, owners e cronograma executável. Depois, `@dev` e `@data-engineer` começam Wave 1.

---

*Executive Report — Brownfield Zenya, Fase 9, 2026-04-25.*
*Atlas, investigando a verdade — 6 dias condensados em 2 páginas.*
