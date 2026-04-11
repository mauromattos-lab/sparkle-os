# Epic 2 — Zenya Integrada

**Status:** Draft  
**Criado por:** Morgan (@pm)  
**Data:** 2026-04-11  
**Objetivo:** Inventariar, documentar e integrar formalmente os ~15 fluxos n8n da Zenya dentro do SparkleOS como primeiro Núcleo do sistema — com IP preservado, rastreabilidade completa, processo de provisionamento executável pelos agentes, e outputs formais definidos para alimentar outros sistemas.

**Pré-requisito:** Epic 1 — Fundação ✅ Done

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor | Quality Gate |
|-------|--------|--------|------------|------------|----------|--------------|
| [2.1](./2.1.story.md) | Inventário dos Fluxos n8n da Zenya | ✅ Done | P1 — Blocker | Epic 1 | @analyst | @pm |
| [2.2](./2.2.story.md) | Preservação e Versionamento do IP da Zenya | ✅ Done | P1 | Epic 1 | @analyst | @pm |
| [2.3](./2.3.story.md) | Integração Formal da Zenya como Núcleo | ✅ Done | P1 | 2.1, 2.2 | @architect | @pm |
| [2.4](./2.4.story.md) | Processo de Provisionamento de Novo Cliente Zenya | 🔄 InReview | P2 | 2.1, 2.3 | @dev | @architect |
| [2.5](./2.5.story.md) | Protocolo de Melhoria Incremental dos Fluxos | 🔄 InReview | P2 | 2.1, 2.3 | @architect | @pm |
| [2.6](./2.6.story.md) | Baseline de Performance da Zenya | 🔄 InReview | P2 | 2.1, 2.3 | @analyst | @pm |
| [2.7](./2.7.story.md) | Isolamento de Dados por Cliente na Zenya | 🚧 InProgress | P2 | 2.1, 2.3, 2.4 | @data-engineer | @dev |
| [2.8](./2.8.story.md) | Base de Conhecimento Operacional da Zenya | 🔄 InReview | P2 | 2.1, 2.3 | @analyst | @pm |
| [2.9](./2.9.story.md) | Protocolo de Erro e Fallback da Zenya | ✅ Ready | P3 | 2.1, 2.3 | @dev | @architect |

---

## Sequência de Execução Recomendada

```
Fase 1 — Conhecimento Base (P1 — Paralelo):
  [2.1 + 2.2 em paralelo]
  ↓
Fase 2 — Integração Formal (P1 — Após Fase 1):
  2.3 (depende de 2.1 + 2.2)
  ↓
Fase 3 — Operacionalização (P2 — Paralelo após 2.3):
  [2.4 + 2.5 + 2.6 + 2.7 + 2.8 em paralelo]
  ↓
Fase 4 — Resiliência (P3 — Após Fase 3):
  2.9
```

---

## Contexto de Arquitetura

| Aspecto | Detalhe |
|---------|---------|
| Sistema alvo | ~15 fluxos n8n da Zenya — atendente IA no WhatsApp |
| Abordagem | Inventário primeiro, modificações incrementais depois |
| IP da Zenya | Lore, personalidade e arquivos visuais — mudanças requerem aprovação de Mauro |
| Isolamento | Dados por cliente — NFR3 obrigatório |
| Saídas para outros Épicos | Conhecimento → Cérebro Coletivo (Epic 3), métricas → Interface (Epic 4) |
| Plataforma n8n | Mantida no curto prazo — migração gradual para código em épicos futuros |

---

## Requisitos Cobertos por este Epic

| Requisito | Descrição |
|-----------|-----------|
| FR3 | Integrar formalmente os ~15 fluxos n8n da Zenya |
| FR4 | Agentes capazes de clonar e modificar fluxos n8n incrementalmente |
| FR10 | IP da Zenya preservado e versionado |
| FR13 | Provisionamento de novo cliente executável pelos agentes |
| FR14 | Toda implementação rastreável a story AIOS |
| NFR3 | Isolamento de dados por cliente |
| NFR10 | Todo processo repetível com SOP documentado |

---

## Definition of Done do Epic 2

- [ ] Stories 2.1–2.8 todas com status `Done` e @qa PASS
- [ ] Story 2.9 (resiliência) Done
- [ ] Inventário completo dos ~15 fluxos n8n disponível e consultável por qualquer agente
- [ ] IP da Zenya importado ao SparkleOS com versão inicial tagueada
- [ ] Zenya documentada formalmente como Núcleo com inputs/outputs definidos
- [ ] Processo de provisionamento testado com simulação de cliente
- [ ] Isolamento de dados validado: cliente A não acessa dados do cliente B
- [ ] SOPs criados para: atualização de inventário, melhoria incremental, provisionamento, incidentes
- [ ] Baseline de performance coletado da operação real
- [ ] Base de conhecimento operacional estruturada e compatível com Epic 3
