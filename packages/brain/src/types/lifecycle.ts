// Lifecycle types — Story 3.7
import type { Insight } from './insight.js';

export interface LifecycleReport {
  runAt: string;                     // ISO 8601
  staleRawDetected: number;          // insights raw marked as stale
  staleValidatedDetected: number;    // insights validated marked as stale
  archivedRejected: number;          // insights rejected marked as archived
  unresolvedDuplicates: number;      // duplicates pending resolution
  totalPendingReview: number;        // total in pending queue
}

export interface DuplicateGroup {
  canonical: Insight;
  duplicates: Array<Insight & { similarityScore: number }>;
}

export interface PendingItem {
  insight: Insight;
  reason: 'stale_raw' | 'stale_validated' | 'unresolved_duplicate';
  staleSinceDate?: string; // createdAt or validatedAt relevant to this stale reason
}
