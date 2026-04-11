export type DecisionPriority = 'urgent' | 'normal' | 'low';
export type DecisionStatus = 'pending' | 'resolved' | 'deferred';

export interface DecisionOption {
  label: string;
  description: string;
  recommendation: boolean;
  pros: string[];
  cons: string[];
}

export interface PendingDecision {
  id: string;
  title: string;
  context: string;
  options: DecisionOption[];
  requestedBy: string;
  storyId: string | null;
  priority: DecisionPriority;
  status: DecisionStatus;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateDecisionInput {
  title: string;
  context: string;
  options: DecisionOption[];
  requestedBy: string;
  storyId?: string;
  priority?: DecisionPriority;
}

export interface ResolveDecisionInput {
  resolution: string;
  status?: 'resolved' | 'deferred';
}
