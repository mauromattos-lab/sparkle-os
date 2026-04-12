# Arquitetura — Cérebro Coletivo v1

**Versão:** 1.0  
**Data:** 2026-04-11  
**Autor:** Aria (@architect)  
**Story:** 3.1 — Arquitetura do Cérebro Coletivo  
**Status:** Accepted

---

## 1. Visão Geral

O Cérebro Coletivo é o componente de conhecimento do SparkleOS. Sua responsabilidade é capturar, validar e aplicar conhecimento gerado por múltiplas fontes de forma que melhore a operação do sistema de forma mensurável.

O ciclo obrigatório (FR6) é:
```
Captura → Validação → Aplicação mensurável
```

Captura sem aplicação não conta como ciclo completo.

---

## 2. Posição na Arquitetura SparkleOS

```
Zenya Adapter ──(insights ops)──► Collective Brain ◄──(agent_research)── Agentes AIOS
                                        │                ◄──(mauro_input)── Mauro (via UI)
                                        │
                                   pgvector (Supabase)
                                        │
                              SparkleOS Core / API ◄──(search)── Agentes AIOS
```

**Componente:** `packages/brain/` — package independente no monorepo pnpm  
**Deploy:** Coolify na VPS Hostinger KVM2  
**Stack:** Node.js 22 LTS + Hono v4 + pgvector (Supabase)  
**Porta:** 3003 (interno VPS) — gateway `/brain` (externo via Core)

---

## 3. Modelo de Dados

### 3.1 Insight

Unidade atômica de conhecimento. Todo conhecimento no Cérebro é um Insight.

```typescript
interface Insight {
  // Identidade
  id: string;                    // UUID v4
  
  // Origem
  source: InsightSource;         // 'zenya_operation' | 'agent_research' | 'mauro_input'
  nucleusId: string | null;      // ex: 'zenya' — qual Núcleo gerou
  sourceRef: string | null;      // referência na fonte (ex: flowId, storyId, sessionId)
  confidenceLevel: ConfidenceLevel; // 'authoritative' | 'high' | 'medium'
  
  // Conteúdo
  content: string;               // texto do insight (max 2000 chars)
  summary: string | null;        // resumo para display (max 200 chars)
  tags: string[];                // categorização livre
  
  // Vetorial
  embedding: number[];           // Voyage-3, 1024 dims, HNSW index
  
  // Lifecycle
  status: InsightStatus;         // 'raw' | 'validated' | 'applied' | 'rejected'
  
  // Validação
  qualityScore: number | null;   // 0.0–1.0 — definido em Story 3.3
  validationNotes: string | null;
  validatedAt: string | null;
  validatedBy: string | null;    // agentId ou 'system'
  
  // Aplicação (FR6 — ciclo completo obrigatório)
  applicationProof: ApplicationProof | null;
  appliedAt: string | null;
  
  // Canonicalização
  canonicalId: string | null;    // aponta para o insight "mestre" se for duplicata
  isDuplicate: boolean;          // true = similar detectada (cosine > 0.92)
  similarityScore: number | null; // score da similaridade detectada
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

type InsightSource = 'zenya_operation' | 'agent_research' | 'mauro_input';

type InsightStatus = 'raw' | 'validated' | 'applied' | 'rejected';

type ConfidenceLevel = 'authoritative' | 'high' | 'medium';
```

### 3.2 ApplicationProof

Schema estruturado para evidenciar FR6 — melhoria mensurável.

```typescript
interface ApplicationProof {
  appliedAt: string;              // ISO 8601
  appliedBy: string;             // agentId ou 'system'
  changeDescription: string;     // o que foi modificado
  
  // Métricas comparativas (pelo menos uma obrigatória)
  baselineMetric: Metric;        // valor antes da aplicação
  resultMetric: Metric;          // valor depois da aplicação
  improvementPercent: number;    // calculado: ((result - baseline) / baseline) * 100
  
  // Rastreabilidade
  storyId: string | null;        // FR14
  nucleusId: string | null;      // qual Núcleo foi melhorado
  evidenceRef: string | null;    // link para documento ou relatório de evidência
}

interface Metric {
  name: string;       // ex: 'taxa_escalacao', 'tempo_resposta_p50'
  value: number;
  unit: string;       // ex: '%', 'segundos', 'conversas/dia'
  measuredAt: string; // ISO 8601
}
```

### 3.3 Confiança por Fonte

| Fonte | confidenceLevel | Semântica |
|-------|----------------|-----------|
| `mauro_input` | `authoritative` | Conhecimento do dono do sistema — máxima prioridade. Nunca rejeitado automaticamente. |
| `zenya_operation` | `high` | Dados operacionais reais — alta confiabilidade. Validação leve. |
| `agent_research` | `medium` | Pesquisa de agentes — pode conter imprecisão. Validação criteriosa. |

Queries de busca podem filtrar por `confidenceLevel` mínimo.

---

## 4. Schema Postgres

```sql
-- Extensão (já habilitada no Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela principal
CREATE TABLE insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Origem
  source          TEXT NOT NULL CHECK (source IN ('zenya_operation', 'agent_research', 'mauro_input')),
  nucleus_id      TEXT,
  source_ref      TEXT,
  confidence_level TEXT NOT NULL DEFAULT 'medium'
                  CHECK (confidence_level IN ('authoritative', 'high', 'medium')),
  
  -- Conteúdo
  content         TEXT NOT NULL CHECK (char_length(content) <= 2000),
  summary         TEXT CHECK (char_length(summary) <= 200),
  tags            TEXT[] DEFAULT '{}',
  
  -- Vetorial (Voyage-3 = 1024 dims)
  embedding       vector(1024),
  
  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'raw'
                  CHECK (status IN ('raw', 'validated', 'applied', 'rejected')),
  
  -- Validação
  quality_score   NUMERIC(3,2) CHECK (quality_score BETWEEN 0 AND 1),
  validation_notes TEXT,
  validated_at    TIMESTAMPTZ,
  validated_by    TEXT,
  
  -- Aplicação
  application_proof JSONB,         -- ApplicationProof serializado
  applied_at      TIMESTAMPTZ,
  
  -- Canonicalização
  canonical_id    UUID REFERENCES insights(id),
  is_duplicate    BOOLEAN NOT NULL DEFAULT false,
  similarity_score NUMERIC(4,3),
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice HNSW para busca semântica
-- HNSW escolhido: volume esperado < 10k no v1, sem necessidade de treinamento
-- m=16 (conexões por nó), ef_construction=64 (qualidade de build)
CREATE INDEX insights_embedding_hnsw_idx
  ON insights USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Índices auxiliares
CREATE INDEX insights_source_idx ON insights (source);
CREATE INDEX insights_status_idx ON insights (status);
CREATE INDEX insights_nucleus_idx ON insights (nucleus_id);
CREATE INDEX insights_confidence_idx ON insights (confidence_level);
CREATE INDEX insights_canonical_idx ON insights (canonical_id) WHERE canonical_id IS NOT NULL;

-- Trigger: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insights_updated_at
  BEFORE UPDATE ON insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tabelas auxiliares (recomendadas pelo Baseline — Story 2.6 §Gaps)

-- G1: Exportação periódica de execuções n8n
CREATE TABLE zenya_execution_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         TEXT NOT NULL,
  flow_name       TEXT NOT NULL,
  execution_id    TEXT,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error')),
  duration_ms     INTEGER,
  started_at      TIMESTAMPTZ NOT NULL,
  finished_at     TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- G2: Logging de uso AI por chamada
CREATE TABLE zenya_ai_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         TEXT NOT NULL,
  execution_id    TEXT,
  model           TEXT NOT NULL,         -- ex: 'gpt-4.1', 'gpt-4.1-mini'
  prompt_tokens   INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens    INTEGER NOT NULL,
  cost_usd        NUMERIC(10,6),         -- calculado com preços do modelo
  conversation_id TEXT,                  -- Chatwoot conversation ID
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX zenya_ai_usage_flow_idx ON zenya_ai_usage (flow_id);
CREATE INDEX zenya_ai_usage_recorded_idx ON zenya_ai_usage (recorded_at);
```

---

## 5. Pipeline de Conhecimento

```
┌─────────────────────────────────────────────────────────┐
│                    INGESTÃO (Story 3.2)                  │
│                                                          │
│  Source → POST /brain/insights                           │
│            │                                             │
│            ├─ gera embedding (Voyage-3, 1024 dims)       │
│            ├─ busca similares (cosine, HNSW)             │
│            │   └─ se similarity > 0.92 → is_duplicate=T │
│            └─ salva com status='raw'                     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                  VALIDAÇÃO (Story 3.3)                   │
│                                                          │
│  raw → PATCH /brain/insights/{id}/validate               │
│         │                                                │
│         ├─ qualityScore calculado por critérios (3.3)    │
│         ├─ score >= threshold → status='validated'       │
│         └─ score < threshold → status em observação      │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                  APLICAÇÃO (Story 3.4)                   │
│                                                          │
│  validated → PATCH /brain/insights/{id}/apply            │
│              │                                           │
│              ├─ applicationProof obrigatório (FR6)       │
│              ├─ baselineMetric + resultMetric             │
│              └─ status='applied'                         │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                  CONSULTA (Story 3.5)                    │
│                                                          │
│  POST /brain/insights/search                             │
│   └─ cosine similarity, threshold 0.75                   │
│      apenas validated + applied                          │
│      resultado inclui source + confidenceLevel           │
└─────────────────────────────────────────────────────────┘
```

---

## 6. API do Brain (expansão de docs/architecture.md §5)

Base URL: `http://localhost:3003` (interno) | `/brain` (via gateway Core)

```yaml
# Ingestão base
POST /brain/insights
  body:
    source: InsightSource          # obrigatório (zenya_operation | agent_research | mauro_input)
    content: string                # obrigatório, max 2000 chars
    nucleusId?: string
    sourceRef?: string
    tags?: string[]
    summary?: string
  response: Insight                # status='raw', embedding gerado, confidenceLevel derivado do source

# Ingestão externa — endpoint de conveniência para agent_research e mauro_input (Story 3.6)
# Aplica validações source-specific e deriva confidenceLevel automaticamente.
# IMPORTANTE: registrado antes de /:id no router para evitar conflito de rota.
POST /brain/insights/ingest
  body:
    source: 'mauro_input' | 'agent_research'  # obrigatório — zenya_operation não aceito
    content: string                            # obrigatório, não vazio, max 2000 chars
    sourceRef?: string                         # obrigatório para agent_research (ex: "story:3.6")
                                               # opcional para mauro_input
    tags?: string[]
    summary?: string                           # max 200 chars
    nucleusId?: string
  validations:
    - content ausente ou vazio → 400
    - content > 2000 chars → 400
    - source não é mauro_input nem agent_research → 400
    - source = agent_research e sourceRef ausente → 400
  confidenceLevel_override:
    mauro_input: authoritative  # sempre — ignora valor enviado pelo cliente
    agent_research: medium       # sempre — ignora valor enviado pelo cliente
  response: Insight              # status='raw', confidenceLevel derivado do source
  errors:
    400: { error: string }       # mensagem descritiva da violação

# Busca semântica
POST /brain/insights/search
  body:
    query: string                  # texto de busca
    limit?: number                 # default 10
    minConfidence?: ConfidenceLevel # filtro opcional
    statusFilter?: InsightStatus[] # default ['validated', 'applied']
    threshold?: number             # default 0.75
  response:
    results: Array<Insight & { similarity: number }>

# Validar insight
PATCH /brain/insights/{id}/validate
  body:
    qualityScore: number           # 0.0–1.0
    validationNotes?: string
    validatedBy: string            # agentId
  response: Insight                # status='validated' ou permanece em observação

# Registrar aplicação (FR6 — ciclo completo)
PATCH /brain/insights/{id}/apply
  body:
    applicationProof: ApplicationProof  # obrigatório
  response: Insight                # status='applied'

# Rejeitar insight
PATCH /brain/insights/{id}/reject
  body:
    reason: string
  response: Insight                # status='rejected'

# Detalhe
GET /brain/insights/{id}
  response: Insight

# Listar (paginado)
GET /brain/insights
  query: status?, source?, nucleusId?, page?, limit?
  response: { data: Insight[], total: number, page: number }

# Health
GET /brain/health
  response: { status: 'ok', db: 'ok', embeddingService: 'ok' }
```

---

## 7. Canonicalização

### Estratégia v1: Similarity Threshold

Durante a ingestão de cada novo insight:

1. Gerar embedding do novo conteúdo (Voyage-3)
2. Buscar os 5 insights mais similares no HNSW (excluindo `rejected`)
3. Se o mais similar tiver `cosine_similarity > 0.92`:
   - Marcar `is_duplicate = true`
   - Salvar `similarity_score` e `canonical_id` apontando para o insight original
   - Status segue o fluxo normal (`raw`) — não é bloqueado
4. O canonical insight recebe um tag `has_duplicates` para revisão periódica

**Nota:** Duplicatas não são deletadas nem bloqueadas — são marcadas para que o processo de ciclo de vida (Story 3.7) possa decidir o que fazer.

**Threshold 0.92:** escolhido empiricamente para v1. Deve ser revisado após acúmulo de 100+ insights com dados reais.

---

## 8. Decisão — Errata da Arquitetura Base

| Campo | docs/architecture.md (original) | Esta decisão | Rationale |
|-------|----------------------------------|--------------|-----------|
| Dims embeddings | 1536 (incorreto) | **1024** | Voyage-3 usa 1024 dims por padrão — 1536 é dimensão do OpenAI text-embedding-3-small |
| Modelo embeddings | "Voyage via Anthropic SDK" | **Voyage API direta** | Anthropic SDK não expõe embeddings diretamente — usar `voyageai` npm package |

`docs/architecture.md §4` será atualizado em Story 3.2 quando o package `packages/brain/` for criado.

---

## Referências

- `docs/architecture.md` — arquitetura base SparkleOS (§2.4, §4, §5, §6)
- `docs/zenya/NUCLEUS-CONTRACT.md` — outputs formais da Zenya
- `docs/zenya/BASELINE-PERFORMANCE.md` — métricas base e gaps G1/G2/G3
- `docs/adrs/ADR-005-cerebro-coletivo-stack.md` — decisões de tecnologia
- `docs/sops/sop-adicionar-fonte-cerebro.md` — como adicionar nova fonte
