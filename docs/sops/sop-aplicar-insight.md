# SOP — Aplicar um Insight Validado

**Versão:** 1.0  
**Data:** 2026-04-12  
**Autor:** @dev (Dex) — Story 3.4  
**Revisão prevista:** Após 20+ aplicações reais (Story 3.7)

---

## Objetivo

Este SOP define o processo para registrar a aplicação concreta de um insight `validated`, completando o ciclo obrigatório do Cérebro Coletivo (FR6): **Captura → Validação → Aplicação mensurável**.

Um insight só é `applied` após produzir evidência de mudança real com métricas comparativas.

---

## Pré-requisitos

1. Insight deve estar em status `validated` — verificar com:
   ```bash
   GET /brain/insights?status=validated&limit=20
   ```
2. Ter coletado a **métrica baseline** antes da aplicação
3. Ter aplicado a mudança operacional no sistema
4. Ter aguardado período de estabilização (mínimo 24h para métricas de taxa)
5. Ter coletado a **métrica resultado** após a mudança

---

## 1. Coletar Métrica Baseline (antes de aplicar)

Antes de qualquer mudança, registre o estado atual do sistema:

| Campo | Exemplos |
|-------|---------|
| `name` | `taxa_escalacao`, `tempo_resposta_p50`, `conversas_resolvidas_dia` |
| `value` | `12.5`, `1200`, `340` |
| `unit` | `%`, `ms`, `conversas/dia` |
| `measuredAt` | `2026-04-10T09:00:00Z` (ISO 8601) |

**Onde encontrar métricas Zenya:**
- `GET /brain/insights?source=zenya_operation` — insights existentes sobre a operação
- `BASELINE-PERFORMANCE.md` — métricas de referência do sistema
- Dashboard Chatwoot — para métricas de conversa

---

## 2. Aplicar a Mudança

Realize a mudança operacional (ajuste de fluxo, prompt, configuração) e aguarde estabilização.

---

## 3. Coletar Métrica Resultado (após aplicar)

Após o período de estabilização, colete a mesma métrica:

```json
{
  "name": "taxa_escalacao",
  "value": 8.0,
  "unit": "%",
  "measuredAt": "2026-04-12T09:00:00Z"
}
```

---

## 4. Calcular improvementPercent

```
improvementPercent = ((resultado - baseline) / |baseline|) * 100
```

**Exemplos:**
- Taxa de escalação: baseline=12.5%, resultado=8.0% → `((8.0 - 12.5) / 12.5) * 100 = -36%` ✅
- Tempo de resposta: baseline=1200ms, resultado=850ms → `((850 - 1200) / 1200) * 100 = -29.2%` ✅
- Conversas resolvidas: baseline=340, resultado=410 → `((410 - 340) / 340) * 100 = +20.6%` ✅

**Nota:** `improvementPercent` pode ser negativo — para métricas onde "menos é melhor" (tempo, taxa de erro), valores negativos indicam melhoria.

---

## 5. Chamar o Endpoint

```bash
PATCH /brain/insights/{id}/apply
Content-Type: application/json

{
  "applicationProof": {
    "appliedAt": "2026-04-12T08:00:00Z",
    "appliedBy": "@dev",
    "changeDescription": "Ajuste no prompt de triagem do fluxo Atendimento Principal — reduz escalações desnecessárias para o time humano",
    "baselineMetric": {
      "name": "taxa_escalacao",
      "value": 12.5,
      "unit": "%",
      "measuredAt": "2026-04-10T09:00:00Z"
    },
    "resultMetric": {
      "name": "taxa_escalacao",
      "value": 8.0,
      "unit": "%",
      "measuredAt": "2026-04-12T09:00:00Z"
    },
    "improvementPercent": -36,
    "storyId": "3.4",
    "nucleusId": "zenya",
    "evidenceRef": null
  }
}
```

**Campos opcionais:**
- `storyId` — preencher quando a aplicação veio de uma story de desenvolvimento
- `nucleusId` — qual Núcleo foi modificado (`zenya`, `chatwoot`, etc.)
- `evidenceRef` — link para documento de evidência, relatório ou screenshot

---

## 6. Verificar o Resultado

```bash
GET /brain/insights/{id}
```

Confirmar:
- `status` = `"applied"`
- `applicationProof` retornado como objeto (não string)
- `appliedAt` preenchido
- `applicationProof.improvementPercent` correto

---

## 7. Quando NÃO Aplicar

| Situação | Ação |
|----------|------|
| Mudança ainda não foi feita | Aguardar — não aplique sem mudança real |
| Métricas não coletadas | Aguardar período de estabilização |
| Insight não está `validated` | Primeiro validar via `PATCH /validate` |
| Melhoria não mensurável | Documentar como limitação — buscar proxy métrico |

---

## 8. Fluxo Completo

```
GET /brain/insights?status=validated
         │
         ▼
Selecionar insight para aplicar
         │
         ├─ Coletar baselineMetric (antes da mudança)
         │
         ├─ Aplicar mudança no sistema
         │
         ├─ Aguardar estabilização (24–72h)
         │
         ├─ Coletar resultMetric (após a mudança)
         │
         ├─ Calcular improvementPercent
         │
         └─ PATCH /brain/insights/{id}/apply → status='applied'
```

Insights `applied` são incluídos nas buscas semânticas (`POST /brain/insights/search`) e alimentam o dashboard do Cérebro (Story 3.9).
