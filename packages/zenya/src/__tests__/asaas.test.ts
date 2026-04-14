import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock credentials
vi.mock('../tenant/credentials.js', () => ({
  getCredentialJson: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getCredentialJson } from '../tenant/credentials.js';
import { createAsaasTools } from '../integrations/asaas.js';

const TENANT_ID = 'tenant-asaas-test';

const mockCreds = {
  api_key: 'test-api-key',
  environment: 'sandbox' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCredentialJson).mockResolvedValue(mockCreds);
});

describe('createAsaasTools', () => {
  it('returns a ToolSet with criarOuBuscarCobranca', () => {
    const tools = createAsaasTools(TENANT_ID);
    expect(tools).toHaveProperty('criarOuBuscarCobranca');
  });

  it('tenantId is NOT exposed as a tool parameter', () => {
    const tools = createAsaasTools(TENANT_ID);
    const tool = tools['criarOuBuscarCobranca'];
    const schema = (tool as { parameters: { shape: Record<string, unknown> } }).parameters;
    expect(schema.shape).not.toHaveProperty('tenantId');
    expect(schema.shape).not.toHaveProperty('tenant_id');
  });
});

describe('criarOuBuscarCobranca — find existing customer', () => {
  it('finds existing customer and creates charge', async () => {
    // Mock: customer search returns existing customer
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'cus_existing' }] }),
      })
      // Mock: create charge
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'pay_123',
            invoiceUrl: 'https://sandbox.asaas.com/i/abc',
            status: 'PENDING',
            value: 99.9,
            dueDate: '2026-04-17',
          }),
      });

    const tools = createAsaasTools(TENANT_ID);
    const tool = tools['criarOuBuscarCobranca'] as unknown as {
      execute: (args: Record<string, unknown>) => Promise<unknown>;
    };

    const result = (await tool.execute({
      customer_name: 'João Silva',
      customer_cpf_cnpj: '12345678900',
      customer_phone: '11999990000',
      valor: 99.9,
      descricao: 'Produto X',
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      cobranca_id: 'pay_123',
      link_pagamento: 'https://sandbox.asaas.com/i/abc',
      status: 'PENDING',
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('creates new customer when not found, then creates charge', async () => {
    mockFetch
      // customer search — empty
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
      // create customer
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'cus_new' }),
      })
      // create charge
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'pay_456',
            invoiceUrl: 'https://sandbox.asaas.com/i/def',
            status: 'PENDING',
            value: 49.9,
            dueDate: '2026-04-17',
          }),
      });

    const tools = createAsaasTools(TENANT_ID);
    const tool = tools['criarOuBuscarCobranca'] as unknown as {
      execute: (args: Record<string, unknown>) => Promise<unknown>;
    };

    const result = (await tool.execute({
      customer_name: 'Maria Santos',
      customer_cpf_cnpj: '98765432100',
      customer_phone: '21988880000',
      valor: 49.9,
      descricao: 'Serviço Y',
    })) as Record<string, unknown>;

    expect(result).toMatchObject({ cobranca_id: 'pay_456' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('returns { error } when charge API fails', async () => {
    mockFetch
      // customer found
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'cus_abc' }] }),
      })
      // charge fails
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve('Validation error'),
      });

    const tools = createAsaasTools(TENANT_ID);
    const tool = tools['criarOuBuscarCobranca'] as unknown as {
      execute: (args: Record<string, unknown>) => Promise<unknown>;
    };

    const result = (await tool.execute({
      customer_name: 'Test',
      customer_cpf_cnpj: '00000000000',
      customer_phone: '11900000000',
      valor: 10,
      descricao: 'Test',
    })) as Record<string, unknown>;

    expect(result).toHaveProperty('error');
    expect(String(result['error'])).toContain('422');
  });

  it('loads credentials lazily at execute time, not at factory time', async () => {
    // Factory is called before credentials are available
    vi.mocked(getCredentialJson).mockReset();

    const tools = createAsaasTools(TENANT_ID);
    // getCredentialJson should NOT have been called yet
    expect(getCredentialJson).not.toHaveBeenCalled();

    // Now set up creds and mocks for actual execution
    vi.mocked(getCredentialJson).mockResolvedValue(mockCreds);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'cus_lazy' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'pay_lazy',
            invoiceUrl: 'https://...',
            status: 'PENDING',
            value: 1,
            dueDate: '2026-04-17',
          }),
      });

    const tool = tools['criarOuBuscarCobranca'] as unknown as {
      execute: (args: Record<string, unknown>) => Promise<unknown>;
    };
    await tool.execute({
      customer_name: 'Test',
      customer_cpf_cnpj: '00000000000',
      customer_phone: '11900000000',
      valor: 1,
      descricao: 'Test',
    });

    // getCredentialJson should have been called during execute
    expect(getCredentialJson).toHaveBeenCalledWith(TENANT_ID, 'asaas');
  });
});

describe('tool-factory Asaas activation (AC2)', () => {
  it('createAsaasTools accepts only tenantId (no creds param)', () => {
    // If this compiles and runs, the signature is correct
    expect(() => createAsaasTools(TENANT_ID)).not.toThrow();
  });
});
