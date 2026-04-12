# SOP — Dashboard do Cérebro Coletivo

**Story:** 3.9  
**Autor:** @dev (Dex)  
**Data:** 2026-04-12  
**Status:** Ativo

---

## 1. Visão Geral

O Dashboard do Cérebro Coletivo fornece uma visão agregada e em tempo quase-real do estado do conhecimento acumulado no SparkleOS. Ele expõe dois endpoints:

| Endpoint | Tipo | Descrição |
|----------|------|-----------|
| `GET /brain/dashboard` | JSON | Dados agregados em formato `DashboardData` — contrato de dados para Epic 4 |
| `GET /brain/dashboard/ui` | HTML | Página vanilla com visualização dos dados (fetch client-side) |

---

## 2. URLs de Acesso

### Acesso Interno (dentro do VPS / container)

```
http://localhost:3003/brain/dashboard       # JSON
http://localhost:3003/brain/dashboard/ui    # HTML
```

### Acesso via Gateway (externo / outros serviços)

```
https://<gateway-host>/brain/dashboard      # JSON
https://<gateway-host>/brain/dashboard/ui   # HTML
```

> O gateway é configurado no `core-config.yaml` e redireciona `/brain/*` para o serviço `brain` na porta 3003.

---

## 3. Estrutura do Payload JSON (`DashboardData`)

```typescript
{
  generatedAt: string;    // ISO 8601 — quando os dados foram calculados
  cacheHit: boolean;      // true = dados vieram do cache em memória (TTL 60s)
  summary: { ... };       // Totais e contagens por status/fonte
  cycle: { ... };         // Métricas do funil de conhecimento
  insights_by_confidence: { ... };  // Breakdown por nível de confiança
  top_applied: [...];     // 5 insights mais recentes com status=applied
  quality_distribution: [...];  // Histograma em 5 buckets de qualityScore
  duplicates: { ... };    // Total e top 5 canônicos com mais duplicatas
}
```

---

## 4. Como Interpretar Cada Seção

### 4.1 `summary`

| Campo | Significado |
|-------|-------------|
| `total` | Total absoluto de insights na base (todos os status) |
| `by_status.raw` | Recém-capturados, aguardando validação de qualidade |
| `by_status.validated` | Validados pelo quality service (qualityScore >= threshold) |
| `by_status.applied` | Aplicados ao sistema com prova de melhoria |
| `by_status.rejected` | Rejeitados por baixa qualidade ou duplicação |
| `by_source.zenya_operation` | Originados de execuções de fluxos Zenya |
| `by_source.agent_research` | Originados de pesquisas de agentes AIOX |
| `by_source.mauro_input` | Originados de input direto do Mauro |
| `total_duplicates` | Insights marcados como `isDuplicate=true` |
| `avg_quality_score` | Média de `qualityScore` de insights validados/aplicados (2 casas decimais). `null` se nenhum ainda foi validado/aplicado |

### 4.2 `cycle`

Representa o funil obrigatório definido em FR6 (captura → validação → aplicação mensurável):

| Campo | Significado |
|-------|-------------|
| `ingested` | Total de insights criados (entrada do funil = total) |
| `validated` | Total que completou a fase de validação (`validated` + `applied`) |
| `applied` | Total com evidência de aplicação |
| `rejected` | Total descartado |
| `completionRate` | `applied / ingested * 100` — percentual do funil completo (2 casas decimais) |

**Como ler o completionRate:** Um `completionRate` de 15% indica que 15% do conhecimento capturado foi efetivamente aplicado ao sistema. Valores baixos podem indicar acúmulo de insights `raw` aguardando validação.

### 4.3 `insights_by_confidence`

Contagem de insights não-rejeitados por nível de confiança:

| Nível | Origem típica |
|-------|---------------|
| `authoritative` | `mauro_input` — decisões diretas do Mauro |
| `high` | `zenya_operation` — dados operacionais verificáveis |
| `medium` | `agent_research` — pesquisas de agentes (requerem validação) |

### 4.4 `top_applied`

Lista dos 5 insights aplicados mais recentemente. Ordenados por `appliedAt DESC`.

Campos relevantes:
- `improvementPercent`: extraído de `applicationProof.improvementPercent`. `null` se a prova de aplicação não contém métrica de melhoria percentual.
- `nucleusId`: identifica o núcleo de execução associado (ex: ID de fluxo Zenya).

### 4.5 `quality_distribution`

Histograma de `qualityScore` em 5 faixas fixas. Sempre retorna todos os 5 buckets (count=0 para faixas sem dados):

| Faixa | Interpretação |
|-------|---------------|
| `0.0–0.2` | Insights de baixíssima qualidade (raramente chegam a `validated`) |
| `0.2–0.4` | Baixa qualidade |
| `0.4–0.6` | Qualidade média |
| `0.6–0.8` | Boa qualidade |
| `0.8–1.0` | Alta qualidade — candidatos prioritários para aplicação |

Inclui apenas insights com `status IN ('validated', 'applied')` e `qualityScore IS NOT NULL`.

### 4.6 `duplicates`

| Campo | Significado |
|-------|-------------|
| `total_duplicates` | Total de insights com `isDuplicate=true` |
| `top_canonical` | Top 5 insights canônicos com mais duplicatas apontando para eles |
| `top_canonical[].canonicalId` | ID do insight canônico (original) |
| `top_canonical[].count` | Quantidade de duplicatas que apontam para este canônico |
| `top_canonical[].summary` | Resumo do insight canônico (pode ser `null`) |

---

## 5. Cache em Memória (TTL 60s)

O endpoint `/brain/dashboard` usa cache em memória com TTL de 60 segundos para evitar queries agregadas repetidas.

- `cacheHit: false` — dados recém-calculados do banco
- `cacheHit: true` — dados vieram do cache (menos de 60s desde o último cálculo)

O cache é invalidado automaticamente após 60s. Não há endpoint para forçar invalidação — reiniciar o serviço limpa o cache.

---

## 6. Quando Usar JSON vs HTML

| Situação | Endpoint recomendado |
|----------|----------------------|
| Integração com frontend (Epic 4) | `GET /brain/dashboard` (JSON) |
| Monitoramento operacional rápido | `GET /brain/dashboard/ui` (HTML) |
| Debugging de contagens | `GET /brain/dashboard` (JSON) — inspecionar campos individuais |
| Apresentação para Mauro / stakeholders | `GET /brain/dashboard/ui` (HTML) |
| Agentes AIOX consultando métricas | `GET /brain/dashboard` (JSON) |

---

## 7. Coordenação com Epic 4

O endpoint `GET /brain/dashboard` é o **contrato de dados** que o frontend do Epic 4 consumirá.

**Compromissos para Epic 4:**
- O tipo `DashboardData` exportado de `packages/brain/src/types/dashboard.ts` é estável
- Campos novos serão adicionados de forma aditiva (sem quebrar clientes existentes)
- Campos removidos ou renomeados serão precedidos de uma story de deprecação

**Integração no Epic 4:**
- O cliente do Epic 4 deve consumir via gateway: `GET <gateway>/brain/dashboard`
- A re-exportação de `DashboardData` via `@sparkle-os/brain-client` será feita em story futura (fora do escopo da Story 3.9)
- Por ora, Epic 4 pode copiar o tipo `DashboardData` de `packages/brain/src/types/dashboard.ts`

---

## 8. Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|---------------|------|
| `500 Internal Server Error` | Conexão com banco falhando | Verificar `DATABASE_URL` no ambiente + saúde do Supabase |
| `avg_quality_score: null` | Nenhum insight validado ainda | Normal em sistemas novos — aguardar ciclo de validação |
| `completionRate: 0` | Nenhum insight foi aplicado ainda | Normal em fase inicial — executar ciclos de aplicação |
| `cacheHit` sempre `false` | Processo reiniciado recentemente ou TTL expirado | Normal — cache expira após 60s |
| Dados desatualizados | Cache ativo | Aguardar 60s para atualização automática |

---

## 9. Referências

- Schema `insights` e campos: `docs/architecture/cerebro-coletivo.md §3.1`
- `ApplicationProof.improvementPercent`: `docs/architecture/cerebro-coletivo.md §3.2`
- FR6 (ciclo obrigatório): `docs/architecture/cerebro-coletivo.md §1`
- Índices auxiliares: `docs/architecture/cerebro-coletivo.md §4`
- Implementação: `packages/brain/src/services/dashboard.service.ts`
- Testes: `packages/brain/src/dashboard.test.ts`
