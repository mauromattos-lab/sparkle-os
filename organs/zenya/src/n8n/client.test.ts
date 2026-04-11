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

  describe('cloneWorkflow()', () => {
    const mockFullWorkflow = {
      id: 'r3C1FMc6NIi6eCGI',
      name: '01. Secretária v3',
      active: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      nodes: [{ type: 'n8n-nodes-base.start' }],
      connections: {},
      settings: {},
    };

    const mockClonedWorkflow = {
      id: 'new-workflow-id',
      name: 'Acme Corp - Secretária v3',
      active: false,
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    };

    it('busca o template e cria um novo workflow com nome alterado', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockFullWorkflow })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClonedWorkflow });

      const result = await client.cloneWorkflow('r3C1FMc6NIi6eCGI', 'Acme Corp - Secretária v3');

      expect(result.id).toBe('new-workflow-id');
      expect(result.name).toBe('Acme Corp - Secretária v3');
    });

    it('POST de criação não inclui o id do template', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockFullWorkflow })
        .mockResolvedValueOnce({ ok: true, json: async () => mockClonedWorkflow });

      await client.cloneWorkflow('r3C1FMc6NIi6eCGI', 'Acme Corp - Secretária v3');

      const postCall = mockFetch.mock.calls[1];
      const postBody = JSON.parse(postCall?.[1]?.body as string) as Record<string, unknown>;
      expect(postBody['id']).toBeUndefined();
      expect(postBody['name']).toBe('Acme Corp - Secretária v3');
      expect(postBody['active']).toBe(false);
    });

    it('lança erro quando fetch do template falha', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

      await expect(
        client.cloneWorkflow('id-invalido', 'Clone'),
      ).rejects.toThrow('n8n API error fetching template id-invalido: 404 Not Found');
    });

    it('lança erro quando criação do clone falha', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockFullWorkflow })
        .mockResolvedValueOnce({ ok: false, status: 400, statusText: 'Bad Request' });

      await expect(
        client.cloneWorkflow('r3C1FMc6NIi6eCGI', 'Clone'),
      ).rejects.toThrow('n8n API error creating clone: 400 Bad Request');
    });
  });

  describe('deleteWorkflow()', () => {
    it('executa DELETE no endpoint correto', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.deleteWorkflow('workflow-to-delete');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5678/api/v1/workflows/workflow-to-delete',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('lança erro quando delete falha', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

      await expect(client.deleteWorkflow('id-inexistente')).rejects.toThrow(
        'n8n API error deleting workflow id-inexistente: 404 Not Found',
      );
    });
  });
});
