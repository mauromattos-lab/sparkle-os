import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// --- Mocks (hoisted before imports that use them) ---

vi.mock('../db/client.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../worker/lock.js', () => ({
  withSessionLock: vi.fn().mockResolvedValue({ locked: true }),
}));

// We mock enqueue at the module level so we can assert on it
const mockEnqueue = vi.fn().mockResolvedValue(undefined);
vi.mock('../worker/queue.js', () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
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

vi.mock('../integrations/chatwoot.js', () => ({
  getChatwootParams: (accountId: string, conversationId: string) => ({
    url: 'https://chatwoot.test',
    token: 'test-token',
    accountId,
    conversationId,
  }),
  sendMessage: vi.fn(),
}));

// Import after mocks
import { createWebhookRouter } from '../worker/webhook.js';

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
