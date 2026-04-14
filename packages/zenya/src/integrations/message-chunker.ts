// Message chunker — splits long responses into WhatsApp-natural parts with typing simulation
// Uses gpt-4.1-mini + structured output to find natural split points.
// Fallback: if LLM call fails, sends the full message as a single chunk.

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { sendMessage, setTypingStatus, type ChatwootParams } from './chatwoot.js';

const CHUNK_SCHEMA = z.object({
  mensagens: z.array(z.string()).min(1).max(5),
});

/**
 * Calculates typing delay in milliseconds for a text chunk.
 * Based on 150 WPM average typing speed at 4.5 chars/word.
 * Capped at 25 seconds to avoid stalling.
 */
export function calcTypingDelay(text: string): number {
  const seconds = Math.min((60 * (text.length / 4.5)) / 150, 25);
  return Math.round(seconds * 1000);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Splits a message into natural chunks using gpt-4.1-mini structured output,
 * then sends each chunk to Chatwoot with typing simulation.
 *
 * Loop is strictly serial — chunks are sent one at a time, in order.
 * Fallback: on any LLM error, sends the original message in full.
 */
export async function chunkAndSend(
  message: string,
  params: ChatwootParams,
): Promise<void> {
  let chunks: string[];

  try {
    const { object } = await generateObject({
      model: openai('gpt-4.1-mini'),
      schema: CHUNK_SCHEMA,
      system:
        'Divida a mensagem em partes naturais para WhatsApp. ' +
        'Máximo 5 partes. Respeite pontuação natural. ' +
        'Cada parte deve ser completa e fazer sentido sozinha. ' +
        'Se a mensagem já é curta, retorne em uma única parte.',
      prompt: message,
    });
    chunks = object.mensagens;
  } catch (err) {
    // Fallback: send the whole message without chunking
    console.warn('[zenya] chunkAndSend: LLM fallback — sending full message:', err);
    chunks = [message];
  }

  // AC4: strictly serial — one chunk at a time
  for (const chunk of chunks) {
    const delay = calcTypingDelay(chunk);
    await setTypingStatus(params, 'on');
    await sleep(delay);
    await sendMessage(params, chunk);
    await setTypingStatus(params, 'off');
    await sleep(1000); // pause between chunks
  }
}
