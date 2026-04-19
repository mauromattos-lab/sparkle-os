# Epic 9 — AEO Squad Plaka: Automação Diária de Conteúdo

**Status:** Draft
**Criado por:** Morgan (@pm) — 2026-04-19
**Depende de:** Epic 8 (Done)
**Objetivo:** Transformar o pipeline manual de geração de conteúdo do squad Plaka em um processo autônomo que roda diariamente no servidor, produzindo, validando, processando imagens e publicando um post no Ghost sem intervenção humana — com notificação ao Mauro apenas quando escalação for necessária.

---

## Contexto

O Epic 8 entregou a estrutura completa: squad com agentes (Sage, Lyra, Rex, Vista), workflow `daily-content.yaml`, tasks bem definidas, feature images processadas em 1200×630 com modelo, e posts publicados com qualidade AEO.

O pipeline ainda exige execução manual. O custo de operação diário é alto: alguém precisa iniciar o fluxo, supervisionar cada etapa e publicar. Com o volume-alvo de 1 post/dia, isso não é sustentável.

**A automação elimina essa fricção.** O servidor executa o pipeline às 09h BRT todos os dias, publica automaticamente no Ghost, processa a feature image, e notifica o Mauro apenas em dois casos: post publicado (resumo) ou escalação necessária (problema que precisa de olho humano).

---

## Arquitetura de Automação

```
VPS (187.77.37.88)
  ├── n8n (porta 5678) ← orquestrador principal
  │     └── Workflow: plaka-daily-content
  │           ├── Trigger: cron 09:00 BRT (America/Sao_Paulo)
  │           ├── Step 0: Gate — posts-history.md (max 1/dia)
  │           ├── Step 1: Claude API → Sage (briefing)
  │           ├── Step 2: Claude API → Lyra (escrever post)
  │           ├── Step 3: Claude API → Rex (validar)
  │           ├── Step 4: [se REVISAO] Claude API → Lyra (reescrever)
  │           ├── Step 5: [se REVISAO] Claude API → Rex (revalidar)
  │           ├── Step 6: [se ESCALADO] → Notificar Mauro e parar
  │           ├── Step 7: NuvemShop API → resolver imagem via product-enricher
  │           ├── Step 8: Node.js sharp → processar 1200×630 hero
  │           ├── Step 9: Ghost Admin API → publicar post com feature_image
  │           ├── Step 10: Ghost Admin API → atualizar posts-history.md
  │           └── Step 11: Zenya/Z-API → notificar Mauro (resumo do post)
  └── Node.js scripts (content-engine)
        ├── auto-publish-post.mjs  ← novo (Story 9.2)
        └── process-feature-images.mjs  ← já existe (Story 8.2)
```

**Por que n8n?**
- Já roda no VPS (porta 5678, usado pelo Zenya)
- Interface visual para debugar cada step
- Retry automático em falhas de rede
- Histórico de execuções visível
- Fácil de pausar/retomar sem editar código

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| [9.1](./9.1.story.md) | n8n Workflow: Trigger Cron + Pipeline Sage→Rex | Draft | P1 — Blocker | — | @dev |
| [9.2](./9.2.story.md) | Publicação Automática: Feature Image + Ghost | Draft | P1 | 9.1 | @dev |
| [9.3](./9.3.story.md) | Notificações: WhatsApp para Sucesso e Escalação | Draft | P2 | 9.1 | @dev |

---

## Sequência de Execução

```
Wave 1 — Orquestração (blocker):
  9.1 — n8n workflow com cron + steps Sage, Lyra, Rex, loop de revisão
        → Pipeline inteligente, gera post aprovado automaticamente

Wave 2 — Publicação (após 9.1):
  9.2 — Publicação automática: feature image via NuvemShop + processamento
        sharp + POST no Ghost Admin API
        → Post aparece no blog sem intervenção

Wave 3 — Visibilidade (paralelo à 9.2):
  9.3 — Notificações Z-API: resumo de sucesso + alerta de escalação
        → Mauro sabe que o post foi ao ar sem precisar checar manualmente
```

---

## Stack Afetada

| Componente | Mudança |
|-----------|---------|
| n8n (VPS) | Novo workflow `plaka-daily-content` com 11 steps |
| `packages/content-engine/scripts/` | Novo `auto-publish-post.mjs` |
| `squads/aeo-squad-plaka/workflows/daily-content.yaml` | Trigger alterado de `manual` → `scheduled` (documentar) |
| `squads/aeo-squad-plaka/data/posts-history.md` | Atualizado automaticamente pelo pipeline |
| Z-API / Zenya | Novo endpoint de notificação de publicação |

---

## Definition of Done do Epic 9

- [ ] Workflow n8n `plaka-daily-content` ativo no VPS, trigger cron 09:00 BRT
- [ ] Gate de 1 post/dia funcional (step-0 lê posts-history.md)
- [ ] Sage gera briefing via Claude API (system prompt fiel ao task/daily-briefing.md)
- [ ] Lyra escreve post completo com contextual links e citação (task/write-post.md)
- [ ] Rex valida e devolve feedback — loop de revisão max 2x
- [ ] Feature image resolvida automaticamente via NuvemShop + processada 1200×630
- [ ] Post publicado no Ghost com feature_image, tags e slug corretos
- [ ] `posts-history.md` atualizado automaticamente após publicação
- [ ] Notificação WhatsApp enviada com título + URL do post
- [ ] Notificação de escalação enviada quando Rex rejeita 2x
- [ ] Teste end-to-end com 1 post real publicado automaticamente

---

## Escopo FORA deste Epic

- Pinterest publisher automático — depende de token de API (issue separada)
- Geração automática de variações de post (A/B) — escopo futuro
- Análise de performance (cliques, tempo de leitura) — Analytics epic
- Múltiplos posts por dia — regra de 1/dia permanece
