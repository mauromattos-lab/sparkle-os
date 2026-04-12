// Lifecycle Service — Story 3.7
// Manages stale detection, duplicate resolution, and archival of rejected insights.

import {
  markStaleRawInsights,
  markStaleValidatedInsights,
  archiveOldRejectedInsights,
  countUnresolvedDuplicates,
  listDuplicateInsights,
  listPendingInsights,
  keepDuplicateInsight,
  rejectInsight,
  findInsightById,
  type PendingReason,
} from '../db/insights.js';
import { LIFECYCLE_CONFIG } from '../config/lifecycle.config.js';
import type { LifecycleReport, DuplicateGroup, PendingItem } from '../types/lifecycle.js';
import type { Insight } from '../types/insight.js';

/**
 * Detects and marks stale raw insights and stale validated insights.
 * Uses SQL-level idempotency (array_append only if tag not present).
 */
export async function detectStaleInsights(): Promise<{
  staleRawCount: number;
  staleValidatedCount: number;
}> {
  const [staleRawCount, staleValidatedCount] = await Promise.all([
    markStaleRawInsights(LIFECYCLE_CONFIG.STALE_RAW_DAYS),
    markStaleValidatedInsights(LIFECYCLE_CONFIG.STALE_VALIDATED_DAYS),
  ]);

  return { staleRawCount, staleValidatedCount };
}

/**
 * Archives old rejected insights (adds 'archived' tag).
 * Idempotent: will not re-archive already archived insights.
 */
export async function archiveOldRejected(): Promise<number> {
  return archiveOldRejectedInsights(LIFECYCLE_CONFIG.ARCHIVE_REJECTED_DAYS);
}

/**
 * Runs the full lifecycle cycle.
 * Returns a LifecycleReport with counts of all actions taken.
 * Idempotent: running multiple times produces the same final state.
 */
export async function runLifecycleCycle(): Promise<LifecycleReport> {
  const runAt = new Date().toISOString();

  const [{ staleRawCount, staleValidatedCount }, archivedRejected, unresolvedDuplicates] =
    await Promise.all([
      detectStaleInsights(),
      archiveOldRejected(),
      countUnresolvedDuplicates(),
    ]);

  const totalPendingReview = staleRawCount + staleValidatedCount + unresolvedDuplicates;

  return {
    runAt,
    staleRawDetected: staleRawCount,
    staleValidatedDetected: staleValidatedCount,
    archivedRejected,
    unresolvedDuplicates,
    totalPendingReview,
  };
}

/**
 * Lists duplicate insights grouped by their canonical insight.
 * Groups all duplicates (isDuplicate=true) by canonicalId.
 */
export async function listDuplicateGroups(
  page: number,
  limit: number,
): Promise<{ duplicates: DuplicateGroup[]; total: number }> {
  const { data: duplicates, total } = await listDuplicateInsights(page, limit);

  // Group duplicates by canonicalId
  const groupMap = new Map<string, Insight[]>();
  for (const dup of duplicates) {
    if (!dup.canonicalId) continue;
    const existing = groupMap.get(dup.canonicalId);
    if (existing) {
      existing.push(dup);
    } else {
      groupMap.set(dup.canonicalId, [dup]);
    }
  }

  // Resolve canonical insights
  const groups: DuplicateGroup[] = [];
  for (const [canonicalId, dups] of groupMap) {
    const canonical = await findInsightById(canonicalId);
    if (!canonical) continue;

    groups.push({
      canonical,
      duplicates: dups.map((d) => ({
        ...d,
        similarityScore: d.similarityScore ?? 0,
      })),
    });
  }

  return { duplicates: groups, total };
}

/**
 * Resolves a duplicate insight.
 * - keep: promotes the insight to independent (isDuplicate=false, canonicalId=null)
 * - reject: rejects the insight with auto-generated reason referencing canonicalId
 */
export async function resolveDuplicate(
  id: string,
  action: 'keep' | 'reject',
): Promise<Insight | null> {
  const insight = await findInsightById(id);
  if (!insight) return null;

  if (action === 'keep') {
    return keepDuplicateInsight(id);
  }

  // action === 'reject'
  const reason = `Duplicata de ${insight.canonicalId ?? 'unknown'} — ciclo de vida`;
  return rejectInsight(id, reason);
}

/**
 * Lists pending insights requiring human attention.
 * Includes: stale raw, stale validated, unresolved duplicates.
 * Optionally filter by reason type.
 */
export async function listPendingItems(
  page: number,
  limit: number,
  reason?: PendingReason,
): Promise<{ items: PendingItem[]; total: number; page: number }> {
  const { data, total } = await listPendingInsights(page, limit, reason);

  const items: PendingItem[] = data.map((item) => {
    const pendingItem: PendingItem = {
      insight: item,
      reason: item.pendingReason,
    };

    // Add staleSinceDate based on reason
    if (item.pendingReason === 'stale_raw') {
      pendingItem.staleSinceDate = item.createdAt;
    } else if (item.pendingReason === 'stale_validated') {
      pendingItem.staleSinceDate = item.validatedAt ?? item.createdAt;
    }

    return pendingItem;
  });

  return { items, total, page };
}
