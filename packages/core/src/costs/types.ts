export type OperationType =
  | 'llm_input'
  | 'llm_output'
  | 'embedding'
  | 'web_search'
  | 'storage_read'
  | 'storage_write';

export interface CostEvent {
  id: string;
  agentId: string;
  operationType: OperationType;
  model: string | null;
  units: number;
  unitCost: number;
  totalCost: number;
  storyId: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RecordCostInput {
  agentId: string;
  operationType: OperationType;
  model?: string;
  units: number;
  unitCost: number;
  storyId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface CostSummary {
  period: string;
  totalCost: number;
  byOperationType: Record<string, number>;
  eventCount: number;
}

export interface AgentCostSummary {
  agentId: string;
  totalCost: number;
  byOperationType: Record<string, number>;
  eventCount: number;
}

export interface BudgetStatus {
  monthlyBudgetUsd: number;
  currentMonthCost: number;
  remainingBudget: number;
  percentUsed: number;
  alertThreshold: number;
  isAlertTriggered: boolean;
}
