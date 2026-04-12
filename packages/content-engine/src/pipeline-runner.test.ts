import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sparkle-os/core
vi.mock('@sparkle-os/core', () => ({
  createContentPost: vi.fn(),
  updateContentPost: vi.fn(),
}));

// Mock agent-loader
vi.mock('./agent-loader.js', () => ({
  loadAgentPrompt: vi.fn().mockResolvedValue('# Agent Prompt\nVocê é um agente AEO.'),
  loadTaskPrompt: vi.fn().mockResolvedValue('## Task\nExecute esta tarefa.'),
  loadSquadContext: vi.fn().mockResolvedValue({
    plakaContext: '# Plaka Context\nSemi-joias do Rio.',
    postsHistory: '# Posts History\nNenhum post ainda.',
  }),
}));

import { createContentPost, updateContentPost } from '@sparkle-os/core';
import { runDailyPipeline } from './pipeline-runner.js';

const mockCreate = vi.mocked(createContentPost);
const mockUpdate = vi.mocked(updateContentPost);

const basePost = {
  id: 'post-abc',
  clientId: 'plaka',
  status: 'gerando' as const,
  topic: null,
  title: null,
  meta: null,
  bodyPreview: null,
  bodyFull: null,
  imageDesc: null,
  pinCopy: null,
  pinHashtags: null,
  imageDriveUrl: null,
  blogUrl: null,
  pinUrl: null,
  errorMsg: null,
  rejectionNote: null,
  createdAt: new Date().toISOString(),
  approvedAt: null,
  publishedAt: null,
};

describe('runDailyPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(basePost);
    mockUpdate.mockResolvedValue({ ...basePost });
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
  });

  it('AC4: updates status to erro when Anthropic API throws', async () => {
    // Run without valid ANTHROPIC_API_KEY — Anthropic will throw authentication error
    // The pipeline-runner must catch it and set status to 'erro'
    process.env['ANTHROPIC_API_KEY'] = 'invalid-key-for-test';

    await runDailyPipeline('plaka');

    expect(mockCreate).toHaveBeenCalledWith({ clientId: 'plaka' });

    const calls = mockUpdate.mock.calls;
    const errorCall = calls.find((c) => c[1]?.status === 'erro');
    expect(errorCall).toBeDefined();
    expect(typeof errorCall?.[1]?.errorMsg).toBe('string');
    expect((errorCall?.[1]?.errorMsg ?? '').length).toBeGreaterThan(0);
  });

  it('creates post with gerando status on start', async () => {
    mockCreate.mockResolvedValue(basePost);

    // We just verify create is called with correct clientId
    // Full pipeline test requires Anthropic mock
    expect(mockCreate).not.toHaveBeenCalled();
    await runDailyPipeline('plaka').catch(() => {
      // May fail without real ANTHROPIC_API_KEY — that's OK
    });

    expect(mockCreate).toHaveBeenCalledWith({ clientId: 'plaka' });
  });
});
