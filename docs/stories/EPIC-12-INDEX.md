# Epic 12 — Produção de Conteúdo da Zenya

**Status:** Draft
**Criado por:** Morgan (@pm) — inputs arquiteturais: Aria (@architect) — 2026-04-20
**Depende de:** Independente (pode rodar em paralelo com Epic 11)
**Objetivo:** Transformar a Zenya em máquina de produção de conteúdo para o negócio do cliente — posts, textos de produto, respostas-padrão e materiais de autoridade — gerados automaticamente com base no contexto do tenant.

---

## Contexto

Mauro identificou produção de conteúdo como área de grande impacto e paixão ("semanas de trabalho focado aqui"). A lógica é clara: clientes que usam Zenya têm negócios reais — imobiliárias, confeitarias, clínicas, advogados — e precisam de conteúdo constantemente.

A Zenya já conhece o contexto do negócio do cliente (histórico de conversas, produtos, serviços). Ela pode usar esse conhecimento para gerar:
- Posts para redes sociais (Instagram, WhatsApp Status)
- Descrições de produtos ou serviços
- Textos de follow-up personalizados
- Materiais de autoridade sobre o nicho

A infraestrutura do AEO Squad Plaka (Epic 8/9) serve de base tecnológica. O Content Engine já existe — aqui o escopo é adaptá-lo para produção por tenant.

**Regra Sparkle-first:** Pipeline de conteúdo validado no negócio da SparkleOS antes de qualquer cliente.

---

## Arquitetura

```
Trigger (manual via WhatsApp ou agendado)
  └── Fluxo n8n: Content Engine por Tenant
        ├── Contexto do tenant (ZenyaClient.metadata + histórico)
        ├── Claude API → Geração de conteúdo contextualizado
        ├── Validação (semelhante ao Rex do Plaka)
        └── Entrega: WhatsApp do gestor + opcional publicação direta
```

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| 12.1 — Spec Pipeline | Levantamento de requisitos de conteúdo por nicho | Draft | P0 | — | @pm + @analyst |
| 12.2 | Pipeline de geração de conteúdo por tenant (n8n + Claude) | Draft | P1 | 12.1 | @dev |
| 12.3 | Trigger via WhatsApp: gestor solicita conteúdo por comando | Draft | P1 | 12.2 | @dev |
| 12.4 | Agendamento automático: conteúdo programado por tenant | Draft | P2 | 12.2 | @dev |

---

## Sequência de Execução

```
Wave 0 — Spec (blocker):
  12.1 — Levantamento com @analyst: quais tipos de conteúdo, por nicho, formato
        → Sem isso, pipeline gera conteúdo genérico sem valor

Wave 1 — Pipeline base (após 12.1):
  12.2 — Fluxo n8n adaptado do Content Engine com contexto de tenant
        → Gestor recebe rascunho de conteúdo pronto para usar

Wave 2 — Experiência (após 12.2):
  12.3 — Comando via WhatsApp: "gera post da semana"
        → Interação natural, sem acessar nenhum painel

  12.4 — Agendamento: todo Monday às 9h, gera sugestão de conteúdo semanal
        → Operação autônoma, zero intervenção
```

---

## Stack Afetada

| Componente | Mudança |
|-----------|---------|
| `packages/content-engine/` | Adaptação para multi-tenant |
| n8n | Novo fluxo de content por tenant |
| `zenya_clients.metadata` | Campo `content_config` com preferências por tenant |
| Claude API | Prompts de geração contextualizada por nicho |

---

## Definition of Done do Epic 12

- [ ] Gestor envia "gera post" no WhatsApp → recebe rascunho em < 60s
- [ ] Conteúdo usa contexto real do negócio (nome, produtos, histórico)
- [ ] Isolamento: conteúdo do cliente A não usa dados do cliente B
- [ ] Agendamento semanal funcional para pelo menos 1 tenant
- [ ] Validado na instância SparkleOS antes de habilitar para clientes
- [ ] Spec de conteúdo por nicho documentada antes de implementar

---

## Escopo FORA deste Epic

- Publicação automática em redes sociais (requer APIs de terceiros) — epic futuro
- Analytics de desempenho do conteúdo — escopo futuro
- Editor visual de conteúdo no cockpit — escopo futuro
- Geração de imagens para posts — escopo futuro
