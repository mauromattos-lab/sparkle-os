# Epic 6 — Canal de Blog AEO (Ghost CMS)

**Status:** 🔄 Em andamento — Stories 6.1 ✅ 6.2 ✅ 6.3 ✅ 6.4 ✅ 6.5 ✅ 6.6 ✅ 6.7 🔲 Draft
**Criado por:** Morgan (@pm)
**Data:** 2026-04-13
**Fonte:** Análise técnica Atlas (@analyst) + limitação descoberta na Nuvemshop API
**Objetivo:** Substituir o canal de publicação de blog da Nuvemshop (endpoint inexistente) por Ghost CMS hospedado na VPS existente, com conteúdo estruturado para AEO (Answer Engine Optimization).

**Pré-requisito:** Epic 5 — Content Engine: Automação e Integração ✅ Done

---

## Contexto

A Story 5.3 implementou `POST /blogs/{blog_id}/articles` — endpoint que **não existe na API da Nuvemshop**. O blog nativo da plataforma é gerenciado apenas via painel administrativo, sem suporte via API. O QA passou em testes unitários com mocks, mas a integração real nunca funcionou.

**Decisão estratégica:** em vez de usar as Pages da Nuvemshop (solução paliativa sem estrutura de blog), migrar para Ghost CMS instalado na VPS já disponível no projeto. Ghost oferece:
- API REST completa para publicação automatizada
- Schema `BlogPosting` nativo (essencial para AEO)
- RSS automático (consumido por crawlers de IA: Perplexity, ChatGPT Search)
- URL estruturada em subdomínio: `blog.plakaacessorios.com.br`

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| [6.1](./6.1.story.md) | PoC: Ghost CMS na VPS | ✅ Done | P1 — Blocker | — | @dev |
| [6.2](./6.2.story.md) | Ghost Publisher no Content Engine | ✅ Done | P1 | 6.1 | @dev |
| [6.3](./6.3.story.md) | Estrutura AEO no Conteúdo Gerado | ✅ Done | P2 | 6.2 | @dev |
| [6.4](./6.4.story.md) | Deprecação do NuvemShop Blog Publisher | ✅ Done | P3 | 6.2 | @dev |
| [6.5](./6.5.story.md) | Tema Ghost com Identidade Visual Plaka | ✅ Done | P2 | 6.2 | @ux-design-expert + @dev |
| [6.6](./6.6.story.md) | Enriquecimento do Briefing com Catálogo de Produtos | ✅ Done | P2 | 6.2, 5.6 | @dev |
| [6.7](./6.7.story.md) | AEO: Feature Image no Ghost Publisher | ✅ Ready | P2 | 6.2, 6.6 | @dev |

---

## Sequência de Execução

```
Wave 1 — Validação (blocker):
  6.1 — PoC Ghost CMS na VPS
        → Valida viabilidade técnica antes de qualquer investimento
        → GO: continua para wave 2
        → NO-GO: pivota para Nuvemshop Pages (plano B)

Wave 2 — Implementação (após GO na 6.1):
  6.2 — Ghost Publisher no Content Engine
        → ghost-publisher.ts integrado ao publication-orchestrator.ts

Wave 3 — Qualidade AEO (após 6.2):
  6.3 — Estrutura AEO no conteúdo
        → JSON-LD, Schema BlogPosting, bloco FAQ
  6.4 — Deprecação NuvemShop Blog Publisher
        → Remove dead code da 5.3, atualiza Cockpit

Wave 4 — Identidade Visual (paralelo, pode rodar antes de 6.3/6.4):
  6.5 — Tema Ghost com Identidade Visual Plaka
        → Pesquisa @analyst + design @ux-design-expert + implementação @dev
        → Blog com cara premium — potencialmente mais polido que a própria loja
```

> **Estratégia de ponte:** enquanto 6.2–6.5 são desenvolvidas, Mauro posta manualmente
> no Ghost (`http://187.77.37.88:2368/ghost`) para validar conteúdo e estratégia AEO
> na prática, sem esperar automação completa.

---

## Arquitetura de Decisão

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Plataforma de blog | Ghost CMS | API REST completa, Schema nativo, RSS |
| Hospedagem | VPS existente do projeto | Zero custo adicional, já disponível |
| Subdomínio | `blog.plakaacessorios.com.br` | Separação clara, SEO adequado |
| Estratégia de rollout | PoC primeiro (6.1) | Valida antes de comprometer |
| Publisher atual (5.3) | Deprecado após 6.2 | Dead code — endpoint Nuvemshop inexistente |

---

## Plano B (se PoC 6.1 falhar)

Se Ghost CMS na VPS não for viável (infra, DNS, custo), fallback para:
- `POST /v1/{id}/pages` da Nuvemshop com JSON-LD manual no HTML
- Estrutura de blog simulada via páginas institucionais
- RSS gerado manualmente via sitemap

---

## Definition of Done do Epic 6

- [ ] Ghost CMS instalado e acessível em `blog.plakaacessorios.com.br`
- [ ] Após aprovação no Cockpit, post é publicado no Ghost (não mais na Nuvemshop)
- [ ] Post publicado inclui Schema `BlogPosting` válido (testável via Google Rich Results)
- [ ] Post publicado inclui bloco FAQ com JSON-LD
- [ ] RSS do Ghost acessível em `blog.plakaacessorios.com.br/rss`
- [ ] Dead code da Story 5.3 removido
- [ ] Cockpit atualiza link para post no Ghost corretamente

---

## Escopo FORA deste Epic

- Analytics de performance dos posts (monitoramento de tráfego AEO) — Epic 7
- Integração com Zenya SAC para dados de perguntas frequentes — Epic 7
- Multi-cliente para blog (apenas Plaka neste epic)
- Geração de imagens por IA — evolução futura
- Analytics de performance do blog (tráfego, posições AEO) — Epic 7
- Configuração DNS `blog.plakaacessorios.com` — depende de acesso ao Google Domains (bloqueante externo)
