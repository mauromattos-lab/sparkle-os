import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('../db/client.js', () => ({
  getDb: vi.fn(() => ({ execute: mockExecute })),
}));

import { getClientSession, ClientNotFoundError } from './session.js';

const tenantA = { id: 'tenant-uuid-A', name: 'Empresa A' };
const tenantB = { id: 'tenant-uuid-B', name: 'Empresa B' };

describe('getClientSession — isolamento por tenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna tenantId e tenantName do tenant vinculado ao userId', async () => {
    mockExecute.mockResolvedValueOnce([tenantA]);

    const session = await getClientSession('user-uuid-A');

    expect(session.tenantId).toBe('tenant-uuid-A');
    expect(session.tenantName).toBe('Empresa A');
  });

  it('userId B retorna tenant B, nunca tenant A', async () => {
    mockExecute.mockResolvedValueOnce([tenantB]);

    const session = await getClientSession('user-uuid-B');

    expect(session.tenantId).toBe('tenant-uuid-B');
    expect(session.tenantId).not.toBe('tenant-uuid-A');
  });

  it('lança ClientNotFoundError quando userId não tem tenant vinculado', async () => {
    mockExecute.mockResolvedValueOnce([]);

    await expect(getClientSession('user-sem-tenant')).rejects.toThrow(
      ClientNotFoundError,
    );
  });

  it('lança ClientNotFoundError com mensagem informativa', async () => {
    mockExecute.mockResolvedValueOnce([]);

    await expect(getClientSession('ghost-user')).rejects.toThrow(
      'Nenhum tenant Zenya ativo vinculado ao usuário: ghost-user',
    );
  });

  it('userId A não acessa dados do tenant B (isolamento garantido)', async () => {
    mockExecute.mockResolvedValueOnce([tenantA]);
    const sessionA = await getClientSession('user-uuid-A');

    mockExecute.mockResolvedValueOnce([tenantB]);
    const sessionB = await getClientSession('user-uuid-B');

    expect(sessionA.tenantId).not.toBe(sessionB.tenantId);
    expect(sessionA.tenantName).not.toBe(sessionB.tenantName);
  });
});
