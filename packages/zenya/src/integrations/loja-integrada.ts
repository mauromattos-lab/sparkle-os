// Loja Integrada integration — product search and order lookup
// Credentials stored encrypted via getCredentialJson(tenantId, 'loja-integrada')
// Credential shape: { chave_api: string, id_aplicacao: string }

import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { getCredentialJson } from '../tenant/credentials.js';

interface LojaIntegradaCredentials {
  chave_api: string;
  id_aplicacao: string;
}

interface Produto {
  id: number;
  nome: string;
  ativo: boolean;
  apelido: string;
  url: string;
  preco_cheio: number | null;
  descricao_completa: string | null;
}

interface ProdutoDetalhe extends Produto {
  descricao_completa: string | null;
}

interface ListResponse {
  objects: Produto[];
  meta: { next: string | null; total_count: number };
}

// Synonyms for common search terms that differ from catalog names
const SINONIMOS: Record<string, string[]> = {
  camiseta: ['camisa'],
  camisetas: ['camisa'],
  blusa: ['camisa'],
  blusas: ['camisa'],
  caneca: ['canecas'],
  canecas: ['caneca'],
};

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function corresponde(produto: Produto, termoNorm: string, palavras: string[]): boolean {
  const nome = normalizar(produto.nome);
  const apelido = normalizar(produto.apelido ?? '');

  // 1. Exact phrase
  if (nome.includes(termoNorm) || apelido.includes(termoNorm)) return true;

  // 2. Each word (with synonyms expanded)
  const todasPalavras = [...palavras];
  for (const p of palavras) {
    const sinonimos = SINONIMOS[p];
    if (sinonimos) todasPalavras.push(...sinonimos);
  }

  if (todasPalavras.some((p) => nome.includes(p) || apelido.includes(p))) return true;

  // 3. Stem fallback (5 chars) — "camiseta" → "camis" matches "camisa"
  const stems = todasPalavras.filter((p) => p.length >= 5).map((p) => p.substring(0, 5));
  return stems.some((s) => nome.includes(s) || apelido.includes(s));
}

function formatarUrl(produto: ProdutoDetalhe): string {
  const base = 'https://www.funpersonalize.com.br';
  const apiUrl = produto.url ?? '';
  const path = apiUrl.replace(/^https?:\/\/[^/]+/, '');
  if (path && path !== '/') return `${base}${path.startsWith('/') ? path : '/' + path}`;
  if (produto.apelido) {
    const ap = produto.apelido;
    return `${base}${ap.startsWith('/') ? ap : '/' + ap}`;
  }
  return base;
}

function stripHtml(html: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<p[^>]*>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function fetchAllProducts(authHeader: string): Promise<Produto[]> {
  const BASE = 'https://api.awsli.com.br';
  const todos: Produto[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${BASE}/api/v1/produto/?limit=${limit}&ativo=true&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: authHeader } });

    if (!res.ok) break;

    const data = (await res.json()) as ListResponse;
    todos.push(...(data.objects ?? []));

    if (!data.meta?.next) break;
    offset += limit;

    // Safety cap: never fetch more than 2000 products
    if (todos.length >= 2000) break;
  }

  return todos;
}

async function fetchProductDetail(id: number, authHeader: string): Promise<ProdutoDetalhe | null> {
  const res = await fetch(`https://api.awsli.com.br/api/v1/produto/${id}`, {
    headers: { Authorization: authHeader },
  });
  if (!res.ok) return null;
  return (await res.json()) as ProdutoDetalhe;
}

/**
 * Creates Loja Integrada tools scoped to a specific tenant.
 */
export function createLojaIntegradaTools(tenantId: string): ToolSet {
  return {
    Buscar_produto: tool({
      description:
        'Busca produtos no catálogo da loja pelo nome ou tipo. ' +
        'Use sempre que o cliente perguntar sobre um produto, preço ou disponibilidade. ' +
        'NUNCA invente preços ou URLs — use apenas o que essa ferramenta retornar.',
      parameters: z.object({
        termo: z.string().describe('Nome ou tipo do produto a buscar (ex: "camiseta", "ecobag", "canga")'),
      }),
      execute: async ({ termo }) => {
        const creds = await getCredentialJson<LojaIntegradaCredentials>(tenantId, 'loja-integrada');
        const authHeader = `chave_api ${creds.chave_api} aplicacao ${creds.id_aplicacao}`;

        const termoNorm = normalizar(termo);
        const palavras = termoNorm.split(/\s+/).filter((p) => p.length >= 3);

        // Fetch all active products with offset pagination (no pagination bug)
        const todos = await fetchAllProducts(authHeader);

        const encontrados = todos
          .filter((p) => p.ativo && p.nome?.trim() && !p.nome.includes('DUPLICADO'))
          .filter((p) => !termoNorm || corresponde(p, termoNorm, palavras))
          .slice(0, 5);

        if (encontrados.length === 0) {
          return { encontrou: false, resultado: 'Nenhum produto encontrado para esse termo.' };
        }

        // Fetch detail for each (price + description + correct URL)
        const detalhes = await Promise.all(
          encontrados.map((p) => fetchProductDetail(p.id, authHeader)),
        );

        const linhas = detalhes
          .filter((d): d is ProdutoDetalhe => d !== null && !!d.nome)
          .map((p) => {
            const preco =
              p.preco_cheio != null
                ? `R$ ${Number(p.preco_cheio).toFixed(2).replace('.', ',')}`
                : 'Preço sob consulta';
            const url = formatarUrl(p);
            const descricao = stripHtml(p.descricao_completa);
            let linha = `- ${p.nome} | ${preco}`;
            if (descricao) linha += ` | ${descricao.substring(0, 400)}`;
            if (url) linha += ` | ${url}`;
            return linha;
          });

        return { encontrou: true, resultado: linhas.join('\n') };
      },
    }),

    Detalhar_pedido_por_numero: tool({
      description:
        'Busca um pedido pelo número informado pelo cliente. ' +
        'Use quando o cliente quiser saber o status, rastreio ou itens de um pedido específico.',
      parameters: z.object({
        numero_pedido: z.string().describe('Número do pedido informado pelo cliente'),
      }),
      execute: async ({ numero_pedido }) => {
        const creds = await getCredentialJson<LojaIntegradaCredentials>(tenantId, 'loja-integrada');
        const authHeader = `chave_api ${creds.chave_api} aplicacao ${creds.id_aplicacao}`;

        const res = await fetch(
          `https://api.awsli.com.br/api/v1/pedido/${numero_pedido}/`,
          { headers: { Authorization: authHeader } },
        );

        if (!res.ok) {
          return { encontrou: false, resultado: 'Pedido não encontrado. Verifique o número informado.' };
        }

        const data = (await res.json()) as {
          numero: number;
          situacao: { nome: string } | null;
          data_criacao: string | null;
          valor_total: string | null;
          itens: Array<{ nome: string; quantidade: string }>;
          envios: Array<{ objeto?: string; forma_envio?: { nome: string } }>;
        };

        if (!data?.numero) {
          return { encontrou: false, resultado: 'Pedido não encontrado. Verifique o número informado.' };
        }

        const situacao = data.situacao?.nome ?? 'N/A';
        const dataPedido = data.data_criacao
          ? new Date(data.data_criacao).toLocaleDateString('pt-BR')
          : 'N/A';

        const envio = data.envios?.[0];
        const rastreio = envio?.objeto ?? null;
        const transportadora = envio?.forma_envio?.nome ?? null;

        let resultado = `Pedido #${data.numero} — ${situacao} (${dataPedido})`;
        if (transportadora) resultado += `\nEnvio: ${transportadora}`;
        if (rastreio) {
          resultado += `\nRastreamento: ${rastreio} (https://melhorrastreio.com.br/rastreio/${rastreio})`;
        }

        return { encontrou: true, resultado };
      },
    }),
  };
}
