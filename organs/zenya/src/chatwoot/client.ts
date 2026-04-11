// ZenyaChatwootClient — cliente REST para a API do Chatwoot (fazer.ai)
// Nota (Story 2.4 — Task 1): endpoint confirmado: POST /api/v1/accounts/{accountId}/inboxes
// com body { name, channel: { type: "api" } } para inbox genérico.
// Conexão Z-API (WhatsApp) é configurada manualmente por Mauro após provisionamento — OUT de scope.

export interface ChatwootInbox {
  id: number;
  name: string;
  channel_type: string;
}

export class ZenyaChatwootClient {
  private readonly baseUrl: string;
  private readonly userToken: string;
  private readonly accountId: string;

  constructor(
    baseUrl = process.env['CHATWOOT_BASE_URL'] ?? '',
    userToken = process.env['CHATWOOT_USER_TOKEN'] ?? '',
    accountId = process.env['CHATWOOT_ACCOUNT_ID'] ?? '',
  ) {
    this.baseUrl = baseUrl;
    this.userToken = userToken;
    this.accountId = accountId;
  }

  private get headers(): Record<string, string> {
    return {
      api_access_token: this.userToken,
      'Content-Type': 'application/json',
    };
  }

  async createInbox(name: string): Promise<ChatwootInbox> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/accounts/${this.accountId}/inboxes`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ name, channel: { type: 'api' } }),
      },
    );

    if (!response.ok) {
      throw new Error(`Chatwoot API error creating inbox: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as ChatwootInbox;
  }

  async deleteInbox(inboxId: number): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/accounts/${this.accountId}/inboxes/${inboxId}`,
      {
        method: 'DELETE',
        headers: this.headers,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Chatwoot API error deleting inbox ${inboxId}: ${response.status} ${response.statusText}`,
      );
    }
  }
}
