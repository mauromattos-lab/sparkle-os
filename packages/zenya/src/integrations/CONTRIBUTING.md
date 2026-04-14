# Zenya Integrations — Guia de Contribuição

Este diretório contém integrações com sistemas externos (Asaas, Google Calendar, ElevenLabs, Chatwoot).

## Como adicionar uma nova integração

### 1. Crie o arquivo de integração

```
packages/zenya/src/integrations/{nome}.ts
```

Use `asaas.ts` como referência. Padrão obrigatório:

```typescript
import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { getCredentialJson } from '../tenant/credentials.js';

interface MinhaIntegracaoCredentials {
  api_key: string;
  // ... outros campos
}

/**
 * Creates tools scoped to a specific tenant.
 * tenantId is captured via closure — NEVER as a tool parameter.
 */
export function createMinhaIntegracaoTools(tenantId: string): ToolSet {
  async function loadCreds(): Promise<MinhaIntegracaoCredentials> {
    return getCredentialJson<MinhaIntegracaoCredentials>(tenantId, 'minha_integracao');
  }

  return {
    nomeDaTool: tool({
      description: 'Descrição clara para o LLM entender quando usar.',
      parameters: z.object({
        // NUNCA incluir tenantId aqui — ele vem do closure
        campo: z.string().describe('Descrição do campo'),
      }),
      execute: async ({ campo }) => {
        try {
          const creds = await loadCreds(); // carrega credenciais em runtime
          // ... implementação
          return { resultado: '...' };
        } catch (err) {
          return { error: `Erro: ${String(err)}` };
        }
      },
    }),
  };
}
```

### 2. Regras de segurança obrigatórias

- **tenantId** NUNCA aparece como parâmetro em nenhuma tool — sempre via closure
- **Credenciais** carregadas via `getCredentialJson(tenantId, 'service')` dentro do execute
- **Logs** nunca expõem api_key ou outros secrets
- **Erros** sempre retornam `{ error: string }` — nunca lançam exceção para o LLM

### 3. Registre a integração no `tool-factory.ts`

```typescript
// packages/zenya/src/tenant/tool-factory.ts

import { createMinhaIntegracaoTools } from '../integrations/minha-integracao.js';

// Dentro de createTenantTools:
if (config.active_tools.includes('minha_integracao')) {
  Object.assign(tools, createMinhaIntegracaoTools(tenantId));
}
```

### 4. Adicione testes

```
packages/zenya/src/__tests__/minha-integracao.test.ts
```

Cobrir:
- Tool retorna resultado esperado com mock de fetch
- Tool retorna `{ error }` quando API falha
- Tool não expõe credenciais em logs

### 5. Configure as credenciais no tenant

Na tabela `zenya_tenant_credentials`, registre o serviço com as credenciais criptografadas. Use `tenant/seed.ts` como exemplo.

## Integrações existentes

| Arquivo | Serviço | Tools |
|---------|---------|-------|
| `asaas.ts` | Asaas (cobranças) | `criarOuBuscarCobranca` |
| `google-calendar.ts` | Google Calendar | `buscarJanelasDisponiveis`, `criarAgendamento`, ... |
| `elevenlabs.ts` | ElevenLabs TTS | `formatSSML`, `generateAudio` (interno) |
| `chatwoot.ts` | Chatwoot | Funções internas (não tools) |
| `message-chunker.ts` | — | `chunkAndSend` (interno) |

## Ativação por tenant

As integrações são ativadas por tenant via `active_tools` (array JSON na tabela `zenya_tenants`):

```json
["google_calendar", "asaas"]
```

Cada integração só é carregada se seu nome estiver neste array.
