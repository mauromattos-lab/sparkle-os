// Escalation helper — marks a conversation as handed off to a human agent.
// Used by:
//   1. escalarHumano tool (LLM explicitly decides to hand off)
//   2. webhook auto-detection (human agent replied from the store's phone)
//
// Behavior:
//   - Adds Chatwoot label 'agente-off' (critical — silences the bot)
//   - Adds Z-API native WhatsApp Business label 'humano' (non-critical, degrades gracefully)

import { addLabel, type ChatwootParams } from '../integrations/chatwoot.js';
import { zapiAddLabel, type ZApiCredentials } from '../integrations/zapi-labels.js';
import { getCredentialJson } from './credentials.js';

export interface EscalationContext {
  tenantId: string;
  chatwoot: ChatwootParams;
  /** Customer phone number (E.164 with or without leading +) */
  phone: string;
  /** Origin of the escalation — used for log traceability */
  source: 'tool' | 'human-reply';
}

/**
 * Escalates a conversation to a human agent:
 *   - Adds 'agente-off' label in Chatwoot (silences the bot)
 *   - Adds native WhatsApp 'humano' label in Z-API (non-critical)
 *
 * Idempotent: Chatwoot addLabel no-ops if label already present.
 */
export async function escalateToHuman(ctx: EscalationContext): Promise<void> {
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
