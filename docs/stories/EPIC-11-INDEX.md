# Epic 11 — Capacidades Globais da Zenya

**Status:** Draft
**Criado por:** Morgan (@pm) — inputs arquiteturais: Aria (@architect) — 2026-04-20
**Depende de:** Epic 2 (provisionamento — Done)
**Objetivo:** Expandir a Zenya com capacidades que beneficiam todos os clientes independente de nicho: assistente pessoal para o gestor e interpretação de imagens enviadas via WhatsApp.

---

## Contexto

A Zenya hoje responde texto e áudio. Dois gaps se destacam para qualquer tipo de negócio:

1. **Assistente pessoal do gestor:** O fluxo `08` existe só para Mauro. Clientes não têm acesso a relatórios, métricas e gestão via WhatsApp com a própria Zenya deles.
2. **Imagens:** Clientes enviam fotos de produtos, documentos, prints de pedidos — a Zenya não processa. GPT-4.1 já tem Vision nativa; falta o fluxo n8n.

Essas capacidades entram para todos os tenants após validação na instância SparkleOS.

**Regra Sparkle-first:** Cada capacidade é ativada e testada na Zenya da SparkleOS antes de ser liberada para clientes.

---

## Arquitetura

```
WhatsApp (cliente do tenant)
  └── n8n: 01. Secretária v3 — já recebe imagem/texto
        ├── [novo] Rota: tipo = imagem → Vision API (GPT-4.1)
        │     → Descreve/interpreta + responde humanizado
        └── [novo] Rota: tipo = comando-gestor → Fluxo 08 generalizado
              → Métricas, relatórios, status via WhatsApp
```

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| 11.1 | Interpretação de imagens via WhatsApp (Vision API) | Draft | P1 | — | @dev |
| 11.2 | Assistente pessoal do gestor — generalizar fluxo 08 para todos os tenants | Draft | P1 | — | @dev |
| 11.3 | Guard em software — promessa de handoff sem invocação de `escalarHumano` ([story](engine-hardening-01/README.md)) | Draft | P1 | HL onboarding 96h monitoring estável | @dev |

---

## Sequência de Execução

```
Wave 1 — Paralelo (independentes entre si):
  11.1 — Rota de imagem no fluxo 01 + chamada Vision API
        → Cliente envia foto, Zenya interpreta e responde

  11.2 — Generalização do fluxo 08 com configuração por tenant
        → Gestor de qualquer cliente acessa relatórios e métricas
```

---

## Stack Afetada

| Componente | Mudança |
|-----------|---------|
| n8n — fluxo `01. Secretária v3` | Nova rota para tipo `imagem` |
| n8n — fluxo `08. Assistente Mauro` | Generalizado com `tenant_id` |
| OpenAI GPT-4.1 | Vision API ativada (já pago) |
| `zenya_clients.metadata` | Flag `assistant_enabled: true` por tenant |

---

## Definition of Done do Epic 11

- [ ] Cliente envia imagem no WhatsApp → Zenya responde com interpretação relevante
- [ ] Gestor do cliente envia comando → Zenya retorna métricas/relatório do tenant dele
- [ ] Isolamento garantido: relatório do gestor A não mistura dados do cliente B
- [ ] Validado na instância SparkleOS antes de habilitar para clientes
- [ ] IP da Zenya (prompts) atualizado conforme SOP de IP

---

## Escopo FORA deste Epic

- Geração de imagens pela Zenya — escopo futuro
- Voz bidirecional (Retell) — epic dedicado
- Comandos por voz do gestor — escopo futuro
- Dashboard visual de métricas — coberto pelo Epic 10
