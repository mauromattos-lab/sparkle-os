# Epic: zenya-prompts-refactor

**Status:** Open
**Owner:** @pm (Morgan)
**Origem:** ADR-001 — `docs/architecture/adr/ADR-001-zenya-prompt-storage.md`
**Data de abertura:** 2026-04-21

---

## Objetivo

Migrar todos os tenants Zenya legados para o novo padrão de armazenamento de prompts definido no ADR-001: prompts versionados em markdown com front-matter YAML em `docs/zenya/tenants/{slug}/prompt.md`, carregados em runtime pelos scripts de seed via `gray-matter`.

## Por que existe

O padrão atual (prompt hardcoded como template literal JavaScript no seed script) compromete revisão, auditoria e iteração sobre prompts. A ADR-001 estabelece o caminho novo, mas 4 tenants legados precisam de migração. Este epic organiza essa migração por nível de risco, com gates explícitos entre fases.

Fun Personalize — o primeiro cliente comercial em produção — **exige** gate formal. Não pode ser "story esquecida no backlog".

## Stories

> Ordem de execução importa: stories posteriores dependem de capacidades entregues por stories anteriores. Não paralelizar indevidamente.

| # | Story | Escopo | Risco | Dependências |
|---|-------|--------|-------|--------------|
| 1 | `zenya-prompts-01-plaka-hl` | PLAKA nasce no padrão + HL migrado antes do cutover | LOW | Fase 0 (feita na Scar AI-01) |
| 2 | `zenya-prompts-02-prime` | Zenya Prime migrado + implementar `--dry-run` genérico | MED | Story 1 |
| 3 | `zenya-prompts-03-fun-personalize` | Fun Personalize migrado com gates (dry-run obrigatório + janela + backup + smoke test) | HIGH | Story 2 (usa `--dry-run`) |
| 4 | `zenya-prompts-04-governance` | Rule em `.claude/rules/` + atualização do TENANT-PLAYBOOK | LOW | Story 3 |

**Fase 0 (setup)** não está no epic porque está absorvida na `scar-ai-onboarding-01` (Fase F do README dessa story). Quando Scar-AI-01 terminar, a infra do padrão novo (gray-matter dep, pasta `docs/zenya/tenants/`, seed Scar refatorado) estará pronta.

## Gates obrigatórios

Cada story só transiciona para InProgress quando a anterior estiver Done.

- Gate Story 1 → 2: `--dry-run` ainda não existe. Requisito da Story 2.
- Gate Story 2 → 3: `--dry-run` tem de estar mergeado e validado em sandbox.
- Gate Story 3 → 4: governança só se formaliza com o rollout executado.

## Critérios de sucesso do epic

- [ ] Todos os 5 tenants Zenya com `docs/zenya/tenants/{slug}/prompt.md`
- [ ] Nenhum `SYSTEM_PROMPT` hardcoded em scripts de seed
- [ ] Rule ativo em `.claude/rules/` garantindo que novos tenants nasçam no padrão
- [ ] `TENANT-PLAYBOOK.md` atualizado referenciando ADR-001
- [ ] Zero regressão em Fun Personalize (smoke test pós-cutover aprovado)
- [ ] Todos os seeds suportam `--dry-run`

## Não escopo

- Mudança de runtime do core (core continua lendo do banco com cache 5min — ADR-001 D3)
- Hot reload de prompts sem re-seed
- CHANGELOG.md por tenant (ADR-001 D4)
- Validação automática de conteúdo do prompt (pode virar epic separado)

## Tenants referenciados

| Tenant | Slug proposto | Risco | Estado pós-migração |
|--------|---------------|-------|---------------------|
| Zenya Prime | `zenya-prime` | MED | `docs/zenya/tenants/zenya-prime/prompt.md` |
| Fun Personalize | `fun-personalize` | HIGH | `docs/zenya/tenants/fun-personalize/prompt.md` |
| HL Importados | `hl-importados` | LOW | `docs/zenya/tenants/hl-importados/prompt.md` |
| PLAKA | `plaka` | LOW | `docs/zenya/tenants/plaka/prompt.md` |
| Scar AI | `scar-ai` | — (já no padrão via Fase F) | `docs/zenya/tenants/scar-ai/prompt.md` |

## Referências

- ADR completo: `docs/architecture/adr/ADR-001-zenya-prompt-storage.md`
- Handoff architect→pm: `.aiox/handoffs/handoff-architect-to-pm-20260421.yaml`
- Padrão vigente: `packages/zenya/scripts/seed-hl-tenant.mjs`
- Padrão novo (referência inicial): `packages/zenya/scripts/seed-scar-tenant.mjs`
