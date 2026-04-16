// Zenya webhook handler — receives Chatwoot webhook events
// Decision: using Hono instead of Fastify (consistent with brain package pattern)

import { Hono } from 'hono';
import { enqueue, fetchPending, markAllDone, markAllFailed } from './queue.js';
import { withSessionLock } from './lock.js';
import { loadTenantByAccountId } from '../tenant/config-loader.js';
import { runZenyaAgent } from '../agent/index.js';
import { transcribeAudioUrl } from '../integrations/whisper.js';

// Debounce window: wait this long after the first message before processing.
// Any messages arriving during this window are merged into a single agent call.
const DEBOUNCE_MS = parseInt(process.env['ZENYA_DEBOUNCE_MS'] ?? '2500', 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chatwoot webhook payload shape (relevant fields only)
interface ChatwootWebhookPayload {
  id?: number;
  content?: string | null;
  message_type?: string;
  account?: { id: string | number };
  conversation?: { id: string | number };
  sender?: { phone_number?: string | null; name?: string };
  attachments?: unknown[];
  created_at?: number;
}

// Message types that should be ignored (bot's own messages, system events)
const IGNORED_MESSAGE_TYPES = new Set(['outgoing', 'activity', 'template']);

function extractPhone(payload: ChatwootWebhookPayload): string | null {
  return payload.sender?.phone_number ?? null;
}

function validatePayload(payload: ChatwootWebhookPayload): string | null {
  if (!payload.message_type) return 'missing message_type';
  if (!payload.account?.id) return 'missing account.id';
  if (!payload.conversation?.id) return 'missing conversation.id';
  if (!payload.sender?.phone_number) return 'missing sender.phone_number';
  return null;
}

export function createWebhookRouter(): Hono {
  const app = new Hono();

  app.post('/webhook/chatwoot', async (c) => {
    let payload: ChatwootWebhookPayload;

    try {
      payload = await c.req.json<ChatwootWebhookPayload>();
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400);
    }

    // AC2: validate required fields
    const validationError = validatePayload(payload);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }

    // AC3: filter outgoing/activity — bot's own messages, return 200 silently
    if (IGNORED_MESSAGE_TYPES.has(payload.message_type!)) {
      return c.json({ ok: true, skipped: true });
    }

    const accountId = String(payload.account!.id);
    const conversationId = String(payload.conversation!.id);
    const phone = extractPhone(payload)!;
    const messageId = String(payload.id ?? `${accountId}-${phone}-${Date.now()}`);
    const message = payload.content ?? '';

    // AC4: enqueue message (idempotent — duplicate message_id is silently ignored)
    await enqueue({
      tenant_id: accountId, // stored as chatwoot account_id in queue
      phone_number: phone,
      message_id: messageId,
      payload: payload as Record<string, unknown>,
    });

    // AC5 + AC7: process with distributed lock (non-blocking — agent runs async)
    // Lock ensures only one execution per session at a time.
    // Lock is ALWAYS released in withSessionLock's finally block.
    void (async () => {
      await withSessionLock(accountId, phone, async () => {
        // Debounce: wait for any burst messages to arrive and get enqueued
        await sleep(DEBOUNCE_MS);

        // Fetch all pending messages accumulated during the debounce window
        const pending = await fetchPending(accountId, phone);
        const pendingIds = pending.map((m) => m.message_id);

        // Resolve content for each pending message — transcribe audio if needed
        const resolvedContents: string[] = [];
        let inputIsAudio = false;
        for (const m of pending) {
          if (m.content) {
            resolvedContents.push(m.content);
          } else if (m.audio_url) {
            inputIsAudio = true;
            const transcription = await transcribeAudioUrl(m.audio_url);
            if (transcription) {
              resolvedContents.push(transcription);
            } else {
              resolvedContents.push('[áudio não transcrito]');
            }
          }
        }

        // Merge all pending messages into a single input for the agent
        // If no pending found (race condition), fall back to the current message
        const mergedMessage = resolvedContents.length > 0
          ? resolvedContents.join('\n')
          : message;

        // Resolve actual tenant config (cache hit after first request)
        const config = await loadTenantByAccountId(accountId);

        // Test mode: if allowed_phones is set, silently ignore unlisted numbers
        if (config.allowed_phones.length > 0 && !config.allowed_phones.includes(phone)) {
          console.log(`[zenya] Test mode — ignored ${phone} (not in allowed list for tenant ${config.name})`);
          return;
        }

        try {
          await runZenyaAgent({
            tenantId: config.id,
            accountId,
            conversationId,
            config,
            message: mergedMessage,
            phone,
            inputIsAudio,
          });
          await markAllDone(pendingIds);
        } catch (err) {
          await markAllFailed(pendingIds);
          throw err;
        }
      });
    })().catch((err: unknown) => {
      console.error(`[zenya] Agent error for message ${messageId}:`, err);
    });

    return c.json({ ok: true, message_id: messageId });
  });

  return app;
}
