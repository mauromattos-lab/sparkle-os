import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client before module load
vi.mock('../db/client.js', () => ({
  getSupabase: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'tenant-cleanup-01', chatwoot_account_id: '100' }],
      }),
    }),
  }),
}));

vi.mock('../integrations/zapi-labels.js', () => ({
  zapiRemoveLabel: vi.fn(),
}));

vi.mock('../tenant/credentials.js', () => ({
  getCredentialJson: vi.fn(),
}));

import { zapiRemoveLabel } from '../integrations/zapi-labels.js';
import { getCredentialJson } from '../tenant/credentials.js';
import { runCleanup } from '../worker/agente-off-cleanup.js';

// Global fetch mock
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Conversation with last_activity_at = 0 (epoch) is always > 72h idle
const OLD_TIMESTAMP = 0;

/** Builds a mock fetch that handles all Chatwoot API calls for a given conversation */
function setupFetchForConversation(conv: {
  id: number;
  phone_number: string | null;
}): void {
  mockFetch.mockImplementation((url: string, opts?: { method?: string }) => {
    // GET conversations with agente-off label (page 1)
    if (url.includes('/conversations') && url.includes('labels[]') && url.includes('page=1')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              payload: [
                {
                  id: conv.id,
                  labels: ['agente-off'],
                  last_activity_at: OLD_TIMESTAMP,
                  meta: { sender: { phone_number: conv.phone_number } },
                },
              ],
            },
          }),
      });
    }
    // GET conversations page 2+ → empty (stop pagination)
    if (url.includes('/conversations') && url.includes('labels[]')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { payload: [] } }),
      });
    }
    // GET messages → empty (getLastAgentMessageAt returns null → falls back to last_activity_at)
    if (url.includes('/messages')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ payload: [] }),
      });
    }
    // POST labels → remove agente-off label
    if (opts?.method === 'POST' && url.includes('/labels')) {
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// TD-7.10-02: Guard — zapiRemoveLabel must NOT be called when phone is null
describe('agente-off-cleanup — guard phone=null (TD-7.10-02)', () => {
  it('não chama zapiRemoveLabel quando phone_number é null', async () => {
    setupFetchForConversation({ id: 42, phone_number: null });

    await runCleanup();

    expect(zapiRemoveLabel).not.toHaveBeenCalled();
  });

  it('não lança exceção quando phone_number é null (non-critical path seguro)', async () => {
    setupFetchForConversation({ id: 42, phone_number: null });

    await expect(runCleanup()).resolves.toBeUndefined();
  });

  it('chama zapiRemoveLabel quando phone_number está presente e labels.humano configurado', async () => {
    setupFetchForConversation({ id: 43, phone_number: '+5531999998888' });
    vi.mocked(getCredentialJson).mockResolvedValue({
      instanceId: 'I',
      token: 'T',
      clientToken: 'C',
      labels: { humano: '10' },
    });
    vi.mocked(zapiRemoveLabel).mockResolvedValue(undefined as never);

    await runCleanup();

    expect(zapiRemoveLabel).toHaveBeenCalledOnce();
    expect(zapiRemoveLabel).toHaveBeenCalledWith('+5531999998888', '10', expect.objectContaining({ instanceId: 'I' }));
  });
});
