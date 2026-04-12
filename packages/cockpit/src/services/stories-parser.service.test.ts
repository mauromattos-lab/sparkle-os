// Unit tests for stories-parser.service.ts
// Covers: parseAllStories(), groupByEpic(), stale detection, error handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseAllStories, groupByEpic } from './stories-parser.service.js';

// ---------------------------------------------------------------------------
// Mock fs/promises
// ---------------------------------------------------------------------------

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

import { readdir, readFile } from 'fs/promises';

const mockReaddir = vi.mocked(readdir);
const mockReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStoryContent(fields: Record<string, string>): string {
  const fm = Object.entries(fields)
    .map(([k, v]) => `${k}: "${v}"`)
    .join('\n');
  return `---\n${fm}\n---\n\n# Story content`;
}

// ---------------------------------------------------------------------------
// parseAllStories
// ---------------------------------------------------------------------------

describe('parseAllStories', () => {
  it('returns empty array when readdir throws (directory not found)', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

    const result = await parseAllStories();

    expect(result).toEqual([]);
  });

  it('filters out files that do not match X.Y.story.md pattern', async () => {
    mockReaddir.mockResolvedValueOnce([
      'EPIC-4-INDEX.md',
      '4.1.story.md',
      'README.md',
      'notes.txt',
      'sub-folder' as unknown as import('fs').Dirent,
    ] as unknown as import('fs').Dirent[]);

    mockReadFile.mockResolvedValueOnce(
      makeStoryContent({ story_id: '4.1', title: 'Shell', status: 'Done', assigned_to: '@dev', created_at: '2026-01-01' }) as unknown as Buffer,
    );

    const result = await parseAllStories();

    expect(result).toHaveLength(1);
    expect(result[0]?.story_id).toBe('4.1');
    // readFile should only be called once (for 4.1.story.md)
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it('parses frontmatter fields correctly from a valid story file', async () => {
    mockReaddir.mockResolvedValueOnce(['3.2.story.md'] as unknown as import('fs').Dirent[]);
    mockReadFile.mockResolvedValueOnce(
      makeStoryContent({
        story_id: '3.2',
        title: 'Captura de Insights',
        status: 'InProgress',
        assigned_to: '@dev',
        created_at: '2026-03-01',
      }) as unknown as Buffer,
    );

    const result = await parseAllStories();

    expect(result).toHaveLength(1);
    const story = result[0]!;
    expect(story.story_id).toBe('3.2');
    expect(story.title).toBe('Captura de Insights');
    expect(story.status).toBe('InProgress');
    expect(story.assigned_to).toBe('@dev');
    expect(story.created_at).toBe('2026-03-01');
    expect(story.epic).toBe(3);
  });

  it('skips a story file that has no story_id in frontmatter', async () => {
    mockReaddir.mockResolvedValueOnce(['2.5.story.md'] as unknown as import('fs').Dirent[]);
    mockReadFile.mockResolvedValueOnce(
      makeStoryContent({ title: 'No ID story', status: 'Draft' }) as unknown as Buffer,
    );

    const result = await parseAllStories();

    expect(result).toHaveLength(0);
  });

  it('skips a file with no frontmatter at all (no --- block)', async () => {
    mockReaddir.mockResolvedValueOnce(['1.1.story.md'] as unknown as import('fs').Dirent[]);
    mockReadFile.mockResolvedValueOnce(
      '# Just a heading\n\nNo frontmatter here.' as unknown as Buffer,
    );

    const result = await parseAllStories();

    expect(result).toHaveLength(0);
  });

  it('skips a file that throws on readFile without breaking other files', async () => {
    mockReaddir.mockResolvedValueOnce([
      '4.1.story.md',
      '4.2.story.md',
    ] as unknown as import('fs').Dirent[]);

    // First file throws
    mockReadFile.mockRejectedValueOnce(new Error('EACCES: permission denied'));
    // Second file succeeds
    mockReadFile.mockResolvedValueOnce(
      makeStoryContent({ story_id: '4.2', title: 'Agents', status: 'Done', assigned_to: '@dev', created_at: '2026-02-01' }) as unknown as Buffer,
    );

    const result = await parseAllStories();

    expect(result).toHaveLength(1);
    expect(result[0]?.story_id).toBe('4.2');
  });

  it('returns multiple stories from multiple files', async () => {
    mockReaddir.mockResolvedValueOnce([
      '4.1.story.md',
      '4.2.story.md',
      '4.3.story.md',
    ] as unknown as import('fs').Dirent[]);

    const stories = [
      { story_id: '4.1', title: 'Shell', status: 'Done', assigned_to: '@dev', created_at: '2026-01-01' },
      { story_id: '4.2', title: 'Agents', status: 'Done', assigned_to: '@dev', created_at: '2026-01-15' },
      { story_id: '4.3', title: 'Decisions', status: 'InProgress', assigned_to: '@dev', created_at: '2026-02-01' },
    ];

    for (const s of stories) {
      mockReadFile.mockResolvedValueOnce(makeStoryContent(s) as unknown as Buffer);
    }

    const result = await parseAllStories();

    expect(result).toHaveLength(3);
    expect(result.map((s) => s.story_id)).toEqual(['4.1', '4.2', '4.3']);
  });
});

// ---------------------------------------------------------------------------
// groupByEpic
// ---------------------------------------------------------------------------

describe('groupByEpic', () => {
  it('returns empty array for empty stories list', () => {
    const result = groupByEpic([]);
    expect(result).toEqual([]);
  });

  it('groups stories by epic number and calculates counts correctly', () => {
    const stories = [
      { story_id: '4.1', title: 'S1', status: 'Done', assigned_to: '@dev', created_at: '2026-01-01', epic: 4 },
      { story_id: '4.2', title: 'S2', status: 'Done', assigned_to: '@dev', created_at: '2026-01-01', epic: 4 },
      { story_id: '4.3', title: 'S3', status: 'InProgress', assigned_to: '@dev', created_at: '2026-01-01', epic: 4 },
      { story_id: '3.1', title: 'S4', status: 'Done', assigned_to: '@dev', created_at: '2026-01-01', epic: 3 },
    ];

    const result = groupByEpic(stories);

    expect(result).toHaveLength(2);
    // Sorted ascending by epic number
    expect(result[0]?.epicNum).toBe(3);
    expect(result[1]?.epicNum).toBe(4);

    const epic4 = result.find((e) => e.epicNum === 4)!;
    expect(epic4.totalCount).toBe(3);
    expect(epic4.doneCount).toBe(2);
    expect(epic4.inProgressCount).toBe(1);
    expect(epic4.completionPct).toBe(67); // Math.round(2/3 * 100)
  });

  it('calculates 100% completion when all stories are Done', () => {
    const stories = [
      { story_id: '1.1', title: 'S1', status: 'Done', assigned_to: '@dev', created_at: '2026-01-01', epic: 1 },
      { story_id: '1.2', title: 'S2', status: 'Done', assigned_to: '@dev', created_at: '2026-01-01', epic: 1 },
    ];

    const result = groupByEpic(stories);
    expect(result[0]?.completionPct).toBe(100);
    expect(result[0]?.staleStories).toHaveLength(0);
  });

  it('calculates 0% completion when no stories are Done', () => {
    const stories = [
      { story_id: '2.1', title: 'S1', status: 'Ready', assigned_to: '@dev', created_at: '2026-04-12', epic: 2 },
      { story_id: '2.2', title: 'S2', status: 'Draft', assigned_to: '@dev', created_at: '2026-04-12', epic: 2 },
    ];

    const result = groupByEpic(stories);
    expect(result[0]?.completionPct).toBe(0);
  });

  it('detects stale stories (Draft or Ready, created_at > 7 days ago)', () => {
    const longAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    const recent = new Date().toISOString().split('T')[0]!;

    const stories = [
      { story_id: '5.1', title: 'Old Draft', status: 'Draft', assigned_to: '@dev', created_at: longAgo, epic: 5 },
      { story_id: '5.2', title: 'Old Ready', status: 'Ready', assigned_to: '@dev', created_at: longAgo, epic: 5 },
      { story_id: '5.3', title: 'Recent Ready', status: 'Ready', assigned_to: '@dev', created_at: recent, epic: 5 },
      { story_id: '5.4', title: 'InProgress', status: 'InProgress', assigned_to: '@dev', created_at: longAgo, epic: 5 },
    ];

    const result = groupByEpic(stories);
    const epic5 = result[0]!;

    expect(epic5.staleStories).toHaveLength(2);
    expect(epic5.staleStories.map((s) => s.story_id).sort()).toEqual(['5.1', '5.2']);
  });

  it('does NOT mark InProgress or Done stories as stale even if old', () => {
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    const stories = [
      { story_id: '6.1', title: 'Old Done', status: 'Done', assigned_to: '@dev', created_at: longAgo, epic: 6 },
      { story_id: '6.2', title: 'Old InProgress', status: 'InProgress', assigned_to: '@dev', created_at: longAgo, epic: 6 },
    ];

    const result = groupByEpic(stories);
    expect(result[0]?.staleStories).toHaveLength(0);
  });

  it('stories with unparseable created_at date are NOT counted as stale', () => {
    const stories = [
      { story_id: '7.1', title: 'No date', status: 'Draft', assigned_to: '@dev', created_at: 'invalid-date', epic: 7 },
    ];

    const result = groupByEpic(stories);
    expect(result[0]?.staleStories).toHaveLength(0);
  });

  it('counts all status types correctly', () => {
    const stories = [
      { story_id: '8.1', status: 'Done', title: 'S1', assigned_to: '@dev', created_at: '2026-01-01', epic: 8 },
      { story_id: '8.2', status: 'InProgress', title: 'S2', assigned_to: '@dev', created_at: '2026-01-01', epic: 8 },
      { story_id: '8.3', status: 'InReview', title: 'S3', assigned_to: '@dev', created_at: '2026-01-01', epic: 8 },
      { story_id: '8.4', status: 'Ready', title: 'S4', assigned_to: '@dev', created_at: '2026-04-12', epic: 8 },
      { story_id: '8.5', status: 'Draft', title: 'S5', assigned_to: '@dev', created_at: '2026-04-12', epic: 8 },
    ];

    const result = groupByEpic(stories);
    const epic8 = result[0]!;

    expect(epic8.doneCount).toBe(1);
    expect(epic8.inProgressCount).toBe(1);
    expect(epic8.inReviewCount).toBe(1);
    expect(epic8.readyCount).toBe(1);
    expect(epic8.draftCount).toBe(1);
    expect(epic8.totalCount).toBe(5);
  });
});
