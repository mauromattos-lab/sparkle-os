# ADR-005 — Cérebro Coletivo: Stack, Embeddings e Índice Vetorial

**Status:** Accepted  
**Data:** 2026-04-11  
**Autor:** @architect (Aria)  
**Story:** 3.1 — Arquitetura do Cérebro Coletivo

---

## Contexto

O Epic 3 requer a implementação do Cérebro Coletivo — pipeline de conhecimento com ingestão multi-fonte, validação de qualidade e aplicação mensurável. Precisávamos confirmar ou revisar as decisões tecnológicas esboçadas em `docs/architecture.md §4` com base nas características reais do problema.

**Decisões a tomar:**
1. Vector store e dimensionalidade dos embeddings
2. Modelo de embeddings
3. Tipo de índice pgvector
4. Threshold de busca semântica
5. Estratégia de canonicalização

---

## Decisões

### 1. Vector Store: pgvector (Supabase)

**Mantido da arquitetura base.**

pgvector já disponível no Supabase free tier — sem custo adicional. Para o volume esperado no v1 (centenas de insights), pgvector no Postgres é mais do que suficiente e elimina complexidade operacional de um serviço dedicado.

**Alternativas descartadas:**

| Alternativa | Razão de Descarte |
|-------------|-----------------|
| Pinecone | Custo adicional, dependência de serviço externo. Vantagem real apareece acima de 1M+ vetores. |
| Weaviate | Infra adicional para hospedar na VPS. Overhead sem benefício no v1. |
| Qdrant | Idem Weaviate — melhor para escala que não temos agora. |
| ChromaDB | Sem suporte nativo a Postgres — não integra com a stack existente. |

---

### 2. Modelo de Embeddings: Voyage-3 via Voyage AI API — 1024 dims

**Correção da arquitetura base:** `docs/architecture.md §4` indicava "1536 dims" que é a dimensionalidade do OpenAI `text-embedding-3-small`, não do Voyage. Voyage-3 usa **1024 dims** por padrão.

**Modelo escolhido:** `voyage-3` (general purpose)

| Modelo | Dims | Contexto | Uso ideal |
|--------|------|----------|-----------|
| voyage-3 | 1024 | 32k tokens | **Escolhido** — general purpose, melhor custo/benefício |
| voyage-3-large | 1024 | 32k tokens | Maior qualidade, custo 2x — não justificado para v1 |
| voyage-3-lite | 512 | 32k tokens | Menor custo, menor qualidade — riscos para recall |

**Integração:** `voyageai` npm package (não via Anthropic SDK — Anthropic SDK não expõe embeddings diretamente).

**Alternativas descartadas:**

| Alternativa | Razão de Descarte |
|-------------|-----------------|
| OpenAI text-embedding-3-small (1536 dims) | Custo adicional (já pagamos Claude). Voyage recomendado pela Anthropic para uso com Claude. |
| OpenAI text-embedding-3-large (3072 dims) | Custo 3x maior, schema pgvector mais pesado. |
| Embeddings locais (fastembed, sentence-transformers) | Requer GPU ou CPU significativa na VPS. Qualidade inferior aos modelos de API. |

---

### 3. Índice pgvector: HNSW

**HNSW** (Hierarchical Navigable Small World) escolhido sobre IVFFLAT.

| Critério | HNSW | IVFFLAT |
|----------|------|---------|
| Volume ideal | Qualquer | 100k+ vetores |
| Treinamento | Não requer | Requer (número de lists) |
| Recall | Superior | Bom |
| Latência | Consistente | Variável |
| Uso de memória | Maior | Menor |

Para o v1 com centenas de insights, HNSW é estritamente superior. IVFFLAT seria preferível apenas se atingíssemos 100k+ insights com memória limitada.

**Configuração:**
```sql
CREATE INDEX USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

- `m = 16`: conexões por nó — balanço entre qualidade e memória
- `ef_construction = 64`: qualidade de build — adequado para v1

---

### 4. Threshold de Busca Semântica: 0.75

Mantido da arquitetura base. Baseline razoável para similaridade coseno em português/domínio de negócio.

**Revisão prevista:** após acúmulo de 50+ queries reais com feedback de qualidade.

---

### 5. Canonicalização: Cosine Similarity > 0.92

Threshold de 0.92 para detecção de duplicatas durante ingestão.

**Rationale:** 0.92 é conservador — evita falsos positivos (marcar insights distintos como duplicatas). Insights marcados como `is_duplicate=true` não são bloqueados — seguem o pipeline normalmente com flag para revisão em Story 3.7.

**Revisão prevista:** após 100+ insights com dados reais.

---

## Consequências

**Positivo:**
- Zero custo adicional de infraestrutura (pgvector já no Supabase)
- Stack coesa — Postgres como única fonte de verdade
- Voyage-3 otimizado para uso com Claude (recomendação Anthropic)
- HNSW sem treinamento facilita operação pelo time de agentes

**Negativo / Riscos:**
- Voyage API = dependência externa adicional (além da Anthropic API)
- 1024 dims exige atualização do schema na arquitetura base — documentado como errata em `docs/architecture/cerebro-coletivo.md §8`
- HNSW usa mais memória que IVFFLAT — monitorar se VPS (8GB RAM) ficar sob pressão

## Referências

- `docs/architecture/cerebro-coletivo.md` — arquitetura detalhada do Brain
- `docs/architecture.md §4` — modelo Insight original (a atualizar em Story 3.2)
- Voyage AI docs: https://docs.voyageai.com/docs/embeddings
