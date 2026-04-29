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
 * ElevenLabs supported output formats. `ogg_opus` is required for
 * WhatsApp Cloud API to render the audio as a native voice message
 * (PTT) instead of as a downloadable file attachment.
 */
export type AudioOutputFormat = 'mp3' | 'ogg_opus';

const OUTPUT_FORMAT_QUERY: Record<AudioOutputFormat, string> = {
  mp3: 'mp3_44100_128',
  ogg_opus: 'opus_48000_64',
};

/**
 * Voice settings for ElevenLabs TTS. All fields optional — fallback to defaults.
 * Story 18.24: per-tenant override via zenya_tenants.tts_config (JSONB column).
 */
export interface TtsVoiceSettings {
  /** 0..1 — Lower = more emotional variation. Default: 0.40 */
  stability?: number;
  /** 0..1 — How close to original voice. Default: 0.65 */
  similarity_boost?: number;
  /**
   * 0..1 — Style exaggeration (multilingual_v2/v3 only). Default: 0.40.
   * Higher = more expressive but can sound caricatured.
   */
  style?: number;
  /**
   * Playback speed multiplier (ElevenLabs API, available since 2024). Default: 1.0.
   * 1.0 = normal, >1 = faster, <1 = slower. Range typically 0.7..1.2.
   */
  speed?: number;
  /** Default: true — boosts similarity to speaker characteristics. */
  use_speaker_boost?: boolean;
}

/**
 * Per-tenant TTS configuration. All fields optional — deep-merged with global defaults.
 * Stored as JSONB in zenya_tenants.tts_config (Story 18.24 / migration 010).
 */
export interface TtsConfig {
  /**
   * Set to false to disable TTS output entirely for this tenant.
   * Agent will always respond in text, even when client sends audio.
   * Default: true (TTS enabled).
   */
  enabled?: boolean;
  /** ElevenLabs voice_id. Falls back to ELEVENLABS_VOICE_ID env var. */
  voice_id?: string;
  /** ElevenLabs model. Default: 'eleven_multilingual_v2'. */
  model_id?: string;
  voice_settings?: TtsVoiceSettings;
}

/**
 * Global defaults for TTS — Story 18.24 elevated from `eleven_flash_v2_5` (latency-optimized,
 * monotonic) to `eleven_multilingual_v2` (production-stable, expressive). Settings
 * tuned for natural conversational tone with emotional variation.
 *
 * Tenants without `tts_config` in DB inherit these — automatic quality bump cross-tenant.
 */
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_VOICE_SETTINGS: Required<TtsVoiceSettings> = {
  stability: 0.40,
  similarity_boost: 0.65,
  style: 0.40,
  speed: 1.0,
  use_speaker_boost: true,
};

/**
 * Resolves final TTS config by deep-merging tenant override on top of globals.
 * Each field in `tenantConfig` overrides the corresponding default; missing
 * fields fall through to defaults.
 */
function resolveTtsConfig(
  voiceIdParam: string | undefined,
  tenantConfig: TtsConfig | undefined,
): {
  voice_id: string;
  model_id: string;
  voice_settings: Required<TtsVoiceSettings>;
} {
  const voice_id =
    tenantConfig?.voice_id ?? voiceIdParam ?? process.env['ELEVENLABS_VOICE_ID'];
  if (!voice_id) throw new Error('ELEVENLABS_VOICE_ID env var is required');

  const ts = tenantConfig?.voice_settings;
  return {
    voice_id,
    model_id: tenantConfig?.model_id ?? DEFAULT_MODEL_ID,
    voice_settings: {
      stability: ts?.stability ?? DEFAULT_VOICE_SETTINGS.stability,
      similarity_boost: ts?.similarity_boost ?? DEFAULT_VOICE_SETTINGS.similarity_boost,
      style: ts?.style ?? DEFAULT_VOICE_SETTINGS.style,
      speed: ts?.speed ?? DEFAULT_VOICE_SETTINGS.speed,
      use_speaker_boost: ts?.use_speaker_boost ?? DEFAULT_VOICE_SETTINGS.use_speaker_boost,
    },
  };
}

/**
 * Generates an audio Buffer from text using ElevenLabs.
 *
 * Resolution order for voice_id and settings:
 *   1. tenantTtsConfig (per-tenant from zenya_tenants.tts_config — Story 18.24)
 *   2. voiceId param (legacy)
 *   3. ELEVENLABS_VOICE_ID env var (final fallback)
 *
 * Defaults (Story 18.24):
 *   model_id: 'eleven_multilingual_v2' (expressive, was flash_v2_5)
 *   voice_settings: { stability: 0.40, similarity_boost: 0.65, style: 0.40, speed: 1.0, use_speaker_boost: true }
 *
 * outputFormat defaults to 'mp3' (Z-API). Pass 'ogg_opus' for WhatsApp Cloud API tenants.
 */
export async function generateAudio(
  text: string,
  apiKey: string,
  voiceId?: string,
  outputFormat: AudioOutputFormat = 'mp3',
  tenantTtsConfig?: TtsConfig,
): Promise<Buffer> {
  const resolved = resolveTtsConfig(voiceId, tenantTtsConfig);

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const url = `${ELEVENLABS_API}/${resolved.voice_id}?output_format=${OUTPUT_FORMAT_QUERY[outputFormat]}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: resolved.model_id,
        voice_settings: resolved.voice_settings,
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
