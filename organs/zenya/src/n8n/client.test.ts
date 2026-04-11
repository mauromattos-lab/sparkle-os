import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZenyaN8nClient } from './client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockWorkflow = {
  id: 'r3C1FMc6NIi6eCGI',
  name: '01. Secretária v3',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('ZenyaN8nClient', () => {
  let client: ZenyaN8nClient;

  beforeEach(() => {
    vi.resetAllMocks();
    client = new ZenyaN8nClient('http://localhost:5678/api/v1', 'test-api-key');
  });

  describe('listWorkflows()', () => {
    it('retorna array de workflows da resposta n8n', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockWorkflow], nextCursor: null }),
      });

      const result = await client.listWorkflows();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('r3C1FMc6NIi6eCGI');
      expect(result[0]?.name).toBe('01. Secretária v3');
    });

    it('lança erro quando a API retorna status não-ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.listWorkflows()).rejects.toThrow('n8n API error: 401 Unauthorized');
    });

    it('envia o header X-N8N-API-KEY correto', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], nextCursor: null }),
      });

      await client.listWorkflows();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5678/api/v1/workflows',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-N8N-API-KEY': 'test-api-key' }) as unknown,
        }),
      );
    });
  });

  describe('getWorkflow()', () => {
    it('retorna workflow específico pelo ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkflow,
      });

      const result = await client.getWorkflow('r3C1FMc6NIi6eCGI');

      expect(result.id).toBe('r3C1FMc6NIi6eCGI');
      expect(result.name).toBe('01. Secretária v3');
    });

    it('lança erro quando workflow não existe', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.getWorkflow('id-invalido')).rejects.toThrow('n8n API error: 404 Not Found');
    });
  });
});
