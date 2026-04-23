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
  sendPrivateNote: vi.fn(),
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
import { addLabel, sendMessage } from '../integrations/chatwoot.js';
import { buildEscalationSummary, createTenantTools } from '../tenant/tool-factory.js';
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

const CONFIG_SILENT: TenantConfig = {
  ...CONFIG,
  escalation_public_summary: false,
};
const CTX = { accountId: '1', conversationId: '99', phone: '+5531999998888' };

// Consistent with google-calendar.test.ts pattern — AI SDK returns PromiseLike, not Promise
type ToolWithExecute = { execute: (...args: unknown[]) => PromiseLike<Record<string, unknown>> };

const ESCALACAO_ARGS = {
  resumo: '[ATENDIMENTO] Cliente perguntou sobre prazo de entrega e quer falar com alguém',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(addLabel).mockResolvedValue(undefined as never);
  vi.mocked(sendMessage).mockResolvedValue(undefined as never);
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

describe('escalarHumano — resumo como mensagem pública na conversa', () => {
  it('posta resumo como mensagem pública ANTES de adicionar label agente-off', async () => {
    vi.mocked(getCredentialJson).mockRejectedValue(new Error('no creds'));

    const tools = createTenantTools(TENANT_ID, CONFIG, CTX);
    await (tools['escalarHumano'] as ToolWithExecute).execute({
      resumo:
        '[ATENDIMENTO] Cliente quer pedido especial de iPhone 14. Última msg: "Consegue conseguir um 14 Pro?". Motivo: fora do estoque.',
    });

    expect(sendMessage).toHaveBeenCalledOnce();
    const msgContent = vi.mocked(sendMessage).mock.calls[0]?.[1] ?? '';
    expect(msgContent).toContain('[ATENDIMENTO]');
    expect(msgContent).toContain('iPhone 14');
    expect(msgContent).toContain('fora do estoque');

    // sendMessage must run before addLabel — the handoff message has to land BEFORE
    // the bot goes silent so the client/atendente see the context.
    const msgOrder = vi.mocked(sendMessage).mock.invocationCallOrder[0] ?? Infinity;
    const labelOrder = vi.mocked(addLabel).mock.invocationCallOrder[0] ?? -Infinity;
    expect(msgOrder).toBeLessThan(labelOrder);
  });

  it('resolve { escalado: true } mesmo se sendMessage falhar (non-critical)', async () => {
    vi.mocked(sendMessage).mockRejectedValue(new Error('Chatwoot message endpoint down'));
    vi.mocked(getCredentialJson).mockRejectedValue(new Error('no creds'));

    const tools = createTenantTools(TENANT_ID, CONFIG, CTX);
    const result = await (tools['escalarHumano'] as ToolWithExecute).execute(ESCALACAO_ARGS);

    expect(result).toMatchObject({ escalado: true });
    // Critical path (agente-off) must still execute when handoff message fails
    expect(addLabel).toHaveBeenCalledWith(expect.anything(), 'agente-off');
  });
});

describe('escalarHumano — modo silencioso (escalation_public_summary=false)', () => {
  it('NÃO posta mensagem pública e não expõe parâmetro `resumo`', async () => {
    vi.mocked(getCredentialJson).mockRejectedValue(new Error('no creds'));

    const tools = createTenantTools(TENANT_ID, CONFIG_SILENT, CTX);

    // Schema do tool não pede mais `resumo` — execute roda sem args
    const result = await (tools['escalarHumano'] as ToolWithExecute).execute({});

    expect(result).toMatchObject({ escalado: true });
    // Nenhuma mensagem pública foi enviada — esse é o ponto principal da flag off
    expect(sendMessage).not.toHaveBeenCalled();
    // O handoff técnico continua acontecendo (label agente-off silencia o bot)
    expect(addLabel).toHaveBeenCalledWith(expect.anything(), 'agente-off');
  });

  it('mantém handoff Z-API mesmo no modo silencioso', async () => {
    vi.mocked(getCredentialJson).mockResolvedValue({
      instanceId: 'I',
      token: 'T',
      clientToken: 'C',
      labels: { humano: '10' },
    });

    const tools = createTenantTools(TENANT_ID, CONFIG_SILENT, CTX);
    await (tools['escalarHumano'] as ToolWithExecute).execute({});

    expect(sendMessage).not.toHaveBeenCalled();
    expect(zapiAddLabel).toHaveBeenCalledOnce();
  });
});

describe('buildEscalationSummary', () => {
  it('inclui motivo quando presente', () => {
    const s = buildEscalationSummary({
      resumo_conversa: 'A',
      ultima_mensagem: 'B',
      motivo: 'C',
    });
    expect(s).toContain('*Motivo:* C');
    expect(s).toContain('*Última mensagem do cliente:* "B"');
    expect(s).toContain('*Resumo da conversa:*\nA');
  });

  it('omite linha de motivo quando ausente', () => {
    const s = buildEscalationSummary({ resumo_conversa: 'A', ultima_mensagem: 'B' });
    expect(s).not.toContain('*Motivo:*');
    expect(s).toContain('*Última mensagem do cliente:* "B"');
  });
});
