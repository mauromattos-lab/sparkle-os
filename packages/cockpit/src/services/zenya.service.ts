// Zenya Service — n8n health check and Epic 2 story progress
// Used by the Zenya panel to display Zenya nucleus operational status

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZenyaStatus {
  /** Whether n8n is reachable (responds to healthz ping) */
  online: boolean;
  /** Number of active workflows — null if N8N_API_KEY not configured or request failed */
  workflowCount: number | null;
  /** Human-readable error message if offline or degraded */
  error: string | null;
}

export interface StoryProgress {
  done: number;
  inProgress: number;
  inReview: number;
  ready: number;
  draft: number;
  total: number;
}

// ---------------------------------------------------------------------------
// n8n Health Check
// ---------------------------------------------------------------------------

/**
 * Checks n8n connectivity in two levels:
 * - Level 1: GET /healthz (no auth required) — verifies n8n is reachable
 * - Level 2: GET /api/v1/workflows?active=true (requires N8N_API_KEY) — counts active workflows
 *
 * AbortSignal.timeout(5000) is MANDATORY — prevents the cockpit from hanging
 * if n8n is offline or unreachable.
 *
 * N8N_API_KEY is NEVER exposed in HTML or logs.
 */
export async function getZenyaStatus(): Promise<ZenyaStatus> {
  // Read env at call time (not module load time) — enables test isolation
  const n8nUrl = process.env['N8N_URL'] ?? 'http://localhost:5678';
  const n8nApiKey = process.env['N8N_API_KEY'];

  // Level 1: basic ping — no auth
  let online = false;
  try {
    const res = await fetch(`${n8nUrl}/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    online = res.ok;
  } catch {
    // n8n offline, unreachable, or timeout — graceful degradation
    return {
      online: false,
      workflowCount: null,
      error: 'n8n não responde. Verifique se o serviço está rodando na VPS.',
    };
  }

  if (!online) {
    return {
      online: false,
      workflowCount: null,
      error: 'n8n respondeu com erro. Verifique o status do serviço na VPS.',
    };
  }

  // Level 2: workflow count (optional — requires API key)
  if (!n8nApiKey) {
    return { online: true, workflowCount: null, error: null };
  }

  try {
    const wf = await fetch(`${n8nUrl}/api/v1/workflows?active=true`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey },
      signal: AbortSignal.timeout(5000),
    });

    if (!wf.ok) {
      // API key may be wrong, but n8n is reachable
      return { online: true, workflowCount: null, error: null };
    }

    const data = (await wf.json()) as { data?: unknown[] };
    const count = Array.isArray(data.data) ? data.data.length : null;
    return { online: true, workflowCount: count, error: null };
  } catch {
    // Workflow API failed, but Level 1 succeeded — n8n is online
    return { online: true, workflowCount: null, error: null };
  }
}

// ---------------------------------------------------------------------------
// Frontmatter parser (inline — same as agent-activity.service.ts)
// ---------------------------------------------------------------------------

/**
 * Parses YAML frontmatter block (between --- delimiters) from a Markdown file.
 * Returns key-value pairs as a flat string record.
 * Arrays and multi-line values are not supported — only scalar values.
 */
function parseFrontmatter(content: string): Record<string, string> {
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
// Epic Story Progress
// ---------------------------------------------------------------------------

const STORY_FILENAME_RE = /^\d+\.\d+\.story\.md$/;
const STORIES_DIR = join(process.cwd(), 'docs', 'stories');

/**
 * Filters story files by epic prefix (e.g. "2." for Epic 2)
 * and returns counts by status.
 *
 * @param epicPrefix - The prefix to filter by, e.g. "2." for Epic 2
 */
export async function getEpicStoryProgress(epicPrefix: string): Promise<StoryProgress> {
  let files: string[];
  try {
    const all = await readdir(STORIES_DIR);
    files = all.filter(
      (f) => STORY_FILENAME_RE.test(f) && f.startsWith(epicPrefix),
    );
  } catch {
    return { done: 0, inProgress: 0, inReview: 0, ready: 0, draft: 0, total: 0 };
  }

  const progress: StoryProgress = { done: 0, inProgress: 0, inReview: 0, ready: 0, draft: 0, total: 0 };

  for (const file of files) {
    try {
      const content = await readFile(join(STORIES_DIR, file), { encoding: 'utf8' });
      const fm = parseFrontmatter(content);
      const status = fm['status'] ?? '';

      progress.total++;
      if (status === 'Done') progress.done++;
      else if (status === 'InProgress') progress.inProgress++;
      else if (status === 'InReview') progress.inReview++;
      else if (status === 'Ready') progress.ready++;
      else if (status === 'Draft') progress.draft++;
    } catch {
      // Unreadable file — skip silently
    }
  }

  return progress;
}
