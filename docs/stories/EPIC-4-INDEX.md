# Epic 4 — Interface de Pilotagem v1

**Status:** ✅ Done — 8/8 stories implementadas e aprovadas pelo @architect  
**Criado por:** Morgan (@pm)  
**Data:** 2026-04-12  
**Fonte:** `docs/prd.md` §Epic 4  
**Objetivo:** Construir o cockpit de Mauro — visibilidade total do SparkleOS sem precisar mergulhar em logs técnicos. Painel único que consolida estado do sistema, atividade dos agentes, fila de decisões, saúde da Zenya, estado do Cérebro e custos operacionais. Construído sobre dados reais produzidos pelos Epics 1, 2 e 3.

**Pré-requisito:** Epic 3 — Cérebro Coletivo v1 ✅ Done

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor | Quality Gate |
|-------|--------|--------|------------|------------|----------|--------------|
| [4.1](./4.1.story.md) | Dashboard do Sistema | ✅ Ready | P1 — Blocker | Epic 3 | @dev | @architect |
| [4.2](./4.2.story.md) | Atividade e Rastreabilidade dos Agentes | ✅ Ready | P2 | 4.1 | @dev | @architect |
| [4.3](./4.3.story.md) | Fila de Decisões de Mauro | ✅ Ready | P2 | 4.1 | @dev | @architect |
| [4.4](./4.4.story.md) | Painel do Núcleo Zenya | ✅ Ready | P2 | 4.1 | @dev | @architect |
| [4.5](./4.5.story.md) | Painel do Cérebro Coletivo | ✅ Ready | P2 | 4.1, Epic 3 | @dev | @architect |
| [4.6](./4.6.story.md) | Rastreamento de Custos | ✅ Ready | P2 | 4.1 | @dev | @architect |
| [4.7](./4.7.story.md) | Progresso de Épicos e Stories | ✅ Ready | P3 | 4.1 | @dev | @architect |
| [4.8](./4.8.story.md) | Resumo de Sessão para Mauro | ✅ Ready | P3 | 4.1–4.7 | @dev | @architect |

---

## Sequência de Execução

```
Wave 1 — Shell do Cockpit (blocker):
  4.1 — estrutura base, navegação, roteamento

Wave 2 — Painéis Core (paralelo após 4.1):
  4.2 + 4.3 + 4.4 + 4.5 + 4.6

Wave 3 — Progresso e Resumo (paralelo após wave 2):
  4.7 + 4.8
```

---

## Contexto de Arquitetura

| Aspecto | Detalhe |
|---------|---------|
| Natureza | Interface de leitura — consome dados já produzidos pelos Epics 1-3 |
| Fonte de dados Cérebro | `GET /brain/dashboard` — API disponível (Story 3.9) |
| Fonte de dados Stories | `docs/stories/` — parsing direto dos arquivos |
| Fonte de dados Custos | Story 1.8 — rastreamento já implementado |
| Acesso | Local-first — Mauro acessa via browser |
| Stack candidata | A decidir em 4.1 — padrão do projeto: Hono + HTML server-side (como 3.9) |

---

## Definition of Done do Epic 4

- [x] Story 4.1 Done — cockpit funcionando, navegação entre painéis, zero dados falsos
- [x] Story 4.2 Done — atividade de agentes rastreável
- [x] Story 4.3 Done — fila de decisões funcional com contexto suficiente
- [x] Story 4.4 Done — painel Zenya com dados reais
- [x] Story 4.5 Done — painel Cérebro consumindo API do Brain
- [x] Story 4.6 Done — custos reais com projeção vs. orçamento
- [x] Story 4.7 Done — progresso de épicos em tempo real
- [x] Story 4.8 Done — resumo de sessão gerado automaticamente
- [x] Mauro consegue entender o estado do SparkleOS em < 2 minutos  ← verificação humana ✓ 2026-04-12

---

## Handoff para @pm

**Próximo passo:** Executar Epic 4 — todas as 8 stories em Ready, prontas para implementação.

```
@pm *execute-epic docs/stories/epics/epic-4/EPIC-4-EXECUTION.yaml

Wave 1 (blocker):  4.1 — shell do cockpit (packages/cockpit/)
Wave 2 (paralelo): 4.2 + 4.3 + 4.4 + 4.5 + 4.6
Wave 3 (paralelo): 4.7 + 4.8

Quality Gate final: @architect após Epic 4 completo
```
