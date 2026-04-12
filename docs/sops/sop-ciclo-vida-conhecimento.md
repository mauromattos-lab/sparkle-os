# SOP — Ciclo de Vida do Conhecimento

**Sistema:** SparkleOS Collective Brain  
**Story:** 3.7 — Ciclo de Vida do Conhecimento  
**Versão:** 1.0  
**Última revisão:** 2026-04-12

---

## 1. Quando Rodar o Ciclo de Vida

O ciclo de vida deve ser executado manualmente via API. Não há execução automática em v1.

**Frequência recomendada:**
- Semanalmente em produção (ex: toda segunda-feira antes do stand-up)
- Após grandes ingestões de insights (>50 novos insights)
- Antes de gerar relatórios de qualidade do conhecimento

**Trigger:**
```bash
curl -X POST http://localhost:3003/brain/lifecycle/run
```

---

## 2. Como Interpretar o `LifecycleReport`

A resposta do `POST /brain/lifecycle/run` retorna um objeto `LifecycleReport`:

```json
{
  "runAt": "2026-04-12T10:00:00.000Z",
  "staleRawDetected": 3,
  "staleValidatedDetected": 1,
  "archivedRejected": 2,
  "unresolvedDuplicates": 5,
  "totalPendingReview": 9
}
```

| Campo | Significado | Ação Esperada |
|-------|-------------|---------------|
| `runAt` | Timestamp da execução (ISO 8601) | Registrar para auditoria |
| `staleRawDetected` | Insights `raw` há >30 dias sem validação, agora marcados `stale` | Revisar em `/brain/lifecycle/pending?reason=stale_raw` |
| `staleValidatedDetected` | Insights `validated` há >90 dias sem aplicação, agora marcados `stale` | Revisar em `/brain/lifecycle/pending?reason=stale_validated` |
| `archivedRejected` | Insights `rejected` há >180 dias, agora marcados `archived` | Nenhuma ação necessária (auditoria preservada) |
| `unresolvedDuplicates` | Duplicatas detectadas pelo sistema aguardando resolução humana | Resolver em `/brain/lifecycle/duplicates` |
| `totalPendingReview` | Total de itens na fila de atenção humana | Meta: manter <20 |

**Idempotência:** Rodar o ciclo duas vezes seguidas produz o mesmo estado final. Só novos insights serão marcados na segunda execução.

---

## 3. Como Resolver Duplicatas via API

### 3.1 Listar grupos de duplicatas

```bash
curl http://localhost:3003/brain/lifecycle/duplicates
# ou com paginação:
curl "http://localhost:3003/brain/lifecycle/duplicates?page=1&limit=10"
```

Resposta:
```json
{
  "duplicates": [
    {
      "canonical": { "id": "abc-123", "content": "...", ... },
      "duplicates": [
        { "id": "def-456", "similarityScore": 0.95, ... }
      ]
    }
  ],
  "total": 1
}
```

### 3.2 Resolver uma duplicata

**Opção A — Promover como independente (keep):**
Use quando o insight duplicado tem valor único que justifica existência independente.
```bash
curl -X PATCH http://localhost:3003/brain/lifecycle/duplicates/{id}/resolve \
  -H 'Content-Type: application/json' \
  -d '{"action": "keep"}'
```
Resultado: `isDuplicate=false`, `canonicalId=null`, `validationNotes` auditado.

**Opção B — Rejeitar (reject):**
Use quando o insight é genuinamente redundante com o canônico.
```bash
curl -X PATCH http://localhost:3003/brain/lifecycle/duplicates/{id}/resolve \
  -H 'Content-Type: application/json' \
  -d '{"action": "reject"}'
```
Resultado: `status=rejected`, `validationNotes="Duplicata de {canonicalId} — ciclo de vida"`.

---

## 4. Critérios para Promover ou Rejeitar Insights Estagnados

### 4.1 Consultar a fila de pendentes

```bash
# Todos os pendentes
curl http://localhost:3003/brain/lifecycle/pending

# Filtrar por tipo
curl "http://localhost:3003/brain/lifecycle/pending?reason=stale_raw"
curl "http://localhost:3003/brain/lifecycle/pending?reason=stale_validated"
curl "http://localhost:3003/brain/lifecycle/pending?reason=unresolved_duplicate"
```

### 4.2 Insights `stale_raw` (raw > 30 dias)

**Promover (validar):** Quando o insight ainda é relevante e o conteúdo é factualmente correto.
```bash
curl -X PATCH http://localhost:3003/brain/insights/{id}/validate \
  -H 'Content-Type: application/json' \
  -d '{"qualityScore": 0.8, "validatedBy": "@agente", "validationNotes": "Relevante após revisão"}'
```

**Rejeitar:** Quando o insight é obsoleto, impreciso ou foi superado por conhecimento mais recente.
```bash
curl -X PATCH http://localhost:3003/brain/insights/{id}/reject \
  -H 'Content-Type: application/json' \
  -d '{"reason": "Insight obsoleto — contexto mudou após Story X.Y"}'
```

**Critérios de promoção para raw estagnado:**
- Conteúdo ainda é factualmente correto no contexto atual
- Não existe insight equivalente mais recente e validado
- A fonte (`source`) ainda é confiável
- O `nucleusId` referenciado ainda está ativo

### 4.3 Insights `stale_validated` (validated > 90 dias sem aplicação)

**Aplicar:** Se há uma oportunidade concreta de uso do insight.
```bash
curl -X PATCH http://localhost:3003/brain/insights/{id}/apply \
  -H 'Content-Type: application/json' \
  -d '{"applicationProof": { ... }}'
```

**Rejeitar:** Quando o insight validado não tem mais relevância operacional.
```bash
curl -X PATCH http://localhost:3003/brain/insights/{id}/reject \
  -H 'Content-Type: application/json' \
  -d '{"reason": "Conhecimento validado mas sem oportunidade de aplicação — contexto mudou"}'
```

**Critérios de promoção para validated estagnado:**
- Existe uma story ou operação em andamento que pode usar o insight
- O insight é aplicável ao estado atual do sistema
- O responsável pela aplicação está disponível para executar

---

## 5. Política de Retenção de Rejeitados

### Regras de Arquivamento

- Insights com `status='rejected'` há mais de **180 dias** são marcados automaticamente com a tag `archived` na próxima execução do ciclo de vida.
- Insights `archived` são **excluídos por padrão** dos resultados de `GET /brain/insights` e `POST /brain/insights/search`.
- **Não há deleção física.** Os dados permanecem no banco para auditoria.

### Acessar insights arquivados

```bash
# Listar incluindo arquivados
curl "http://localhost:3003/brain/insights?includeArchived=true"

# Busca semântica incluindo arquivados
curl -X POST http://localhost:3003/brain/insights/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "...", "includeArchived": true}'
```

### Justificativa da Política

- **180 dias** é o threshold padrão — configurável via env `ARCHIVE_REJECTED_DAYS`.
- Insights rejeitados recentes (< 180 dias) ficam visíveis para referência e aprendizado.
- Insights arquivados (>180 dias rejeitados) são excluídos por default para não poluir buscas e listagens.
- A auditabilidade completa é preservada via banco de dados.

---

## 6. Variáveis de Ambiente

| Variável | Default | Descrição |
|----------|---------|-----------|
| `STALE_RAW_DAYS` | `30` | Dias até insight `raw` ser marcado como `stale` |
| `STALE_VALIDATED_DAYS` | `90` | Dias até insight `validated` sem aplicação ser marcado `stale` |
| `ARCHIVE_REJECTED_DAYS` | `180` | Dias até insight `rejected` ser arquivado |

Para ajustar, definir no arquivo `.env` do package `brain`:
```
STALE_RAW_DAYS=45
STALE_VALIDATED_DAYS=120
ARCHIVE_REJECTED_DAYS=365
```

---

## 7. Referências

- Architecture: `docs/architecture/cerebro-coletivo.md`
- Story: `docs/stories/3.7.story.md`
- Código: `packages/brain/src/services/lifecycle.service.ts`
- Config: `packages/brain/src/config/lifecycle.config.ts`
