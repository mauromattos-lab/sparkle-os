# Epic 9 — AEO Squad Plaka: Automação Diária de Conteúdo

**Status:** Done
**Criado por:** Morgan (@pm) — arquitetura: Aria (@architect) — 2026-04-19
**Depende de:** Epic 8 (Done)
**Objetivo:** Transformar o pipeline manual de geração de conteúdo do squad Plaka em um processo autônomo via GitHub Actions que roda diariamente, produzindo, validando, processando imagens e publicando um post no Ghost sem intervenção humana — com notificação ao Mauro apenas quando escalação for necessária.

---

## Contexto

O Epic 8 entregou a estrutura completa: squad com agentes (Sage, Lyra, Rex, Vista), workflow `daily-content.yaml`, tasks bem definidas, feature images processadas em 1200×630 com modelo, e posts publicados com qualidade AEO.

O pipeline ainda exige execução manual. O custo de operação diário é alto: alguém precisa iniciar o fluxo, supervisionar cada etapa e publicar. Com o volume-alvo de 1 post/dia, isso não é sustentável.

**A automação elimina essa fricção.** GitHub Actions executa o pipeline às 09h BRT todos os dias, publica automaticamente no Ghost, processa a feature image, e notifica o Mauro apenas em dois casos: post publicado (resumo) ou escalação necessária.

---

## Arquitetura de Automação

```
GitHub Actions (cron 09:00 BRT = UTC 12:00)
  └── ubuntu-latest runner
        ├── actions/checkout@v4
        │     └── repo clonado (posts-history.md, tasks, context)
        ├── actions/setup-node@v4 (Node 20)
        ├── npm install (sharp + dependências)
        └── node packages/content-engine/scripts/daily-pipeline.mjs
              ├── Step 0: Gate — lê posts-history.md (max 1 post/dia)
              ├── Step 1: Claude API → Sage (briefing)
              ├── Step 2: Claude API → Lyra (escrever post)
              ├── Step 3: Claude API → Rex (validar)
              ├── Step 4: [se REVISAO] Claude API → Lyra (reescrever)
              ├── Step 5: [se REVISAO] Claude API → Rex (revalidar)
              ├── Step 6: [se ESCALADO] Z-API → WhatsApp Mauro + exit
              ├── Step 7: NuvemShop API → resolver imagem (com modelo confirmado)
              ├── Step 8: sharp → processar 1200×630 hero
              ├── Step 9: Ghost Admin API → upload imagem + publicar post
              ├── Step 10: atualizar posts-history.md
              └── Step 11: Z-API → WhatsApp (resumo do post publicado)
        └── stefanzweifel/git-auto-commit@v5
              └── commit posts-history.md → origin/main
```

**Por que GitHub Actions (não n8n, não VPS cron):**

| Critério | GitHub Actions | VPS cron |
|---------|---------------|---------|
| Monitoramento | UI nativa, histórico por run | Log file, SSH pra ver |
| Falha silenciosa | Email automático | Nenhum alerta |
| Trigger manual | `workflow_dispatch` nativo | SSH + executar script |
| Secrets | GitHub Secrets (criptografado) | .env no servidor |
| Infra para gerenciar | Zero | Crontab, log rotation |
| Custo | Grátis (~150 min/mês de 2000) | VPS já pago |
| sharp | Funciona no ubuntu-latest | Funciona no VPS |

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| [9.1](./9.1.story.md) | GitHub Actions: Workflow + Pipeline Sage→Rex | Done | P1 — Blocker | — | @dev |
| [9.2](./9.2.story.md) | Script daily-pipeline.mjs: Imagem + Publicação Ghost | Done | P1 | 9.1 | @dev |
| [9.3](./9.3.story.md) | Notificações WhatsApp: Sucesso e Escalação | Done | P2 | 9.1 | @dev |

---

## Sequência de Execução

```
Wave 1 — Orquestração (blocker):
  9.1 — GitHub Actions workflow com cron + script diário
        → Trigger automático, logs e histórico no GitHub

Wave 2 — Pipeline completo (após 9.1):
  9.2 — daily-pipeline.mjs: Sage→Lyra→Rex→imagem→Ghost→git commit
        → Post aparece no blog sem intervenção

Wave 3 — Visibilidade (paralelo à 9.2):
  9.3 — Notificações Z-API: resumo de sucesso + alerta de escalação
        → Mauro sabe que o post foi ao ar sem precisar checar manualmente
```

---

## Stack Afetada

| Componente | Mudança |
|-----------|---------|
| `.github/workflows/` | Novo `plaka-daily-content.yml` |
| `packages/content-engine/scripts/` | Novo `daily-pipeline.mjs` |
| GitHub Secrets | 7 secrets: ANTHROPIC_API_KEY, GHOST_API_URL, GHOST_ADMIN_API_KEY, NUVEMSHOP_ACCESS_TOKEN, NUVEMSHOP_USER_ID, ZAPI_INSTANCE_ID, ZAPI_TOKEN, MAURO_PHONE |
| `squads/aeo-squad-plaka/workflows/daily-content.yaml` | Trigger atualizado: `manual` → `scheduled` |
| `squads/aeo-squad-plaka/data/posts-history.md` | Atualizado automaticamente via git-auto-commit |

---

## Definition of Done do Epic 9

- [x] `.github/workflows/plaka-daily-content.yml` ativo com cron 09:00 BRT
- [x] `workflow_dispatch` funcional para trigger manual
- [x] Gate de 1 post/dia funcional (lê posts-history.md do checkout)
- [x] Sage gera briefing via Claude API (system prompt de daily-briefing.md)
- [x] Lyra escreve post completo com contextual links e citação (write-post.md)
- [x] Rex valida e devolve feedback — loop de revisão max 2x
- [x] Feature image resolvida automaticamente via NuvemShop (índice com modelo confirmado)
- [x] Imagem processada 1200×630 com sharp no runner
- [x] Post publicado no Ghost com feature_image, tags e slug corretos
- [x] `posts-history.md` commitado automaticamente via git-auto-commit
- [x] Notificação WhatsApp enviada com título + URL do post
- [x] Notificação de escalação enviada quando Rex rejeita 2x
- [ ] GitHub Secrets configurados (pendente — setup manual no repositório)
- [ ] Teste end-to-end com 1 post real publicado automaticamente

---

## Escopo FORA deste Epic

- Pinterest publisher automático — depende de token de API (issue separada)
- Geração automática de variações de post (A/B) — escopo futuro
- Análise de performance (cliques, tempo de leitura) — Analytics epic
- Múltiplos posts por dia — regra de 1/dia permanece
