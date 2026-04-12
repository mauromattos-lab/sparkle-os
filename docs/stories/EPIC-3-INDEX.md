# Epic 3 — Cérebro Coletivo v1

**Status:** ✅ Done — 9/9 stories concluídas  
**Criado por:** Morgan (@pm)  
**Data:** 2026-04-11  
**Fonte:** `docs/prd.md` §Epic 3  
**Objetivo:** Implementar o primeiro ciclo funcional do Cérebro Coletivo — captura de insights da operação → validação de qualidade → aplicação mensurável. Arquitetura projetada desde o início para múltiplas fontes de conhecimento: operacional (Zenya), pesquisa (agentes) e externo (Mauro).

**Pré-requisito:** Epic 2 — Zenya Integrada ✅ Done

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor | Quality Gate |
|-------|--------|--------|------------|------------|----------|--------------|
| [3.1](./3.1.story.md) | Arquitetura do Cérebro Coletivo | ✅ Done | P1 — Blocker | Epic 2 | @architect | @pm |
| [3.2](./3.2.story.md) | Captura de Insights da Zenya | ✅ Done | P2 | 3.1 | @dev | @architect |
| [3.3](./3.3.story.md) | Validação de Qualidade do Conhecimento | ✅ Done | P2 | 3.1, 3.2 | @dev | @architect |
| [3.4](./3.4.story.md) | Mecanismo de Aplicação de Insights | ✅ Done | P2 | 3.1, 3.2, 3.3 | @dev | @architect |
| [3.5](./3.5.story.md) | Interface de Consulta do Cérebro para Agentes | ✅ Done | P2 | 3.1, 3.2 | @dev | @architect |
| [3.6](./3.6.story.md) | Ingestão de Conhecimento Externo | ✅ Done | P3 | 3.1, 3.5 | @dev | @architect |
| [3.7](./3.7.story.md) | Ciclo de Vida do Conhecimento | ✅ Done | P3 | 3.1, 3.2, 3.3 | @dev | @architect |
| [3.8](./3.8.story.md) | DNA de Mauro | ✅ Done | P2 | 3.1, 3.5 | @analyst | @pm |
| [3.9](./3.9.story.md) | Dashboard do Cérebro (coordenado com Epic 4) | ✅ Done | P3 | 3.1–3.7 | @dev | @architect |

---

## Sequência de Execução Recomendada

```
Fase 1 — Fundação Arquitetural (P1 — Blocker):
  3.1 (@architect decide tecnologia, modelo de dados, fontes, canonicalização)
  ↓
Fase 2 — Ciclo Core (P2 — Paralelo após 3.1):
  [3.2 + 3.3 + 3.8 em paralelo]
  ↓
Fase 3 — Aplicação e Consulta (P2 — Após 3.2 + 3.3):
  [3.4 + 3.5 em paralelo]
  ↓
Fase 4 — Extensão (P3 — Após 3.5):
  [3.6 + 3.7 em paralelo]
  ↓
Fase 5 — Visibilidade (P3 — Gate final, coordena com Epic 4):
  3.9
```

---

## Contexto de Arquitetura

| Aspecto | Detalhe |
|---------|---------|
| Stack base | TypeScript + pnpm monorepo (ADR-001) |
| Package alvo | `packages/brain/` — novo package a ser criado |
| Fontes de conhecimento | Operacional (Zenya), Pesquisa (agentes), Externo (Mauro) |
| Ciclo obrigatório | Captura → Validação → Aplicação mensurável (FR6) |
| Pré-requisitos críticos | `docs/zenya/NUCLEUS-CONTRACT.md` (outputs formais) e `docs/zenya/BASELINE-PERFORMANCE.md` (referência de melhoria) |
| pgvector | Já disponível via Supabase — candidato natural para knowledge store (a confirmar em 3.1) |
| DNA de Mauro | Co-criado em sessão direta com Mauro — não extraído de docs antigos (FR15) |
| Coordenação Epic 4 | Story 3.9 entrega dados que alimentam o dashboard do Epic 4 |

---

## Requisitos Cobertos por este Epic

| Requisito | Descrição |
|-----------|-----------|
| FR5 | Capturar insights da operação da Zenya como insumo para melhoria |
| FR6 | Aplicar insights de forma mensurável — ciclo completo obrigatório |
| FR15 | Arquitetura multi-fonte: operacional + pesquisa + externo (Mauro) |
| NFR1 | Sistema opera sem intervenção manual constante de Mauro |

---

## Riscos do Epic

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Canonicalização complexa | Duplicação de conhecimento | Story 3.1 define estratégia pragmática antes de qualquer implementação |
| DNA de Mauro mal capturado | Filtros de raciocínio imprecisos | Story 3.8 obriga sessão direta com Mauro — não permite extração de docs |
| Ciclo sem aplicação real | FR6 não atendido | Story 3.4 AC explícito: melhoria mensurável vs. baseline (Story 2.6) |
| Stack incompatível com Epic 1 | Reengenharia | Story 3.1 avalia pgvector antes de decidir tecnologia |

---

## Definition of Done do Epic 3

- [ ] Story 3.1 Done — arquitetura documentada, ADR criado, modelo de dados definido
- [ ] Story 3.2 Done — pipeline de captura conectado à Zenya, insights reais sendo coletados
- [ ] Story 3.3 Done — validação de qualidade ativa, threshold definido e funcionando
- [ ] Story 3.4 Done — pelo menos um tipo de insight aplicado com melhoria mensurável vs. baseline (Story 2.6)
- [ ] Story 3.5 Done — interface de consulta disponível e funcional para todos os agentes
- [x] Story 3.6 Done — agentes e Mauro conseguem ingerir conhecimento externo
- [x] Story 3.7 Done — ciclo de vida ativo, conhecimento obsoleto não polui o Cérebro
- [x] Story 3.8 Done — DNA de Mauro co-criado, 17 insights ingeridos no Supabase, filtros de raciocínio ativos
- [x] Story 3.9 Done — dashboard do Cérebro integrado com Epic 4
- [ ] Ciclo completo validado end-to-end: insight capturado → validado → aplicado → melhoria mensurável documentada

---

## Handoff para @sm

**Próximo passo:** Criar Story 3.1 — Arquitetura do Cérebro Coletivo

```
Contexto para @sm:
- Epic 3 definido em docs/prd.md §Epic 3
- Stack: pnpm monorepo, packages/brain/ (novo package)
- Story 3.1 é BLOCKER de todas as demais — prioridade máxima
- @architect é o executor de 3.1 — story deve conter contexto técnico completo
- Pré-requisitos relevantes: NUCLEUS-CONTRACT.md, BASELINE-PERFORMANCE.md, KNOWLEDGE-BASE.md
```
