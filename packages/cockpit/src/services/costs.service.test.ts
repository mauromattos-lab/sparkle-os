// Unit tests for costs.service.ts
// Mocks @sparkle-os/core to avoid real DB connections

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCostsDashboard,
  getBudgetIndicator,
  type CostSummary,
  type AgentCostSummary,
  type BudgetStatus,
} from './costs.service.js';

// ---------------------------------------------------------------------------
// Mock @sparkle-os/core
// ---------------------------------------------------------------------------

vi.mock('@sparkle-os/core', () => ({
  getCostSummary: vi.fn(),
  getCostByAgent: vi.fn(),
  getBudgetStatus: vi.fn(),
}));

import { getCostSummary, getCostByAgent, getBudgetStatus } from '@sparkle-os/core';

const mockGetCostSummary = vi.mocked(getCostSummary);
const mockGetCostByAgent = vi.mocked(getCostByAgent);
const mockGetBudgetStatus = vi.mocked(getBudgetStatus);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SUMMARY: CostSummary = {
  period: 'monthly:2026-04-12',
  totalCost: 120.5,
  byOperationType: { llm_input: 80, llm_output: 40.5 },
  eventCount: 50,
};

const MOCK_AGENTS: AgentCostSummary[] = [
  {
    agentId: 'dev',
    totalCost: 90,
    byOperationType: { llm_input: 60, llm_output: 30 },
    eventCount: 30,
  },
  {
    agentId: 'qa',
    totalCost: 30.5,
    byOperationType: { llm_input: 20, llm_output: 10.5 },
    eventCount: 20,
  },
];

const MOCK_BUDGET_OK: BudgetStatus = {
  monthlyBudgetUsd: 550,
  currentMonthCost: 120.5,
  remainingBudget: 429.5,
  percentUsed: 0.219,
  alertThreshold: 0.9,
  isAlertTriggered: false,
};

const MOCK_BUDGET_WARNING: BudgetStatus = {
  monthlyBudgetUsd: 550,
  currentMonthCost: 450,
  remainingBudget: 100,
  percentUsed: 0.818,
  alertThreshold: 0.9,
  isAlertTriggered: false,
};

const MOCK_BUDGET_EXCEEDED: BudgetStatus = {
  monthlyBudgetUsd: 550,
  currentMonthCost: 600,
  remainingBudget: -50,
  percentUsed: 1.09,
  alertThreshold: 0.9,
  isAlertTriggered: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getBudgetIndicator
// ---------------------------------------------------------------------------

describe('getBudgetIndicator', () => {
  it('returns green when percentUsed is 0 (no spending)', () => {
    expect(getBudgetIndicator(0)).toBe('green');
  });

  it('returns green when percentUsed is below 80%', () => {
    expect(getBudgetIndicator(0.5)).toBe('green');
    expect(getBudgetIndicator(0.799)).toBe('green');
  });

  it('returns yellow at exactly 80%', () => {
    expect(getBudgetIndicator(0.8)).toBe('yellow');
  });

  it('returns yellow when percentUsed is between 80% and 100%', () => {
    expect(getBudgetIndicator(0.9)).toBe('yellow');
    expect(getBudgetIndicator(0.999)).toBe('yellow');
  });

  it('returns red at exactly 100%', () => {
    expect(getBudgetIndicator(1.0)).toBe('red');
  });

  it('returns red when percentUsed exceeds 100%', () => {
    expect(getBudgetIndicator(1.05)).toBe('red');
    expect(getBudgetIndicator(2.0)).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// getCostsDashboard — with data
// ---------------------------------------------------------------------------

describe('getCostsDashboard — with data', () => {
  it('returns dashboard with available=true when core responds normally', async () => {
    mockGetCostSummary.mockResolvedValueOnce(MOCK_SUMMARY);
    mockGetCostByAgent.mockResolvedValueOnce(MOCK_AGENTS);
    mockGetBudgetStatus.mockResolvedValueOnce(MOCK_BUDGET_OK);

    const dashboard = await getCostsDashboard();

    expect(dashboard.available).toBe(true);
    expect(dashboard.summary.totalCost).toBe(120.5);
    expect(dashboard.agentBreakdown).toHaveLength(2);
    expect(dashboard.budget.monthlyBudgetUsd).toBe(550);
    expect(dashboard.indicator).toBe('green');
  });

  it('sets indicator to yellow when budget is between 80% and 100%', async () => {
    mockGetCostSummary.mockResolvedValueOnce(MOCK_SUMMARY);
    mockGetCostByAgent.mockResolvedValueOnce(MOCK_AGENTS);
    mockGetBudgetStatus.mockResolvedValueOnce(MOCK_BUDGET_WARNING);

    const dashboard = await getCostsDashboard();

    expect(dashboard.indicator).toBe('yellow');
    expect(dashboard.available).toBe(true);
  });

  it('sets indicator to red when budget is exceeded', async () => {
    mockGetCostSummary.mockResolvedValueOnce(MOCK_SUMMARY);
    mockGetCostByAgent.mockResolvedValueOnce(MOCK_AGENTS);
    mockGetBudgetStatus.mockResolvedValueOnce(MOCK_BUDGET_EXCEEDED);

    const dashboard = await getCostsDashboard();

    expect(dashboard.indicator).toBe('red');
    expect(dashboard.available).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getCostsDashboard — no data (zeros)
// ---------------------------------------------------------------------------

describe('getCostsDashboard — no data (system new, zeros)', () => {
  it('returns valid dashboard with zeros — not an error state', async () => {
    const emptySummary: CostSummary = {
      period: 'monthly:2026-04-12',
      totalCost: 0,
      byOperationType: {},
      eventCount: 0,
    };
    const emptyBudget: BudgetStatus = {
      monthlyBudgetUsd: 550,
      currentMonthCost: 0,
      remainingBudget: 550,
      percentUsed: 0,
      alertThreshold: 0.9,
      isAlertTriggered: false,
    };

    mockGetCostSummary.mockResolvedValueOnce(emptySummary);
    mockGetCostByAgent.mockResolvedValueOnce([]);
    mockGetBudgetStatus.mockResolvedValueOnce(emptyBudget);

    const dashboard = await getCostsDashboard();

    expect(dashboard.available).toBe(true);
    expect(dashboard.summary.totalCost).toBe(0);
    expect(dashboard.agentBreakdown).toHaveLength(0);
    expect(dashboard.indicator).toBe('green');
  });
});

// ---------------------------------------------------------------------------
// getCostsDashboard — core throws error
// ---------------------------------------------------------------------------

describe('getCostsDashboard — core unavailable', () => {
  it('returns available=false with empty valid state when core throws', async () => {
    mockGetCostSummary.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    mockGetCostByAgent.mockResolvedValueOnce(MOCK_AGENTS);
    mockGetBudgetStatus.mockResolvedValueOnce(MOCK_BUDGET_OK);

    const dashboard = await getCostsDashboard();

    expect(dashboard.available).toBe(false);
    expect(dashboard.summary.totalCost).toBe(0);
    expect(dashboard.agentBreakdown).toHaveLength(0);
    expect(dashboard.indicator).toBe('green');
  });

  it('returns available=false when getBudgetStatus throws', async () => {
    mockGetCostSummary.mockResolvedValueOnce(MOCK_SUMMARY);
    mockGetCostByAgent.mockResolvedValueOnce(MOCK_AGENTS);
    mockGetBudgetStatus.mockRejectedValueOnce(new Error('DB connection timeout'));

    const dashboard = await getCostsDashboard();

    expect(dashboard.available).toBe(false);
    expect(dashboard.summary.totalCost).toBe(0);
  });

  it('returns available=false when getCostByAgent throws', async () => {
    mockGetCostSummary.mockResolvedValueOnce(MOCK_SUMMARY);
    mockGetCostByAgent.mockRejectedValueOnce(new Error('query failed'));
    mockGetBudgetStatus.mockResolvedValueOnce(MOCK_BUDGET_OK);

    const dashboard = await getCostsDashboard();

    expect(dashboard.available).toBe(false);
    expect(dashboard.agentBreakdown).toHaveLength(0);
  });
});
