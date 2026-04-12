# SOP — Revisar e Promover Insights do Cérebro Coletivo

**Versão:** 1.0  
**Data:** 2026-04-11  
**Autor:** @dev (Dex) — Story 3.3  
**Revisão prevista:** Após 50+ validações reais (Story 3.7)

---

## Objetivo

Este SOP define o processo para um agente ou Mauro revisar insights em estado `raw`, promovê-los para `validated` ou rejeitá-los com justificativa. Um insight só entra no pipeline de aplicação (Story 3.4) se estiver `validated`.

---

## 1. Identificar Insights Pendentes

Listar insights em `raw` que ainda não foram validados:

```bash
GET /brain/insights?status=raw&limit=20
```

Priorizar por `confidenceLevel`:
1. `authoritative` (mauro_input) — revisar primeiro, quase sempre validar
2. `high` (zenya_operation) — validar se conteúdo é acionável
3. `medium` (agent_research) — critério mais rigoroso

---

## 2. Critérios de Decisão por Fonte

### `mauro_input` (confidenceLevel: authoritative)
- **Regra padrão:** Validar com `qualityScore` alto (≥ 0.8)
- **Quando rejeitar:** Apenas se o conteúdo for claramente duplicata de um insight já `validated` (verificar `isDuplicate=true`)
- **validatedBy:** `'mauro'` ou `'@po'`

### `zenya_operation` (confidenceLevel: high)
- **Regra padrão:** Validar se o conteúdo é acionável (descreve um padrão de comportamento do sistema)
- **Quando rejeitar:** Conteúdo de erro isolado sem padrão repetido, dados claramente incorretos
- **Threshold:** `qualityScore >= 0.6` promove para `validated` automaticamente
- **validatedBy:** `'system'` ou `'@qa'`

### `agent_research` (confidenceLevel: medium)
- **Regra padrão:** Exige critério mais rigoroso — validar apenas se há evidência clara (sourceRef + dados)
- **Quando rejeitar:** Afirmações sem evidência, generalizações, conteúdo sem relação com SparkleOS
- **Threshold:** Mesmo 0.6, mas revisar `validationNotes` mais criticamente
- **validatedBy:** `'@architect'` ou `'@analyst'`

---

## 3. Como Validar um Insight

### 3.1 Avaliação Manual (com qualityScore explícito)

Avaliar as 3 dimensões de qualidade:

| Dimensão | Pergunta | Alta (0.8–1.0) | Baixa (0.1–0.3) |
|----------|----------|---------------|----------------|
| **Especificidade** | O conteúdo é específico e acionável? | Tem números, nomes de fluxos, percentuais, durações | Usa "sempre", "nunca", "às vezes", sem métricas |
| **Evidência** | É baseado em dado real ou suposição? | Tem `sourceRef` rastreável + dados numéricos | Sem rastreabilidade, sem dados concretos |
| **Relevância** | Tem relação clara com a operação SparkleOS? | `nucleusId` preenchido + tags de domínio (zenya, chatwoot, etc.) | Sem nucleusId, tags genéricas |

Calcular score: `qualityScore = (especificidade + evidência + relevância) / 3`

### 3.2 Chamar o Endpoint

```bash
PATCH /brain/insights/{id}/validate
Content-Type: application/json

{
  "qualityScore": 0.85,
  "validatedBy": "system",
  "validationNotes": "Insight específico com sourceRef rastreável e dados numéricos"
}
```

**Resultado:**
- `qualityScore >= 0.6` → `status` transiciona para `validated`
- `qualityScore < 0.6` → `status` permanece `raw`, `validationNotes` documenta o gap

---

## 4. Como Rejeitar um Insight

Use apenas quando o insight é claramente inválido, irrecuperável ou prejudicial ao Cérebro.

```bash
PATCH /brain/insights/{id}/reject
Content-Type: application/json

{
  "reason": "Conteúdo duplica insight #uuid-do-canonical sem informação adicional"
}
```

**Notas:**
- Insights rejeitados **não são deletados** — permanecem no banco para auditoria
- `status = 'rejected'` exclui o insight de buscas semânticas e canonicalizações futuras
- Use `reason` descritivo para facilitar auditoria posterior

---

## 5. Busca Semântica para Contexto

Antes de validar ou rejeitar, verificar se já existe insight similar `validated`:

```bash
POST /brain/insights/search
Content-Type: application/json

{
  "query": "conteúdo do insight a avaliar",
  "threshold": 0.85,
  "statusFilter": ["validated", "applied"]
}
```

Se resultado com `similarity > 0.92` → o insight é provável duplicata (confirmar via `isDuplicate` e `canonicalId`).

---

## 6. Frequência de Revisão Recomendada

| Fonte | Frequência | Agente |
|-------|-----------|--------|
| `zenya_operation` | Diária (lote) | @dev ou sistema automático (v2) |
| `mauro_input` | Imediata | @po ou Mauro |
| `agent_research` | Semanal | @qa ou @architect |

---

## 7. Fluxo Completo

```
GET /brain/insights?status=raw
       │
       ▼
Avaliar cada insight (3 dimensões)
       │
       ├─ qualityScore >= 0.6 → PATCH /validate → status='validated'
       │
       ├─ qualityScore < 0.6 (mas recuperável) → PATCH /validate → status permanece 'raw'
       │   └─ Reavaliar após enriquecimento de conteúdo (Story 3.7)
       │
       └─ Claramente inválido → PATCH /reject → status='rejected'
```

Insights `validated` ficam disponíveis para:
- Busca semântica: `POST /brain/insights/search`
- Aplicação: `PATCH /brain/insights/{id}/apply` (Story 3.4)
