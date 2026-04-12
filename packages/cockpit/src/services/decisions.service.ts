// Decisions service — wrapper around @sparkle-os/core listPendingDecisions()
// Implements graceful degradation: returns [] if core is unavailable (port 5432 blocked)

import type { PendingDecision } from '@sparkle-os/core';

export type { PendingDecision };

export interface DecisionsDashboard {
  decisions: PendingDecision[];
  count: number;
  coreAvailable: boolean;
  error: string | null;
}

/**
 * Fetches pending decisions from @sparkle-os/core.
 * Graceful degradation: if the core fails (e.g. port 5432 blocked),
 * returns an empty list with coreAvailable=false. Never throws.
 */
export async function getDecisionsDashboard(): Promise<DecisionsDashboard> {
  try {
    const { listPendingDecisions } = await import('@sparkle-os/core');
    const decisions = await listPendingDecisions();
    return {
      decisions,
      count: decisions.length,
      coreAvailable: true,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[cockpit:decisions] Core unavailable — graceful degradation:', message);
    return {
      decisions: [],
      count: 0,
      coreAvailable: false,
      error: message,
    };
  }
}

/**
 * Returns only the count of pending decisions.
 * Used by Story 4.8 (summary panel) and the shell badge.
 * Returns 0 if core is unavailable.
 */
export async function getDecisionsCount(): Promise<number> {
  const dashboard = await getDecisionsDashboard();
  return dashboard.count;
}
