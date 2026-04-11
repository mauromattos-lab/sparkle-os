// ZenyaN8nClient — cliente REST para a API do n8n
// Validação live contra n8n real está em Story 2.4.
// Esta implementação é testada com mock HTTP em client.test.ts.
//
// Nota (Story 2.4 — Task 1): A API v1 do n8n não possui endpoint /duplicate.
// Clone é implementado via GET + POST: busca o workflow completo e cria um novo
// com nome alterado e active: false. Credenciais NÃO são preservadas no clone —
// reconfiguração manual obrigatória (documentada em sop-provisionar-cliente-zenya.md).

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface N8nWorkflowFull extends N8nWorkflow {
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  staticData?: unknown;
  tags?: unknown[];
}

export interface N8nWorkflowListResponse {
  data: N8nWorkflow[];
  nextCursor: string | null;
}

export class ZenyaN8nClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    baseUrl = process.env['N8N_BASE_URL'] ?? 'http://localhost:5678/api/v1',
    apiKey = process.env['N8N_API_KEY'] ?? '',
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      'X-N8N-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async listWorkflows(): Promise<N8nWorkflow[]> {
    const response = await fetch(`${this.baseUrl}/workflows`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as N8nWorkflowListResponse;
    return body.data;
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await fetch(`${this.baseUrl}/workflows/${id}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as N8nWorkflow;
  }

  async cloneWorkflow(templateId: string, newName: string): Promise<N8nWorkflow> {
    // Step 1: fetch the full workflow (nodes, connections, settings)
    const getResponse = await fetch(`${this.baseUrl}/workflows/${templateId}`, {
      headers: this.headers,
    });

    if (!getResponse.ok) {
      throw new Error(
        `n8n API error fetching template ${templateId}: ${getResponse.status} ${getResponse.statusText}`,
      );
    }

    const template = (await getResponse.json()) as N8nWorkflowFull;

    // Step 2: POST as new workflow with updated name and inactive state
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...workflowData } = template;
    const cloneBody = { ...workflowData, name: newName, active: false };

    const postResponse = await fetch(`${this.baseUrl}/workflows`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(cloneBody),
    });

    if (!postResponse.ok) {
      throw new Error(
        `n8n API error creating clone: ${postResponse.status} ${postResponse.statusText}`,
      );
    }

    return (await postResponse.json()) as N8nWorkflow;
  }

  async deleteWorkflow(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workflows/${id}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(
        `n8n API error deleting workflow ${id}: ${response.status} ${response.statusText}`,
      );
    }
  }
}
