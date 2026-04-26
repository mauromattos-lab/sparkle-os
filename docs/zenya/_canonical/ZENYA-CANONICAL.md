# Zenya — Documento Canônico

**Versão:** 1.0 (Brownfield Discovery completo — 2026-04-25)
**Owner:** `@architect` Aria → handoff a `@pm` Morgan ao final do brownfield (Fase 10)
**Status:** ✅ **Canon completo publicado.** Capítulos 1-6 + 8a + apêndices B/C. Aguarda Fase 9 (Executive Report) e Fase 10 (Master Plan + Epic 18).

> Este é o **documento raiz** do canon Zenya. Toda pergunta sobre o que é, como funciona, como operar a Zenya **deve** começar aqui. Se uma resposta exigir outro doc, este aqui aponta o caminho.
>
> **Princípio P1 (Single Source of Truth):** se você encontrar contradição entre este canon e qualquer outro doc em `docs/zenya/**`, **este canon prevalece**. Docs que divergem estão em estado pré-saneamento (catalogados em `_canonical/_drafts/technical-debt-DRAFT.md` quando publicado) e serão promovidos, deprecated ou virarem apêndice histórico ao fim do brownfield.

---

## Estrutura

| Capítulo | Pergunta-mãe | Doc | Status |
|----------|--------------|-----|--------|
| **1 — System Architecture** | Como a Zenya funciona, ponta a ponta, hoje? | [01-system-architecture.md](./01-system-architecture.md) | ✅ v0.2 (Aria, Fase 1 + correções Fase 2) |
| **2 — Schema & Data** | Como os dados são organizados, isolados, persistidos? | [02-schema-data.md](./02-schema-data.md) | ✅ v1.0 (Dara, Fase 2) |
| **3 — Operational Manual** | Como faço X? (operações técnicas recorrentes) | [03-operational-manual.md](./03-operational-manual.md) | ✅ v1.0 (Aria, Fase 8) |
| **4 — Access & Credentials Map** | O que precisa de credencial? Onde estão? Como roto? | [04-access-credentials.md](./04-access-credentials.md) | ✅ v1.0 (Aria, Fase 8) |
| **5 — Test Strategy & Variants** | Como testo? Que tipos de tenant? Quais variantes? | [05-test-strategy.md](./05-test-strategy.md) | ✅ v1.0 (Aria, Fase 8 — promove TENANT-REFINEMENT-PLAYBOOK) |
| **6 — Owner Playbook** | O que faço quando X acontece? (9 fluxos do dono) | [06-owner-playbook.md](./06-owner-playbook.md) | ✅ v1.0 (Aria, Fase 8) |
| **8a — Template Canônico do Método SparkleOS** | Como construir núcleos novos herdando o método validado pela Zenya? | [08a-template-canonico-metodo-sparkleos.md](./08a-template-canonico-metodo-sparkleos.md) | ✅ v1.0 (Aria, Fase 8 — herança cross-núcleo) |

**Apêndices** (Fase 8):
- [`_appendix/B-historical-n8n-era.md`](./_appendix/B-historical-n8n-era.md) — era n8n abril/8 a abril/22 (preservada como história)
- [`_appendix/C-deprecated.md`](./_appendix/C-deprecated.md) — docs deprecated (ISOLATION-SPEC) e reescrita pendente (NUCLEUS-CONTRACT v2 em backlog Cockpit)

**Drafts (input pra Fases 9-10):**
- [`_drafts/runtime-drift-audit.md`](./_drafts/runtime-drift-audit.md) — auditoria 9 vetores drift
- [`_drafts/frontend-spec.md`](./_drafts/frontend-spec.md) — UX 3 personas + 9 princípios + 10 anti-patterns
- [`_drafts/technical-debt-DRAFT.md`](./_drafts/technical-debt-DRAFT.md) — 28 dívidas em waves
- [`_drafts/db-specialist-review.md`](./_drafts/db-specialist-review.md) — review TDs DB com 6 migrations propostas
- [`_drafts/ux-specialist-review.md`](./_drafts/ux-specialist-review.md) — review TDs UX
- [`_drafts/qa-gate-report.md`](./_drafts/qa-gate-report.md) — gate report Fase 7

---

## Audiência dual

Este canon é consumido por dois leitores e a estrutura precisa servir os dois:

### Agente AIOX (`@dev`, `@qa`, `@devops`, `@data-engineer`, `@ux-design-expert`, `@architect`)
Cenários típicos: "preciso adicionar integração nova", "bug em produção: webhook 500", "vou refatorar X", "schema novo necessário". → Capítulos 1-5 são primários.

### Owner (Mauro hoje, futuro responsável)
Cenários típicos: "cliente reporta bug", "quero implementar função nova: vale pra todos ou só um?", "tirar um cliente", "rodar teste", "incidente em produção", "pricing/escopo de cliente novo". → Capítulo 6 é primário; 1-5 são consultivos.

---

## Convenções globais (referência rápida)

| Item | Convenção |
|------|-----------|
| `{slug}` | minúsculo, kebab-case (`scar-ai`, `fun-personalize`, `hl-importados`, `plaka`, `zenya-prime`, `doceria-dona-geralda`, `ensinaja`) |
| Prompt canônico | `docs/zenya/tenants/{slug}/prompt.md` com front-matter YAML (ADR-001) |
| Branch | `feat/{epic}.{story}-{slug}` para epic stories; `fix/{slug}` para hotfix |
| Commit | Conventional. `feat(zenya)` / `fix(zenya-{slug})` / `docs(zenya)` / `refactor(zenya)` |
| Env var por tenant (no seed) | Prefixo `{SLUG}_` em caps (`HL_CHATWOOT_ACCOUNT_ID`) |
| Webhook único | `https://api.sparkleai.tech/webhook/chatwoot` para todos os tenants |
| Cache TTL | 5min no `config-loader` (sem invalidação programática hoje — ver D8) |
| History window | 50 mensagens cliente / 20 admin |
| Debounce | 2.5s (configurável via `ZENYA_DEBOUNCE_MS`) |

---

## Princípios canônicos do output

| # | Princípio | Aplicação |
|---|-----------|-----------|
| **P1** | Single Source of Truth | Para cada questão, **um único** doc canônico responde. |
| **P2** | Canon serve agentes E dono | Output dual (técnico + fluxograma de decisão). |
| **P3** | Method, not product | Capture o método. Próximos núcleos herdam a forma, não a funcionalidade. |
| **P4** | Cicatriz documenta regra | Toda regra/anti-pattern referencia caso real (commit, issue, memória). |
| **P5** | Defasagem é dívida explícita | Doc velho que diverge da realidade é **marcado**, não atualizado por inferência. |

---

## Estado de produção (snapshot 2026-04-25)

7 tenants no core TS/Hono (`packages/zenya/`); 1 ainda em n8n.

| # | Tenant | `chatwoot_account_id` | Stack | Status |
|---|--------|----------------------|-------|--------|
| 1 | Zenya Prime | `1` | core | Produção |
| 2 | PLAKA (Roberta) | `2` | core | Produção |
| 3 | Doceria Dona Geralda (Ariane) | `3` | core | Produção (cutover 2026-04-23) |
| 5 | Fun Personalize (Julia) | `5` | core | Produção (Done Epic 16) |
| 6 | HL Importados (Hiago) | `6` | core | Produção (cutover 2026-04-22) |
| 7 | Scar AI — GuDesignerPro (Gustavo) | `7` | core | Em teste real do dono |
| — | Ensinaja (Douglas) | — | n8n | A migrar (último em n8n; aguarda prompt v2) |

---

## Histórico do canon

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-04-25 | @architect Aria | Criação. Capítulo 1 publicado. Estrutura dos capítulos restantes definida. |

---

*Próxima atualização: ao fim de cada fase do Brownfield Discovery (ver `.aiox/handoffs/`).*
