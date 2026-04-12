# SOP — Agentes Consultando o Cérebro Coletivo

**Versão:** 1.0  
**Data:** 2026-04-12  
**Autor:** @dev (Dex) — Story 3.5  
**Revisão prevista:** Após 50+ consultas de agentes reais (Story 3.7)

---

## Objetivo

Este SOP define como agentes AIOX (Dex, Quinn, Aria, etc.) e outros módulos do SparkleOS consultam o Cérebro Coletivo usando o `BrainClient` (`@sparkle-os/brain-client`).

---

## 1. Importar e Inicializar

```typescript
import { BrainClient } from '@sparkle-os/brain-client';

const brain = new BrainClient({
  baseUrl: process.env['BRAIN_URL'] ?? 'http://localhost:3003',
  // apiKey: process.env['BRAIN_API_KEY'], // opcional — para quando auth for implementado
});
```

**Variável de ambiente obrigatória:**
```bash
BRAIN_URL=http://localhost:3003  # interno VPS
# ou via gateway:
BRAIN_URL=https://sparkle.mauro.dev/brain
```

---

## 2. Busca Direta — `search()`

Quando você sabe exatamente o que quer buscar:

```typescript
const { results } = await brain.search('fluxo de atendimento escala humano', {
  limit: 5,
  threshold: 0.80,       // mais restrito que o default (0.75)
  minConfidence: 'high', // só authoritative + high
});

for (const r of results) {
  console.log(`[${r.source}] ${r.content} (similarity: ${r.similarity.toFixed(2)})`);
}
```

**Defaults:**
| Parâmetro | Default |
|-----------|---------|
| `limit` | 10 |
| `threshold` | 0.75 |
| `statusFilter` | `['validated', 'applied']` |
| `minConfidence` | sem filtro (todos) |

---

## 3. Contexto para Prompt — `getContext()`

A abordagem preferida para agentes que constroem prompts LLM:

```typescript
// Injeta contexto do Cérebro no prompt do agente
const context = await brain.getContext(
  'Como melhorar a taxa de resolução no primeiro contato?',
  { limit: 3 },
);

// Formatar para injeção no prompt
const contextStr = context
  .map((c, i) => `[${i + 1}] (${c.source}, confiança: ${c.confidenceLevel})\n${c.content}`)
  .join('\n\n');

const systemPrompt = `
Você é um especialista em operações SparkleOS.

## Conhecimento do Cérebro Coletivo
${context.length > 0 ? contextStr : '(sem contexto relevante disponível)'}

## Tarefa
...
`;
```

**`getContext()` retorna apenas os campos necessários para prompt:**
- `id` — para rastreabilidade
- `content` — o texto do insight
- `source` — origem (zenya_operation, agent_research, mauro_input)
- `confidenceLevel` — authoritative > high > medium
- `similarity` — relevância para a query (0.75–1.0)

---

## 4. Interpretação de `confidenceLevel`

| Nível | Fonte | Como usar no prompt |
|-------|-------|-------------------|
| `authoritative` | `mauro_input` | Tratar como regra — seguir sem questionamento |
| `high` | `zenya_operation` | Dado operacional real — alta credibilidade |
| `medium` | `agent_research` | Pode conter imprecisão — usar como referência |

---

## 5. Tratamento de Erros

O Cérebro pode estar indisponível. **Agentes nunca devem falhar se o Brain estiver offline:**

```typescript
import { BrainClientError } from '@sparkle-os/brain-client';

async function enrichWithBrainContext(task: string) {
  try {
    return await brain.getContext(task, { limit: 3 });
  } catch (err) {
    if (err instanceof BrainClientError) {
      if (err.status === 0) {
        // Rede indisponível — continuar sem contexto
        console.warn('[Brain] Offline — continuando sem contexto');
        return [];
      }
      if (err.status === 400) {
        // Query inválida — corrigir chamada
        console.error('[Brain] Query inválida:', err.message);
        return [];
      }
    }
    // Erro inesperado — não bloquear o agente
    console.error('[Brain] Erro inesperado:', err);
    return [];
  }
}
```

---

## 6. Máximo de Itens no Prompt

Para evitar overflow de contexto LLM:
- **Máximo recomendado:** 3–5 itens por prompt
- **threshold mínimo:** 0.75 (padrão) — não abaixar abaixo de 0.70
- **Preferir:** `minConfidence: 'high'` quando precisão é crítica

---

## 7. Outros Métodos Disponíveis

```typescript
// Buscar insight específico por ID
const insight = await brain.getInsight('uuid-do-insight');

// Listar insights com filtros
const { data, total } = await brain.listInsights({
  status: 'validated',
  source: 'zenya_operation',
  limit: 20,
});

// Ingerir novo insight (agentes de pesquisa)
const novo = await brain.ingest({
  source: 'agent_research',
  content: 'Descoberta: fluxos com mais de 3 nós de decisão têm 40% mais erros',
  tags: ['arquitetura', 'fluxos', 'qualidade'],
  nucleusId: 'zenya',
});
// Após ingestão, insight fica em status='raw' — aguarda validação humana/sistema
```

---

## 8. Exemplo Completo — @dev consultando antes de implementar

```typescript
import { BrainClient, BrainClientError } from '@sparkle-os/brain-client';

const brain = new BrainClient({ baseUrl: process.env['BRAIN_URL'] ?? 'http://localhost:3003' });

async function implementWithContext(storyDescription: string) {
  // 1. Buscar padrões e aprendizados relevantes do Cérebro
  let context: string[] = [];
  try {
    const entries = await brain.getContext(storyDescription, { limit: 3, minConfidence: 'high' });
    context = entries.map(e => `- [${e.source}] ${e.content}`);
  } catch (e) {
    if (e instanceof BrainClientError) console.warn('[Brain] Indisponível:', e.message);
  }

  const prompt = context.length > 0
    ? `Padrões conhecidos:\n${context.join('\n')}\n\n${storyDescription}`
    : storyDescription;

  return prompt;
}
```
