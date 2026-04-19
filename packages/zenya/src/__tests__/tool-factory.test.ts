import { describe, it, expect, vi, beforeEach } from 'vitest';

// All external dependencies mocked before module import
vi.mock('../integrations/zapi-labels.js', () => ({
  zapiAddLabel: vi.fn(),
}));

vi.mock('../tenant/credentials.js', () => ({
  getCredentialJson: vi.fn(),
}));

vi.mock('../integrations/chatwoot.js', () => ({
  addLabel: vi.fn(),
  sendMessage: vi.fn(),
  getChatwootParams: vi.fn().mockReturnValue({ accountId: '1', conversationId: '99' }),
  setContactAudioPreference: vi.fn(),
}));

vi.mock('../integrations/google-calendar.js', () => ({
  createCalendarTools: vi.fn().mockReturnValue({}),
}));

vi.mock('../integrations/asaas.js', () => ({
  createAsaasTools: vi.fn().mockReturnValue({}),
}));

vi.mock('../integrations/loja-integrada.js', () => ({
  createLojaIntegradaTools: vi.fn().mockReturnValue({}),
}));

import { zapiAddLabel } from '../integrations/zapi-labels.js';
import { getCredentialJson } from '../tenant/credentials.js';
import { addLabel } from '../integrations/chatwoot.js';
import { createTenantTools } from '../tenant/tool-factory.js';
import type { TenantConfig } from '../tenant/config-loader.js';

const TENANT_ID = 'tenant-td-01';
const CONFIG: TenantConfig = {
  id: TENANT_ID,
  name: 'Test Tenant',
  system_prompt: '',
  active_tools: [],
  chatwoot_account_id: '1',
  allowed_phones: [],
  admin_phones: [],
  admin_contacts: [],
};
const CTX = { accountId: '1', conversationId: '99', phone: '+5531999998888' };

// Consistent with google-calendar.test.ts pattern — AI SDK returns PromiseLike, not Promise
type ToolWithExecute = { execute: (...args: unknown[]) => PromiseLike<Record<string, unknown>> };

const ESCALACAO_ARGS = {
  resumo_conversa: 'Cliente perguntou sobre prazo de entrega',
  ultima_mensagem: 'Quero falar com alguém',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(addLabel).mockResolvedValue(undefined as never);
});

// TD-7.10-01: Behavioral test — escalarHumano degrades gracefully when zapiAddLabel throws
describe('escalarHumano — degradação graciosamente Z-API (TD-7.10-01)', () => {
  it('resolve com { escalado: true } mesmo quando zapiAddLabel lança erro (non-critical)', async () => {
    vi.mocked(getCredentialJson).mockResolvedValue({
      instanceId: 'I',
      token: 'T',
      clientToken: 'C',
      labels: { humano: '10' },
    });
    vi.mocked(zapiAddLabel).mockRejectedValue(new Error('Z-API connection refused'));

    const tools = createTenantTools(TENANT_ID, CONFIG, CTX);
    const result = await (tools['escalarHumano'] as ToolWithExecute).execute(ESCALACAO_ARGS);

    // Z-API failure must NOT propagate — escalarHumano is non-critical path
    expect(result).toMatchObject({ escalado: true });
    // Critical path (Chatwoot agente-off) must still execute
    expect(addLabel).toHaveBeenCalledWith(expect.anything(), 'agente-off');
    // zapiAddLabel was attempted (confirms the label path was reached)
    expect(zapiAddLabel).toHaveBeenCalledOnce();
  });

  it('resolve com { escalado: true } quando getCredentialJson lança erro (sem credenciais Z-API)', async () => {
    vi.mocked(getCredentialJson).mockRejectedValue(new Error('No credentials for zapi'));

    const tools = createTenantTools(TENANT_ID, CONFIG, CTX);
    const result = await (tools['escalarHumano'] as ToolWithExecute).execute(ESCALACAO_ARGS);

    expect(result).toMatchObject({ escalado: true });
    expect(addLabel).toHaveBeenCalledWith(expect.anything(), 'agente-off');
    // zapiAddLabel never reached when getCredentialJson throws
    expect(zapiAddLabel).not.toHaveBeenCalled();
  });
});
