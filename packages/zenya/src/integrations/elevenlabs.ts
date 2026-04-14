// ElevenLabs TTS integration — generates MP3 audio from text
// SSML pre-formatting via gpt-4.1-mini to improve TTS quality
// Fallback: caller is responsible for text fallback on error

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/text-to-speech';
const TIMEOUT_MS = 20_000;

/**
 * Formats text to SSML using gpt-4.1-mini.
 * Strips markdown, emojis, and adds natural pause breaks.
 */
export async function formatSSML(text: string): Promise<string> {
  const { text: ssml } = await generateText({
    model: openai('gpt-4.1-mini'),
    system:
      'Converta o texto para SSML adequado para TTS. ' +
      'Remova markdown (* ** # _ ~), emojis e formatação visual. ' +
      'Adicione pausas naturais com <break time="0.4s"/> em pontuações fortes. ' +
      'Mantenha tom conversacional. Retorne apenas o SSML, sem comentários.',
    prompt: text,
  });
  return ssml;
}

/**
 * Generates an MP3 audio Buffer from text using ElevenLabs eleven_flash_v2_5.
 * voiceId defaults to ELEVENLABS_VOICE_ID env var.
 */
export async function generateAudio(text: string, apiKey: string, voiceId?: string): Promise<Buffer> {
  const vid = voiceId ?? process.env['ELEVENLABS_VOICE_ID'];
  if (!vid) throw new Error('ELEVENLABS_VOICE_ID env var is required');

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${ELEVENLABS_API}/${vid}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: abort.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ElevenLabs API error (${res.status}): ${body}`);
    }

    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

/** Returns ElevenLabs API key from env or throws. */
export function getElevenLabsApiKey(): string {
  const key = process.env['ELEVENLABS_API_KEY'];
  if (!key) throw new Error('ELEVENLABS_API_KEY env var is required');
  return key;
}
