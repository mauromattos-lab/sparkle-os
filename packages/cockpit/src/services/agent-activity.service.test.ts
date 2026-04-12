// Unit tests for agent-activity.service.ts
// Tests: parseFrontmatter, getAgentActivity, getInProgressStories, getRecentDoneStories

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock child_process and fs/promises before importing the service
// ---------------------------------------------------------------------------

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

import { parseFrontmatter, getAgentActivity, getInProgressStories, getRecentDoneStories } from './agent-activity.service.js';
import { execSync } from 'child_process';
import { readdir, readFile } from 'fs/promises';

const mockExecSync = vi.mocked(execSync);
const mockReaddir = vi.mocked(readdir);
const mockReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  it('parses a standard frontmatter block', () => {
    const content = `---
story_id: "4.2"
title: "Atividade dos Agentes"
status: "InProgress"
assigned_to: "@dev"
created_at: "2026-04-12"
---

# Story content here
`;
    const fm = parseFrontmatter(content);
    expect(fm['story_id']).toBe('4.2');
    expect(fm['title']).toBe('Atividade dos Agentes');
    expect(fm['status']).toBe('InProgress');
    expect(fm['assigned_to']).toBe('@dev');
    expect(fm['created_at']).toBe('2026-04-12');
  });

  it('returns empty object when frontmatter is missing', () => {
    const content = `# Story without frontmatter\n\nSome content.`;
    expect(parseFrontmatter(content)).toEqual({});
  });

  it('strips surrounding quotes from values', () => {
    const content = `---\ntitle: "Quoted Title"\nother: 'single quoted'\n---`;
    const fm = parseFrontmatter(content);
    expect(fm['title']).toBe('Quoted Title');
    expect(fm['other']).toBe('single quoted');
  });

  it('handles values containing colons — strips outer quotes, preserves internal colons', () => {
    const content = `---\ndescription: "value: with colon"\n---`;
    const fm = parseFrontmatter(content);
    // Outer quotes are stripped: '"value: with colon"' → 'value: with colon'
    expect(fm['description']).toBe('value: with colon');
  });

  it('returns empty object for empty frontmatter', () => {
    const content = `---\n\n---\n\n# Body`;
    expect(parseFrontmatter(content)).toEqual({});
  });

  it('ignores lines without a colon separator', () => {
    const content = `---\nstory_id: "1.1"\ninvalid_line\ntitle: "Hello"\n---`;
    const fm = parseFrontmatter(content);
    expect(fm['story_id']).toBe('1.1');
    expect(fm['title']).toBe('Hello');
    expect(Object.keys(fm)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getAgentActivity
// ---------------------------------------------------------------------------

describe('getAgentActivity', () => {
  it('returns parsed commits from git log output', () => {
    mockExecSync.mockReturnValueOnce(
      'abc1234|SparkleOS AIOX Agents|feat: implement brain health [Story 3.1]|2026-04-12 03:00:00 -0300\n' +
      'def5678|Mauro|fix: correct typo|2026-04-11 10:00:00 -0300\n',
    );

    const commits = getAgentActivity();

    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      hash: 'abc1234',
      author: 'SparkleOS AIOX Agents',
      message: 'feat: implement brain health [Story 3.1]',
      storyRef: '3.1',
    });
    expect(commits[1]).toMatchObject({
      hash: 'def5678',
      author: 'Mauro',
      message: 'fix: correct typo',
      storyRef: null,
    });
  });

  it('returns empty array when git throws (not a git repo)', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('not a git repository');
    });

    const commits = getAgentActivity();
    expect(commits).toEqual([]);
  });

  it('returns empty array when git log output is empty', () => {
    mockExecSync.mockReturnValueOnce('');

    const commits = getAgentActivity();
    expect(commits).toEqual([]);
  });

  it('truncates hash to 7 characters', () => {
    mockExecSync.mockReturnValueOnce(
      'abcdefg1234567|Author|message|2026-04-12 00:00:00 -0300\n',
    );

    const commits = getAgentActivity();
    expect(commits[0]?.hash).toBe('abcdefg');
  });

  it('extracts storyRef from message with [Story X.Y] pattern', () => {
    mockExecSync.mockReturnValueOnce(
      'abc1234|Author|chore: update config [Story 4.2]|2026-04-12 00:00:00 -0300\n',
    );

    const commits = getAgentActivity();
    expect(commits[0]?.storyRef).toBe('4.2');
  });

  it('sets storyRef to null when message has no story reference', () => {
    mockExecSync.mockReturnValueOnce(
      'abc1234|Author|chore: update .gitignore|2026-04-12 00:00:00 -0300\n',
    );

    const commits = getAgentActivity();
    expect(commits[0]?.storyRef).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Shared story frontmatter fixtures
// ---------------------------------------------------------------------------

function makeStoryFM(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    story_id: '3.1',
    title: 'Test Story',
    status: 'Done',
    assigned_to: '@dev',
    created_at: '2026-04-01',
  };
  const fields = { ...defaults, ...overrides };
  const lines = Object.entries(fields).map(([k, v]) => `${k}: "${v}"`).join('\n');
  return `---\n${lines}\n---`;
}

const INPROGRESS_FM = makeStoryFM({ story_id: '3.5', title: 'Brain Client Interface', status: 'InProgress', created_at: '2026-04-10' });
const DONE_OLD_FM = makeStoryFM({ story_id: '3.1', title: 'Captura de Insights', status: 'Done', created_at: '2026-04-01' });
const INVALID_FM = `# No frontmatter here`;

// ---------------------------------------------------------------------------
// getInProgressStories
// ---------------------------------------------------------------------------

describe('getInProgressStories', () => {
  it('returns only InProgress stories', async () => {
    mockReaddir.mockResolvedValueOnce(['3.1.story.md', '3.5.story.md'] as never);
    mockReadFile
      .mockResolvedValueOnce(DONE_OLD_FM as never)
      .mockResolvedValueOnce(INPROGRESS_FM as never);

    const stories = await getInProgressStories();

    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({
      storyId: '3.5',
      title: 'Brain Client Interface',
      status: 'InProgress',
      assignedTo: '@dev',
    });
  });

  it('returns empty array when no stories are InProgress', async () => {
    mockReaddir.mockResolvedValueOnce(['3.1.story.md'] as never);
    mockReadFile.mockResolvedValueOnce(DONE_OLD_FM as never);

    const stories = await getInProgressStories();
    expect(stories).toEqual([]);
  });

  it('returns empty array when readdir fails', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('ENOENT'));

    const stories = await getInProgressStories();
    expect(stories).toEqual([]);
  });

  it('skips files without story_id in frontmatter silently', async () => {
    mockReaddir.mockResolvedValueOnce(['3.5.story.md'] as never);
    mockReadFile.mockResolvedValueOnce(INVALID_FM as never);

    const stories = await getInProgressStories();
    expect(stories).toEqual([]);
  });

  it('skips files that cannot be read (readFile throws)', async () => {
    mockReaddir.mockResolvedValueOnce(['3.5.story.md', '3.1.story.md'] as never);
    mockReadFile
      .mockResolvedValueOnce(INPROGRESS_FM as never)
      .mockRejectedValueOnce(new Error('Permission denied'));

    const stories = await getInProgressStories();
    expect(stories).toHaveLength(1);
    expect(stories[0]?.storyId).toBe('3.5');
  });

  it('ignores files not matching the story filename pattern', async () => {
    // readdir returns a mix — only 3.5.story.md matches /^\d+\.\d+\.story\.md$/
    mockReaddir.mockResolvedValueOnce([
      '3.5.story.md',
      'EPIC-3-INDEX.md',
      'notes.txt',
      '3.1-validation-scenario.story.md',
    ] as never);
    mockReadFile.mockResolvedValueOnce(INPROGRESS_FM as never);

    const stories = await getInProgressStories();
    expect(stories).toHaveLength(1);
    expect(stories[0]?.storyId).toBe('3.5');
  });
});

// ---------------------------------------------------------------------------
// getRecentDoneStories
// ---------------------------------------------------------------------------

describe('getRecentDoneStories', () => {
  it('returns Done stories created within the given time window', async () => {
    // Today's date in YYYY-MM-DD — always within 48h
    const today = new Date().toISOString().split('T')[0] as string;
    const recentDoneFM = makeStoryFM({ story_id: '3.2', title: 'Recent Done', status: 'Done', created_at: today });

    mockReaddir.mockResolvedValueOnce(['3.2.story.md'] as never);
    mockReadFile.mockResolvedValueOnce(recentDoneFM as never);

    const stories = await getRecentDoneStories(48);
    expect(stories).toHaveLength(1);
    expect(stories[0]?.storyId).toBe('3.2');
  });

  it('excludes Done stories older than the time window', async () => {
    // 2026-04-01 is >48h before 2026-04-12
    mockReaddir.mockResolvedValueOnce(['3.1.story.md'] as never);
    mockReadFile.mockResolvedValueOnce(DONE_OLD_FM as never);

    const stories = await getRecentDoneStories(48);
    expect(stories).toEqual([]);
  });

  it('excludes non-Done stories regardless of date', async () => {
    mockReaddir.mockResolvedValueOnce(['3.5.story.md'] as never);
    mockReadFile.mockResolvedValueOnce(INPROGRESS_FM as never);

    const stories = await getRecentDoneStories(48);
    expect(stories).toEqual([]);
  });

  it('returns empty array when readdir fails', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('ENOENT'));

    const stories = await getRecentDoneStories(48);
    expect(stories).toEqual([]);
  });

  it('excludes stories with unparseable dates', async () => {
    const badDateFM = makeStoryFM({ story_id: '9.9', title: 'Bad Date Story', status: 'Done', created_at: 'not-a-date' });

    mockReaddir.mockResolvedValueOnce(['9.9.story.md'] as never);
    mockReadFile.mockResolvedValueOnce(badDateFM as never);

    const stories = await getRecentDoneStories(48);
    expect(stories).toEqual([]);
  });

  it('uses the hours parameter to set the cutoff window', async () => {
    // 2026-04-01 is approx 264h before 2026-04-12 — included if window is 300h
    mockReaddir.mockResolvedValueOnce(['3.1.story.md'] as never);
    mockReadFile.mockResolvedValueOnce(DONE_OLD_FM as never);

    const stories = await getRecentDoneStories(300);
    expect(stories).toHaveLength(1);
    expect(stories[0]?.storyId).toBe('3.1');
  });
});
