// Session Summary Service — aggregates data from existing services for the 24h summary panel
// Uses Promise.allSettled — partial failure is acceptable (graceful degradation)

import { getAgentActivity, getRecentDoneStories, type CommitEntry, type StoryEntry } from './agent-activity.service.js';
import { getDecisionsCount } from './decisions.service.js';
import { getBrainStatus, type BrainStatus } from './brain.service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionActivity {
  commits: CommitEntry[];
  recentDoneStories: StoryEntry[];
}

export interface SessionSummary {
  isEmpty: boolean;
  activity: SessionActivity | null;
  decisionsCount: number | null;
  brain: BrainStatus | null;
  generatedAt: string;
  /** Tracks which sources were unavailable during aggregation */
  unavailable: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HOURS_24 = 24;

// ─── Service function ─────────────────────────────────────────────────────────

/**
 * Aggregates data from agent-activity, decisions, and brain services.
 * Uses Promise.allSettled — if one source fails, the others still render.
 * Returns { isEmpty: true } when no activity is detected (valid state, not an error).
 */
export async function getSessionSummary(): Promise<SessionSummary> {
  const since24h = new Date(Date.now() - HOURS_24 * 60 * 60 * 1000);
  const unavailable: string[] = [];

  // Wrap synchronous getAgentActivity in a try/catch before Promise.allSettled
  // because Promise.resolve(syncThrow()) propagates the throw before allSettled can catch it
  const safeGetActivity = () =>
    new Promise<ReturnType<typeof getAgentActivity>>((resolve, reject) => {
      try {
        resolve(getAgentActivity());
      } catch (err) {
        reject(err);
      }
    });

  const [activityResult, recentStoriesResult, decisionsResult, brainResult] =
    await Promise.allSettled([
      safeGetActivity(),
      getRecentDoneStories(HOURS_24),
      getDecisionsCount(),
      getBrainStatus(),
    ]);

  // ── Activity (commits + done stories) ──────────────────────────────────────
  let activity: SessionActivity | null = null;

  if (activityResult.status === 'fulfilled' || recentStoriesResult.status === 'fulfilled') {
    const allCommits =
      activityResult.status === 'fulfilled' ? activityResult.value : [];
    const recentDoneStories =
      recentStoriesResult.status === 'fulfilled' ? recentStoriesResult.value : [];

    // Filter commits to last 24h
    const commits = allCommits.filter((c) => {
      const ts = Date.parse(c.date);
      return !isNaN(ts) && ts >= since24h.getTime();
    });

    activity = { commits, recentDoneStories };

    if (activityResult.status === 'rejected') {
      unavailable.push('commits');
    }
    if (recentStoriesResult.status === 'rejected') {
      unavailable.push('stories');
    }
  } else {
    unavailable.push('activity');
  }

  // ── Decisions ──────────────────────────────────────────────────────────────
  let decisionsCount: number | null = null;
  if (decisionsResult.status === 'fulfilled') {
    decisionsCount = decisionsResult.value;
  } else {
    unavailable.push('decisions');
  }

  // ── Brain ──────────────────────────────────────────────────────────────────
  let brain: BrainStatus | null = null;
  if (brainResult.status === 'fulfilled') {
    brain = brainResult.value;
  } else {
    unavailable.push('brain');
  }

  // ── isEmpty detection ──────────────────────────────────────────────────────
  // isEmpty = true only when all sources are available but genuinely have no data
  const hasCommits = activity !== null && activity.commits.length > 0;
  const hasDoneStories = activity !== null && activity.recentDoneStories.length > 0;
  const hasDecisions = decisionsCount !== null && decisionsCount > 0;

  const allUnavailable = activity === null && decisionsCount === null && brain === null;
  const isEmpty =
    !allUnavailable &&
    !hasCommits &&
    !hasDoneStories &&
    !hasDecisions;

  return {
    isEmpty,
    activity,
    decisionsCount,
    brain,
    generatedAt: new Date().toISOString(),
    unavailable,
  };
}
