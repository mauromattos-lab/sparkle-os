# Epic 8 — AEO Squad Plaka: Correções de Semana 1 e Fortalecimento de Autoridade

**Status:** 🔍 InReview
**Criado por:** Morgan (@pm) — análise Atlas (@analyst) — 2026-04-19
**Fonte:** Relatório de diagnóstico AEO pós-semana-1 (`squads/aeo-squad-plaka/`)
**Objetivo:** Corrigir os gaps de distribuição e arquitetura identificados na Semana 1 do AEO Squad Plaka, aplicar correções retroativas nos 8 posts publicados, e fortalecer o squad para produzir conteúdo com maior potencial de citação por LLMs a partir da Semana 2.

---

## Contexto

O Atlas (@analyst) conduziu análise do blog `blog.plakaacessorios.com` ao final da Semana 1 e identificou 8 gaps críticos/altos/médios. O conteúdo produzido tem qualidade sólida (estrutura answer-first, FAQ com JSON-LD, CTAs contextuais), mas a **camada de distribuição e arquitetura está frágil**:

- 8 posts sem feature image → Open Graph quebrado, schema ImageObject inválido
- Sem tags/categorias no Ghost → posts existem como ilhas, sem cluster semântico
- Links internos apenas no footer, não contextual no corpo do texto
- Sem pillar pages para agregar autoridade dos clusters
- Tagline genérica, sem bio de autor, sem citações externas nos posts técnicos
- 2 posts publicados no mesmo dia (18/04) — scheduling indevido

**Scorecard Semana 1:** 41/80 — base sólida, estrutura de distribuição frágil.

**Risco de não corrigir:** posts perdem oportunidade de citação por LLMs na janela dos primeiros 4-6 semanas pós-publicação — período crítico de indexação.

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| [8.1](./8.1.story.md) | Ghost: Tags, Taxonomia e Correções de Estrutura | ✅ Done | P1 — Blocker | — | @dev |
| [8.2](./8.2.story.md) | Feature Images: Backfill e Product Enricher no Fluxo Manual | 🔍 InReview | P1 | 8.1 | @dev |
| [8.3](./8.3.story.md) | Squad: Contextual Linking, Citações e Pillar Page | 🔍 InReview | P2 | 8.1 | @dev |

---

## Sequência de Execução

```
Wave 1 — Estrutura (blocker):
  8.1 — Tags Ghost + taxonomia + tagline + author bio
        → Posts ganham hierarquia semântica e breadcrumbs
        → Pillar pages de categoria geradas automaticamente pelo Ghost

Wave 2 — Visual (após 8.1):
  8.2 — Feature images via product-enricher + backfill nos 8 posts
        → Open Graph completo, schema ImageObject válido
        → Pinterest desbloqueado

Wave 3 — Conteúdo (paralelo à 8.2):
  8.3 — Squad task/workflow updates + pillar page Cuidados
        → Lyra passa a incluir contextual links e citações
        → Scheduling: máx 1 post/dia
        → Pillar page agrega 3 posts de cuidados existentes
```

---

## Stack Afetada

| Componente | Mudança |
|-----------|---------|
| Ghost CMS Admin API | Tags, author bio, tagline, feature images via PATCH |
| `packages/content-engine/scripts/` | Novos scripts de backfill |
| `packages/content-engine/src/ghost-publisher.ts` | Já suporta feature_image — integrar no fluxo manual |
| `squads/aeo-squad-plaka/tasks/write-post.md` | Adicionar contextual linking + citações |
| `squads/aeo-squad-plaka/tasks/register-post.md` | Validar scheduling (1 post/dia) |
| `squads/aeo-squad-plaka/workflows/daily-content.yaml` | Gate de scheduling |

---

## Definition of Done do Epic 8

- [ ] 8 posts existentes com tags AEO aplicadas
- [ ] Taxonomy pages (`/tag/cuidados/`, `/tag/qualidade/`, etc.) acessíveis no Ghost
- [ ] 8 posts com feature image resolvida via product-enricher
- [ ] Open Graph `og:image` presente em todos os posts
- [ ] Tagline do blog atualizada para identidade semi joias
- [ ] Bio de autor criada no Ghost
- [ ] Pillar page "Guia de Cuidados com Semi Joias" publicada com links para 3 posts
- [ ] `write-post.md` atualizado com regra de contextual linking e citação obrigatória
- [ ] `daily-content.yaml` com gate de scheduling (máx 1 post/dia)
- [ ] Scorecard AEO estimado: 65+/80 (vs. 41/80 atual)

---

## Escopo FORA deste Epic

- Criação de todas as pillar pages (apenas Cuidados neste epic — as demais após validação)
- Pinterest publisher automático — depende de token de API (issue separada)
- Melhoria de velocidade de página / Core Web Vitals — escopo futuro
- Estratégia de backlinks externos — fora do controle do squad
