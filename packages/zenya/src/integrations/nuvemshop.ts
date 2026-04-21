// Nuvemshop integration — order lookup for PLAKA tenant
// Credentials stored encrypted via getCredentialJson(tenantId, 'nuvemshop')
// Credential shape: { access_token: string, store_id: string, user_agent: string }
//
// Implements FR-2 of plaka-01 spec.
// API reference: https://dev.nuvemshop.com.br/api/v1
// - Base URL: https://api.nuvemshop.com.br/v1/{store_id}
// - Auth: `Authentication: bearer {access_token}` (header is 'Authentication', not 'Authorization')
// - User-Agent header is REQUIRED by Nuvemshop API gateway

import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { getCredentialJson } from '../tenant/credentials.js';

interface NuvemshopCredentials {
  access_token: string;
  store_id: string;
  user_agent: string;
}

interface NuvemshopPedido {
  id: number;
  number: number;
  status: string;
  payment_status: string;
  shipping_status: string | null;
  shipping_tracking_number: string | null;
  shipping_tracking_url: string | null;
  customer: { name: string } | null;
  products: Array<{ name: string; quantity: number }>;
  total: string;
  created_at: string;
}

const BASE_URL = 'https://api.nuvemshop.com.br/v1';
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { expires: number; value: NuvemshopPedido }>();

function cacheKey(storeId: string, numero: string): string {
  return `${storeId}:${numero}`;
}

/** Test-only helper — clears cache between runs. */
export function __resetCacheForTests(): void {
  cache.clear();
}

function formatPaymentStatus(s: string): string {
  const map: Record<string, string> = {
    pending: 'aguardando pagamento',
    paid: 'pago',
    authorized: 'autorizado',
    abandoned: 'abandonado',
    refunded: 'reembolsado',
    voided: 'cancelado',
  };
  return map[s] ?? s;
}

function formatShippingStatus(s: string | null): string {
  if (!s) return 'ainda não enviado';
  const map: Record<string, string> = {
    unpacked: 'aguardando preparo',
    ready_for_shipping: 'pronto para envio',
    shipped: 'enviado',
    unshipped: 'não enviado',
    delivered: 'entregue',
  };
  return map[s] ?? s;
}

async function fetchNuvemshopOrder(
  creds: NuvemshopCredentials,
  numero: string,
): Promise<NuvemshopPedido | null> {
  const url = `${BASE_URL}/${creds.store_id}/orders?q=${encodeURIComponent(numero)}`;
  const res = await fetch(url, {
    headers: {
      Authentication: `bearer ${creds.access_token}`,
      'User-Agent': creds.user_agent,
      Accept: 'application/json',
    },
  });

  // Log rate-limit headers for future tuning (ASM-4). Never throw on them.
  const remaining = res.headers.get('x-rate-limit-remaining');
  const reset = res.headers.get('x-rate-limit-reset');
  if (remaining && Number(remaining) < 20) {
    console.warn(`[nuvemshop] rate-limit baixo — remaining=${remaining} reset=${reset}`);
  }

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Nuvemshop orders lookup failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const orders = (await res.json()) as NuvemshopPedido[];
  if (!Array.isArray(orders) || orders.length === 0) return null;

  const exact = orders.find((o) => String(o.number) === String(numero));
  return exact ?? orders[0] ?? null;
}

function formatResult(pedido: NuvemshopPedido) {
  return {
    encontrado: true,
    numero: pedido.number,
    cliente: pedido.customer?.name ?? null,
    status: pedido.status,
    pagamento: formatPaymentStatus(pedido.payment_status),
    envio: formatShippingStatus(pedido.shipping_status),
    rastreio: pedido.shipping_tracking_number,
    link_rastreio: pedido.shipping_tracking_url,
    total: pedido.total,
    itens: pedido.products.map((p) => `${p.quantity}× ${p.name}`).join(', '),
    data: pedido.created_at,
  };
}

export function createNuvemshopTools(tenantId: string): ToolSet {
  return {
    buscarPedidoNuvemshop: tool({
      description:
        'Consulta o status de um pedido da loja Nuvemshop pelo número. Use quando o cliente perguntar sobre status, prazo de entrega, rastreio ou confirmação de pagamento de um pedido específico. Retorna status de pagamento, situação do envio e código de rastreio quando disponível.',
      parameters: z.object({
        numero: z
          .string()
          .describe('Número do pedido (pode vir como "#1234", "1234" ou "pedido 1234")'),
      }),
      execute: async ({ numero }) => {
        const numeroClean = numero.replace(/[^0-9]/g, '').trim();
        if (!numeroClean) {
          return {
            encontrado: false,
            mensagem: 'Não consegui identificar um número de pedido válido na sua mensagem.',
          };
        }

        const creds = await getCredentialJson<NuvemshopCredentials>(tenantId, 'nuvemshop');
        const key = cacheKey(creds.store_id, numeroClean);
        const cached = cache.get(key);
        if (cached && cached.expires > Date.now()) {
          return formatResult(cached.value);
        }

        try {
          const pedido = await fetchNuvemshopOrder(creds, numeroClean);
          if (!pedido) {
            console.log(
              `[nuvemshop] tenant=${tenantId} buscarPedidoNuvemshop numero="${numeroClean}" result=not-found`,
            );
            return {
              encontrado: false,
              mensagem:
                'Não encontrei esse pedido na nossa base. Confere se o número está correto ou me passa o CPF/email usado na compra?',
            };
          }

          cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value: pedido });
          console.log(
            `[nuvemshop] tenant=${tenantId} buscarPedidoNuvemshop numero="${numeroClean}" status=${pedido.status} payment=${pedido.payment_status}`,
          );
          return formatResult(pedido);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            `[nuvemshop] tenant=${tenantId} buscarPedidoNuvemshop numero="${numeroClean}" error: ${message}`,
          );
          return {
            encontrado: false,
            mensagem:
              'Tive um problema técnico pra consultar agora. Posso te passar para a equipe?',
            erro: true,
          };
        }
      },
    }),
  };
}
