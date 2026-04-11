export interface WorkState {
  currentTask: string;
  filesModified: string[];
  nextAction: string;
  blockers: string[];
}

export interface DecisionEntry {
  decision: string;
  rationale: string;
  alternatives?: string[];
  timestamp: string;
}

export interface AgentContext {
  id: string;
  agentId: string;
  sessionId: string;
  storyId: string | null;
  workState: WorkState;
  decisionLog: DecisionEntry[];
  createdAt: string;
  updatedAt: string;
}

export type SaveContextInput = Omit<AgentContext, 'id' | 'createdAt' | 'updatedAt'>;
