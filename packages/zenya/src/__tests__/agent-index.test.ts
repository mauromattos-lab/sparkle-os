import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AI SDK
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: vi.fn() };
});

// Mock dependencies
vi.mock('../agent/memory.js', () => ({
  loadHistory: vi.fn().mockResolvedValue([]),
  saveHistory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../agent/prompt.js', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('system prompt'),
}));

vi.mock('../tenant/tool-factory.js', () => ({
  createTenantTools: vi.fn().mockReturnValue({}),
}));

const mockSetTypingStatus = vi.fn().mockResolvedValue(undefined);
const mockGetChatwootParams = vi.fn().mockReturnValue({ url: 'u', token: 't', accountId: 'a', conversationId: 'c' });
const mockGetContactAudioPreference = vi.fn().mockResolvedValue(null);
const mockMarkConversationRead = vi.fn().mockResolvedValue(undefined);
const mockSendAudioMessage = vi.fn().mockResolvedValue(undefined);
vi.mock('../integrations/chatwoot.js', () => ({
  setTypingStatus: (...args: unknown[]) => mockSetTypingStatus(...args),
  getChatwootParams: (...args: unknown[]) => mockGetChatwootParams(...args),
  getContactAudioPreference: (...args: unknown[]) => mockGetContactAudioPreference(...args),
  markConversationRead: (...args: unknown[]) => mockMarkConversationRead(...args),
  sendAudioMessage: (...args: unknown[]) => mockSendAudioMessage(...args),
}));

const mockChunkAndSend = vi.fn().mockResolvedValue(undefined);
vi.mock('../integrations/message-chunker.js', () => ({
  chunkAndSend: (...args: unknown[]) => mockChunkAndSend(...args),
}));

const mockFormatSSML = vi.fn().mockResolvedValue('<speak>hello</speak>');
const mockGenerateAudio = vi.fn().mockResolvedValue(Buffer.from('audio'));
const mockGetElevenLabsApiKey = vi.fn().mockReturnValue('test-key');
vi.mock('../integrations/elevenlabs.js', () => ({
  formatSSML: (...args: unknown[]) => mockFormatSSML(...args),
  generateAudio: (...args: unknown[]) => mockGenerateAudio(...args),
  getElevenLabsApiKey: () => mockGetElevenLabsApiKey(),
}));

import { generateText } from 'ai';
import { runZenyaAgent } from '../agent/index.js';
import type { TenantConfig } from '../tenant/config-loader.js';

function makeConfig(overrides: Partial<TenantConfig> = {}): TenantConfig {
  return {
    id: 'tenant-uuid',
    name: 'test',
    system_prompt: '',
    active_tools: [],
    chatwoot_account_id: 'acc-1',
    allowed_phones: [],
    admin_phones: [],
    admin_contacts: [],
    escalation_public_summary: true,
    audio_format: 'mp3',
    ...overrides,
  };
}

function makeParams(overrides: object = {}) {
  return {
    tenantId: 'tenant-uuid',
    accountId: 'acc-1',
    conversationId: 'conv-1',
    config: makeConfig(),
    message: 'Olá',
    phone: '+5511999990000',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateText).mockResolvedValue({ text: 'Olá, como posso ajudar?' } as Awaited<ReturnType<typeof generateText>>);
  mockGetContactAudioPreference.mockResolvedValue(null);
});

describe('runZenyaAgent — tts_config.enabled flag', () => {
  it('tts_config.enabled=false + inputIsAudio=true → responde em texto, nunca em áudio', async () => {
    const config = makeConfig({ tts_config: { enabled: false, voice_id: 'roberta-voice' } });
    await runZenyaAgent(makeParams({ config, inputIsAudio: true }));

    expect(mockSendAudioMessage).not.toHaveBeenCalled();
    expect(mockGenerateAudio).not.toHaveBeenCalled();
    expect(mockChunkAndSend).toHaveBeenCalledOnce();
  });

  it('tts_config.enabled=false + audioPref=audio → responde em texto (flag vence preferência)', async () => {
    mockGetContactAudioPreference.mockResolvedValue('audio');
    const config = makeConfig({ tts_config: { enabled: false, voice_id: 'roberta-voice' } });
    await runZenyaAgent(makeParams({ config, inputIsAudio: false }));

    expect(mockSendAudioMessage).not.toHaveBeenCalled();
    expect(mockChunkAndSend).toHaveBeenCalledOnce();
  });

  it('tts_config.enabled=true + inputIsAudio=true → responde em áudio (comportamento normal)', async () => {
    const config = makeConfig({ tts_config: { enabled: true, voice_id: 'roberta-voice' } });
    await runZenyaAgent(makeParams({ config, inputIsAudio: true }));

    expect(mockGenerateAudio).toHaveBeenCalledOnce();
    expect(mockSendAudioMessage).toHaveBeenCalledOnce();
    expect(mockChunkAndSend).not.toHaveBeenCalled();
  });

  it('tts_config ausente + inputIsAudio=true → responde em áudio (default enabled=true)', async () => {
    const config = makeConfig(); // sem tts_config = undefined, enabled assume true
    await runZenyaAgent(makeParams({ config, inputIsAudio: true }));

    expect(mockGenerateAudio).toHaveBeenCalledOnce();
    expect(mockSendAudioMessage).toHaveBeenCalledOnce();
  });

  it('tts_config.enabled=false + inputIsAudio=false + audioPref=null → texto (caso normal sem mudança)', async () => {
    const config = makeConfig({ tts_config: { enabled: false } });
    await runZenyaAgent(makeParams({ config, inputIsAudio: false }));

    expect(mockSendAudioMessage).not.toHaveBeenCalled();
    expect(mockChunkAndSend).toHaveBeenCalledOnce();
  });
});
