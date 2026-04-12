// Agent Activity Service — reads git log and story files
// Used by the Agents panel to display recent agent activity

import { execSync } from 'child_process';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommitEntry {
  hash: string;
  author: string;
  message: string;
  date: string;
  storyRef: string | null;
}

export interface StoryEntry {
  storyId: string;
  title: string;
  status: string;
  assignedTo: string;
  createdAt: string;
}

export interface AgentActivity {
  commits: CommitEntry[];
  inProgressStories: StoryEntry[];
  recentDoneStories: StoryEntry[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Frontmatter parser (inline, no external library)
// ---------------------------------------------------------------------------

/**
 * Parses a YAML frontmatter block (between --- delimiters) from a Markdown file.
 * Returns key-value pairs as a flat string record.
 * Arrays and multi-line values are not supported — only scalar values.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Git log reader
// ---------------------------------------------------------------------------

/**
 * Extracts a story reference (e.g. "Story 3.1") from a commit message.
 */
function extractStoryRef(message: string): string | null {
  const match = message.match(/\[Story\s+([\d.]+)\]/i);
  return match ? match[1] : null;
}

/**
 * Reads the last 20 commits from git log.
 * Returns an empty array on failure (graceful degradation).
 */
export function getAgentActivity(): CommitEntry[] {
  try {
    const output = execSync('git log --format="%H|%aN|%s|%ci" -20', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    const lines = output.trim().split('\n').filter(Boolean);

    return lines.map((line) => {
      // Strip surrounding quotes added by some shells
      const clean = line.replace(/^"|"$/g, '');
      const parts = clean.split('|');
      const hash = parts[0] ?? '';
      const author = parts[1] ?? '';
      const message = parts[2] ?? '';
      const date = parts[3] ?? '';
      return {
        hash: hash.slice(0, 7),
        author,
        message,
        date,
        storyRef: extractStoryRef(message),
      };
    });
  } catch {
    // git not available or repository error — return empty list
    return [];
  }
}

// ---------------------------------------------------------------------------
// Story file reader
// ---------------------------------------------------------------------------

const STORY_FILENAME_RE = /^\d+\.\d+\.story\.md$/;
const STORIES_DIR = join(process.cwd(), 'docs', 'stories');

/**
 * Reads all story files and parses their frontmatter.
 * Skips files that cannot be read or lack valid frontmatter.
 */
async function loadAllStories(): Promise<StoryEntry[]> {
  let files: string[];
  try {
    const all = await readdir(STORIES_DIR);
    files = all.filter((f) => STORY_FILENAME_RE.test(f));
  } catch {
    return [];
  }

  const stories: StoryEntry[] = [];

  for (const file of files) {
    try {
      const content = await readFile(join(STORIES_DIR, file), { encoding: 'utf8' });
      const fm = parseFrontmatter(content);

      const storyId = fm['story_id'] ?? '';
      const title = fm['title'] ?? file;
      const status = fm['status'] ?? '';
      const assignedTo = fm['assigned_to'] ?? '';
      const createdAt = fm['created_at'] ?? '';

      if (!storyId) continue; // Skip files without a valid frontmatter ID

      stories.push({ storyId, title, status, assignedTo, createdAt });
    } catch {
      // Corrupted or unreadable file — skip silently
    }
  }

  return stories;
}

/**
 * Returns stories currently in "InProgress" status.
 */
export async function getInProgressStories(): Promise<StoryEntry[]> {
  const stories = await loadAllStories();
  return stories.filter((s) => s.status === 'InProgress');
}

/**
 * Returns stories with "Done" status whose `created_at` date is within
 * the last `hours` hours. Falls back to the file date when available.
 *
 * Note: since story frontmatter only has `created_at` (not `completed_at`),
 * we use `created_at` as an approximation for recently delivered stories.
 * Stories without a parseable date are excluded.
 */
export async function getRecentDoneStories(hours: number): Promise<StoryEntry[]> {
  const stories = await loadAllStories();
  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  return stories.filter((s) => {
    if (s.status !== 'Done') return false;
    const ts = Date.parse(s.createdAt);
    if (isNaN(ts)) return false;
    return ts >= cutoff;
  });
}
