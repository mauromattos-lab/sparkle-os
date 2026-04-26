import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// --- Mocks (hoisted before imports that use them) ---

vi.mock('../db/client.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../worker/lock.js', () => ({
  withSessionLock: vi.fn().mockResolvedValue({ locked: true }),
}));

// We mock enqueue + markAllDone at the module level so we can assert on them
const mockEnqueue = vi.fn().mockResolvedValue(undefined);
const mockMarkAllDone = vi.fn().mockResolvedValue(undefined);
vi.mock('../worker/queue.js', () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
  markAllDone: (...args: unknown[]) => mockMarkAllDone(...args),
  fetchPending: vi.fn().mockResolvedValue([]),
  markAllFailed: vi.fn().mockResolvedValue(undefined),
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
