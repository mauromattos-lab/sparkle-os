# Epic 1 — Fundação: Habitat, Processo e Arsenal

**Status:** ✅ Done — 11/11 stories implementadas  
**Criado por:** @sm (River)  
**Data:** 2026-04-11  
**Objetivo:** Estabelecer tudo que os agentes AIOS precisam para operar dentro do SparkleOS com excelência.

---

## Stories

| Story | Título | Status | Prioridade | Depende de |
|-------|--------|--------|------------|------------|
| [1.1](./1.1.story.md) | Estrutura do Repositório SparkleOS | ✅ Done | P1 — Blocker | — |
| [1.2](./1.2.story.md) | AIOS Operacional no SparkleOS | ✅ Done | P1 — Blocker | 1.1 |
| [1.3](./1.3.story.md) | Persistência de Contexto dos Agentes | ✅ Done | P1 | 1.1, 1.2 |
| [1.4](./1.4.story.md) | ADR Registry | ✅ Done | P1 | 1.1, 1.2 |
| [1.5](./1.5.story.md) | Ecossistema de Ferramentas, Pesquisa e Credenciais | ✅ Done | P2 | 1.1, 1.2 |
| [1.6](./1.6.story.md) | Protocolo de Escalação para Mauro | ✅ Done | P2 | 1.1, 1.2, 1.4 |
| [1.7](./1.7.story.md) | Framework de SOPs | ✅ Done | P2 | 1.1, 1.2 |
| [1.8](./1.8.story.md) | Rastreamento de Custo por Operação | ✅ Done | P2 | 1.1, 1.3 |
| [1.9](./1.9.story.md) | Mapa de Capacidades dos Agentes | ✅ Done | P2 | 1.2, 1.5 |
| [1.10](./1.10.story.md) | Base de Segurança e Isolamento | ✅ Done | P2 | 1.1, 1.3 |
| [1.11](./1.11.story.md) | Validação End-to-End da Fundação | ✅ Done | P3 — Gate | 1.1–1.10 |

---

## Sequência de Execução Recomendada

```
Fase 1 (P1 — Paralelo após 1.1):
  1.1 → 1.2 → [1.3 + 1.4 em paralelo]

Fase 2 (P2 — Após fase 1):
  [1.5 + 1.6 + 1.7 + 1.8 + 1.9 + 1.10 em paralelo]

Fase 3 (Gate):
  1.11 (após todas as anteriores Done)
```

---

## Decisões de Arquitetura (Handoff @architect)

| Decisão | Detalhe |
|---------|---------|
| Plataforma | VPS Hostinger KVM2 + Coolify + Vercel + Supabase (custo zero adicional) |
| Stack | TypeScript + Hono + Next.js 15 + Postgres + Redis + pgvector |
| Context Store | Redis (72h TTL) + Postgres (permanente) — FR11 |
| ADR Registry | Arquivos .md em `docs/adrs/` + indexado no Postgres — FR12 |
| Zenya | n8n + Chatwoot fazer.ai + Z-API — coexiste com sistema antigo até Epic 2 |
| Agentes | AIOS locais durante construção — workers autônomos em Épicos futuros |

---

## Definition of Done do Epic 1
- [x] Stories 1.1–1.10 todas com status `Done` e @qa PASS
- [x] Story 1.11 (validação E2E) PASS — relatório em `docs/validation/epic-1-e2e-report.md`
- [x] `npm run test` passando em todos os packages (35/35 testes em packages/core)
- [x] Validação com dados reais no Supabase — todos os ACs PASS
