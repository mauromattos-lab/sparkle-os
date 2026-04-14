// Asaas integration — referência do pattern de integração customizada
// Ver integrations/CONTRIBUTING.md para guia de como criar novas integrações

import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { getCredentialJson } from '../tenant/credentials.js';

interface AsaasCredentials {
  api_key: string;
  environment?: 'sandbox' | 'prod';
}

function getBaseUrl(env?: string): string {
  return env === 'prod'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

function asaasHeaders(apiKey: string): Record<string, string> {
  return { 'access_token': apiKey, 'Content-Type': 'application/json' };
}

async function findOrCreateCustomer(
  baseUrl: string,
  apiKey: string,
  name: string,
  cpfCnpj: string,
  phone: string,
): Promise<string> {
  // Try to find existing customer
  const searchRes = await fetch(
    `${baseUrl}/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`,
    { headers: asaasHeaders(apiKey) },
  );

  if (searchRes.ok) {
    const data = (await searchRes.json()) as { data?: Array<{ id: string }> };
    const existing = data.data?.[0];
    if (existing?.id) return existing.id;
  }

  // Create new customer
  const createRes = await fetch(`${baseUrl}/customers`, {
    method: 'POST',
    headers: asaasHeaders(apiKey),
    body: JSON.stringify({ name, cpfCnpj, mobilePhone: phone }),
  });

  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '');
    throw new Error(`Asaas createCustomer failed (${createRes.status}): ${body}`);
  }

  const customer = (await createRes.json()) as { id: string };
  return customer.id;
}

/**
 * Creates Asaas tools scoped to a specific tenant.
 * tenantId is captured via closure; credentials are loaded lazily at execution time.
 */
export function createAsaasTools(tenantId: string): ToolSet {
  // Credentials loaded per-call to respect runtime key rotation
  async function loadCreds(): Promise<AsaasCredentials> {
    return getCredentialJson<AsaasCredentials>(tenantId, 'asaas');
  }

  return {
    criarOuBuscarCobranca: tool({
      description:
        'Cria ou busca uma cobrança no Asaas para o cliente. ' +
        'Busca o cliente pelo CPF/CNPJ — cria se não existir. ' +
        'Retorna o link de pagamento.',
      parameters: z.object({
        customer_name: z.string().describe('Nome completo do cliente'),
        customer_cpf_cnpj: z.string().describe('CPF ou CNPJ do cliente (apenas números)'),
        customer_phone: z.string().describe('Telefone do cliente com DDD'),
        valor: z.number().describe('Valor em reais (ex: 99.90)'),
        descricao: z.string().describe('Descrição do produto ou serviço'),
        vencimento_dias: z.number().optional().describe('Dias até o vencimento (padrão: 3)'),
      }),
      execute: async ({
        customer_name,
        customer_cpf_cnpj,
        customer_phone,
        valor,
        descricao,
        vencimento_dias,
      }) => {
        try {
          const creds = await loadCreds();
          const apiKey = creds.api_key;
          const baseUrl = getBaseUrl(creds.environment);

          // 1. Find or create customer
          const customerId = await findOrCreateCustomer(
            baseUrl, apiKey, customer_name, customer_cpf_cnpj, customer_phone,
          );

          // 2. Create charge
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (vencimento_dias ?? 3));
          const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD

          const chargeRes = await fetch(`${baseUrl}/payments`, {
            method: 'POST',
            headers: asaasHeaders(apiKey),
            body: JSON.stringify({
              customer: customerId,
              billingType: 'UNDEFINED', // allows customer to choose payment method
              value: valor,
              dueDate: dueDateStr,
              description: descricao,
            }),
          });

          if (!chargeRes.ok) {
            const body = await chargeRes.text().catch(() => '');
            throw new Error(`Asaas createCharge failed (${chargeRes.status}): ${body}`);
          }

          const charge = (await chargeRes.json()) as {
            id: string;
            invoiceUrl: string;
            status: string;
            value: number;
            dueDate: string;
          };

          console.log(`[zenya] Asaas cobrança criada — tenant=${tenantId} charge=${charge.id}`);

          return {
            cobranca_id: charge.id,
            link_pagamento: charge.invoiceUrl,
            status: charge.status,
            valor: charge.value,
            vencimento: charge.dueDate,
          };
        } catch (err) {
          return { error: `Erro ao criar cobrança: ${String(err)}` };
        }
      },
    }),
  };
}
