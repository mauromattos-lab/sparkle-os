# SOP-1.6-A — Protocolo de Escalação para Mauro

**Versão:** 1.0  
**Criado:** 2026-04-11  
**Story:** 1.6 — Protocolo de Escalação para Mauro  
**Dono:** @dev (Dex)

---

## 1. Mapa de Decisão

Toda decisão tomada pelos agentes SparkleOS se enquadra em um de quatro níveis:

| Nível | Quem decide | Critério | Exemplos |
|-------|-------------|----------|---------|
| **Autônoma** | Agente | Sem impacto externo, reversível, sem custo | Escolha de biblioteca, estrutura de código, estratégia de teste, nomeação de variáveis |
| **Documentada** | Agente + ADR | Impacto arquitetural, mudança de padrão, irreversível sem esforço | Mudança de ORM, novo padrão de roteamento, estratégia de cache |
| **Recomendação** | Agente propõe → Mauro aprova | Impacto em infraestrutura, custo, ou múltiplos épicos | Novo serviço pago, migração de banco, mudança de CI/CD |
| **Escalação obrigatória** | Mauro decide | Ver triggers abaixo | IP da Zenya, aprovação de épico, custo > $50/mês |

---

## 2. Triggers de Escalação Obrigatória

O agente DEVE criar uma `PendingDecision` com `priority: 'urgent'` nas seguintes situações:

1. **IP da Zenya** — Qualquer alteração em lore, personalidade, tom de voz, nome, assets visuais da Zenya
2. **Custo novo** — Adição de serviço com custo recorrente superior a $50/mês
3. **Dados de clientes ativos** — Qualquer acesso a dados de usuários reais da Zenya (produção)
4. **Impacto multi-épico** — Mudança de arquitetura que afeta 2+ épicos ativos
5. **Conflito de recomendações** — Agentes em desacordo sobre uma decisão crítica
6. **Operação destrutiva em produção** — DROP TABLE, DELETE sem WHERE, reset de banco de produção

---

## 3. Como Formatar uma Escalação

Ao criar uma `PendingDecision`, fornecer **obrigatoriamente**:

```json
{
  "title": "Frase curta e objetiva do que precisa ser decidido",
  "context": "Por que esta decisão precisa de Mauro. Inclua: o que aconteceu, por que é bloqueante, quais as alternativas consideradas.",
  "options": [
    {
      "label": "Opção A — Nome curto",
      "description": "Descrição em 1-2 frases",
      "recommendation": true,
      "pros": ["vantagem 1", "vantagem 2"],
      "cons": ["desvantagem 1"]
    },
    {
      "label": "Opção B — Nome curto",
      "description": "Descrição em 1-2 frases",
      "recommendation": false,
      "pros": ["vantagem 1"],
      "cons": ["desvantagem 1", "desvantagem 2"]
    }
  ],
  "requestedBy": "agentId",
  "storyId": "1.6",
  "priority": "urgent | normal | low"
}
```

**Regras de qualidade para escalações:**
- `context` deve responder: *"Por que Mauro precisa disso agora?"*
- Pelo menos 2 opções sempre que possível (nunca escalar sem alternativas)
- Exatamente uma opção deve ter `recommendation: true`
- `pros` e `cons` devem ser factuais, não opinativos

---

## 4. SLA de Resposta de Mauro

| Prioridade | SLA esperado |
|-----------|-------------|
| `urgent` | 24 horas |
| `normal` | 3 dias úteis |
| `low` | próximo sprint |

---

## 5. O Que Fazer Enquanto Aguarda Decisão

1. **Continuar com o que é possível** — Nenhuma story deve parar completamente por causa de uma escalação. Trabalhe nos itens que não dependem da decisão pendente.
2. **Documentar o blocker no contexto** — Chamar `saveContext` com `workState.blockers` atualizado, indicando o ID da `PendingDecision`.
3. **Não inventar a decisão** — Se a decisão for de Escalação Obrigatória, não implementar nenhuma opção sem resposta de Mauro.
4. **Sinalizar na story** — Adicionar nota no Dev Agent Record da story indicando o `pendingDecisionId`.

---

## 6. Caso Real de Escalação — Epic 1 (Meta-Exemplo)

**Decisão:** `dec-uuid-epic1-meta` — Escolha do modelo de escalação para o protocolo da Story 1.6

Durante a implementação desta própria story, o agente @dev enfrentou a decisão de como modelar os critérios de escalação. As opções eram:

1. **Matriz de 4 níveis** (autônoma / documentada / recomendação / obrigatória) — recomendada
2. **Binário simples** (autônomo vs. humano) — mais simples, mas perde granularidade
3. **Baseado em custo/risco numérico** — mais preciso, mas requer calibração

A opção 1 foi escolhida autonomamente como **Decisão Documentada** (não requer Mauro), registrada neste SOP. O modelo foi documentado no ADR de arquitetura e implementado na `PendingDecision` com campos que suportam as 4 categorias.

---

## 7. API de Referência

```
POST /api/decisions              # Registrar nova decisão pendente
GET  /api/decisions/pending      # Listar decisões aguardando Mauro
PATCH /api/decisions/:id         # Resolver uma decisão (Mauro ou via Piloting Interface)
```

Para uso programático, ver `packages/core/src/decisions/decision-store.ts`.
