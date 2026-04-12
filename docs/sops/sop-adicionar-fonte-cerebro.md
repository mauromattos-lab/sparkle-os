# SOP — Adicionar Nova Fonte de Dados ao Cérebro Coletivo

**Versão:** 1.0  
**Data:** 2026-04-11  
**Autor:** @architect (Aria)  
**Story:** 3.1 — Arquitetura do Cérebro Coletivo

---

## Objetivo

Descrever o processo para adicionar uma nova fonte de conhecimento ao Cérebro Coletivo sem modificar a arquitetura central. O modelo foi projetado para extensibilidade — novas fontes são adicionadas como adaptadores, não como mudanças no Core.

---

## Pré-requisitos

- Story 3.1 Done (arquitetura do Brain definida)
- Story 3.2 Done (pipeline de captura base implementado)
- Nova fonte identificada e aprovada por Mauro
- ADR criado justificando a nova fonte (se impactar o modelo de confiança)

---

## Fontes Existentes

| Source ID | Descrição | confidenceLevel |
|-----------|-----------|----------------|
| `zenya_operation` | Dados operacionais da Zenya (n8n, Chatwoot) | `high` |
| `agent_research` | Pesquisas realizadas por agentes AIOS | `medium` |
| `mauro_input` | Conhecimento trazido diretamente por Mauro | `authoritative` |

---

## Passos

### 1. Avaliar o tipo da nova fonte

Determine qual `confidenceLevel` a nova fonte deve ter:

| Tipo de fonte | confidenceLevel recomendado |
|--------------|---------------------------|
| Dados operacionais reais (logs, métricas) | `high` |
| Pesquisa externa / agentes | `medium` |
| Input direto de Mauro ou especialistas | `authoritative` |
| Novo Núcleo operacional (ex: novo produto) | `high` |

**Se nenhum nível existente se aplicar:** criar ADR propondo novo nível antes de continuar.

### 2. Definir o Source ID

O Source ID deve ser:
- Lowercase, snake_case
- Descritivo da origem (ex: `friday_assistant`, `market_research`, `client_feedback`)
- Único — verificar que não existe em `docs/architecture/cerebro-coletivo.md §3.3`

### 3. Atualizar o enum de fontes

Localizar o tipo `InsightSource` em `packages/brain/src/types/insight.ts` e adicionar o novo valor:

```typescript
// Antes
type InsightSource = 'zenya_operation' | 'agent_research' | 'mauro_input';

// Depois
type InsightSource = 'zenya_operation' | 'agent_research' | 'mauro_input' | 'nova_fonte';
```

Atualizar também a constraint SQL na tabela `insights`:
```sql
ALTER TABLE insights DROP CONSTRAINT insights_source_check;
ALTER TABLE insights ADD CONSTRAINT insights_source_check
  CHECK (source IN ('zenya_operation', 'agent_research', 'mauro_input', 'nova_fonte'));
```

### 4. Atualizar o mapa de confidenceLevel

Em `packages/brain/src/services/ingest.service.ts`, atualizar o mapa de confiança:

```typescript
const CONFIDENCE_BY_SOURCE: Record<InsightSource, ConfidenceLevel> = {
  zenya_operation: 'high',
  agent_research: 'medium',
  mauro_input: 'authoritative',
  nova_fonte: 'high', // ← adicionar aqui
};
```

### 5. Criar o adaptador de captura

Criar arquivo em `packages/brain/src/adapters/{nova-fonte}.adapter.ts`:

```typescript
// Template base
export class NovaFonteAdapter {
  async capture(rawData: unknown): Promise<InsightInput> {
    return {
      source: 'nova_fonte',
      content: /* transformar rawData em texto */,
      tags: ['nova_fonte', /* tags específicas */],
      sourceRef: /* referência na fonte original */,
      nucleusId: /* qual Núcleo se aplica, ou null */,
    };
  }
}
```

### 6. Registrar no pipeline de ingestão

Em `packages/brain/src/routes/insights.ts`, o endpoint `POST /brain/insights` já aceita qualquer `InsightSource` válido. O adaptador deve chamar este endpoint ou o service diretamente.

### 7. Atualizar documentação

- [ ] Adicionar entrada na tabela §3.3 de `docs/architecture/cerebro-coletivo.md`
- [ ] Atualizar `docs/zenya/NUCLEUS-CONTRACT.md` se for novo Núcleo
- [ ] Registrar decisão no Change Log deste SOP

### 8. Testar

```bash
# Teste de ingestão da nova fonte
curl -X POST http://localhost:3003/brain/insights \
  -H "Content-Type: application/json" \
  -d '{
    "source": "nova_fonte",
    "content": "Insight de teste da nova fonte",
    "tags": ["teste"]
  }'

# Verificar que embedding foi gerado e status='raw'
curl http://localhost:3003/brain/insights/{id}
```

---

## Resultado Esperado

- Nova fonte aceita pelo endpoint de ingestão
- Insights da nova fonte passam pelo pipeline normal (raw → validated → applied)
- confidenceLevel aplicado corretamente
- Documentação atualizada

---

## Change Log

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-04-11 | 1.0 | @architect (Aria) | Versão inicial — Story 3.1 |
