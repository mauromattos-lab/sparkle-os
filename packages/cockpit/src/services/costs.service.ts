// Costs Service — aggregates cost data from @sparkle-os/core
// Used by the Costs panel to display spending vs. budget

import type { CostSummary, AgentCostSummary, BudgetStatus } from '@sparkle-os/core';
import { getCostSummary, getCostByAgent, getBudgetStatus } from '@sparkle-os/core';

export type { CostSummary, AgentCostSummary, BudgetStatus };

export type BudgetIndicator = 'green' | 'yellow' | 'red';

export interface CostsDashboard {
  summary: CostSummary;
  agentBreakdown: AgentCostSummary[];
  budget: BudgetStatus;
  indicator: BudgetIndicator;
  available: boolean;
}

const EMPTY_SUMMARY: CostSummary = {
  period: '',
  totalCost: 0,
  byOperationType: {},
  eventCount: 0,
};

const EMPTY_BUDGET: BudgetStatus = {
  monthlyBudgetUsd: 550,
  currentMonthCost: 0,
  remainingBudget: 550,
  percentUsed: 0,
  alertThreshold: 0.9,
  isAlertTriggered: false,
};

/**
 * Returns a budget color indicator based on percentUsed:
 *   < 0.8  → green  (OK)
 *   0.8–1  → yellow (attention)
 *   > 1    → red    (exceeded)
 */
export function getBudgetIndicator(percentUsed: number): BudgetIndicator {
  if (percentUsed >= 1) return 'red';
  if (percentUsed >= 0.8) return 'yellow';
  return 'green';
}

/**
 * Fetches all cost data in parallel from @sparkle-os/core.
 * Applies graceful degradation: if core is unavailable (e.g. DB connection
 * refused on port 5432), returns an empty but valid dashboard state.
 */
export async function getCostsDashboard(): Promise<CostsDashboard> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [summary, agentBreakdown, budget] = await Promise.all([
      getCostSummary('monthly', today),
      getCostByAgent('monthly', today),
      getBudgetStatus(),
    ]);

    return {
      summary,
      agentBreakdown,
      budget,
      indicator: getBudgetIndicator(budget.percentUsed),
      available: true,
    };
  } catch {
    // DB unavailable or core connection error — return empty valid state
    return {
      summary: EMPTY_SUMMARY,
      agentBreakdown: [],
      budget: EMPTY_BUDGET,
      indicator: 'green',
      available: false,
    };
  }
}
