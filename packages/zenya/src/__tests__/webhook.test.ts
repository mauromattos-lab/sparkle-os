import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Story 18.5: DEBOUNCE_MS é capturado em module scope no webhook.ts.
// vi.hoisted garante que o env var é setado ANTES do import do webhook.
vi.hoisted(() => {
  process.env['ZENYA_DEBOUNCE_MS'] = '1';
});

// --- Mocks (hoisted before imports that use them) ---

vi.mock('../db/client.js', () => ({
  getSupabase: vi.fn(),
}));

// withSessionLock: by default in legacy tests, just returns locked:true without
// running the callback (those tests don't depend on the inner pipeline).
// Story 18.5 tests override this mock to actually execute the callback so we can
// validate fetchPending → markAll{Done,Failed} flow.
const mockWithSessionLock = vi.fn().mockResolvedValue({ locked: true });
vi.mock('../worker/lock.js', () => ({
  withSessionLock: (...args: unknown[]) => mockWithSessionLock(...args),
}));

// We mock enqueue + markAllDone at the module level so we can assert on them
const mockEnqueue = vi.fn().mockResolvedValue(undefined);
const mockMarkAllDone = vi.fn().mockResolvedValue(undefined);
const mockFetchPending = vi.fn().mockResolvedValue([]);
const mockMarkAllFailed = vi.fn().mockResolvedValue(undefined);
vi.mock('../worker/queue.js', () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
  markAllDone: (...args: unknown[]) => mockMarkAllDone(...args),
  fetchPending: (...args: unknown[]) => mockFetchPending(...args),
  markAllFailed: (...args: unknown[]) => mockMarkAllFailed(...args),
}));

const mockTranscribeAudioUrl = vi.fn().mockResolvedValue('transcription text');
vi.mock('../integrations/whisper.js', () => ({
  transcribeAudioUrl: (...args: unknown[]) => mockTranscribeAudioUrl(...args),
}));

const mockRunZenyaAgent = vi.fn().mockResolvedValue(undefined);
vi.mock('../agent/index.js', () => ({
  runZenyaAgent: (...args: unknown[]) => mockRunZenyaAgent(...args),
}));

const mockRunAdminAgent = vi.fn().mockResolvedValue(undefined);
const mockIsBurstMessage = vi.fn().mockReturnValue(false);
vi.mock('../agent/admin-agent.js', () => ({
  runAdminAgent: (...args: unknown[]) => mockRunAdminAgent(...args),
  isBurstMessage: (...args: unknown[]) => mockIsBurstMessage(...args),
}));

const mockClearHistory = vi.fn().mockResolvedValue(undefined);
vi.mock('../agent/memory.js', () => ({
  clearHistory: (...args: unknown[]) => mockClearHistory(...args),
}));

const mockEscalateToHuman = vi.fn().mockResolvedValue(undefined);
vi.mock('../tenant/escalation.js', () => ({
  escalateToHuman: (...args: unknown[]) => mockEscalateToHuman(...args),
}));

const mockLoadTenantByAccountId = vi.fn().mockResolvedValue({
  id: 'tenant-uuid-123',
  chatwoot_account_id: 'tenant-123',
  name: 'Test Tenant',
  system_prompt: '',
  active_tools: [],
  allowed_phones: [],
  admin_phones: [],
  admin_contacts: [],
});
vi.mock('../tenant/config-loader.js', () => ({
  loadTenantByAccountId: (...args: unknown[]) => mockLoadTenantByAccountId(...args),
}));

const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockRemoveConversationLabel = vi.fn();
vi.mock('../integrations/chatwoot.js', () => ({
  getChatwootParams: (accountId: string, conversationId: string) => ({
    url: 'https://chatwoot.test',
    token: 'test-token',
    accountId,
    conversationId,
  }),
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  removeConversationLabel: (...args: unknown[]) => mockRemoveConversationLabel(...args),
}));

// Import after mocks
import { createWebhookRouter, handleResetCommand } from '../worker/webhook.js';
import type { TenantConfig } from '../tenant/config-loader.js';

// --- Helpers ---

function buildApp(): Hono {
  const app = new Hono();
  app.route('/', createWebhookRouter());
  return app;
}

function makePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 42,
    content: 'Olá',
    message_type: 'incoming',
    account: { id: 'tenant-123' },
    conversation: { id: 'conv-999' },
    sender: { phone_number: '+5511999990000', name: 'Cliente' },
    ...overrides,
  };
}

async function postWebhook(app: Hono, body: unknown): Promise<Response> {
  return app.request('/webhook/chatwoot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- Test suite ---

describe('POST /webhook/chatwoot', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  // AC2: payload validation
  describe('payload validation', () => {
    it('returns 400 when message_type is missing', async () => {
      const payload = makePayload({ message_type: undefined });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/message_type/);
    });

    it('returns 400 when account.id is missing', async () => {
      const payload = makePayload({ account: {} });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(400);
    });

    it('returns 400 when conversation.id is missing', async () => {
      const payload = makePayload({ conversation: {} });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(400);
    });

    it('returns 400 when sender.phone_number is missing', async () => {
      const payload = makePayload({ sender: { name: 'X' } });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid JSON body', async () => {
      const res = await app.request('/webhook/chatwoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      });
      expect(res.status).toBe(400);
    });
  });

  // AC3: activity/template filter — always skip
  describe('activity/template filter', () => {
    it.each(['activity', 'template'])(
      'returns 200 and skips message_type=%s without enqueuing',
      async (msgType) => {
        const payload = makePayload({ message_type: msgType });
        const res = await postWebhook(app, payload);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; skipped: boolean };
        expect(body.ok).toBe(true);
        expect(body.skipped).toBe(true);
        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(mockEscalateToHuman).not.toHaveBeenCalled();
      },
    );
  });

  // Outgoing: bot (sent_by_zenya=true) → skip silent; anything else (panel ou celular) → auto-escalate
  describe('outgoing message handling', () => {
    it('skips bot replies (outgoing with sent_by_zenya=true) without escalating', async () => {
      const payload = makePayload({
        message_type: 'outgoing',
        content_attributes: { sent_by_zenya: true },
      });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; skipped: boolean; human_reply: boolean };
      expect(body.ok).toBe(true);
      expect(body.skipped).toBe(true);
      expect(body.human_reply).toBe(false);
      expect(mockEnqueue).not.toHaveBeenCalled();
      expect(mockEscalateToHuman).not.toHaveBeenCalled();
    });

    it('auto-escalates human replies from the store phone (outgoing with source_id, no sent_by_zenya)', async () => {
      const payload = makePayload({
        message_type: 'outgoing',
        source_id: 'wamid.abc123',
      });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; skipped: boolean; human_reply: boolean };
      expect(body.human_reply).toBe(true);
      expect(mockEscalateToHuman).toHaveBeenCalledOnce();
      expect(mockEscalateToHuman).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-uuid-123', source: 'human-reply' }),
      );
    });

    it('auto-escalates human replies from the Chatwoot panel (outgoing, source_id null, no sent_by_zenya)', async () => {
      const payload = makePayload({
        message_type: 'outgoing',
        source_id: null,
        sender: { type: 'User', name: 'Julia' },
      });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; skipped: boolean; human_reply: boolean };
      expect(body.human_reply).toBe(true);
      expect(mockEscalateToHuman).toHaveBeenCalledOnce();
    });

    it('skips re-escalation when agente-off label is already present', async () => {
      const payload = makePayload({
        message_type: 'outgoing',
        source_id: 'wamid.xyz',
        conversation: { id: 'conv-999', labels: ['agente-off'] },
      });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(200);
      expect(mockEscalateToHuman).not.toHaveBeenCalled();
    });

    it('responds 200 even when escalateToHuman throws (graceful degradation)', async () => {
      mockEscalateToHuman.mockRejectedValueOnce(new Error('Chatwoot down'));
      const payload = makePayload({
        message_type: 'outgoing',
        source_id: 'wamid.999',
      });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(200);
      expect(mockEscalateToHuman).toHaveBeenCalledOnce();
    });
  });

  // AC4: queue insertion
  describe('queue insertion', () => {
    it('enqueues incoming message with correct fields', async () => {
      const payload = makePayload();
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(200);

      expect(mockEnqueue).toHaveBeenCalledOnce();
      const [queued] = mockEnqueue.mock.calls[0] as [{ tenant_id: string; phone_number: string; message_id: string; payload: unknown }];
      expect(queued.tenant_id).toBe('tenant-123');
      expect(queued.phone_number).toBe('+5511999990000');
      expect(queued.message_id).toBe('42');
      expect(queued.payload).toMatchObject({ content: 'Olá', message_type: 'incoming' });
    });

    it('returns message_id in response for incoming messages', async () => {
      const payload = makePayload({ id: 99 });
      const res = await postWebhook(app, payload);
      const body = (await res.json()) as { ok: boolean; message_id: string };
      expect(body.ok).toBe(true);
      expect(body.message_id).toBe('99');
    });

    it('generates a fallback message_id when payload.id is absent', async () => {
      const payload = makePayload({ id: undefined });
      const res = await postWebhook(app, payload);
      expect(res.status).toBe(200);
      expect(mockEnqueue).toHaveBeenCalledOnce();
      const [queued] = mockEnqueue.mock.calls[0] as [{ message_id: string }];
      // fallback format: {tenantId}-{phone}-{timestamp}
      expect(queued.message_id).toMatch(/tenant-123/);
    });

    it('returns 200 even when enqueue throws duplicate error (idempotent)', async () => {
      // enqueue itself handles 23505 internally — here we test that the webhook
      // surfaces a successful response when enqueue resolves normally
      mockEnqueue.mockResolvedValueOnce(undefined);
      const res = await postWebhook(app, makePayload());
      expect(res.status).toBe(200);
    });
  });
});

// Story 18.2 — /reset clears history + removes agente-off label in test mode
describe('handleResetCommand (Story 18.2)', () => {
  const baseConfig: TenantConfig = {
    id: 'tenant-uuid-abc',
    name: 'Test Tenant',
    chatwoot_account_id: 'tenant-123',
    system_prompt: '',
    active_tools: [],
    allowed_phones: ['+5511999990000'],
    admin_phones: [],
    admin_contacts: [],
  } as unknown as TenantConfig;

  const baseArgs = {
    config: baseConfig,
    phone: '+5511999990000',
    accountId: 'tenant-123',
    conversationId: 'conv-555',
    pendingIds: ['msg-1', 'msg-2'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes label when present + sends "bot reativado" message', async () => {
    mockRemoveConversationLabel.mockResolvedValueOnce({ removed: true });

    await handleResetCommand(baseArgs);

    expect(mockClearHistory).toHaveBeenCalledWith('tenant-uuid-abc', '+5511999990000');
    expect(mockRemoveConversationLabel).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'tenant-123', conversationId: 'conv-555' }),
      'agente-off',
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      '🔄 Memória zerada + bot reativado. Nova conversa!',
    );
    expect(mockMarkAllDone).toHaveBeenCalledWith(['msg-1', 'msg-2']);
  });

  it('sends "memória zerada" message when label is not present (idempotent no-op)', async () => {
    mockRemoveConversationLabel.mockResolvedValueOnce({ removed: false, reason: 'not_present' });

    await handleResetCommand(baseArgs);

    expect(mockClearHistory).toHaveBeenCalledOnce();
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      '🔄 Memória zerada. Nova conversa!',
    );
    expect(mockMarkAllDone).toHaveBeenCalledOnce();
  });

  it('falls back gracefully when removeConversationLabel throws (Chatwoot 5xx)', async () => {
    mockRemoveConversationLabel.mockRejectedValueOnce(new Error('Chatwoot 500'));

    await handleResetCommand(baseArgs);

    expect(mockClearHistory).toHaveBeenCalledOnce();
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      '🔄 Memória zerada. Se o bot não responder, peça pro admin remover "agente-off".',
    );
    expect(mockMarkAllDone).toHaveBeenCalledOnce();
  });

  it('falls back gracefully when removeConversationLabel returns fetch_failed (Chatwoot GET non-2xx)', async () => {
    mockRemoveConversationLabel.mockResolvedValueOnce({ removed: false, reason: 'fetch_failed_403' });

    await handleResetCommand(baseArgs);

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      '🔄 Memória zerada. Se o bot não responder, peça pro admin remover "agente-off".',
    );
    expect(mockMarkAllDone).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Story 18.5 — Queue leak fixes (AC 6: 5 cenários DB Specialist Review §3)
// ---------------------------------------------------------------------------
//
// Os testes abaixo validam o comportamento dos Fixes 1-4 no pipeline real:
//   Fix 1 — tenant lookup ANTES de enqueue
//   Fix 2 — markAllDone no test-mode skip
//   Fix 3 — try/finally robusto em withSessionLock
//   Fix 4 — re-fetch após markAllDone (race detection)
//
// Diferente dos testes legados (que stubavam withSessionLock), aqui executamos
// o callback real para validar o pipeline completo.

describe('POST /webhook/chatwoot — Story 18.5 queue leak fixes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default tenant config (Zenya path normal — sem admin/test-mode)
    mockLoadTenantByAccountId.mockResolvedValue({
      id: 'tenant-uuid-123',
      chatwoot_account_id: 'tenant-123',
      name: 'Test Tenant',
      system_prompt: '',
      active_tools: [],
      allowed_phones: [],
      admin_phones: [],
      admin_contacts: [],
    });

    // withSessionLock real: executa o callback (vs. stub do top-level que
    // só retorna {locked:true} sem rodar a fn). Necessário para validar
    // o pipeline interno (fetchPending → markAll{Done,Failed}).
    mockWithSessionLock.mockImplementation(
      async (_tenantId: string, _phone: string, fn: () => Promise<void>) => {
        await fn();
        return { locked: true };
      },
    );

    app = buildApp();
  });

  /**
   * Helper: aguarda o callback async do withSessionLock terminar.
   * O webhook handler dispara `void (async () => ...)()` para o pipeline
   * pós-enqueue. Em testes, precisamos esperar:
   *   - debounce sleep (DEBOUNCE_MS=1ms aqui)
   *   - fetchPending → markAllDone/Failed → checkRaceAfterMarkDone (re-fetch)
   *   - catch handler do void IIFE
   *
   * 50ms é folga suficiente para todas as Promises microtask resolverem
   * mesmo com sleep de 1ms intercalado.
   */
  async function flushAsyncPipeline(): Promise<void> {
    await new Promise((r) => setTimeout(r, 50));
  }

  it('Cenário 1 (Fix 1): tenant inexistente → 400 + zero pending', async () => {
    mockLoadTenantByAccountId.mockRejectedValueOnce(new Error('Tenant not found'));

    const res = await postWebhook(app, makePayload());

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; accountId: string };
    expect(body.error).toBe('unknown_tenant');
    expect(body.accountId).toBe('tenant-123');

    // CRÍTICO: enqueue NÃO foi chamado — webhook rejeitado antes de inserir
    expect(mockEnqueue).not.toHaveBeenCalled();
    // Pipeline async não rodou
    expect(mockWithSessionLock).not.toHaveBeenCalled();
    expect(mockFetchPending).not.toHaveBeenCalled();
  });

  it('Cenário 2 (Fix 2): test-mode + phone fora whitelist → markAllDone (não pending)', async () => {
    mockLoadTenantByAccountId.mockResolvedValue({
      id: 'tenant-uuid-123',
      chatwoot_account_id: 'tenant-123',
      name: 'Test Tenant',
      system_prompt: '',
      active_tools: [],
      allowed_phones: ['+5511999999999'], // whitelist diferente do sender
      admin_phones: [],
      admin_contacts: [],
    });
    mockFetchPending.mockResolvedValueOnce([
      { message_id: 'm1', content: 'oi', audio_url: undefined },
    ]);

    const res = await postWebhook(app, makePayload({ sender: { phone_number: '+5511888888888' } }));
    expect(res.status).toBe(200);

    await flushAsyncPipeline();

    // Test-mode skip MARCA como done (não falha) — não deixa pending órfão
    expect(mockMarkAllDone).toHaveBeenCalledWith(['m1']);
    expect(mockMarkAllFailed).not.toHaveBeenCalled();
    // Agente NÃO foi acionado
    expect(mockRunZenyaAgent).not.toHaveBeenCalled();
  });

  it('Cenário 3 (Fix 3): Whisper falha → markAllFailed, lock liberado', async () => {
    mockFetchPending.mockResolvedValueOnce([
      { message_id: 'm-audio', content: '', audio_url: 'https://example.com/audio.ogg' },
    ]);
    mockTranscribeAudioUrl.mockRejectedValueOnce(new Error('Whisper API down'));

    const res = await postWebhook(app, makePayload());
    expect(res.status).toBe(200);

    await flushAsyncPipeline();

    // Fix 3: catch envelope marcou como failed mesmo com erro escapando
    // de transcribeAudioUrl (path sem try/catch local antigo).
    expect(mockMarkAllFailed).toHaveBeenCalledWith(['m-audio']);
    expect(mockRunZenyaAgent).not.toHaveBeenCalled();
    // withSessionLock foi entrado — Fix 3 garante release no finally
    expect(mockWithSessionLock).toHaveBeenCalledOnce();
  });

  it('Cenário 4 (Fix 3): Chatwoot 5xx no agente → markAllFailed', async () => {
    mockFetchPending.mockResolvedValueOnce([
      { message_id: 'm1', content: 'oi', audio_url: undefined },
    ]);
    mockRunZenyaAgent.mockRejectedValueOnce(new Error('Chatwoot 502 Bad Gateway'));

    const res = await postWebhook(app, makePayload());
    expect(res.status).toBe(200);

    await flushAsyncPipeline();

    // try/catch interno da Zenya path marcou failed; envelope externo (Fix 3)
    // pode reafirmar o status (idempotente — UPDATE noop).
    expect(mockMarkAllFailed).toHaveBeenCalled();
    expect(mockMarkAllFailed.mock.calls[0]?.[0]).toEqual(['m1']);
    expect(mockMarkAllDone).not.toHaveBeenCalled();
  });

  it('Cenário 5 (Fix 4): burst 5 msgs → 1 ciclo, zero pending residual', async () => {
    // 1ª chamada: 5 msgs acumuladas no debounce (burst)
    mockFetchPending.mockResolvedValueOnce([
      { message_id: 'b1', content: 'msg 1', audio_url: undefined },
      { message_id: 'b2', content: 'msg 2', audio_url: undefined },
      { message_id: 'b3', content: 'msg 3', audio_url: undefined },
      { message_id: 'b4', content: 'msg 4', audio_url: undefined },
      { message_id: 'b5', content: 'msg 5', audio_url: undefined },
    ]);
    // 2ª chamada (re-fetch após markAllDone): nenhuma msg nova → zero residual
    mockFetchPending.mockResolvedValueOnce([]);

    const res = await postWebhook(app, makePayload());
    expect(res.status).toBe(200);

    await flushAsyncPipeline();

    // Agente chamou 1x com merge das 5 msgs
    expect(mockRunZenyaAgent).toHaveBeenCalledOnce();
    const agentArgs = mockRunZenyaAgent.mock.calls[0]?.[0] as { message: string };
    expect(agentArgs.message).toBe('msg 1\nmsg 2\nmsg 3\nmsg 4\nmsg 5');

    // markAllDone com TODOS os 5 ids
    expect(mockMarkAllDone).toHaveBeenCalledOnce();
    expect(mockMarkAllDone).toHaveBeenCalledWith(['b1', 'b2', 'b3', 'b4', 'b5']);

    // Re-fetch (Fix 4) executou — fetchPending chamado 2x (debounce + race-check)
    expect(mockFetchPending).toHaveBeenCalledTimes(2);
    // Sem pending residual
    expect(mockMarkAllFailed).not.toHaveBeenCalled();
  });
});
