export type FlowStatus = 'active' | 'inactive' | 'paused';

export type FlowCategory =
  | 'atendimento'
  | 'utilitário'
  | 'notificação'
  | 'handoff'
  | 'admin'
  | 'setup';

export interface ZenyaFlow {
  id: string;
  name: string;
  category: FlowCategory;
  status: FlowStatus;
  description?: string;
  dependencies?: string[];
}
