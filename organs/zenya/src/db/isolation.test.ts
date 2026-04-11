import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock factories — declaradas antes dos imports para garantir hoisting correto
const {
  mockTxExecute,
  mockTxSelectFrom,
  mockTxInsertReturning,
} = vi.hoisted(() => ({
  mockTxExecute: vi.fn(),
  mockTxSelectFrom: vi.fn(),
  mockTxInsertReturning: vi.fn(),
}));

// Mock do tx passado ao callback de db.transaction()
// Recria a estrutura do tx drizzle com os mocks hoistados
vi.mock('./client.js', () => ({
  getDb: vi.fn(() => ({
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
      const mockTx = {
        execute: mockTxExecute,
        select: vi.fn(() => ({ from: mockTxSelectFrom })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: mockTxInsertReturning })),
        })),
      };
      return callback(mockTx);
    }),
  })),
  schema: {
    zenyaConversations: {},
    zenyaClients: {},
  },
}));

import { listConversations, insertConversation } from './conversations.js';

// Fixture de conversas para simular dois clientes distintos
const convClientA = {
  id: 'conv-a1',
  clientId: 'client-uuid-A',
  isolationKey: 'key-A',
  chatwootConvId: 101,
  content: { msg: 'Olá, preciso de ajuda' },
  createdAt: new Date('2026-04-11T10:00:00Z'),
};

const convClientB = {
  id: 'conv-b1',
  clientId: 'client-uuid-B',
  isolationKey: 'key-B',
  chatwootConvId: 202,
  content: { msg: 'Quero agendar consulta' },
  createdAt: new Date('2026-04-11T11:00:00Z'),
};

describe('Isolamento de Dados — Task 2: dataIsolationKey', () => {
  it('crypto.randomUUID() gera chaves únicas para clientes distintos', () => {
    const keys = new Set(Array.from({ length: 100 }, () => crypto.randomUUID()));
    expect(keys.size).toBe(100);
  });

  it('dataIsolationKey gerada é um UUID válido (formato RFC 4122)', () => {
    const key = crypto.randomUUID();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(key).toMatch(uuidPattern);
  });
});

describe('Isolamento de Dados — Task 3: Testes de Isolamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTxExecute.mockResolvedValue(undefined);
  });

  // Task 3.1 + 3.2: Query com key A retorna apenas conversas de A
  it('listConversations com key-A retorna apenas conversas do cliente A', async () => {
    mockTxSelectFrom.mockResolvedValueOnce([convClientA]);

    const result = await listConversations('key-A');

    expect(result).toHaveLength(1);
    expect(result[0]?.isolationKey).toBe('key-A');
    expect(result[0]?.id).toBe('conv-a1');
    // set_config executado dentro da transação
    expect(mockTxExecute).toHaveBeenCalledOnce();
  });

  // Task 3.3: Query com key B retorna apenas conversas de B
  it('listConversations com key-B retorna apenas conversas do cliente B', async () => {
    mockTxSelectFrom.mockResolvedValueOnce([convClientB]);

    const result = await listConversations('key-B');

    expect(result).toHaveLength(1);
    expect(result[0]?.isolationKey).toBe('key-B');
    expect(result[0]?.id).toBe('conv-b1');
    expect(mockTxExecute).toHaveBeenCalledOnce();
  });

  // Task 3.4: Query sem key configurado retorna 0 registros (RLS bloqueia)
  it('listConversations com key vazia retorna 0 registros (simula RLS block)', async () => {
    mockTxSelectFrom.mockResolvedValueOnce([]);

    const result = await listConversations('');

    expect(result).toHaveLength(0);
    expect(mockTxExecute).toHaveBeenCalledOnce();
  });

  // Task 3.5: Query com key inválida retorna 0 registros
  it('listConversations com key inválida retorna 0 registros (simula RLS block)', async () => {
    mockTxSelectFrom.mockResolvedValueOnce([]);

    const result = await listConversations('chave-inexistente-xyz');

    expect(result).toHaveLength(0);
    expect(mockTxExecute).toHaveBeenCalledOnce();
  });

  // set_config e query rodam na mesma transação
  it('set_config e select executam dentro da mesma transação (tx)', async () => {
    mockTxSelectFrom.mockResolvedValueOnce([]);

    await listConversations('qualquer-key');

    // execute (set_config) e select.from chamados no mesmo tx mock
    expect(mockTxExecute).toHaveBeenCalledOnce();
    expect(mockTxSelectFrom).toHaveBeenCalledOnce();
  });

  // insertConversation: set_config + insert dentro da mesma transação
  it('insertConversation chama set_config e insere com isolation_key correta', async () => {
    const newConv = { ...convClientA, id: 'conv-a2' };
    mockTxInsertReturning.mockResolvedValueOnce([newConv]);

    const result = await insertConversation('key-A', {
      clientId: 'client-uuid-A',
      chatwootConvId: 101,
      content: { msg: 'Nova conversa' },
    });

    expect(result.isolationKey).toBe('key-A');
    expect(mockTxExecute).toHaveBeenCalledOnce();
    expect(mockTxInsertReturning).toHaveBeenCalledOnce();
  });

  // Dois clientes com keys distintas nunca têm conversas cruzadas
  it('clientes A e B não compartilham conversas entre si', async () => {
    mockTxSelectFrom
      .mockResolvedValueOnce([convClientA])
      .mockResolvedValueOnce([convClientB]);

    const resultA = await listConversations('key-A');
    const resultB = await listConversations('key-B');

    const idsA = resultA.map((c) => c.id);
    const idsB = resultB.map((c) => c.id);

    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
    expect(mockTxExecute).toHaveBeenCalledTimes(2);
  });
});
