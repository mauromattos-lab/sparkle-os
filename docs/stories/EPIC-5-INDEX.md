# Epic 5 — Content Engine: Automação e Integração

**Status:** ✅ Done — 6/6 stories implementadas e aprovadas (validado @po 2026-04-12, implementado 2026-04-12 → 2026-04-13)
**Criado por:** Morgan (@pm)
**Data:** 2026-04-12
**Fonte:** Sessão de design AEO Squad Plaka + decisões de Mauro
**Objetivo:** Conectar o AEO Squad Plaka às plataformas de publicação (NuvemShop e Pinterest), adicionar gate de aprovação no Cockpit e criar a camada de scheduling diário — transformando o squad num produto que roda com intervenção mínima de Mauro.

**Pré-requisito:** Epic 4 — Interface de Pilotagem v1 ✅ Done

---

## Contexto

O AEO Squad Plaka (Sage, Lyra, Rex, Vista) foi construído e validado em sessão única. O squad produz diariamente:
- 1 post AEO completo com imagem referenciada
- 1 pin do Pinterest com copy e hashtags

O que falta é a **camada de conexão** entre o output do squad e as plataformas — mais o gate de aprovação de Mauro no Cockpit antes de qualquer publicação.

**Decisão de produto:** publicação não é automática. Mauro aprova no Cockpit → sistema publica. Simples e seguro.

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| [5.1](./5.1.story.md) | Scheduler Diário do Squad | Ready | P1 — Blocker | — | @dev |
| [5.2](./5.2.story.md) | Gate de Aprovação no Cockpit | Ready | P1 — Blocker | 5.1 | @dev |
| [5.3](./5.3.story.md) | Integração NuvemShop Blog | Ready | P2 | 5.2 | @dev |
| [5.4](./5.4.story.md) | Integração Pinterest | Ready | P2 | 5.2 | @dev |
| [5.5](./5.5.story.md) | Integração Google Drive | Ready | P2 | 5.1 | @dev |
| [5.6](./5.6.story.md) | Onboarding de Cliente | Ready | P3 | 5.3, 5.4 | @dev |

---

## Sequência de Execução

```
Wave 1 — Base (blocker):
  5.1 — Scheduler diário (trigger da pipeline)
  
Wave 2 — Gate (blocker):
  5.2 — Aprovação no Cockpit (Mauro vê e aprova)

Wave 3 — Publicação (paralelo após 5.2):
  5.3 — NuvemShop blog
  5.4 — Pinterest
  5.5 — Google Drive (imagens)

Wave 4 — Produto (após wave 3):
  5.6 — Onboarding de cliente (multi-cliente)
```

---

## Arquitetura de Decisão

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Aprovação | Via Cockpit | Já existe, Mauro já usa, zero nova UI |
| Scheduling | Cron interno SparkleOS | Sem dependência externa |
| Imagens blog | Catálogo NuvemShop API | Formato correto, sem trabalho extra |
| Imagens Pinterest | Google Drive da Luiza | 9:16 editorial, já cedido |
| Primeira versão | Simplest viable | Mauro acompanha manualmente no início |

---

## Definition of Done do Epic 5

- [ ] Pipeline roda automaticamente 1x por dia
- [ ] Post gerado aparece no Cockpit com status "Aguardando aprovação"
- [ ] Mauro aprova em 1 clique no Cockpit
- [ ] Após aprovação: post publicado no blog NuvemShop com imagem e alt text
- [ ] Após aprovação: pin publicado no Pinterest com copy e hashtags
- [ ] Falhas são logadas e visíveis no Cockpit
- [ ] Mauro consegue operar o sistema inteiro sem abrir terminal

---

## Escopo FORA deste Epic

- Geração de imagens por IA (Midjourney, DALL-E) — evolução futura
- Analytics de performance dos posts — Epic 6
- Multi-cliente além da Plaka — Story 5.6 cobre onboarding básico
- Integração com Zenya SAC para dados de perguntas — Epic 6
