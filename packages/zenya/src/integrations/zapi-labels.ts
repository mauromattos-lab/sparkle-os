// Z-API labels integration — manages native WhatsApp Business labels per conversation
// SECURITY: credentials are passed in, never logged
// GRACEFUL DEGRADATION: callers must wrap in try/catch — errors are non-critical

const ZAPI_BASE_URL = 'https://api.z-api.io';

export interface ZApiCredentials {
  instanceId: string;
  token: string;
  clientToken: string;
  /** Optional WhatsApp Business label IDs, populated by setup-zapi-labels.mjs */
  labels?: {
    /** Numeric ID of the "humano" label in this WhatsApp Business account */
    humano?: string;
  };
}

/**
 * Normalizes a phone number to the format expected by Z-API (no leading +).
 * Input: "+5531999998888" → Output: "5531999998888"
 */
function normalizePhone(phone: string): string {
  return phone.replace(/^\+/, '');
}

function zapiHeaders(clientToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'client-token': clientToken,
  };
}

async function assertOk(res: Response, operation: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Z-API ${operation} failed (${res.status}): ${body}`);
  }
}

/**
 * Assigns a label to a WhatsApp Business chat.
 * Requires the instance to be connected in Multi-Devices mode.
 *
 * @param phone  - Customer phone number (e.g. "+5531999998888" or "5531999998888")
 * @param labelId - Numeric label ID from Z-API (stored in credentials.labels)
 * @param creds  - Z-API instance credentials
 * @throws Error if the API call fails — callers should catch and treat as non-critical
 */
export async function zapiAddLabel(
  phone: string,
  labelId: string,
  creds: ZApiCredentials,
): Promise<void> {
  // POST /chats/{phone}/tags/{labelId} — no body, tag ID in path
  const url = `${ZAPI_BASE_URL}/instances/${creds.instanceId}/token/${creds.token}/chats/${normalizePhone(phone)}/tags/${labelId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: zapiHeaders(creds.clientToken),
  });
  await assertOk(res, 'chats/tags');
}

/**
 * Removes a label from a WhatsApp Business chat.
 * Requires the instance to be connected in Multi-Devices mode.
 *
 * @param phone  - Customer phone number (e.g. "+5531999998888" or "5531999998888")
 * @param labelId - Numeric label ID from Z-API (stored in credentials.labels)
 * @param creds  - Z-API instance credentials
 * @throws Error if the API call fails — callers should catch and treat as non-critical
 */
export async function zapiRemoveLabel(
  phone: string,
  labelId: string,
  creds: ZApiCredentials,
): Promise<void> {
  // DELETE /chats/{phone}/tags/{labelId} — no body, tag ID in path
  const url = `${ZAPI_BASE_URL}/instances/${creds.instanceId}/token/${creds.token}/chats/${normalizePhone(phone)}/tags/${labelId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: zapiHeaders(creds.clientToken),
  });
  await assertOk(res, 'chats/tags/delete');
}
