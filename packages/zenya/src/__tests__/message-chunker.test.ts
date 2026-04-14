import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock AI SDK generateObject
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateObject: vi.fn() };
});

// Mock Chatwoot integration
vi.mock('../integrations/chatwoot.js', () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
  setTypingStatus: vi.fn().mockResolvedValue(undefined),
}));

import { generateObject } from 'ai';
import { sendMessage, setTypingStatus } from '../integrations/chatwoot.js';
import { calcTypingDelay, chunkAndSend } from '../integrations/message-chunker.js';
import type { ChatwootParams } from '../integrations/chatwoot.js';

const PARAMS: ChatwootParams = {
  url: 'https://chat.example.com',
  accountId: '1',
  conversationId: '42',
  token: 'tok',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// --- calcTypingDelay ---

describe('calcTypingDelay', () => {
  it('returns a positive value for non-empty text', () => {
    expect(calcTypingDelay('hello')).toBeGreaterThan(0);
  });

  it('returns higher delay for longer text', () => {
    const short = calcTypingDelay('ok');
    const long = calcTypingDelay('a'.repeat(200));
    expect(long).toBeGreaterThan(short);
  });

  it('caps at 25000ms (25 seconds)', () => {
    const delay = calcTypingDelay('a'.repeat(10000));
    expect(delay).toBeLessThanOrEqual(25000);
  });

  it('matches formula for 90-char text', () => {
    // 60 * (90 / 4.5) / 150 = 60 * 20 / 150 = 8s
    expect(calcTypingDelay('a'.repeat(90))).toBe(8000);
  });
});

// --- chunkAndSend ---

describe('chunkAndSend', () => {
  function mockChunks(chunks: string[]) {
    vi.mocked(generateObject).mockResolvedValue({
      object: { mensagens: chunks },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);
  }

  it('sends each chunk in serial order', async () => {
    mockChunks(['parte 1', 'parte 2', 'parte 3']);
    const callOrder: string[] = [];
    vi.mocked(sendMessage).mockImplementation(async (_p, msg) => {
      callOrder.push(msg);
    });

    const promise = chunkAndSend('long message', PARAMS);
    await vi.runAllTimersAsync();
    await promise;

    expect(callOrder).toEqual(['parte 1', 'parte 2', 'parte 3']);
  });

  it('activates typing before each chunk', async () => {
    mockChunks(['a', 'b']);

    const promise = chunkAndSend('msg', PARAMS);
    await vi.runAllTimersAsync();
    await promise;

    // setTypingStatus('on') called once per chunk = 2 times
    const onCalls = vi.mocked(setTypingStatus).mock.calls.filter(([, s]) => s === 'on');
    expect(onCalls).toHaveLength(2);
  });

  it('falls back to sending the full message when LLM throws', async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error('API error'));

    const promise = chunkAndSend('fallback message', PARAMS);
    await vi.runAllTimersAsync();
    await promise;

    expect(vi.mocked(sendMessage)).toHaveBeenCalledOnce();
    expect(vi.mocked(sendMessage)).toHaveBeenCalledWith(PARAMS, 'fallback message');
  });

  it('sends a single chunk without splitting when LLM returns one item', async () => {
    mockChunks(['single response']);

    const promise = chunkAndSend('short', PARAMS);
    await vi.runAllTimersAsync();
    await promise;

    expect(vi.mocked(sendMessage)).toHaveBeenCalledOnce();
  });
});
