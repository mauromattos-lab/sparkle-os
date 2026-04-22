// Escalation helper — marks a conversation as handed off to a human agent.
// Used by:
//   1. escalarHumano tool (LLM explicitly decides to hand off)
//   2. webhook auto-detection (human agent replied from the store's phone)
//
// Behavior:
//   - (Optional) Sends the LLM-generated summary as a PUBLIC message on the
//     conversation channel (WhatsApp). Convention: the summary starts with
//     "[ATENDIMENTO]" so the human agent picking up can identify it on the
//     conversation preview even without a Chatwoot-style private-note UI.
//     The customer sees it too — that's intentional (handoff is transparent,
//     and it makes the design universal: works for tenants that don't use
//     Chatwoot, don't have a back-office, or pick up directly on the WhatsApp
//     Business App). Skipped silently on failure (non-critical).
//   - Adds Chatwoot label 'agente-off' (critical — silences the bot)
//   - Adds Z-API native WhatsApp Business label 'humano' (non-critical, degrades gracefully)

import { addLabel, sendMessage, type ChatwootParams } from '../integrations/chatwoot.js';
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
   * Optional LLM-generated summary to post as a public message in the
   * conversation channel. Convention: starts with "[ATENDIMENTO]" for the
   * human agent to identify on preview. The customer will see it — that's
   * the trade-off for universality (no private-note channel assumed).
   */
  summary?: string;
}

/**
 * Escalates a conversation to a human agent:
 *   - (Optional) Posts summary as a PUBLIC message in the conversation
 *   - Adds 'agente-off' label in Chatwoot (silences the bot)
 *   - Adds native WhatsApp 'humano' label in Z-API (non-critical)
 *
 * Idempotent: Chatwoot addLabel no-ops if label already present. The summary
 * message is posted every call — callers should only pass `summary` on the
 * initial escalation (the `escalarHumano` tool), not on `human-reply`
 * auto-detection (which has no LLM-generated summary).
 */
export async function escalateToHuman(ctx: EscalationContext): Promise<void> {
  if (ctx.summary) {
    try {
      await sendMessage(ctx.chatwoot, ctx.summary);
    } catch (err) {
      console.warn(
        `[zenya] escalation handoff message failed (non-critical) — tenant=${ctx.tenantId} source=${ctx.source}: ${err}`,
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
