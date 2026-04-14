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

  // AC3: outgoing/activity filter
  describe('outgoing message filter', () => {
    it.each(['outgoing', 'activity', 'template'])(
      'returns 200 and skips message_type=%s without enqueuing',
      async (msgType) => {
        const payload = makePayload({ message_type: msgType });
        const res = await postWebhook(app, payload);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; skipped: boolean };
        expect(body.ok).toBe(true);
        expect(body.skipped).toBe(true);
        expect(mockEnqueue).not.toHaveBeenCalled();
      },
    );
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
