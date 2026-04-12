// Stories Parser Service — reads and parses all story files from docs/stories/
// Used by the Epic Progress panel to display epic-level completion stats

import { readdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseFrontmatter } from '../lib/frontmatter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoryMeta {
  story_id: string;
  title: string;
  status: string;
  assigned_to: string;
  created_at: string;
  epic: number;
}

export interface EpicProgress {
  epicNum: number;
  stories: StoryMeta[];
  totalCount: number;
  doneCount: number;
  inProgressCount: number;
  inReviewCount: number;
  readyCount: number;
  draftCount: number;
  completionPct: number;
  staleStories: StoryMeta[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORY_FILENAME_RE = /^\d+\.\d+\.story\.md$/;
const STORIES_DIR = join(__dirname, '..', '..', '..', '..', 'docs', 'stories');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Story reader
// ---------------------------------------------------------------------------

/**
 * Reads all story files matching the pattern `X.Y.story.md` from docs/stories/.
 * Files that cannot be read or lack a valid frontmatter story_id are silently skipped.
 * One corrupted file does NOT break the entire result set.
 */
export async function parseAllStories(): Promise<StoryMeta[]> {
  let files: string[];
  try {
    const all = await readdir(STORIES_DIR);
    files = all.filter((f) => STORY_FILENAME_RE.test(f));
  } catch {
    // docs/stories directory not found or unreadable — return empty list
    return [];
  }

  const stories: StoryMeta[] = [];

  for (const file of files) {
    try {
      const content = await readFile(join(STORIES_DIR, file), { encoding: 'utf8' });
      const fm = parseFrontmatter(content);

      const story_id = fm['story_id'] ?? '';
      if (!story_id) continue; // Skip files without a valid frontmatter ID

      const epicNum = Math.floor(parseFloat(story_id));
      if (isNaN(epicNum)) continue;

      stories.push({
        story_id,
        title: fm['title'] ?? file,
        status: fm['status'] ?? '',
        assigned_to: fm['assigned_to'] ?? '',
        created_at: fm['created_at'] ?? '',
        epic: epicNum,
      });
    } catch {
      // Corrupted or unreadable file — skip silently
    }
  }

  return stories;
}

// ---------------------------------------------------------------------------
// Epic grouping
// ---------------------------------------------------------------------------

/**
 * Groups a flat list of StoryMeta by epic number.
 * Calculates completion percentage and detects stale stories
 * (Draft or Ready status, created more than 7 days ago).
 *
 * @param stories - List of parsed story metadata
 * @returns Array of EpicProgress sorted by epic number ascending
 */
export function groupByEpic(stories: StoryMeta[]): EpicProgress[] {
  const epicMap = new Map<number, StoryMeta[]>();

  for (const story of stories) {
    const existing = epicMap.get(story.epic) ?? [];
    existing.push(story);
    epicMap.set(story.epic, existing);
  }

  const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;

  const result: EpicProgress[] = [];

  for (const [epicNum, epicStories] of epicMap) {
    const totalCount = epicStories.length;
    const doneCount = epicStories.filter((s) => s.status === 'Done').length;
    const inProgressCount = epicStories.filter((s) => s.status === 'InProgress').length;
    const inReviewCount = epicStories.filter((s) => s.status === 'InReview').length;
    const readyCount = epicStories.filter((s) => s.status === 'Ready').length;
    const draftCount = epicStories.filter((s) => s.status === 'Draft').length;
    const completionPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const staleStories = epicStories.filter((s) => {
      if (s.status !== 'Draft' && s.status !== 'Ready') return false;
      const ts = Date.parse(s.created_at);
      if (isNaN(ts)) return false;
      return ts < sevenDaysAgo;
    });

    result.push({
      epicNum,
      stories: epicStories,
      totalCount,
      doneCount,
      inProgressCount,
      inReviewCount,
      readyCount,
      draftCount,
      completionPct,
      staleStories,
    });
  }

  // Sort by epic number ascending
  result.sort((a, b) => a.epicNum - b.epicNum);

  return result;
}
