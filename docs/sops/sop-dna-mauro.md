# SOP — DNA de Mauro no Cérebro Coletivo

**Story:** 3.8 — DNA de Mauro
**Versão:** 1.0
**Criado por:** @analyst (Atlas)
**Data:** 2026-04-12

---

## Propósito

Este SOP define como agentes AIOX e o Cérebro Coletivo devem interagir com o DNA de Mauro — seus princípios, filtros de raciocínio e preferências capturados diretamente em sessão de co-criação (Story 3.8).

---

## 1. O que é o DNA de Mauro

O DNA de Mauro é um conjunto de insights com `source='mauro_input'` carregados no Cérebro com `confidenceLevel='authoritative'`. Representa os princípios fundacionais, filtros de raciocínio e preferências de trabalho de Mauro — capturados diretamente por ele, sem inferência de documentos.

**Documento completo:** `docs/dna/mauro-dna.md`

**Estrutura:**
1. Princípios Fundacionais (7 princípios)
2. Filtros de Raciocínio (5 filtros)
3. Preferências de Trabalho (3 preferências)
4. Anti-padrões (4 padrões a evitar)
5. Exemplos de Decisões

---

## 2. Comportamento de `source='mauro_input'`

Conforme arquitetura do Cérebro Coletivo (`docs/architecture/cerebro-coletivo.md`):

| Propriedade | Valor | Significado |
|-------------|-------|-------------|
| `source` | `'mauro_input'` | Input direto de Mauro |
| `confidenceLevel` | `'authoritative'` | Peso máximo — automático |
| Validação automática | Nunca rejeitado | Bypass do validador de qualidade |
| Ranking de busca | Prioridade máxima | Aparece no topo dos resultados |

**Regra crítica:** Insights com `source='mauro_input'` **nunca são rejeitados automaticamente** pelo validador de qualidade. Têm prioridade máxima no ranking de resultados de busca.

---

## 3. Como consultar o DNA de Mauro

### 3.1 Busca semântica

Use `BrainClient.search()` com threshold reduzido para garantir captura:

```typescript
import { BrainClient } from 'packages/brain-client/src/index.js';

const client = new BrainClient({ baseUrl: process.env.BRAIN_API_URL! });

// Consultar princípios de priorização
const { results } = await client.search('como priorizar quando há múltiplas demandas', {
  threshold: 0.70,
  limit: 5,
  statusFilter: ['validated', 'applied'],
});

// Filtrar apenas insights do DNA de Mauro
const dnaResults = results.filter(r => r.source === 'mauro_input');
```

### 3.2 Contexto para injeção em prompt de agente

Use `BrainClient.getContext()` para obter entradas prontas para prompt:

```typescript
const context = await client.getContext('qualidade vs velocidade de entrega', {
  threshold: 0.70,
  limit: 5,
});

// context é um array de ContextEntry com: id, content, source, confidenceLevel, similarity
// Injete no prompt do agente para alinhar decisão com DNA de Mauro
```

### 3.3 Listar todos os insights do DNA de Mauro

```typescript
const { data } = await client.listInsights({
  source: 'mauro_input',
  limit: 50,
});
```

---

## 4. Quando usar `source='mauro_input'` ao ingerir novos insights

Use `source='mauro_input'` **exclusivamente** quando:

| Situação | Usar? |
|----------|-------|
| Mauro expressa um novo princípio ou preferência diretamente em sessão | ✅ Sim |
| Mauro corrige ou refina um princípio existente | ✅ Sim (ingerir como novo, marcar revisão) |
| Mauro dá feedback sobre comportamento de agente | ✅ Sim, se expressar princípio geral |
| Agente infere o que Mauro "provavelmente prefere" | ❌ Não — usar `agent_research` |
| Insight vem de documento escrito por Mauro | ❌ Não — verificar com Mauro antes |
| Insight operacional da Zenya | ❌ Não — usar `zenya_operation` |

**FR15 (inegociável):** Nenhum princípio pode ser inferido de documentos anteriores ou comportamentos observados sem confirmação direta de Mauro.

---

## 5. Como agentes devem interpretar `confidenceLevel='authoritative'`

Quando um resultado de busca retorna `confidenceLevel='authoritative'`:

1. **Não questionar** — o princípio tem peso de decisão final de Mauro
2. **Priorizar sobre outros insights** — mesmo que outros tenham maior `similarity`
3. **Usar como âncora** — em conflito entre insights, `authoritative` prevalece
4. **Citar a fonte** — ao apresentar decisão a Mauro, indicar que é baseada no DNA dele

**Exemplo de uso em prompt de agente:**
```
Contexto do DNA de Mauro (authoritative):
- "O compromisso anterior vem primeiro, sempre."
- "Pronto = processo seguido + saída dentro do esperado."

Com base nisso, a recomendação para esta situação é: [decisão alinhada com DNA]
```

---

## 6. Queries de teste de referência (AC4)

Para verificar se o DNA está recuperável, use estas queries com `threshold: 0.70`:

```typescript
const queries = [
  'como priorizar quando há múltiplas demandas',
  'qualidade vs velocidade de entrega',
  'como tomar decisões sem informação completa',
];

for (const query of queries) {
  const { results } = await client.search(query, {
    threshold: 0.70,
    limit: 5,
    statusFilter: ['validated', 'applied'],
  });
  const dnaResults = results.filter(r => r.source === 'mauro_input');
  console.log(`${query}: ${dnaResults.length} resultados DNA`);
  // Esperado: >= 3 por query
}
```

---

## 7. Atualizar o DNA de Mauro

Se Mauro expressar novos princípios ou refinamentos:

1. Documentar em `docs/dna/mauro-dna.md` (seção correspondente)
2. Ingerir via `BrainClient.ingest()` com `source='mauro_input'`
3. Adicionar entry ao `docs/dna/load-mauro-dna.ts` como registro auditável
4. Não remover insights antigos — o Cérebro mantém histórico (Story 3.7 gerencia ciclo de vida)

---

## Referências

- `docs/dna/mauro-dna.md` — DNA completo de Mauro
- `docs/dna/load-mauro-dna.ts` — Script de carga auditável
- `docs/architecture/cerebro-coletivo.md` — Comportamento de `source='mauro_input'`
- `packages/brain-client/src/` — Interface `BrainClient`
- `docs/sops/sop-agentes-consultar-cerebro.md` — SOP geral de consulta ao Cérebro
- Story 3.8 — Contexto completo da co-criação
