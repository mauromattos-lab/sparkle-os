import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZenyaChatwootClient } from './client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockInbox: { id: number; name: string; channel_type: string } = {
  id: 42,
  name: 'Acme Corp',
  channel_type: 'Channel::Api',
};

describe('ZenyaChatwootClient', () => {
  let client: ZenyaChatwootClient;

  beforeEach(() => {
    vi.resetAllMocks();
    client = new ZenyaChatwootClient(
      'https://chat.fazer.ai',
      'test-user-token',
      '1',
    );
  });

  describe('createInbox()', () => {
    it('retorna inbox criado no happy path', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockInbox });

      const result = await client.createInbox('Acme Corp');

      expect(result.id).toBe(42);
      expect(result.name).toBe('Acme Corp');
    });

    it('envia POST com body e headers corretos', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockInbox });

      await client.createInbox('Acme Corp');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://chat.fazer.ai/api/v1/accounts/1/inboxes',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ api_access_token: 'test-user-token' }) as unknown,
          body: JSON.stringify({ name: 'Acme Corp', channel: { type: 'api' } }),
        }),
      );
    });

    it('lança erro quando API retorna status não-ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });

      await expect(client.createInbox('Acme Corp')).rejects.toThrow(
        'Chatwoot API error creating inbox: 401 Unauthorized',
      );
    });
  });

  describe('deleteInbox()', () => {
    it('executa DELETE no endpoint correto', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.deleteInbox(42);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://chat.fazer.ai/api/v1/accounts/1/inboxes/42',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('lança erro quando delete falha', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

      await expect(client.deleteInbox(99)).rejects.toThrow(
        'Chatwoot API error deleting inbox 99: 404 Not Found',
      );
    });
  });
});
