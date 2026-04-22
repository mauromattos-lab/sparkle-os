# Epic 17 — Refino Brownfield dos demais tenants migrados

**Status:** ⚪ Draft
**Criado por:** Morgan (@pm) — 2026-04-22
**Depende de:** Epic 15 (método — Done) + Epic 16 (prova em 1 tenant — **Done 4/4**). Wave B (tenants pós-cutover) adicionalmente depende de Epic 7.8.
**Destrava:** Camadas 5-7 do [EPICS-OVERVIEW](./EPICS-OVERVIEW.md) — produto horizontal/vertical e automação de onboarding só fazem sentido com tenants saneados.

**Objetivo:** Aplicar o ciclo brownfield do Epic 15 (baseline → smoke → fix → janela) a **todos os tenants já em produção que ainda não passaram por refino formal**. Encerrar a prática de "refino retroativo informal" que aconteceu com PLAKA e Scar AI.

---

## Contexto

Hoje existem tenants que foram migrados ou configurados **antes** do método de refino existir (Epic 15 — `2026-04-22`). Eles estão em produção mas nunca passaram pelo ciclo formal:

- **PLAKA (Roberta)** — e-commerce, refinado iterativamente durante onboarding, sem story formal. Prompt v2.1 → v2.3, kb-sync multi-aba, fuzzy morfológico. Aprendizados foram persistidos em memórias, mas não em stories/gates.
- **Scar AI (Gustavo / GuDesignerPro)** — pré-venda, prompt-only multilíngue. Refino informal na branch `feature/scar-ai-onboarding-01`. Prompt v2 + smoke-scar.mjs, mas sem gate formal.
- **Demais tenants pós-Epic 7.8** — conforme cutover acontece, cada tenant cruza a fronteira "migrado mas não refinado formalmente" e entra no backlog deste epic.

O Epic 16 (Fun Personalize) provou que o ciclo funciona em tenant em produção real (com concern documentado e tudo). Replicar isso nos demais evita que:

1. Aprendizados fiquem em memória/commits e não em artefatos rastreáveis.
2. Regressões silenciosas persistam porque o tenant "aprendeu a conviver" com elas.
3. Ajustes no playbook não retroalimentem o Epic 15.

**Princípio:** um tenant brownfield não está "terminado" até passar pelo ciclo completo com gate @qa PASS.

---

## Arquitetura (processo)

```
Para cada tenant a refinar:

  Story 17.N — Refino brownfield do tenant <slug>
    │
    ├── Fase 1: Baseline + backup (espelha 16.1)
    ├── Fase 2: Smoke derivado da fonte real (espelha 16.2 — variante aplicável pelo tipo do tenant)
    ├── Fase 3: Fix iterativo pelo ROI (espelha 16.3)
    └── Fase 4: Janela + whitelist + monitoramento 96h (espelha 16.4)

Saída:
  - Story com gate @qa (PASS / CONCERNS / FAIL)
  - Backup do prompt em docs/stories/17/backups/
  - Smoke script em packages/zenya/scripts/smoke-<tenant>.mjs
  - Aprendizados alimentam Epic 15.v2 (revisão do playbook)
```

---

## Stories (provisional — ajusta conforme Epic 7.8 avança)

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|-----------|-----------|----------|
**Wave A — tenants já migrados (executável agora):**

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|-----------|-----------|----------|
| 17.1 | Refino brownfield — PLAKA (Roberta, Nuvemshop + Sheets KB) | Draft | P1 | Epic 16 Done ✅ | @dev |
| 17.2 | Refino brownfield — Scar AI / GuProDesigner (Gustavo, prompt-only PT/EN) | Draft | P1 | Epic 16 Done ✅ | @dev |

**Wave B — tenants pós-cutover Epic 7.8 (aguardam migração):**

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|-----------|-----------|----------|
| 17.3 | Refino brownfield — HL Importados (pós-cutover 7.8) | Blocked | P2 | Epic 7.8 story HL Done | @dev |
| 17.4 | Refino brownfield — Ensinaja (pós-cutover 7.8) | Blocked | P2 | Epic 7.8 story Ensinaja Done | @dev |
| 17.5 | Refino brownfield — Doceria Dona Geralda (pós-cutover 7.8) | Blocked | P2 | Epic 7.8 story Doceria Done | @dev |

**Retroalimentação do playbook:**

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|-----------|-----------|----------|
| 17.Z | Epic 15 v2 — adicionar variante "baixo volume + cliente engajado" + aprendizados Wave A/B | Draft | P2 | 17.1 + 17.2 Done (mín.) | @pm |

> Roster explícito: PLAKA, Fun, Scar → core (Fun já refinada via Epic 16). HL, Ensinaja, Doceria → n8n (entram via 7.8 → 17.3-17.5). Ver memória `project_tenant_roster` pra estado vivo.

---

## Escopo — IN

- Ciclo brownfield completo (Fases 1-4) por tenant.
- Backup do estado anterior (prompt, KB, tools) antes de qualquer mudança.
- Gate @qa formal por story (PASS / CONCERNS / FAIL).
- Coleta de ajustes ao playbook (entrada do Epic 15 v2).

## Escopo — OUT

- Criação de tenants novos (greenfield) — esses entram direto no core com método já aplicado, sem passar por este epic.
- Migração técnica n8n → core — isso é Epic 7.8.
- Adição de capacidades novas ao produto para o tenant — isso é Epic 11/13.
- Alteração do método em si — isso é Epic 15 (revisão) disparada pela story 17.Z.

---

## Sequência de Execução

```
Wave 1 — Pré-requisito: Epic 16 Done ✅ (4/4 stories fechadas)
  │   Prova que o ciclo fecha em produção real (Julia rodando com prompt v4).

Wave 2 — Refino dos tenants já migrados (paralelo):
  17.1 — PLAKA (Roberta)
  17.2 — Scar AI (Gustavo)

Wave 3 — Tenants adicionais conforme Epic 7.8 avança:
  17.3+ — cada cutover gera uma story nova aqui.

Wave 4 — Revisão do método (após 2-3 stories fechadas):
  17.Z — retroalimenta Epic 15 com aprendizados empíricos.
```

---

## Definition of Done do Epic 17

- [ ] Todos os tenants em produção antes de 2026-04-22 passaram pelo ciclo brownfield (ou têm waiver formal documentado)
- [ ] Cada tenant tem backup do estado original preservado
- [ ] Cada tenant tem smoke próprio versionado em `packages/zenya/scripts/`
- [ ] Playbook Epic 15 revisado com aprendizados → v2 publicado
- [ ] Zero débito de "refino informal" em aberto (sem tenant refinado fora do fluxo AIOX)

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Cliente reage mal a mudança de comportamento durante refino | Janela negociada + whitelist (replica Fase 4 do Epic 16) |
| Retrabalho em tenant que já está "funcionando bem" | Smoke derivado da fonte pode revelar bugs silenciosos que valem corrigir — ROI decide |
| Epic vira eterno conforme novos clientes chegam | Stories 17.3+ são **apenas** para tenants migrados informalmente. Greenfield novo passa por processo diferente, fora deste epic |
| Ajustes no playbook conflitam com Epic 16 já fechado | Story 17.Z gera Epic 15 v2 — Epic 16 não é reaberto |

---

## Changelog

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-04-22 | @pm Morgan | Criação do epic em Draft. Objetivo: absorver refino brownfield dos tenants pós-cutover do Epic 7.8. Stories 17.1 (PLAKA) e 17.2 (Scar AI) já identificadas. |
