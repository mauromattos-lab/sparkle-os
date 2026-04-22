import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable mock emulando API do Supabase JS
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../db/client.js', () => ({
  getSupabase: () => mockSupabase,
}));

import {
  createSheetsKBTools,
  normalizeQuestion,
  __resetCacheForTests,
} from '../integrations/sheets-kb.js';

const TENANT_ID = 'tenant-plaka';

type ConsultarArgs = { pergunta: string };
type ConsultarResult = {
  sem_match: boolean;
  resposta?: string;
  motivo?: string;
  erro?: boolean;
  fonte_sincronizada_em?: string;
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetCacheForTests();
});

describe('normalizeQuestion', () => {
  it('remove acentos e passa pra lowercase', () => {
    expect(normalizeQuestion('Qual a GARANTIA do COLÁR?')).toBe('qual a garantia do colar');
  });

  it('colapsa múltiplos espaços e trim', () => {
    expect(normalizeQuestion('  vocês    fazem    troca?   ')).toBe('voces fazem troca');
  });

  it('remove pontuação final repetitiva', () => {
    expect(normalizeQuestion('vocês dão alergia???')).toBe('voces dao alergia');
    expect(normalizeQuestion('vocês dão alergia!!!')).toBe('voces dao alergia');
    expect(normalizeQuestion('vocês dão alergia...')).toBe('voces dao alergia');
  });

  it('normaliza diferentes variantes pra mesma chave', () => {
    const a = normalizeQuestion('Como funciona a personalização?');
    const b = normalizeQuestion('  COMO FUNCIONA A PERSONALIZAÇÃO!!! ');
    const c = normalizeQuestion('Como  funciona  a  personalizacao');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe('createSheetsKBTools — consultarKBSheets', () => {
  it('retorna resposta literal quando há match na KB', async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: {
          answer: 'Nossas semijoias não dão alergia 🩵',
          last_synced_at: '2026-04-21T10:00:00Z',
        },
        error: null,
      }),
    );

    const tools = createSheetsKBTools(TENANT_ID);
    const exec = tools.consultarKBSheets!.execute as (
      a: ConsultarArgs,
    ) => Promise<ConsultarResult>;
    const result = await exec({ pergunta: 'Vocês dão alergia?' });

    expect(result.sem_match).toBe(false);
    expect(result.resposta).toBe('Nossas semijoias não dão alergia 🩵');
    expect(result.fonte_sincronizada_em).toBe('2026-04-21T10:00:00Z');
  });

  it('retorna sem_match=true quando pergunta não está na KB', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    const tools = createSheetsKBTools(TENANT_ID);
    const exec = tools.consultarKBSheets!.execute as (
      a: ConsultarArgs,
    ) => Promise<ConsultarResult>;
    const result = await exec({ pergunta: 'Vocês vendem anel de casamento?' });

    expect(result.sem_match).toBe(true);
    expect(result.resposta).toBeUndefined();
    expect(result.erro).toBeUndefined();
  });

  it('degrada graciosamente quando o banco falha (EC-2)', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { message: 'connection timeout' } }),
    );

    const tools = createSheetsKBTools(TENANT_ID);
    const exec = tools.consultarKBSheets!.execute as (
      a: ConsultarArgs,
    ) => Promise<ConsultarResult>;
    const result = await exec({ pergunta: 'teste' });

    expect(result.sem_match).toBe(true);
    expect(result.erro).toBe(true);
    expect(result.motivo).toContain('erro técnico');
  });

  it('usa cache in-memory (5min) — segunda chamada idêntica não vai ao banco', async () => {
    const chain = makeChain({
      data: { answer: 'R', last_synced_at: '2026-04-21T10:00:00Z' },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const tools = createSheetsKBTools(TENANT_ID);
    const exec = tools.consultarKBSheets!.execute as (a: ConsultarArgs) => Promise<unknown>;

    await exec({ pergunta: 'quanto custa o frete?' });
    await exec({ pergunta: 'QUANTO CUSTA O FRETE???' });
    await exec({ pergunta: '  quanto  custa  o  frete  ' });

    // chain.maybeSingle foi chamado apenas 1 vez — as outras 2 pegaram do cache
    expect(chain.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('cache também memoriza "sem_match" pra evitar hammering no banco', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const tools = createSheetsKBTools(TENANT_ID);
    const exec = tools.consultarKBSheets!.execute as (
      a: ConsultarArgs,
    ) => Promise<ConsultarResult>;

    const r1 = await exec({ pergunta: 'pergunta inexistente' });
    const r2 = await exec({ pergunta: 'pergunta inexistente' });

    expect(r1.sem_match).toBe(true);
    expect(r2.sem_match).toBe(true);
    expect(chain.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('rejeita pergunta vazia sem ir ao banco', async () => {
    const tools = createSheetsKBTools(TENANT_ID);
    const exec = tools.consultarKBSheets!.execute as (
      a: ConsultarArgs,
    ) => Promise<ConsultarResult>;
    const result = await exec({ pergunta: '   ' });

    expect(result.sem_match).toBe(true);
    expect(result.motivo).toContain('vazia');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('isola queries por tenant_id (cache separado por tenant)', async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: { answer: 'A', last_synced_at: '2026-04-21T10:00:00Z' },
        error: null,
      }),
    );

    const tools1 = createSheetsKBTools('tenant-A');
    const tools2 = createSheetsKBTools('tenant-B');
    const exec1 = tools1.consultarKBSheets!.execute as (a: ConsultarArgs) => Promise<unknown>;
    const exec2 = tools2.consultarKBSheets!.execute as (a: ConsultarArgs) => Promise<unknown>;

    await exec1({ pergunta: 'mesma pergunta' });
    await exec2({ pergunta: 'mesma pergunta' });

    // Cada tenant vai ao banco, mesmo com a mesma pergunta
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});
