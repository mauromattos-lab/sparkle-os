import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sparkle-os/core
vi.mock('@sparkle-os/core', () => ({
  getPendingPostForToday: vi.fn(),
}));

// Mock pipeline-runner
vi.mock('./pipeline-runner.js', () => ({
  runDailyPipeline: vi.fn(),
}));

// Mock client-config (scheduler uses listClientIds)
vi.mock('./client-config.js', () => ({
  loadClientConfig: vi.fn().mockResolvedValue({
    clientId: 'plaka',
    name: 'Plaka Acessórios',
    squadPath: 'squads/aeo-squad-plaka',
    scheduleTime: '0 8 * * *',
  }),
  listClientIds: vi.fn().mockResolvedValue(['plaka']),
}));

import { getPendingPostForToday } from '@sparkle-os/core';
import { runDailyPipeline } from './pipeline-runner.js';
import { runPipelineWithGuard } from './scheduler.js';

const mockGetPending = vi.mocked(getPendingPostForToday);
const mockRunPipeline = vi.mocked(runDailyPipeline);

describe('runPipelineWithGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC5: skips pipeline if pending post exists for today', async () => {
    mockGetPending.mockResolvedValueOnce({
      id: 'post-123',
      clientId: 'plaka',
      status: 'aguardando_aprovacao',
      topic: 'Test',
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
    });

    await runPipelineWithGuard('plaka');

    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  it('AC5: runs pipeline if no pending post exists for today', async () => {
    mockGetPending.mockResolvedValueOnce(null);
    mockRunPipeline.mockResolvedValueOnce(undefined);

    await runPipelineWithGuard('plaka');

    expect(mockRunPipeline).toHaveBeenCalledWith('plaka');
  });
});
