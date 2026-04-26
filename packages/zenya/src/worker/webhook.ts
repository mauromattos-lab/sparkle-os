// Zenya webhook handler — receives Chatwoot webhook events
// Decision: using Hono instead of Fastify (consistent with brain package pattern)

import { Hono } from 'hono';
import { enqueue, fetchPending, markAllDone, markAllFailed } from './queue.js';
import { withSessionLock } from './lock.js';
import { loadTenantByAccountId } from '../tenant/config-loader.js';
import { runZenyaAgent } from '../agent/index.js';
import { runAdminAgent } from '../agent/admin-agent.js';
import { transcribeAudioUrl } from '../integrations/whisper.js';
import { clearHistory } from '../agent/memory.js';
import { sendMessage, getChatwootParams, removeConversationLabel } from '../integrations/chatwoot.js';
import type { TenantConfig } from '../tenant/config-loader.js';
import { escalateToHuman } from '../tenant/escalation.js';

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
  /**
   * Original message ID from the external channel (e.g. WhatsApp msg id when mirrored
   * via Z-API). Present on messages that come from outside Chatwoot; null when the bot
   * creates a message via Chatwoot API.
   */
  source_id?: string | null;
  account?: { id: string | number };
  conversation?: { id: string | number; labels?: string[] };
  sender?: { phone_number?: string | null; name?: string; type?: string };
  /** Chatwoot payload's "meta" block — contains the conversation's Contact (customer) */
  meta?: { sender?: { phone_number?: string | null; name?: string } };
  /**
   * Content attributes echoed back by Chatwoot. The bot marks its own messages with
   * { sent_by_zenya: true } on send, so the webhook can identify them here.
   */
  content_attributes?: { sent_by_zenya?: boolean } & Record<string, unknown>;
  attachments?: unknown[];
  created_at?: number;
}

/**
 * Handles `/reset` command in test mode (Story 18.2).
 * Clears conversation history AND removes `agente-off` label so test users
 * can unblock the bot via WhatsApp without admin Chatwoot access.
 *
 * Idempotent: if label is absent or Chatwoot fails, still clears history
 * and replies with a fallback message — never leaves the conversation stuck.
 */
export async function handleResetCommand(args: {
  config: TenantConfig;
  phone: string;
  accountId: string;
  conversationId: string;
  pendingIds: string[];
}): Promise<void> {
  const { config, phone, accountId, conversationId, pendingIds } = args;

  await clearHistory(config.id, phone);
  const params = getChatwootParams(accountId, conversationId);

  let result: { removed: boolean; reason?: string } = { removed: false, reason: 'not_attempted' };
  try {
    result = await removeConversationLabel(params, 'agente-off');
  } catch (err) {
    console.warn(`[zenya] /reset — removeLabel falhou (non-critical) tenant=${config.id}:`, err);
    result = { removed: false, reason: 'throw' };
  }

  const message = result.removed
    ? '🔄 Memória zerada + bot reativado. Nova conversa!'
    : result.reason === 'not_present'
      ? '🔄 Memória zerada. Nova conversa!'
      : '🔄 Memória zerada. Se o bot não responder, peça pro admin remover "agente-off".';

  await sendMessage(params, message);
  await markAllDone(pendingIds);
  console.log(
    `[zenya] /reset — tenant=${config.id} phone=${phone} ` +
    `cleared_history=true removed_label=${result.removed} reason=${result.reason ?? 'removed'}`,
  );
}

// Activity/template messages are internal Chatwoot events — always ignored.
// 'outgoing' is handled separately: may be the bot itself OR a human reply mirrored
// from the store's phone (Z-API). Distinguished by source_id.
const ACTIVITY_MESSAGE_TYPES = new Set(['activity', 'template']);

function extractPhone(payload: ChatwootWebhookPayload): string | null {
  // For 'incoming' messages, sender is the customer (Contact) with phone_number.
  // For 'outgoing' messages, sender is the agent (User) WITHOUT phone_number;
  // fall back to meta.sender (the Contact of the conversation) if present.
  return (
    payload.sender?.phone_number ??
    payload.meta?.sender?.phone_number ??
    null
  );
}

function validatePayload(payload: ChatwootWebhookPayload): string | null {
  if (!payload.message_type) return 'missing message_type';
  if (!payload.account?.id) return 'missing account.id';
  if (!payload.conversation?.id) return 'missing conversation.id';
  // phone_number is only required for 'incoming' — outgoing sender is the agent (no phone).
  if (payload.message_type === 'incoming' && !payload.sender?.phone_number) {
    return 'missing sender.phone_number';
  }
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

    // DIAGNOSTIC: log every non-incoming request shape to diagnose human-reply detection.
    // Temporary — remove once heuristic is confirmed.
    if (payload.message_type !== 'incoming') {
      console.log(
        `[zenya][diag] type=${payload.message_type} source_id=${JSON.stringify(payload.source_id)} ` +
        `sent_by_zenya=${payload.content_attributes?.sent_by_zenya ?? false} ` +
        `sender=${JSON.stringify(payload.sender)} conv=${payload.conversation?.id} ` +
        `labels=${JSON.stringify(payload.conversation?.labels)} content_len=${payload.content?.length ?? 0}`,
      );
    }

    // Activity/template: internal Chatwoot events, always skip
    if (ACTIVITY_MESSAGE_TYPES.has(payload.message_type!)) {
      return c.json({ ok: true, skipped: true });
    }

    const accountId = String(payload.account!.id);
    const conversationId = String(payload.conversation!.id);
    const phone = extractPhone(payload);

    // Outgoing messages: distinguish bot replies from human agent replies.
    //   - Bot (Zenya): marks content_attributes.sent_by_zenya=true on send
    //   - Human — Chatwoot panel: outgoing without sent_by_zenya
    //   - Human — store's phone: outgoing without sent_by_zenya (source_id = wamid.xxx)
    // Any outgoing NOT marked by the bot → human → auto-apply 'agente-off'.
    if (payload.message_type === 'outgoing') {
      const isBot = payload.content_attributes?.sent_by_zenya === true;
      const isHumanReply = !isBot;
      if (isHumanReply && !payload.conversation?.labels?.includes('agente-off')) {
        try {
          const config = await loadTenantByAccountId(accountId);
          await escalateToHuman({
            tenantId: config.id,
            chatwoot: getChatwootParams(accountId, conversationId),
            phone: phone ?? '',
            source: 'human-reply',
          });
        } catch (err) {
          console.error(`[zenya] Failed to auto-escalate on human reply — conv=${conversationId}: ${err}`);
        }
      }
      return c.json({ ok: true, skipped: true, human_reply: isHumanReply });
    }

    // agente-off label: conversation was escalated to human — bot stays silent
    if (payload.conversation?.labels?.includes('agente-off')) {
      return c.json({ ok: true, skipped: true });
    }

    // Beyond here, message is 'incoming' — validatePayload already enforced phone presence.
    if (!phone) {
      return c.json({ ok: true, skipped: true });
    }

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
          // Defensive audio detection: queue.ts extracts audio_url from
          // attachments[file_type=audio].data_url, but also try payload attachments
          // directly here in case of shape drift (Chatwoot fork or Z-API update).
          let audioUrl: string | undefined = m.audio_url;
          if (!audioUrl && !m.content) {
            const atts = (m as unknown as { attachments?: Array<Record<string, unknown>> }).attachments;
            const audioAtt = Array.isArray(atts)
              ? atts.find((a) => a['file_type'] === 'audio' && typeof a['data_url'] === 'string')
              : null;
            audioUrl = audioAtt?.['data_url'] as string | undefined;
          }

          if (m.content) {
            resolvedContents.push(m.content);
          } else if (audioUrl) {
            inputIsAudio = true;
            const transcription = await transcribeAudioUrl(audioUrl);
            if (transcription) {
              resolvedContents.push(transcription);
            } else {
              resolvedContents.push('[áudio não transcrito]');
            }
          }
        }
        console.log(
          `[zenya][audio-diag] conv=${conversationId} pending=${pending.length} ` +
          `inputIsAudio=${inputIsAudio} mergedLen=${resolvedContents.join('\n').length}`,
        );

        // Merge all pending messages into a single input for the agent
        // If no pending found (race condition), fall back to the current message
        const mergedMessage = resolvedContents.length > 0
          ? resolvedContents.join('\n')
          : message;

        // Resolve actual tenant config (cache hit after first request)
        const config = await loadTenantByAccountId(accountId);

        // Admin channel: messages from admin_phones get metrics/management responses
        if (config.admin_phones.length > 0 && config.admin_phones.includes(phone)) {
          const adminContact = config.admin_contacts.find((c) => c.phone === phone);
          const adminName = adminContact?.name ?? null;
          console.log(`[zenya] Admin mode — phone=${phone} name=${adminName ?? 'unknown'} tenant=${config.name}`);
          try {
            await runAdminAgent({
              accountId,
              conversationId,
              config,
              message: mergedMessage,
              phone,
              adminName,
              inputIsAudio,
            });
            await markAllDone(pendingIds);
          } catch (err) {
            await markAllFailed(pendingIds);
            throw err;
          }
          return;
        }

        // Test mode: if allowed_phones is set, silently ignore unlisted numbers
        if (config.allowed_phones.length > 0 && !config.allowed_phones.includes(phone)) {
          console.log(`[zenya] Test mode — ignored ${phone} (not in allowed list for tenant ${config.name})`);
          return;
        }

        // /reset command — test mode only: clears history + removes agente-off label (Story 18.2)
        if (config.allowed_phones.length > 0 && mergedMessage.trim() === '/reset') {
          await handleResetCommand({ config, phone, accountId, conversationId, pendingIds });
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
