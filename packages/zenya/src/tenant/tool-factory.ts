// Tool factory — creates tenant-scoped tools with tenantId injected via closure
//
// SECURITY CRITICAL:
//   tenantId is ALWAYS injected via JavaScript closure.
//   It NEVER appears as a parameter in any tool's Zod schema.
//   This prevents the LLM from accessing or manipulating the tenant identifier.

import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { addLabel, sendMessage, getChatwootParams } from '../integrations/chatwoot.js';
import type { TenantConfig } from './config-loader.js';

export interface AgentContext {
  accountId: string;
  conversationId: string;
}

// ToolSet from AI SDK is the correct type for the tools map passed to generateText
export type TenantTools = ToolSet;

/**
 * Creates tools scoped to a specific tenant and conversation.
 * tenantId, accountId, and conversationId are captured in closures —
 * they are never part of any tool's parameter schema.
 */
export function createTenantTools(
  tenantId: string,
  config: TenantConfig,
  ctx: AgentContext,
): TenantTools {
  const chatwootParams = () => getChatwootParams(ctx.accountId, ctx.conversationId);

  return {
    /**
     * Escalates the conversation to a human agent.
     * Adds 'agente-off' label to Chatwoot — disabling the bot for this session.
     */
    escalarHumano: tool({
      description:
        'Escala o atendimento para um humano quando o usuário solicitar ou quando a situação exigir. ' +
        'Use quando o usuário pedir para falar com uma pessoa, estiver frustrado, ou o problema for complexo.',
      parameters: z.object({
        resumo_conversa: z.string().describe('Resumo breve do que foi discutido'),
        ultima_mensagem: z.string().describe('Última mensagem do usuário'),
        motivo: z.string().optional().describe('Motivo da escalação'),
      }),
      execute: async ({ resumo_conversa, motivo }) => {
        const params = chatwootParams();
        // Add label that disables the bot for this conversation
        await addLabel(params, 'agente-off');
        console.log(
          `[zenya] Escalated to human — tenant=${tenantId} conv=${ctx.conversationId}` +
          ` motivo=${motivo ?? 'não especificado'} resumo=${resumo_conversa.slice(0, 80)}`,
        );
        return {
          escalado: true,
          mensagem: 'Atendimento escalado para um humano. O bot está desativado para esta conversa.',
        };
      },
    }),

    /**
     * Sends an additional text chunk to the conversation.
     * Useful for breaking long responses into smaller parts before story 7.4 (chunker).
     */
    enviarTextoSeparado: tool({
      description: 'Envia um texto adicional separado para o usuário. Use quando precisar enviar mais de uma mensagem.',
      parameters: z.object({
        texto: z.string().describe('Texto a ser enviado'),
      }),
      execute: async ({ texto }) => {
        const params = chatwootParams();
        await sendMessage(params, texto);
        return { enviado: true };
      },
    }),

    /**
     * Chain-of-thought tool — use to reason before responding.
     * Does nothing externally; helps the model think step by step.
     */
    refletir: tool({
      description:
        'Use para raciocinar sobre o problema antes de responder. ' +
        'Escreva seu pensamento aqui. Isso não é enviado ao usuário.',
      parameters: z.object({
        pensamento: z.string().describe('Seu raciocínio interno'),
      }),
      execute: async ({ pensamento }) => {
        // Intentional noop — chain-of-thought only
        void pensamento;
        return { ok: true };
      },
    }),

    /**
     * Marks the conversation for follow-up (e.g. label 'follow-up').
     */
    marcarFollowUp: tool({
      description: 'Marca a conversa para follow-up humano sem desativar o bot.',
      parameters: z.object({
        observacao: z.string().optional().describe('Observação para o gestor'),
      }),
      execute: async ({ observacao }) => {
        const params = chatwootParams();
        await addLabel(params, 'follow-up');
        console.log(
          `[zenya] Follow-up marcado — tenant=${tenantId} conv=${ctx.conversationId}` +
          ` obs=${observacao ?? ''}`,
        );
        return { marcado: true };
      },
    }),
  };
}
