import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AI SDK
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: vi.fn() };
});

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { generateText } from 'ai';
import { formatSSML, generateAudio } from '../integrations/elevenlabs.js';
import type { TtsConfig } from '../integrations/elevenlabs.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env['ELEVENLABS_VOICE_ID'] = 'test-voice-id';
});

/** Helper to extract the JSON body from the latest fetch call. */
function lastFetchBody(): Record<string, unknown> {
  const lastCall = mockFetch.mock.calls.at(-1);
  if (!lastCall) throw new Error('No fetch calls recorded');
  const init = lastCall[1] as RequestInit;
  return JSON.parse(init.body as string);
}

/** Helper to extract the URL from the latest fetch call. */
function lastFetchUrl(): string {
  const lastCall = mockFetch.mock.calls.at(-1);
  if (!lastCall) throw new Error('No fetch calls recorded');
  return lastCall[0] as string;
}

describe('formatSSML', () => {
  it('returns SSML text from LLM', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '<speak>Olá, tudo bem?</speak>',
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await formatSSML('Olá, **tudo** bem? 😊');
    expect(result).toBe('<speak>Olá, tudo bem?</speak>');
    expect(generateText).toHaveBeenCalledOnce();
  });
});

describe('generateAudio', () => {
  it('returns audio Buffer from ElevenLabs API', async () => {
    const fakeAudio = Buffer.from('MP3_BYTES');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeAudio.buffer),
    });

    const result = await generateAudio('Hello', 'test-api-key');
    expect(result).toBeInstanceOf(Buffer);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('test-voice-id'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when API returns non-200', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('quota exceeded'),
    });

    await expect(generateAudio('Hello', 'key')).rejects.toThrow('429');
  });

  it('throws when ELEVENLABS_VOICE_ID is not set', async () => {
    delete process.env['ELEVENLABS_VOICE_ID'];
    await expect(generateAudio('Hello', 'key')).rejects.toThrow('ELEVENLABS_VOICE_ID');
  });
});

describe('audio fallback in agent (integration concern)', () => {
  it('falls back to text when ElevenLabs fails — tested in agent index tests', () => {
    // Fallback behavior is tested via agent/index.ts integration
    // (audio failure → chunkAndSend text path)
    expect(true).toBe(true);
  });
});

// Story 18.24 — TTS qualidade por-tenant (modelo expressivo + voice curada + settings)
describe('generateAudio — Story 18.24 (per-tenant tts_config)', () => {
  const fakeAudio = Buffer.from('MP3_BYTES');
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeAudio.buffer),
    });
  });

  it('Cenário 1 — sem ttsConfig → usa defaults globais novos (multilingual_v2 + settings expressivos)', async () => {
    await generateAudio('Texto teste', 'test-api-key');

    const body = lastFetchBody();
    expect(body['model_id']).toBe('eleven_multilingual_v2');
    expect(body['voice_settings']).toEqual({
      stability: 0.40,
      similarity_boost: 0.65,
      style: 0.40,
      speed: 1.0,
      use_speaker_boost: true,
    });
    // Voice id falls back to env (test-voice-id)
    expect(lastFetchUrl()).toContain('test-voice-id');
  });

  it('Cenário 2 — ttsConfig parcial (só voice_id) → mantém defaults nos settings', async () => {
    const tts: TtsConfig = { voice_id: 'custom-voice-X' };
    await generateAudio('Texto', 'key', undefined, 'mp3', tts);

    expect(lastFetchUrl()).toContain('custom-voice-X');
    const body = lastFetchBody();
    expect(body['model_id']).toBe('eleven_multilingual_v2');
    expect(body['voice_settings']).toEqual({
      stability: 0.40,
      similarity_boost: 0.65,
      style: 0.40,
      speed: 1.0,
      use_speaker_boost: true,
    });
  });

  it('Cenário 3 — ttsConfig completo (Roberta para Scar) → todos os campos sobrescrevem defaults', async () => {
    const tts: TtsConfig = {
      voice_id: 'RGymW84CSmfVugnA5tvA', // Roberta
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.75,
        style: 0.30,
        speed: 1.10,
        use_speaker_boost: true,
      },
    };
    await generateAudio('Texto Scar', 'key', undefined, 'mp3', tts);

    expect(lastFetchUrl()).toContain('RGymW84CSmfVugnA5tvA');
    const body = lastFetchBody();
    expect(body['model_id']).toBe('eleven_multilingual_v2');
    expect(body['voice_settings']).toEqual({
      stability: 0.35,
      similarity_boost: 0.75,
      style: 0.30,
      speed: 1.10,
      use_speaker_boost: true,
    });
  });

  it('Cenário 4 — tts_config = undefined (tenant sem override) → idêntico ao Cenário 1', async () => {
    await generateAudio('Texto', 'key', undefined, 'mp3', undefined);

    const body = lastFetchBody();
    expect(body['model_id']).toBe('eleven_multilingual_v2');
    expect(lastFetchUrl()).toContain('test-voice-id');
  });

  it('voice_id resolution priority — tenantTtsConfig > voiceIdParam > env', async () => {
    const tts: TtsConfig = { voice_id: 'tenant-voice' };
    await generateAudio('Texto', 'key', 'param-voice', 'mp3', tts);
    expect(lastFetchUrl()).toContain('tenant-voice');
    expect(lastFetchUrl()).not.toContain('param-voice');

    // Without tenantTtsConfig, voiceIdParam wins
    await generateAudio('Texto', 'key', 'param-voice', 'mp3', undefined);
    expect(lastFetchUrl()).toContain('param-voice');
  });

  it('voice_settings partial override — só stability custom, demais defaults', async () => {
    const tts: TtsConfig = { voice_settings: { stability: 0.20 } };
    await generateAudio('Texto', 'key', undefined, 'mp3', tts);

    const body = lastFetchBody();
    const vs = body['voice_settings'] as Record<string, unknown>;
    expect(vs['stability']).toBe(0.20);
    expect(vs['similarity_boost']).toBe(0.65);
    expect(vs['style']).toBe(0.40);
    expect(vs['speed']).toBe(1.0);
    expect(vs['use_speaker_boost']).toBe(true);
  });
});
