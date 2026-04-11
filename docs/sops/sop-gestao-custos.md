# SOP-1.8-A — Como Revisar e Otimizar Custos no SparkleOS

**Versão:** 1.0  
**Data:** 2026-04-11  
**Autor:** @dev (Dex)  
**Story de origem:** 1.8 — Rastreamento de Custo por Operação  
**Revisão:** @qa (PASS)

---

## Objetivo

Guiar a revisão periódica de custos de operação dos agentes SparkleOS, identificação de operações custosas, aplicação de otimizações padrão e resposta a alertas de orçamento.

---

## Pré-requisitos

- [ ] `packages/core` rodando com `DATABASE_URL` configurado
- [ ] Variável `MONTHLY_BUDGET_USD` definida (default: 570 = $550 Claude + $20 extras)
- [ ] Acesso ao endpoint `/api/costs/budget`

---

## Responsável

Mauro (revisão mensal) ou @dev (quando alerta de orçamento é disparado).

---

## Passos

### Passo 1 — Verificar custo do período atual

```bash
# Custo diário de hoje
curl "http://localhost:3000/api/costs/summary?period=daily&date=2026-04-11"

# Custo mensal do mês atual
curl "http://localhost:3000/api/costs/summary?period=monthly&date=2026-04-11"

# Status do orçamento (mês atual vs. budget)
curl "http://localhost:3000/api/costs/budget"
```

**Resultado esperado:** JSON com `totalCost`, `byOperationType`, `percentUsed`, `isAlertTriggered`.

---

### Passo 2 — Identificar operações mais caras

```bash
# Custo por agente no mês
curl "http://localhost:3000/api/costs/by-agent?period=monthly&month=2026-04-11"
```

Analisar:
- Qual agente gera mais custo (`totalCost` maior)
- Qual `operationType` domina (`llm_output` geralmente é o maior — $15/1M tokens)
- Se há picos inesperados (operação de custo muito maior que o normal)

**Resultado esperado:** Lista de agentes ordenada por custo desc com breakdown por tipo.

---

### Passo 3 — Otimizações padrão (se necessário)

| Problema | Otimização |
|----------|-----------|
| `llm_output` alto | Revisar prompts — output tokens custam 5× mais que input |
| `embedding` alto | Batch embeddings em vez de um por vez |
| `web_search` alto | Cache de queries EXA — evitar queries repetidas |
| Agente específico caro | Verificar se está fazendo mais chamadas LLM que necessário |

---

### Passo 4 — Threshold de alerta e ação

O endpoint `/api/costs/budget` retorna `isAlertTriggered: true` quando `percentUsed >= 0.9` (90% do orçamento mensal).

**Quando alerta ativo:**
1. Criar `PendingDecision` via `POST /api/decisions` com `priority: 'urgent'`
2. Título: "Orçamento mensal atingiu 90% — revisar operações"
3. Incluir dados do `/api/costs/by-agent` como contexto
4. Opções: (a) continuar — aceitar custo, (b) reduzir operações específicas, (c) aumentar budget

**Threshold configurável:** `MONTHLY_BUDGET_USD` em `.env`. Alterar e reiniciar o serviço.

---

### Passo 5 — Registrar custo de nova operação

Ao adicionar nova funcionalidade que usa APIs pagas:

```typescript
// Fire-and-forget — nunca bloquear o fluxo principal
recordCost({
  agentId: 'dev',
  operationType: 'web_search',
  units: 1,
  unitCost: 0.005,          // EXA: $0.005/query
  storyId: '2.1',
  metadata: { query: 'search term' },
}).catch((err) => console.error('Cost tracking failed:', err));
```

Preços de referência (2026):
| Operação | Modelo | Custo unitário |
|----------|--------|---------------|
| llm_input | claude-sonnet-4-6 | $0.000003/token |
| llm_output | claude-sonnet-4-6 | $0.000015/token |
| embedding | voyage-3 | $0.00000006/token |
| web_search | EXA | $0.005/query |

**Resultado esperado:** Evento registrado na tabela `cost_events` sem impacto na latência.

---

## Resultado Final

Após revisão mensal:
- Custo total do mês calculado e comparado ao budget
- Agentes e operações mais custosas identificados
- Otimizações aplicadas (se aplicável)
- Alert disparado para Mauro via DecisionQueue (se >= 90%)

---

## Troubleshooting

| Problema | Causa Provável | Solução |
|----------|---------------|---------|
| `totalCost` zerado | Nenhum evento registrado no período | Verificar se `recordCost` está sendo chamado |
| `isAlertTriggered` sempre true | `MONTHLY_BUDGET_USD` muito baixo | Ajustar variável de ambiente |
| Eventos ausentes | Fire-and-forget silentemente falhando | Checar logs do servidor para erros de `Cost tracking failed` |

---

## Histórico de Revisões

| Data | Versão | Mudança | Autor |
|------|--------|---------|-------|
| 2026-04-11 | 1.0 | Criação | @dev (Dex) |
