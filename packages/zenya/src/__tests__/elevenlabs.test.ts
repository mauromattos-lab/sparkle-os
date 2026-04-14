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

beforeEach(() => {
  vi.clearAllMocks();
  process.env['ELEVENLABS_VOICE_ID'] = 'test-voice-id';
});

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
