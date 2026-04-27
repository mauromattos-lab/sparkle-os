// Zenya agent loop — processes incoming messages using Vercel AI SDK + OpenAI gpt-4.1
// Loads conversation history, calls LLM with tools, saves history, sends response

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { loadHistory, saveHistory } from './memory.js';
import { buildSystemPrompt } from './prompt.js';
import { createTenantTools } from '../tenant/tool-factory.js';
import {
  setTypingStatus,
  getChatwootParams,
  getContactAudioPreference,
  markConversationRead,
  sendAudioMessage,
} from '../integrations/chatwoot.js';
import { chunkAndSend } from '../integrations/message-chunker.js';
import { formatSSML, generateAudio, getElevenLabsApiKey } from '../integrations/elevenlabs.js';
import type { TenantConfig } from '../tenant/config-loader.js';

export interface AgentParams {
  /** UUID from zenya_tenants */
  tenantId: string;
  /** Chatwoot account_id (for API calls) */
  accountId: string;
  /** Chatwoot conversation_id */
  conversationId: string;
  /** Resolved tenant configuration */
  config: TenantConfig;
  /** Incoming user message text */
  message: string;
  /** User's phone number */
  phone: string;
  /** Whether the input came from an audio message (mirrors format by default) */
  inputIsAudio?: boolean;
}

/**
 * Runs the Zenya agent loop for a single incoming message.
 * Orchestrates: history → LLM → history save → Chatwoot response.
 *
 * AC7: Any errors bubble up to the webhook lock handler's finally block,
 * ensuring the session lock is always released.
 */
export async function runZenyaAgent(params: AgentParams): Promise<void> {
  const { tenantId, accountId, conversationId, config, message, phone, inputIsAudio } = params;

  const chatwootParams = getChatwootParams(accountId, conversationId);

  // Mark conversation as read — user sees double-check receipt immediately
  await markConversationRead(chatwootParams).catch(() => undefined);

  // Show typing indicator (non-blocking failure OK)
  await setTypingStatus(chatwootParams, 'on').catch(() => undefined);

  try {
    // AC2: load conversation history (last 50 messages)
    const history = await loadHistory(tenantId, phone);

    // AC4: build full system prompt (base + client SOP)
    const systemPrompt = buildSystemPrompt(config);

    // AC5: create tenant-scoped tools (tenantId injected via closure)
    const tools = createTenantTools(tenantId, config, { accountId, conversationId, phone });

    // AC1: call LLM with generateText (gpt-4.1, maxSteps: 15)
    const result = await generateText({
      model: openai('gpt-4.1'),
      maxSteps: 15,
      system: systemPrompt,
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: message },
      ],
      tools,
      onStepFinish: ({ toolCalls, toolResults }) => {
        const calls = (toolCalls ?? []) as Array<{ toolCallId: string; toolName: string; args: unknown }>;
        const results = (toolResults ?? []) as Array<{ toolCallId: string; result: unknown }>;
        for (const call of calls) {
          const args = JSON.stringify(call.args ?? {});
          const result = results.find((r) => r.toolCallId === call.toolCallId);
          const resultStr = result ? JSON.stringify(result.result).slice(0, 200) : '(pending)';
          console.log(`[agent] tool=${call.toolName} args=${args} → ${resultStr}`);
        }
      },
    });

    const reply = result.text;

    // AC3: save conversation history
    await saveHistory(tenantId, phone, message, reply);

    // AC6: send reply — format decision:
    // 1. Explicit preference ('audio'|'texto') always wins
    // 2. No preference set → mirror input format (audio in → audio out, text in → text out)
    if (reply.trim()) {
      const audioPref = await getContactAudioPreference(chatwootParams, phone).catch(() => null);
      const respondWithAudio = audioPref === 'audio' || (audioPref === null && inputIsAudio === true);

      if (respondWithAudio) {
        // Show "gravando áudio..." indicator before generating audio
        await setTypingStatus(chatwootParams, 'on', 'recording').catch(() => undefined);
        try {
          const ssml = await formatSSML(reply);
          const audioFormat = config.audio_format ?? 'mp3';
          const audioBuffer = await generateAudio(ssml, getElevenLabsApiKey(), undefined, audioFormat);
          const isOgg = audioFormat === 'ogg_opus';
          await sendAudioMessage(
            chatwootParams,
            audioBuffer,
            isOgg ? 'audio/ogg' : 'audio/mpeg',
            isOgg ? 'response.ogg' : 'response.mp3',
          );
        } catch (audioErr) {
          // AC4 (story 7.6): fallback to text — user gets the response, not a silent error
          console.warn('[zenya] Audio generation failed, falling back to text:', audioErr);
          await chunkAndSend(reply, chatwootParams);
        }
      } else if (audioPref === 'texto' || !respondWithAudio) {
        await chunkAndSend(reply, chatwootParams);
      }
    }
  } finally {
    // Turn off typing regardless of success or error
    await setTypingStatus(chatwootParams, 'off').catch(() => undefined);
  }
}
