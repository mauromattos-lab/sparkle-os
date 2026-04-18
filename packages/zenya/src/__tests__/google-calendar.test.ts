import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock googleapis before imports
vi.mock('googleapis', () => {
  const mockEvents = {
    insert: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  };
  const mockFreebusy = { query: vi.fn() };
  const mockCalendar = { events: mockEvents, freebusy: mockFreebusy };
  const mockOAuth2 = vi.fn().mockImplementation(() => ({
    setCredentials: vi.fn(),
  }));
  return {
    google: {
      auth: { OAuth2: mockOAuth2 },
      calendar: vi.fn().mockReturnValue(mockCalendar),
    },
  };
});

vi.mock('../tenant/credentials.js', () => ({
  getCredentialJson: vi.fn(),
}));

import { google } from 'googleapis';
import { getCredentialJson } from '../tenant/credentials.js';
import { createCalendarTools } from '../integrations/google-calendar.js';

const TENANT_ID = 'tenant-uuid';
const CONFIG = {
  id: TENANT_ID,
  name: 'Test',
  system_prompt: '',
  active_tools: ['google_calendar'],
  chatwoot_account_id: '1',
  allowed_phones: [],
  admin_phones: [],
};
const CREDS = {
  client_id: 'cid',
  client_secret: 'csecret',
  refresh_token: 'rtoken',
  calendar_id: 'primary',
  duration_minutes: 30,
};

function getCalendarMock() {
  return (google.calendar as ReturnType<typeof vi.fn>)();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCredentialJson).mockResolvedValue(CREDS);
});

describe('createCalendarTools', () => {
  it('returns all 5 calendar tools', () => {
    const tools = createCalendarTools(TENANT_ID, CONFIG);
    expect(Object.keys(tools)).toEqual(
      expect.arrayContaining([
        'buscarJanelasDisponiveis',
        'criarAgendamento',
        'buscarAgendamentosContato',
        'cancelarAgendamento',
        'atualizarAgendamento',
      ]),
    );
  });
});

describe('criarAgendamento', () => {
  it('calls events.insert with correct fields', async () => {
    const tools = createCalendarTools(TENANT_ID, CONFIG);
    const cal = getCalendarMock();
    cal.events.insert.mockResolvedValue({
      data: {
        id: 'evt-1',
        summary: 'Reunião',
        start: { dateTime: '2026-05-01T09:00:00' },
        end: { dateTime: '2026-05-01T09:30:00' },
        htmlLink: 'https://calendar.google.com/evt-1',
      },
    });

    const result = await (tools['criarAgendamento'] as { execute: Function }).execute({
      titulo: 'Reunião',
      data_inicio: '2026-05-01T09:00:00-03:00',
    });

    expect(cal.events.insert).toHaveBeenCalledOnce();
    const callArgs = cal.events.insert.mock.calls[0][0];
    expect(callArgs.requestBody.summary).toBe('Reunião');
    expect(result).toMatchObject({ id: 'evt-1', titulo: 'Reunião' });
  });

  it('returns error object on API failure (does not throw)', async () => {
    const tools = createCalendarTools(TENANT_ID, CONFIG);
    const cal = getCalendarMock();
    cal.events.insert.mockRejectedValue(new Error('quota exceeded'));

    const result = await (tools['criarAgendamento'] as { execute: Function }).execute({
      titulo: 'Test',
      data_inicio: '2026-05-01T09:00:00',
    });

    expect(result).toHaveProperty('error');
    expect(String(result.error)).toContain('quota exceeded');
  });
});

describe('cancelarAgendamento', () => {
  it('calls events.delete and returns cancelado: true', async () => {
    const tools = createCalendarTools(TENANT_ID, CONFIG);
    const cal = getCalendarMock();
    cal.events.delete.mockResolvedValue({});

    const result = await (tools['cancelarAgendamento'] as { execute: Function }).execute({
      event_id: 'evt-123',
    });

    expect(cal.events.delete).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-123' }),
    );
    expect(result).toMatchObject({ cancelado: true, event_id: 'evt-123' });
  });
});

describe('conditional activation (tool-factory)', () => {
  it('google_calendar tools are absent when not in active_tools', async () => {
    // Import tool-factory dynamically to avoid top-level mock issues
    const { createTenantTools } = await import('../tenant/tool-factory.js');
    const configWithout = { ...CONFIG, active_tools: ['escalar_humano'] };
    const tools = createTenantTools(TENANT_ID, configWithout, {
      accountId: '1',
      conversationId: '2',
    });
    expect(tools).not.toHaveProperty('buscarJanelasDisponiveis');
  });

  it('google_calendar tools are present when in active_tools', async () => {
    const { createTenantTools } = await import('../tenant/tool-factory.js');
    const configWith = { ...CONFIG, active_tools: ['google_calendar'] };
    const tools = createTenantTools(TENANT_ID, configWith, {
      accountId: '1',
      conversationId: '2',
    });
    expect(tools).toHaveProperty('buscarJanelasDisponiveis');
  });
});
