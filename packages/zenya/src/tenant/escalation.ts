// Escalation helper — marks a conversation as handed off to a human agent.
// Used by:
//   1. escalarHumano tool (LLM explicitly decides to hand off)
//   2. webhook auto-detection (human agent replied from the store's phone)
//
// Behavior:
//   - (Optional) Posts a structured summary as a Chatwoot private note so the
//     human agent picking up the conversation sees full context — invisible to
//     the customer. Skipped silently on failure (non-critical).
//   - Adds Chatwoot label 'agente-off' (critical — silences the bot)
//   - Adds Z-API native WhatsApp Business label 'humano' (non-critical, degrades gracefully)

import { addLabel, sendPrivateNote, type ChatwootParams } from '../integrations/chatwoot.js';
import { zapiAddLabel, type ZApiCredentials } from '../integrations/zapi-labels.js';
import { getCredentialJson } from './credentials.js';

export interface EscalationContext {
  tenantId: string;
  chatwoot: ChatwootParams;
  /** Customer phone number (E.164 with or without leading +) */
  phone: string;
  /** Origin of the escalation — used for log traceability */
  source: 'tool' | 'human-reply';
  /**
   * Optional structured summary to leave as a Chatwoot private note. Shown to
   * the human agent picking up the conversation, never to the customer.
   */
  summary?: string;
}

/**
 * Escalates a conversation to a human agent:
 *   - (Optional) Posts summary as Chatwoot private note
 *   - Adds 'agente-off' label in Chatwoot (silences the bot)
 *   - Adds native WhatsApp 'humano' label in Z-API (non-critical)
 *
 * Idempotent: Chatwoot addLabel no-ops if label already present. The summary
 * note is posted every call — callers should only pass `summary` on the
 * initial escalation (the `escalarHumano` tool), not on `human-reply`
 * auto-detection (which has no LLM-generated summary).
 */
export async function escalateToHuman(ctx: EscalationContext): Promise<void> {
  if (ctx.summary) {
    try {
      await sendPrivateNote(ctx.chatwoot, ctx.summary);
    } catch (err) {
      console.warn(
        `[zenya] escalation private note failed (non-critical) — tenant=${ctx.tenantId} source=${ctx.source}: ${err}`,
      );
    }
  }

  await addLabel(ctx.chatwoot, 'agente-off');

  try {
    const zapCreds = await getCredentialJson<ZApiCredentials>(ctx.tenantId, 'zapi');
    const labelId = zapCreds.labels?.humano;
    if (labelId) {
      await zapiAddLabel(ctx.phone, labelId, zapCreds);
    }
  } catch (err) {
    console.warn(
      `[zenya] zapiAddLabel falhou (non-critical) — tenant=${ctx.tenantId} source=${ctx.source}: ${err}`,
    );
  }

  console.log(
    `[zenya] Escalated to human — tenant=${ctx.tenantId} conv=${ctx.chatwoot.conversationId} source=${ctx.source}`,
  );
}
