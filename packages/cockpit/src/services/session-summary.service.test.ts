// Unit tests for session-summary.service.ts
// Mocks all dependencies: agent-activity, decisions, and brain services

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSessionSummary } from './session-summary.service.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./agent-activity.service.js', () => ({
  getAgentActivity: vi.fn(),
  getRecentDoneStories: vi.fn(),
}));

vi.mock('./decisions.service.js', () => ({
  getDecisionsCount: vi.fn(),
}));

vi.mock('./brain.service.js', () => ({
  getBrainStatus: vi.fn(),
}));

import { getAgentActivity, getRecentDoneStories } from './agent-activity.service.js';
import { getDecisionsCount } from './decisions.service.js';
import { getBrainStatus } from './brain.service.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = Date.now();
const recent = new Date(now - 1 * 60 * 60 * 1000).toISOString(); // 1h ago — within 24h

const mockCommits = [
  {
    hash: 'abc1234',
    author: 'Dex',
    message: 'feat: add session panel [Story 4.8]',
    date: recent,
    storyRef: '4.8',
  },
  {
    hash: 'def5678',
    author: 'Dex',
    message: 'fix: correct route registration',
    date: recent,
    storyRef: null,
  },
];

const mockDoneStories = [
  {
    storyId: '4.7',
    title: 'Epic Progress Panel',
    status: 'Done',
    assignedTo: '@dev',
    createdAt: recent,
  },
];

const mockBrainHealthy = {
  healthy: true as const,
  health: { status: 'ok', db: 'ok', embeddingService: 'ok' },
  dashboard: {
    generatedAt: recent,
    cacheHit: false,
    summary: {
      total: 42,
      by_status: { raw: 5, validated: 10, applied: 20, rejected: 7 },
      by_source: { zenya_operation: 15, agent_research: 20, mauro_input: 7 },
      total_duplicates: 3,
      avg_quality_score: 0.85,
    },
    cycle: {
      ingested: 42,
      validated: 30,
      applied: 20,
      rejected: 7,
      completionRate: 47.6,
    },
    top_applied: [
      { id: '1', content: 'Insight A', quality_score: 0.95, source: 'zenya_operation' },
    ],
  },
  topApplied: [
    { id: '1', content: 'Insight A', quality_score: 0.95, source: 'zenya_operation' },
  ],
};

const mockBrainOffline = {
  healthy: false as const,
  error: 'Brain API indisponível',
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function setupMocks(opts: {
  commits?: typeof mockCommits;
  doneStories?: typeof mockDoneStories;
  decisionsCount?: number;
  brain?: typeof mockBrainHealthy | typeof mockBrainOffline;
  activityThrows?: boolean;
  decisionsThrows?: boolean;
  brainThrows?: boolean;
}) {
  const {
    commits = mockCommits,
    doneStories = mockDoneStories,
    decisionsCount = 2,
    brain = mockBrainHealthy,
    activityThrows = false,
    decisionsThrows = false,
    brainThrows = false,
  } = opts;

  if (activityThrows) {
    vi.mocked(getAgentActivity).mockImplementation(() => {
      throw new Error('git unavailable');
    });
    vi.mocked(getRecentDoneStories).mockRejectedValue(new Error('stories unavailable'));
  } else {
    vi.mocked(getAgentActivity).mockReturnValue(commits);
    vi.mocked(getRecentDoneStories).mockResolvedValue(doneStories);
  }

  if (decisionsThrows) {
    vi.mocked(getDecisionsCount).mockRejectedValue(new Error('core unavailable'));
  } else {
    vi.mocked(getDecisionsCount).mockResolvedValue(decisionsCount);
  }

  if (brainThrows) {
    vi.mocked(getBrainStatus).mockRejectedValue(new Error('brain fetch failed'));
  } else {
    vi.mocked(getBrainStatus).mockResolvedValue(brain);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getSessionSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Scenario 1: All sources available ───────────────────────────────────────
  it('returns complete summary when all sources are available', async () => {
    setupMocks({});

    const result = await getSessionSummary();

    expect(result.isEmpty).toBe(false);
    expect(result.unavailable).toHaveLength(0);
    expect(result.activity).not.toBeNull();
    expect(result.activity!.commits.length).toBeGreaterThan(0);
    expect(result.activity!.recentDoneStories).toHaveLength(1);
    expect(result.decisionsCount).toBe(2);
    expect(result.brain).not.toBeNull();
    expect(result.brain!.healthy).toBe(true);
    expect(result.generatedAt).toBeTruthy();
  });

  it('includes generatedAt as a valid ISO date string', async () => {
    setupMocks({});

    const result = await getSessionSummary();

    expect(() => new Date(result.generatedAt)).not.toThrow();
    expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
  });

  // ── Scenario 2: Brain offline (graceful degradation) ─────────────────────────
  it('degrades gracefully when brain is offline — brain is unhealthy, other data present', async () => {
    setupMocks({ brain: mockBrainOffline });

    const result = await getSessionSummary();

    expect(result.isEmpty).toBe(false);
    expect(result.brain).not.toBeNull();
    expect(result.brain!.healthy).toBe(false);
    expect(result.activity).not.toBeNull();
    expect(result.decisionsCount).toBe(2);
    expect(result.unavailable).toHaveLength(0); // brain returned (unhealthy), not null
  });

  it('marks brain as unavailable when getBrainStatus throws', async () => {
    setupMocks({ brainThrows: true });

    const result = await getSessionSummary();

    expect(result.brain).toBeNull();
    expect(result.unavailable).toContain('brain');
    expect(result.isEmpty).toBe(false); // activity + decisions still present
  });

  // ── Scenario 3: Decisions offline (graceful degradation) ─────────────────────
  it('marks decisionsCount as null and adds to unavailable when getDecisionsCount throws', async () => {
    setupMocks({ decisionsThrows: true });

    const result = await getSessionSummary();

    expect(result.decisionsCount).toBeNull();
    expect(result.unavailable).toContain('decisions');
    expect(result.isEmpty).toBe(false); // activity + brain still present
    expect(result.activity).not.toBeNull();
  });

  // ── Scenario 4: No activity (isEmpty = true) ─────────────────────────────────
  it('returns isEmpty:true when no commits, no done stories, no pending decisions', async () => {
    setupMocks({ commits: [], doneStories: [], decisionsCount: 0 });

    const result = await getSessionSummary();

    expect(result.isEmpty).toBe(true);
    expect(result.unavailable).toHaveLength(0);
    expect(result.activity!.commits).toHaveLength(0);
    expect(result.activity!.recentDoneStories).toHaveLength(0);
    expect(result.decisionsCount).toBe(0);
  });

  it('does NOT return isEmpty:true when there are pending decisions even with no commits', async () => {
    setupMocks({ commits: [], doneStories: [], decisionsCount: 3 });

    const result = await getSessionSummary();

    expect(result.isEmpty).toBe(false);
    expect(result.decisionsCount).toBe(3);
  });

  it('does NOT return isEmpty:true when there are done stories even with no commits', async () => {
    setupMocks({ commits: [], doneStories: mockDoneStories, decisionsCount: 0 });

    const result = await getSessionSummary();

    expect(result.isEmpty).toBe(false);
    expect(result.activity!.recentDoneStories).toHaveLength(1);
  });

  // ── Scenario 5: Commits older than 24h are filtered out ───────────────────────
  it('filters out commits older than 24h', async () => {
    const oldCommit = {
      hash: 'old1234',
      author: 'Dex',
      message: 'chore: old commit',
      date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago
      storyRef: null,
    };
    const recentCommit = mockCommits[0]!;

    setupMocks({ commits: [oldCommit, recentCommit], doneStories: [], decisionsCount: 0 });

    const result = await getSessionSummary();

    // Only the recent commit should survive the 24h filter
    expect(result.activity!.commits).toHaveLength(1);
    expect(result.activity!.commits[0]!.hash).toBe(recentCommit.hash);
  });

  // ── Scenario 6: All sources fail ─────────────────────────────────────────────
  it('returns isEmpty:false (all unavailable) when all sources throw', async () => {
    setupMocks({ activityThrows: true, decisionsThrows: true, brainThrows: true });

    const result = await getSessionSummary();

    // All null — not classified as isEmpty (isEmpty only applies when sources return real empty data)
    expect(result.activity).toBeNull();
    expect(result.decisionsCount).toBeNull();
    expect(result.brain).toBeNull();
    expect(result.isEmpty).toBe(false);
    expect(result.unavailable).toContain('decisions');
    expect(result.unavailable).toContain('brain');
  });
});
