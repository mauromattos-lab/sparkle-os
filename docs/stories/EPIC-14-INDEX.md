# Epic 14 — Onboarding Automático da Zenya

**Status:** Draft
**Criado por:** Morgan (@pm) — inputs arquiteturais: Aria (@architect) — 2026-04-20
**Depende de:** Epic 10 (Cockpit do Cliente — deve estar Done)
**Objetivo:** Eliminar a dependência de Mauro no processo de onboarding de novos clientes — um novo cliente se cadastra, paga e tem a Zenya configurada e funcionando sem intervenção humana.

---

## Contexto

Hoje o onboarding de um novo cliente Zenya é 100% manual: Mauro recebe o contato, executa o SOP de provisionamento passo a passo, configura o n8n, cria o inbox no Chatwoot, e entrega as credenciais. Isso funciona com poucos clientes, mas não escala.

O Story 2.4 já implementou a API `POST /nucleus/zenya/clients` que automatiza o provisionamento técnico. Falta a camada de produto: um formulário de cadastro, pagamento, e automação do fluxo de ativação.

**Pré-requisito obrigatório:** Epic 10 (Cockpit do Cliente) deve estar Done — o onboarding entrega o cliente direto ao cockpit.

**Gatilho de priorização:** Este epic avança quando o volume de novos clientes justificar. Com < 10 clientes/mês, o SOP manual ainda é viável.

**Regra Sparkle-first:** Fluxo de onboarding testado internamente antes de qualquer cliente real passar por ele.

---

## Arquitetura

```
Lead acessa página de contratação
  └── Formulário de cadastro (no cockpit ou landing page)
        ├── Pagamento (Asaas — já integrado na Zenya)
        ├── POST /nucleus/zenya/clients → provisionamento automático
        │     ├── n8n: duplica flow template
        │     ├── Chatwoot: cria inbox
        │     └── Supabase: cria tenant com isolation_key
        ├── E-mail de boas-vindas com QR Code de conexão WhatsApp
        └── Cliente já aparece no cockpit pronto para usar
```

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| 14.1 | Formulário de cadastro self-service no cockpit | Draft | P1 — Blocker | Epic 10 Done | @ux-design-expert |
| 14.2 | Automação end-to-end do SOP de provisionamento | Draft | P1 | 14.1 | @dev |
| 14.3 | E-mail de boas-vindas + instruções de conexão WhatsApp | Draft | P2 | 14.2 | @dev |

---

## Sequência de Execução

```
Wave 1 — Entrada (blocker):
  14.1 — Formulário: dados do negócio, WhatsApp, plano escolhido
        → Ponto de entrada do cliente no sistema

Wave 2 — Motor (após 14.1):
  14.2 — Provisionamento automático: API existente + SOP convertido em código
        → Zero intervenção de Mauro no processo técnico

Wave 3 — Entrega (após 14.2):
  14.3 — E-mail com QR Code do WhatsApp Business + acesso ao cockpit
        → Cliente autossuficiente do primeiro contato
```

---

## Stack Afetada

| Componente | Mudança |
|-----------|---------|
| `apps/client-cockpit/` | Nova tela de cadastro/onboarding |
| `apps/core/src/routes/` | Orquestração do fluxo de onboarding |
| `POST /nucleus/zenya/clients` | Já existe (Story 2.4) — integrar ao fluxo |
| Asaas | Webhook de pagamento confirmado → dispara provisionamento |
| E-mail transacional | Template de boas-vindas |

---

## Definition of Done do Epic 14

- [ ] Novo cliente se cadastra sem contato direto com Mauro
- [ ] Provisionamento completo em < 5 minutos após cadastro
- [ ] Cliente recebe e-mail com instruções claras e QR Code de conexão
- [ ] Cliente aparece no cockpit com dados zerados e pronto para uso
- [ ] Mauro recebe notificação de novo cliente ativo (não precisa agir)
- [ ] Fluxo testado end-to-end na instância SparkleOS antes de ir ao ar

---

## Escopo FORA deste Epic

- Planos e precificação dinâmica — decisão de negócio separada
- Cancelamento e offboarding automático — epic futuro
- Trial gratuito — decisão de go-to-market separada
- Onboarding de múltiplos usuários por tenant — escopo futuro
