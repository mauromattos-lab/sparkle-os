export type AdrStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded';

export interface ADR {
  id: string;
  number: number;
  title: string;
  status: AdrStatus;
  context: string | null;
  decision: string | null;
  rationale: string | null;
  alternatives: string[];
  consequences: string | null;
  createdBy: string | null;
  storyId: string | null;
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdrInput {
  title: string;
  status?: AdrStatus;
  context?: string;
  decision?: string;
  rationale?: string;
  alternatives?: string[];
  consequences?: string;
  createdBy?: string;
  storyId?: string;
}
