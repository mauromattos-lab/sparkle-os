// Chatwoot integration — sends messages, labels, and typing indicators
// Uses REST API over HTTPS (no SDK dependency)

export interface ChatwootParams {
  url: string;
  accountId: string;
  conversationId: string;
  token: string;
}

function apiUrl(params: ChatwootParams, path: string): string {
  return `${params.url}/api/v1/accounts/${params.accountId}/conversations/${params.conversationId}${path}`;
}

function headers(token: string): Record<string, string> {
  return {
    'api_access_token': token,
    'Content-Type': 'application/json',
  };
}

async function assertOk(res: Response, operation: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Chatwoot ${operation} failed (${res.status}): ${body}`);
  }
}

/**
 * Sends an outgoing text message to the conversation.
 */
export async function sendMessage(params: ChatwootParams, content: string): Promise<void> {
  const res = await fetch(apiUrl(params, '/messages'), {
    method: 'POST',
    headers: headers(params.token),
    body: JSON.stringify({ content, message_type: 'outgoing', private: false }),
  });
  await assertOk(res, 'sendMessage');
}

/**
 * Adds a label to the conversation (e.g. 'agente-off' to disable the bot).
 */
export async function addLabel(params: ChatwootParams, label: string): Promise<void> {
  // First fetch existing labels to avoid overwriting them
  const getRes = await fetch(apiUrl(params, '/labels'), {
    headers: headers(params.token),
  });

  let existingLabels: string[] = [];
  if (getRes.ok) {
    const body = (await getRes.json()) as { payload?: string[] };
    existingLabels = body.payload ?? [];
  }

  if (existingLabels.includes(label)) return; // already set

  const res = await fetch(apiUrl(params, '/labels'), {
    method: 'POST',
    headers: headers(params.token),
    body: JSON.stringify({ labels: [...existingLabels, label] }),
  });
  await assertOk(res, 'addLabel');
}

/**
 * Sets typing status for the bot in the conversation.
 */
export async function setTypingStatus(
  params: ChatwootParams,
  status: 'on' | 'off',
): Promise<void> {
  const res = await fetch(apiUrl(params, '/typing_status'), {
    method: 'POST',
    headers: headers(params.token),
    body: JSON.stringify({ typing_status: status }),
  });
  // Typing status failure is non-critical — log but don't throw
  if (!res.ok) {
    console.warn(`[zenya] setTypingStatus ${status} failed (${res.status}) — non-critical`);
  }
}

/** Builds ChatwootParams from environment variables + runtime IDs. */
export function getChatwootParams(accountId: string, conversationId: string): ChatwootParams {
  const url = process.env['CHATWOOT_URL'];
  const token = process.env['CHATWOOT_TOKEN'];
  if (!url || !token) {
    throw new Error('CHATWOOT_URL and CHATWOOT_TOKEN env vars are required');
  }
  return { url, accountId, conversationId, token };
}
