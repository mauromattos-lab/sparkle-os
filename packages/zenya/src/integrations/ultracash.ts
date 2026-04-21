// UltraCash integration — product/stock lookup for HL Importados
// API docs: https://apihl.ultracash.com.br/produtos
//
// Peculiarities discovered during n8n → core migration:
//   - Requires Accept-Encoding: gzip, deflate (Node 18+ fetch sends it by default)
//   - Flat JSON array response (no envelope, no pagination)
//   - Server-side filter via ?descricao= (case-insensitive match in UltraCash DB)
//   - Prices are integers in reais (e.g. 3100 → R$ 3.100)
//   - Fields `custo_medio` and `preco_compra` MUST NEVER be exposed to the LLM/customer
//
// Credential shape (zenya_tenant_credentials, service='ultracash'):
//   { api_key: string, filial?: number }  — filial defaults to 1

import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { getCredentialJson } from '../tenant/credentials.js';

interface UltracashCredentials {
  api_key: string;
  filial?: number;
}

interface ProdutoUltracash {
  id_produto: number;
  descricao: string;
  imagem: string;
  aplicacao: string;
  preco_venda: number;
  preco2: number;
  preco3: number;
  estoque: number;
  status: number;
  // Sensitive — never expose to LLM:
  custo_medio: number;
  preco_compra: number;
  validade: string;
}

const BASE_URL = 'https://apihl.ultracash.com.br';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 12;

function formatarPreco(reais: number): string {
  if (!Number.isFinite(reais) || reais <= 0) return 'Preço sob consulta';
  return `R$ ${reais.toLocaleString('pt-BR')}`;
}

async function buscarProdutos(
  termo: string,
  creds: UltracashCredentials,
): Promise<ProdutoUltracash[]> {
  const filial = creds.filial ?? 1;
  const url = `${BASE_URL}/produtos?filial=${filial}&descricao=${encodeURIComponent(termo.toUpperCase())}`;

  const res = await fetch(url, {
    headers: {
      'x-api-key': creds.api_key,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`UltraCash API ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? (data as ProdutoUltracash[]) : [];
}

/**
 * Creates UltraCash tools scoped to a specific tenant.
 * Currently exposes a single tool `Buscar_produto` — analogous to the n8n
 * `Consultar estoque` node in the HL Importados workflow.
 */
export function createUltracashTools(tenantId: string): ToolSet {
  return {
    Buscar_produto: tool({
      description:
        'Consulta o estoque da loja pelo modelo/descrição do produto. ' +
        'Use sempre que o cliente perguntar sobre disponibilidade, preço, modelos ou cores. ' +
        'CRÍTICO: busque sempre pelo modelo base (ex: "IPHONE 15 PRO", "PERFUME ASAD") — ' +
        'nunca inclua cor, condição ou qualidade no termo (AZUL, SEMINOVO, LACRADO, etc.). ' +
        'Apenas produtos com estoque > 0 são retornados. ' +
        'IMPORTANTE: chame esta ferramenta UMA VEZ POR PRODUTO — se o cliente perguntar sobre 3 produtos, faça 3 chamadas separadas. ' +
        'NUNCA invente preços ou disponibilidade — use apenas o que esta ferramenta retornar.',
      parameters: z.object({
        termo: z
          .string()
          .min(3, 'O termo de busca precisa de pelo menos 3 caracteres.')
          .describe(
            'Modelo ou descrição base do produto, sem cor/condição. ' +
              'Exemplos: "IPHONE 15 PRO", "PERFUME ASAD", "MACBOOK". Sempre em maiúsculas.',
          ),
      }),
      execute: async ({ termo }) => {
        let creds: UltracashCredentials;
        try {
          creds = await getCredentialJson<UltracashCredentials>(tenantId, 'ultracash');
        } catch (err) {
          console.error(`[ultracash] tenant=${tenantId} sem credenciais:`, err);
          return {
            encontrou: false,
            resultado: 'Consulta de estoque indisponível no momento.',
          };
        }

        try {
          const produtos = await buscarProdutos(termo, creds);

          const ativos = produtos.filter((p) => p.status === 1);
          const disponiveis = ativos.filter((p) => p.estoque > 0).slice(0, MAX_RESULTS);

          console.log(
            `[ultracash] tenant=${tenantId} Buscar_produto termo="${termo}" ` +
              `total=${produtos.length} ativos=${ativos.length} disponiveis=${disponiveis.length}`,
          );

          if (disponiveis.length === 0) {
            const semEstoque = ativos.length;
            return {
              encontrou: false,
              resultado:
                semEstoque > 0
                  ? `Encontrei ${semEstoque} registro(s) para "${termo}", mas nenhum com estoque disponível no momento.`
                  : `Nenhum produto encontrado para "${termo}".`,
            };
          }

          const linhas = disponiveis.map((p) => {
            const unidades = p.estoque === 1 ? '1 unidade' : `${p.estoque} unidades`;
            return `- ${p.descricao} | ${formatarPreco(p.preco_venda)} | ${unidades}`;
          });

          return { encontrou: true, resultado: linhas.join('\n') };
        } catch (err) {
          console.error(`[ultracash] tenant=${tenantId} erro em Buscar_produto:`, err);
          return {
            encontrou: false,
            resultado:
              'Não foi possível consultar o estoque agora. Tente novamente em alguns instantes.',
          };
        }
      },
    }),
  };
}
