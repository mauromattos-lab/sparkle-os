# SOP — Ingerir Conhecimento Externo no Cérebro Coletivo

**Versão:** 1.0  
**Data:** 2026-04-12  
**Autor:** @dev (Dex) — Story 3.6  
**Revisão prevista:** Após 50+ ingestões reais (Story 3.7)

---

## Objetivo

Este SOP define como agentes AIOX e Mauro ingerem conhecimento externo no Cérebro Coletivo via o endpoint `POST /brain/insights/ingest`. Cobre dois fluxos:

1. **Agentes AIOX** — pesquisa realizada durante execução de stories ou sessões de análise (`source='agent_research'`)
2. **Mauro** — conhecimento direto inserido via CLI ou API (`source='mauro_input'`)

> **Nota:** Este SOP é complementar ao `sop-aplicar-insight.md`, que cobre o ciclo pós-validação (PATCH /:id/apply). A ingestão é o início do ciclo — produz insights com `status='raw'`.

---

## Quando Ingerir

| Situação | Ação |
|----------|------|
| Agente conclui pesquisa com achado relevante ao sistema | Ingerir ao término da pesquisa |
| Mauro compartilha conhecimento sobre clientes, mercado, processo | Ingerir via `aiox brain add` |
| Insight surge durante execução de story | Ingerir ao concluir a task, não durante |
| Informação já conhecida, sem novidade | Não ingerir — evitar duplicatas |
| Dado operacional da Zenya | Usar `zenya_operation` via Zenya Adapter, não este endpoint |

---

## Formato de `sourceRef`

O `sourceRef` é obrigatório para `agent_research`. Garante rastreabilidade do insight até a origem.

| Contexto | Formato | Exemplo |
|----------|---------|---------|
| Pesquisa durante story | `"story:{id}"` | `"story:3.6"` |
| Sessão de trabalho do agente | `"session:{data}-{agente}"` | `"session:2026-04-12-aria"` |
| Conversa com Mauro | `"conversa:{data}"` | `"conversa:2026-04-12"` |
| Documento externo analisado | `"doc:{titulo-slug}"` | `"doc:relatorio-q1-2026"` |

Para `mauro_input`, o `sourceRef` é opcional mas recomendado quando o conhecimento tem origem rastreável.

---

## Fluxo 1 — Agentes AIOX (`agent_research`)

### Pré-requisitos

- `@sparkle-os/brain-client` instalado no package do agente
- `BRAIN_URL` configurada no ambiente (ou usar default `http://localhost:3003`)
- `sourceRef` identificado (story ID, session ID, etc.)

### Código TypeScript (exemplo completo)

```typescript
import { BrainClient } from '@sparkle-os/brain-client';

const brain = new BrainClient({
  baseUrl: process.env['BRAIN_URL'] ?? 'http://localhost:3003',
});

// Ao concluir pesquisa com achado relevante:
const insight = await brain.ingest({
  source: 'agent_research',
  content: 'Usuários abandonam o fluxo de atendimento após 3 perguntas consecutivas sem resposta direta. Padrão observado em 68% das sessões analisadas.',
  sourceRef: 'story:3.6',           // OBRIGATÓRIO para agent_research
  tags: ['abandono', 'ux', 'fluxo-atendimento'],
  summary: 'Abandono em fluxo de atendimento após 3 perguntas',
});

console.log(`Insight ingested: ${insight.id} (${insight.confidenceLevel})`);
// Output: Insight ingested: 550e8400-... (medium)
```

### Regras para `agent_research`

- `sourceRef` é **obrigatório** — endpoint retorna 400 se ausente
- `confidenceLevel` é definido automaticamente como `'medium'` — não envie este campo
- `content` máximo 2000 caracteres
- `summary` máximo 200 caracteres (recomendado para insights com content longo)
- Ingerir ao término da pesquisa, não durante execução

---

## Fluxo 2 — Mauro via CLI (`mauro_input`)

### Comando `aiox brain add`

```bash
aiox brain add --content "<texto>" [--tags csv] [--summary texto] [--sourceRef ref]
```

### Exemplos

```bash
# Conhecimento simples sobre preferências de clientes
aiox brain add \
  --content "Clientes da Sparkle preferem atendimento via WhatsApp a e-mail. Tempo de resposta esperado: < 2 horas." \
  --tags "canal,whatsapp,preferencia-cliente" \
  --summary "Preferência de canal: WhatsApp > e-mail"

# Conhecimento com referência à conversa
aiox brain add \
  --content "Mauro: o time de vendas precisa de relatórios semanais, não mensais. Relatórios mensais chegam tarde para ajustes de meta." \
  --sourceRef "conversa:2026-04-12" \
  --tags "vendas,relatorios,frequencia" \
  --summary "Relatórios de vendas: frequência semanal preferida"

# Saída esperada
# Insight ingested
#   id:              550e8400-e29b-41d4-a716-446655440000
#   source:          mauro_input
#   confidenceLevel: authoritative
#   status:          raw
```

### Configuração de Ambiente

```bash
# URL do Brain service (padrão: http://localhost:3003)
export BRAIN_URL="http://localhost:3003"

# Verificar que o Brain está rodando
curl http://localhost:3003/brain/health
```

### Regras para `mauro_input`

- `confidenceLevel` é definido automaticamente como `'authoritative'` — nunca será rejeitado automaticamente pelo sistema (per `cerebro-coletivo.md §3.3`)
- `sourceRef` é opcional mas recomendado para rastreabilidade
- `content` máximo 2000 caracteres
- Insights `mauro_input` com status `raw` entram na fila de validação normal (Story 3.3)

---

## Contrato do Endpoint

```
POST /brain/insights/ingest
Content-Type: application/json

Body:
  source:     'mauro_input' | 'agent_research'  (obrigatório)
  content:    string                             (obrigatório, max 2000 chars)
  sourceRef?: string                             (obrigatório para agent_research)
  tags?:      string[]
  summary?:   string                             (max 200 chars)
  nucleusId?: string

Response 201: Insight (com status='raw', confidenceLevel derivado do source)
Response 400: { error: string } — content ausente/vazio/>2000, source inválido, sourceRef ausente para agent_research
```

---

## Após a Ingestão

O insight criado tem `status='raw'`. O ciclo continua:

```
Ingestão (este SOP)
    │ status='raw'
    ▼
Validação — PATCH /brain/insights/{id}/validate
    │ status='validated'
    ▼
Aplicação — PATCH /brain/insights/{id}/apply
    │ status='applied'
    ▼
Busca semântica disponível — POST /brain/insights/search
```

Ver `sop-aplicar-insight.md` para o fluxo de aplicação.  
Ver `sop-agentes-consultar-cerebro.md` para busca semântica.

---

## O que NÃO Fazer

| Erro | Consequência | Alternativa |
|------|-------------|-------------|
| Ingerir `zenya_operation` via este endpoint | 400 — source inválido | Usar Zenya Adapter |
| Omitir `sourceRef` em `agent_research` | 400 — obrigatório | Incluir story ou session ID |
| Enviar `confidenceLevel` no body | Campo ignorado silenciosamente | Não enviar — é derivado do source |
| Ingerir durante execução (não ao final) | Dados incompletos, rastreabilidade ruim | Ingerir ao concluir task |
| Conteúdo > 2000 chars | 400 — limite excedido | Resumir ou dividir em múltiplos insights |
