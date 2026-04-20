# Epic 10 — Cockpit do Cliente Zenya

**Status:** Draft
**Criado por:** Morgan (@pm) — inputs arquiteturais: Aria (@architect) — 2026-04-20
**Depende de:** Epic 2 (provisionamento de clientes — Done)
**Objetivo:** Entregar ao cliente Zenya um painel web onde ele visualiza suas conversas, métricas de atendimento e status do sistema — sem precisar abrir WhatsApp, Google Sheets ou perguntar ao Mauro. Diferencial de venda imediato.

---

## Contexto

Hoje o cliente não tem visibilidade nenhuma do que a Zenya faz por ele. Não sabe quantas conversas foram atendidas, quais estão abertas, nem como está a saúde do sistema. Isso gera fricção de suporte e reduz o valor percebido do produto.

O cockpit do cliente resolve isso: uma tela limpa, acessada por login próprio, mostrando apenas os dados do tenant dele — isolamento garantido pelo RLS já existente.

**Regra Sparkle-first:** O cockpit é desenvolvido e validado primeiro na instância Zenya da SparkleOS. Só após validação em produção real é habilitado para clientes.

**Decisão arquitetural:** Auth via Supabase Auth (gratuito, integra com RLS existente, zero manutenção).

---

## Arquitetura

```
Cliente acessa cockpit.sparkleai.tech (ou subdomínio do cliente)
  └── Next.js 15 (Vercel) — app separado do Piloting Interface
        ├── Supabase Auth → login via magic link ou e-mail/senha
        ├── SparkleOS Core API → /clients/{id}/conversations
        ├── SparkleOS Core API → /clients/{id}/metrics
        └── RLS no Supabase → isola dados por isolation_key
```

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| 10.1 | Auth de Clientes — Supabase Auth + sessão por tenant | Draft | P1 — Blocker | — | @data-engineer |
| 10.2 | API: endpoints /conversations e /metrics por cliente | Draft | P1 | 10.1 | @dev |
| 10.3 | Frontend: app Next.js do cockpit do cliente (telas base) | Draft | P1 | 10.2 | @ux-design-expert |
| 10.4 | Deploy e configuração de domínio do cockpit | InProgress | P2 | 10.3 ✅ | @devops |

---

## Sequência de Execução

```
Wave 1 — Base de auth (blocker):
  10.1 — Supabase Auth configurado, sessão vinculada ao tenant
        → Sem isso, nenhuma tela é possível com segurança

Wave 2 — Backend (após 10.1):
  10.2 — Endpoints da API com dados reais
        → Conversas e métricas expostas com isolamento garantido

Wave 3 — Frontend (após 10.2):
  10.3 — Telas do cockpit: dashboard, lista de conversas, métricas
        → Cliente consegue logar e ver os dados dele

Wave 4 — Deploy (após 10.3):
  10.4 — App no ar no domínio correto
        → Produto pronto para demonstração e venda
```

---

## Stack Afetada

| Componente | Mudança |
|-----------|---------|
| `apps/client-cockpit/` | Nova app Next.js 15 |
| `apps/core/src/routes/` | Novos endpoints `/clients/:id/conversations` e `/metrics` |
| Supabase Auth | Configuração de email templates + magic link |
| Vercel | Novo deploy `client-cockpit` |
| `packages/shared/` | Novos tipos `ClientSession`, `ConversationSummary`, `ClientMetrics` |

---

## Definition of Done do Epic 10

- [ ] Cliente consegue fazer login via magic link com seu e-mail
- [ ] Sessão é isolada: cliente A não vê dados do cliente B
- [ ] Dashboard mostra: total de conversas, conversas hoje, status do sistema
- [ ] Lista de conversas com busca e filtro por data
- [ ] App deployado e acessível via URL pública
- [ ] Validado primeiro na instância Zenya da SparkleOS (Sparkle-first)
- [ ] Testado em produção real antes de habilitar para qualquer cliente

---

## Escopo FORA deste Epic

- Customização visual por cliente (logo, cores) — epic futuro
- Relatórios exportáveis (PDF/CSV) — escopo futuro
- Chat ao vivo entre cliente e Mauro via cockpit — escopo futuro
- Métricas avançadas (NPS, tempo médio de resposta) — escopo futuro
