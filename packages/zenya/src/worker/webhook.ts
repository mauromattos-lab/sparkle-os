// Zenya webhook handler — receives Chatwoot webhook events
// Decision: using Hono instead of Fastify (consistent with brain package pattern)

import { Hono } from 'hono';
import { enqueue, fetchPending, markAllDone, markAllFailed } from './queue.js';
import { withSessionLock } from './lock.js';
import { loadTenantByAccountId } from '../tenant/config-loader.js';
import { runZenyaAgent } from '../agent/index.js';
import { runAdminAgent, isBurstMessage } from '../agent/admin-agent.js';
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
  conversation?: {
    id: string | number;
    labels?: string[];
    /**
     * Total messages in this conversation (including the current one).
     * Story 18.23: used to detect "outgoing before first incoming" — when
     * messages_count <= 1, the conversation has no prior incoming and an
     * outgoing event (e.g. WhatsApp Business app's auto-greeting on
     * Click-to-WhatsApp ads) must NOT trigger anti-eco/agente-off.
     */
    messages_count?: number;
  };
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

/**
 * Story 18.5 / Fix 4 (Causa D — race condition, 4% do leak).
 *
 * Após `markAllDone`, re-fetch verifica se mensagens novas chegaram durante
 * o processamento (entre fetchPending e markAllDone). Se houver, log warning
 * e deixa pra próximo webhook entrante pegar — sem reentrancy/recursion.
 *
 * Decisão deliberada: mensagens novas durante processamento ficam pra próximo
 * turn. Custo: pequena latência adicional (~debounce 2.5s). Benefício:
 * simplicidade + previsibilidade + zero risco de loop infinito.
 */
async function checkRaceAfterMarkDone(accountId: string, phone: string): Promise<void> {
  try {
    const stillPending = await fetchPending(accountId, phone);
    if (stillPending.length > 0) {
      console.warn(
        `[zenya] Race detected: ${stillPending.length} new pending msg(s) arrived ` +
        `during processing (account=${accountId} phone=${phone}) — ` +
        `next webhook will pick them up`,
      );
    }
  } catch (err) {
    // Best-effort: race check é informativo, não crítico. Se DB tá fora,
    // log e segue — não queremos transformar uma race detection em failure.
    console.warn(`[zenya] Race check failed (non-critical) account=${accountId}: ${err}`);
  }
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

      // Story 18.23 — anti-eco não aplica agente-off em outgoing antes do
      // primeiro incoming. Saudação automática do WhatsApp Business app
      // (configurada pelo dono do número) sai como outgoing ANTES do cliente
      // responder e era tratada como human-reply pela regra antiga, ativando
      // agente-off e silenciando o bot quando o lead de Click-to-WhatsApp ad
      // chegasse depois. Sinal: conversation.messages_count <= 1 (essa
      // mensagem é a única até agora — não houve incoming prévio).
      // Padrão validado em prod pelo workflow n8n legado (Master Zenya v3,
      // docs/zenya/raw/wf_4BadjudZ6rww1AGk.json) que usa
      // `body.conversation?.messages_count === 1` para detectar 1ª msg.
      if (isHumanReply) {
        const messagesCount = payload.conversation?.messages_count;
        const isOutgoingBeforeFirstIncoming =
          messagesCount !== undefined && messagesCount <= 1;
        if (isOutgoingBeforeFirstIncoming) {
          console.log(
            `[zenya] outgoing_before_first_incoming — conv=${conversationId} ` +
              `account=${accountId} messages_count=${messagesCount}`,
          );
          return c.json({
            ok: true,
            skipped: true,
            reason: 'outgoing_before_first_incoming',
          });
        }
      }

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

    // Story 18.5 / Fix 1 (Causa A — tenant lookup failure, 66% do leak):
    // Validar tenant ANTES de enqueue. Se account_id não tem tenant, rejeita
    // o webhook com 400 sem enfileirar nada — não há trabalho a fazer e
    // mensagens órfãs em pending eram a maior fonte de leak (581/875).
    let tenantConfig: TenantConfig;
    try {
      tenantConfig = await loadTenantByAccountId(accountId);
    } catch (err) {
      console.warn(
        `[zenya] No tenant for account_id=${accountId} — webhook rejected: ${err}`,
      );
      return c.json({ error: 'unknown_tenant', accountId }, 400);
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
        // Story 18.5 / Fix 3 (Causa C — failure path antes try/catch interno, 25% do leak):
        // pendingIds declarado FORA do try interno para que o catch best-effort
        // possa marcá-los como failed mesmo se a exceção escapar de fetchPending,
        // transcribeAudioUrl, isBurstMessage, etc. (paths sem try/catch local).
        let pendingIds: string[] = [];

        try {
          // Debounce: wait for any burst messages to arrive and get enqueued
          await sleep(DEBOUNCE_MS);

          // Fetch all pending messages accumulated during the debounce window
          const pending = await fetchPending(accountId, phone);
          pendingIds = pending.map((m) => m.message_id);

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

          // Story 18.5 / Fix 1: reuse tenantConfig already loaded pre-enqueue.
          // No second loadTenantByAccountId call here — would be redundant DB hit.
          const config = tenantConfig;

          // Admin channel: messages from admin_phones get metrics/management responses
          if (config.admin_phones.length > 0 && config.admin_phones.includes(phone)) {
            const adminContact = config.admin_contacts.find((c) => c.phone === phone);
            const adminName = adminContact?.name ?? null;

            // Story 18.3: Burst filter — drop Z-API sync history during boot grace.
            // Uses created_at from the original webhook payload (closure). In burst scenarios
            // Z-API floods sync messages with old timestamps; checking the trigger payload's
            // timestamp is sufficient because Z-API doesn't interleave fresh messages mid-sync.
            const triggerCreatedAtSec = Number(payload.created_at ?? 0);
            if (triggerCreatedAtSec > 0 && isBurstMessage(triggerCreatedAtSec * 1000)) {
              console.log(
                `[admin] FILTERED burst — created_at=${triggerCreatedAtSec} ` +
                `age_ms=${Date.now() - triggerCreatedAtSec * 1000} tenant=${config.name}`,
              );
              await markAllDone(pendingIds);
              await checkRaceAfterMarkDone(accountId, phone);
              return;
            }

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
              await checkRaceAfterMarkDone(accountId, phone);
            } catch (err) {
              await markAllFailed(pendingIds);
              throw err;
            }
            return;
          }

          // Test mode: if allowed_phones is set, silently ignore unlisted numbers.
          // Story 18.5 / Fix 2 (Causa B — test-mode-skip leak, 4% do leak):
          // Marca pendingIds como `done` (não `failed`) — webhook fez seu trabalho
          // corretamente decidindo ignorar. Distinção semântica importante pra alarme
          // não sinalizar falsa instabilidade.
          if (config.allowed_phones.length > 0 && !config.allowed_phones.includes(phone)) {
            console.log(
              `[zenya] Test mode — ignored ${phone} (not in allowed list for tenant ${config.name})`,
            );
            await markAllDone(pendingIds); // test-mode skip = sucesso silencioso (não falha)
            await checkRaceAfterMarkDone(accountId, phone);
            return;
          }

          // /reset command — test mode only: clears history + removes agente-off label (Story 18.2)
          // handleResetCommand chama markAllDone internamente — não duplicar aqui.
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
            await checkRaceAfterMarkDone(accountId, phone);
          } catch (err) {
            await markAllFailed(pendingIds);
            throw err;
          }
        } catch (err) {
          // Story 18.5 / Fix 3: best-effort cleanup envelope.
          // Captura exceções que escaparam dos try/catch internos (admin path,
          // Zenya path) E exceções de paths sem try/catch local (fetchPending,
          // transcribeAudioUrl, isBurstMessage, handleResetCommand).
          // markAllFailed é idempotente: paths internos já marcaram failed,
          // o UPDATE noop apenas reafirma o status — overhead irrelevante.
          // .catch(() => {}) garante que falha de DB durante cleanup não
          // mascara o erro original que estamos re-lançando.
          await markAllFailed(pendingIds).catch(() => {});
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
