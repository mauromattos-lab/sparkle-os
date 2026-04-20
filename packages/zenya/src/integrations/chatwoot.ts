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
 * Uses /toggle_typing_status (fazer.ai Chatwoot fork endpoint).
 * mode: 'typing' = text indicator, 'recording' = audio indicator, 'off' = clear both
 */
export async function setTypingStatus(
  params: ChatwootParams,
  status: 'on' | 'off',
  mode: 'typing' | 'recording' = 'typing',
): Promise<void> {
  // Chatwoot fazer.ai fork: 'on' for text typing, 'recording' for audio, 'off' to clear
  const typing_status = status === 'off' ? 'off' : mode === 'recording' ? 'recording' : 'on';
  const res = await fetch(apiUrl(params, '/toggle_typing_status'), {
    method: 'POST',
    headers: headers(params.token),
    body: JSON.stringify({ typing_status }),
  });
  // Typing status failure is non-critical — log but don't throw
  if (!res.ok) {
    console.warn(`[zenya] setTypingStatus ${typing_status} failed (${res.status}) — non-critical`);
  }
}

/**
 * Sends an audio file as an attachment to the conversation.
 * Uses multipart/form-data — no Content-Type header (browser sets boundary).
 */
export async function sendAudioMessage(params: ChatwootParams, audioBuffer: Buffer): Promise<void> {
  const formData = new FormData();
  formData.append(
    'attachments[]',
    new Blob([audioBuffer], { type: 'audio/mpeg' }),
    'response.mp3',
  );
  formData.append('message_type', 'outgoing');
  formData.append('content', '');

  const res = await fetch(apiUrl(params, '/messages'), {
    method: 'POST',
    headers: { 'api_access_token': params.token }, // no Content-Type — FormData sets it
    body: formData,
  });
  await assertOk(res, 'sendAudioMessage');
}

/**
 * Searches for a contact by phone number and returns their audio preference.
 * Returns 'audio' | 'texto' | null (null = not set, default to texto).
 */
export async function getContactAudioPreference(
  params: Omit<ChatwootParams, 'conversationId'>,
  phone: string,
): Promise<'audio' | 'texto' | null> {
  const res = await fetch(
    `${params.url}/api/v1/accounts/${params.accountId}/contacts/search?q=${encodeURIComponent(phone)}&include_contacts=true`,
    { headers: { 'api_access_token': params.token, 'Content-Type': 'application/json' } },
  );
  if (!res.ok) return null;

  const body = (await res.json()) as { payload?: Array<{ additional_attributes?: Record<string, unknown> }> };
  const contact = body.payload?.[0];
  const pref = contact?.additional_attributes?.['preferencia_audio_texto'];
  if (pref === 'audio' || pref === 'texto') return pref;
  return null;
}

/**
 * Updates the audio preference attribute for a contact.
 */
export async function setContactAudioPreference(
  params: Omit<ChatwootParams, 'conversationId'>,
  phone: string,
  preference: 'audio' | 'texto',
): Promise<void> {
  // First, find the contact id
  const searchRes = await fetch(
    `${params.url}/api/v1/accounts/${params.accountId}/contacts/search?q=${encodeURIComponent(phone)}`,
    { headers: { 'api_access_token': params.token, 'Content-Type': 'application/json' } },
  );
  if (!searchRes.ok) throw new Error(`Chatwoot contact search failed (${searchRes.status})`);

  const searchBody = (await searchRes.json()) as { payload?: Array<{ id: number }> };
  const contactId = searchBody.payload?.[0]?.id;
  if (!contactId) throw new Error(`Contact not found for phone: ${phone}`);

  const res = await fetch(
    `${params.url}/api/v1/accounts/${params.accountId}/contacts/${contactId}`,
    {
      method: 'PATCH',
      headers: { 'api_access_token': params.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        additional_attributes: { preferencia_audio_texto: preference },
      }),
    },
  );
  await assertOk(res, 'setContactAudioPreference');
}

/**
 * Marks all messages in the conversation as read (updates agent's last_seen_at).
 * Called at the start of processing so the user sees the "read" receipt.
 */
export async function markConversationRead(params: ChatwootParams): Promise<void> {
  const res = await fetch(apiUrl(params, '/update_last_seen'), {
    method: 'POST',
    headers: headers(params.token),
    body: JSON.stringify({}),
  });
  // Non-critical — log but don't throw
  if (!res.ok) {
    console.warn(`[zenya] markConversationRead failed (${res.status}) — non-critical`);
  }
}

/** Builds ChatwootParams from environment variables + runtime IDs. */
export function getChatwootParams(accountId: string, conversationId: string): ChatwootParams {
  const url = process.env['CHATWOOT_BASE_URL'];
  const token = process.env['CHATWOOT_API_TOKEN'];
  if (!url || !token) {
    throw new Error('CHATWOOT_BASE_URL and CHATWOOT_API_TOKEN env vars are required');
  }
  return { url, accountId, conversationId, token };
}
