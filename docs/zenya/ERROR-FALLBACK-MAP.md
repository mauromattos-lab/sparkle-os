# Zenya — Mapeamento de Pontos de Falha e Fallback

**Story:** 2.9 — Protocolo de Erro e Fallback da Zenya
**Responsável:** @dev (Dex)
**Data:** 2026-04-11
**Fonte:** Story 2.1 (FLOW-INVENTORY.md) + análise dos 15 fluxos n8n

---

## 1. Visão Geral

A Zenya depende de múltiplos serviços externos. Cada falha tem severidade e comportamento diferentes. Este documento mapeia todos os pontos de falha identificados, classifica por severidade e descreve o comportamento atual (pré-mitigação).

**Escala de Severidade:**
- **P1** — Operação da Zenya impossível ou cliente sem resposta
- **P2** — Funcionalidade degradada; cliente pode receber resposta parcial
- **P3** — Funcionalidade auxiliar comprometida; não afeta fluxo principal

---

## 2. Mapa de Pontos de Falha

### 2.1 Infraestrutura Crítica (P1)

| Ponto de Falha | Fluxos Afetados | Severidade | Comportamento Atual | Detecção |
|---------------|----------------|------------|---------------------|----------|
| **n8n indisponível** | Todos (15 fluxos) | **P1** | Zenya para completamente — nenhum fluxo é executado | `GET /healthz` timeout |
| **Chatwoot indisponível** | Todos (webhook de entrada) | **P1** | Mensagens do WhatsApp não chegam ao n8n — fila silenciosa | `GET /` status check |
| **Z-API indisponível** | Todos (via Chatwoot) | **P1** | Mensagens do cliente não são entregues — falha na camada WhatsApp | Indireto via Chatwoot |
| **Postgres indisponível** | 01, 06, 10, 12 | **P1** | Falha silenciosa ou erro de execução — memória não salva, cobranças não registradas | `SELECT 1` |

### 2.2 Serviços de IA (P1 quando em uso)

| Ponto de Falha | Fluxos Afetados | Severidade | Comportamento Atual |
|---------------|----------------|------------|---------------------|
| **OpenAI indisponível** | 01, 08, 11, 12, 13 | **P1** | Execução do AI Agent falha — cliente sem resposta no fluxo ativo |
| **OpenAI timeout (>30s)** | 01, 08, 11, 12, 13 | **P1** | n8n timeout — cliente sem resposta; sem retry automático |
| **Resposta inválida da OpenAI** | 01, 08, 11, 12, 13 | **P2** | Parse falha no n8n — fluxo encerra com erro interno |

### 2.3 Serviços Externos de Negócio (P2)

| Ponto de Falha | Fluxos Afetados | Severidade | Comportamento Atual |
|---------------|----------------|------------|---------------------|
| **Google Calendar indisponível** | 03, 04, 11, 12 | **P2** | AI Agent tool falha — resposta de agendamento degradada; fluxo pode continuar sem agendamento |
| **Google Calendar auth expirada** | 03, 04, 11, 12 | **P2** | Credencial OAuth inválida — ferramenta retorna erro 401 para o AI Agent |
| **Asaas indisponível** | 06 | **P2** | Cobrança não processada — cliente fica sem link de pagamento |
| **Asaas resposta inválida** | 06 | **P2** | Parse falha — link de cobrança não gerado, resposta de erro ao cliente |

### 2.4 Erros de Provisionamento (P2 — Story 2.4)

| Ponto de Falha | Endpoint | Severidade | Comportamento Atual |
|---------------|----------|------------|---------------------|
| **n8n clone falha** | `POST /clients` | **P2** | Saga abortada — compensação tenta rollback; cliente não provisionado |
| **Chatwoot inbox creation falha** | `POST /clients` | **P2** | Compensação deleta clones n8n; cliente não provisionado |
| **INSERT zenya_clients falha** | `POST /clients` | **P2** | Compensação deleta n8n + Chatwoot; cliente não provisionado |
| **Compensação parcial falha** | `POST /clients` | **P3** | Recursos órfãos no n8n ou Chatwoot — requer limpeza manual |

### 2.5 Erros de Isolamento de Dados (P1 — Story 2.7)

| Ponto de Falha | Tabela | Severidade | Comportamento Atual |
|---------------|--------|------------|---------------------|
| **`set_config` sem transação** | `zenya_conversations` | **P1** | RLS vê NULL → retorna 0 resultados — silenciosamente errado (corrigido em 2.7) |
| **`app.current_client_key` não configurado** | `zenya_conversations` | **P1** | RLS bloqueia → 0 resultados (comportamento seguro esperado) |

---

## 3. Classificação por Impacto Operacional

```
ZENYA PARA → n8n down, Chatwoot down, Z-API down
           ↓
RESPOSTA SILENCIOSA → Postgres down, OpenAI down
           ↓
FUNCIONALIDADE DEGRADADA → Google Calendar, Asaas
           ↓
ERRO DE PROVISIONAMENTO → falha no POST /clients
```

---

## 4. Comportamento Esperado Após Story 2.9

| Cenário | Antes (2.9) | Depois (2.9) |
|---------|------------|-------------|
| n8n down | Zenya para sem alerta | `GET /health` retorna `down`, erro tipado `ZenyaN8nError` |
| Chatwoot down | Zenya para sem alerta | `GET /health` retorna `degraded`, erro `ZenyaChatwootError` |
| Postgres down | Falha silenciosa | `GET /health` retorna `degraded`, erro `ZenyaDatabaseError` |
| Erro genérico no Adapter | HTTP 500 sem contexto | Erro tipado com `code`, `message`, `context` |

---

## 5. Critérios de Notificação (ver SOP)

| Condição | Ação Automática | Notificar Mauro |
|----------|----------------|-----------------|
| n8n down | Retornar erro tipado | **Sempre** (P1) |
| Postgres down | Retornar erro tipado | **Sempre** (P1) |
| Timeout de serviço externo | Retry 3x com backoff | Após 3 falhas |
| Falha de parsing de resposta | Log + erro tipado | Não (P3) |
| Compensação parcial falha | Log detalhado | **Sempre** (P1) |

---

## 6. Referências

- Inventário de fluxos: `docs/zenya/FLOW-INVENTORY.md`
- Classes de erro: `organs/zenya/src/errors/`
- Health check: `organs/zenya/src/routes/health.ts`
- SOP de incidentes: `docs/sops/sop-incidente-zenya.md`
- Isolamento de dados: `docs/zenya/ISOLATION-SPEC.md`
