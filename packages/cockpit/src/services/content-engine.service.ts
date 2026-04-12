// Content Engine Service — reads/writes content_posts via @sparkle-os/core
// Used by the Cockpit Content Engine panel (Story 5.2)

import {
  getPendingPostForToday,
  getRecentPosts,
  updateContentPost,
  type ContentPost,
} from '@sparkle-os/core';

export type { ContentPost };

/** Returns the post awaiting approval today, or null if none */
export async function getPendingPost(clientId = 'plaka'): Promise<ContentPost | null> {
  return getPendingPostForToday(clientId);
}

/** Returns the last 7 days of posts for history panel (AC7) */
export async function getRecentHistory(clientId = 'plaka'): Promise<ContentPost[]> {
  return getRecentPosts(clientId, 7);
}

/** Approve post — sets status to 'aprovado', records timestamp (AC4) */
export async function approvePost(id: string): Promise<ContentPost> {
  return updateContentPost(id, {
    status: 'aprovado',
    approvedAt: new Date(),
  });
}

/**
 * Reject post with note — stores note and resets to 'gerando' so pipeline
 * can re-process with Lyra feedback (AC5)
 */
export async function rejectPost(id: string, note: string): Promise<ContentPost> {
  return updateContentPost(id, {
    status: 'gerando',
    rejectionNote: note,
  });
}
