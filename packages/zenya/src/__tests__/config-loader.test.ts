import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from '../db/client.js';
import {
  loadTenantConfig,
  loadTenantByAccountId,
  clearTenantCache,
} from '../tenant/config-loader.js';

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const TENANT = {
  id: 'uuid-tenant-1',
  name: 'Acme Corp',
  system_prompt: 'Você é uma atendente...',
  active_tools: ['escalar_humano', 'google_calendar'],
  chatwoot_account_id: 'acct-42',
};

beforeEach(() => {
  vi.clearAllMocks();
  clearTenantCache();
  vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
  mockSingle.mockResolvedValue({ data: TENANT, error: null });
});

describe('loadTenantConfig', () => {
  it('fetches tenant by UUID from Supabase', async () => {
    const config = await loadTenantConfig('uuid-tenant-1');
    expect(config.id).toBe('uuid-tenant-1');
    expect(config.name).toBe('Acme Corp');
    expect(config.active_tools).toEqual(['escalar_humano', 'google_calendar']);
    expect(mockFrom).toHaveBeenCalledWith('zenya_tenants');
  });

  it('caches the result — second call does not hit DB', async () => {
    await loadTenantConfig('uuid-tenant-1');
    await loadTenantConfig('uuid-tenant-1');
    expect(mockSingle).toHaveBeenCalledOnce();
  });

  it('throws when tenant is not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    await expect(loadTenantConfig('bad-id')).rejects.toThrow('Tenant not found');
  });
});

describe('loadTenantByAccountId', () => {
  it('fetches tenant by chatwoot account_id', async () => {
    const config = await loadTenantByAccountId('acct-42');
    expect(config.chatwoot_account_id).toBe('acct-42');
    expect(config.id).toBe('uuid-tenant-1');
  });

  it('caches by both id and account_id — subsequent loadTenantConfig hits cache', async () => {
    await loadTenantByAccountId('acct-42');
    // Now loadTenantConfig for same tenant should use cache
    await loadTenantConfig('uuid-tenant-1');
    // Only one DB call (from loadTenantByAccountId)
    expect(mockSingle).toHaveBeenCalledOnce();
  });

  it('throws when account_id maps to no tenant', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } });
    await expect(loadTenantByAccountId('unknown')).rejects.toThrow('No tenant for Chatwoot account_id');
  });
});

describe('clearTenantCache', () => {
  it('forces re-fetch after cache is cleared', async () => {
    await loadTenantConfig('uuid-tenant-1');
    clearTenantCache();
    await loadTenantConfig('uuid-tenant-1');
    expect(mockSingle).toHaveBeenCalledTimes(2);
  });
});
