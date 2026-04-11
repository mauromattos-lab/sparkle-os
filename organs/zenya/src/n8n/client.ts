// ZenyaN8nClient — cliente REST para a API do n8n
// Validação live contra n8n real está em Story 2.4.
// Esta implementação é testada com mock HTTP em client.test.ts.

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
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
}
