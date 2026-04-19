// Loja Integrada integration — product search and order lookup
// Credentials stored encrypted via getCredentialJson(tenantId, 'loja-integrada')
// Credential shape: { chave_api: string, id_aplicacao: string }
//
// Order lookup flow:
//   1. Detalhar_pedido_por_numero — cliente sabe o número (caminho principal)
//   2. Buscar_pedidos_por_cliente  — cliente NÃO sabe o número (fallback via scan)

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

interface PedidoListItem {
  numero: number;
  cliente: string; // URI: /api/v1/cliente/{id}
  situacao: { nome: string } | null;
  data_criacao: string | null;
  valor_total: string | null;
}

interface ClienteDetalhe {
  nome: string;
  email: string;
  cpf: string;
  telefone_celular: string;
  fone: string | null;
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

async function validarUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
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
 * Scans the N most recent orders and returns those belonging to a customer
 * identified by nome, email, cpf, or telefone.
 * The Loja Integrada REST API v1 does not support server-side filtering on
 * customer fields, so we fetch order list + cliente details in parallel.
 */
async function scanPedidosPorCliente(
  authHeader: string,
  identificador: string,
  tipo: 'nome' | 'email' | 'cpf' | 'telefone',
  limite: number = 60,
): Promise<Array<{ numero: number; situacao: string; dataPedido: string }>> {
  const BASE = 'https://api.awsli.com.br';

  const listRes = await fetch(
    `${BASE}/api/v1/pedido/?limit=${limite}&order_by=-numero`,
    { headers: { Authorization: authHeader } },
  );
  if (!listRes.ok) return [];

  const listData = (await listRes.json()) as { objects: PedidoListItem[] };
  const pedidos = listData.objects ?? [];

  // Fetch all cliente details in parallel
  const pares = await Promise.all(
    pedidos.map(async (pedido) => {
      const uri = pedido.cliente.startsWith('http')
        ? pedido.cliente
        : `${BASE}${pedido.cliente}`;
      const res = await fetch(uri, { headers: { Authorization: authHeader } });
      if (!res.ok) return null;
      const cliente = (await res.json()) as ClienteDetalhe;
      return { pedido, cliente };
    }),
  );

  const identNorm = normalizar(identificador);

  return pares
    .filter((par): par is NonNullable<typeof par> => {
      if (!par) return false;
      const { cliente } = par;
      switch (tipo) {
        case 'nome':
          return normalizar(cliente.nome ?? '').includes(identNorm);
        case 'email':
          return (cliente.email ?? '').toLowerCase() === identificador.toLowerCase().trim();
        case 'cpf': {
          const cpfClean = (cliente.cpf ?? '').replace(/\D/g, '');
          const idClean = identificador.replace(/\D/g, '');
          return cpfClean === idClean && idClean.length > 0;
        }
        case 'telefone': {
          const telClean = (cliente.telefone_celular ?? cliente.fone ?? '').replace(/\D/g, '');
          const idClean = identificador.replace(/\D/g, '');
          // Match by last 8+ digits to handle DDD variations
          return (
            idClean.length >= 8 &&
            (telClean.endsWith(idClean) || idClean.endsWith(telClean))
          );
        }
        default:
          return false;
      }
    })
    .map(({ pedido }) => ({
      numero: pedido.numero,
      situacao: pedido.situacao?.nome ?? 'N/A',
      dataPedido: pedido.data_criacao
        ? new Date(pedido.data_criacao).toLocaleDateString('pt-BR')
        : 'N/A',
    }));
}

/**
 * Creates Loja Integrada tools scoped to a specific tenant.
 */
export function createLojaIntegradaTools(tenantId: string): ToolSet {
  return {
    Buscar_produto: tool({
      description:
        'Busca UM produto no catálogo da loja pelo nome ou tipo. ' +
        'Use sempre que o cliente perguntar sobre um produto, preço ou disponibilidade. ' +
        'IMPORTANTE: chame esta ferramenta UMA VEZ POR PRODUTO — nunca combine múltiplos produtos em uma única chamada. ' +
        'Se o cliente perguntar sobre 3 produtos, faça 3 chamadas separadas. ' +
        'NUNCA afirme que um produto não existe sem antes chamar esta ferramenta. ' +
        'NUNCA invente preços ou URLs — use apenas o que essa ferramenta retornar.',
      parameters: z.object({
        termo: z.string().describe('Nome ou tipo de UM único produto a buscar (ex: "ecobag", "camiseta", "canga"). Nunca combine múltiplos produtos.'),
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

        console.log(`[loja-integrada] Buscar_produto termo="${termo}" → ${encontrados.length} resultado(s): ${encontrados.map((p) => p.nome).join(', ') || 'nenhum'}`);

        if (encontrados.length === 0) {
          return { encontrou: false, resultado: 'Nenhum produto encontrado para esse termo.' };
        }

        // Fetch detail for each (price + description + correct URL)
        const detalhes = await Promise.all(
          encontrados.map((p) => fetchProductDetail(p.id, authHeader)),
        );

        const linhas = await Promise.all(
          detalhes
            .filter((d): d is ProdutoDetalhe => d !== null && !!d.nome)
            .map(async (p) => {
              const preco =
                p.preco_cheio != null
                  ? `R$ ${Number(p.preco_cheio).toFixed(2).replace('.', ',')}`
                  : 'Preço sob consulta';
              const urlCandidata = formatarUrl(p);
              const descricao = stripHtml(p.descricao_completa);
              let linha = `- ${p.nome} | ${preco}`;
              if (descricao) linha += ` | ${descricao.substring(0, 400)}`;
              if (urlCandidata) {
                const valida = await validarUrl(urlCandidata);
                if (valida) {
                  linha += ` | ${urlCandidata}`;
                } else {
                  console.log(`[loja-integrada] URL inválida descartada: ${urlCandidata}`);
                }
              }
              return linha;
            }),
        );

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

        const itens = (data.itens ?? [])
          .map((i) => `${Math.round(parseFloat(i.quantidade) || 1)}x ${i.nome}`)
          .join(', ');

        let resultado = `Pedido #${data.numero} — ${situacao} (${dataPedido})`;
        if (itens) resultado += `\nItens: ${itens}`;
        if (transportadora) resultado += `\nEnvio: ${transportadora}`;
        if (rastreio) {
          resultado += `\nRastreamento: https://melhorrastreio.com.br/rastreio/${rastreio}`;
        }

        return { encontrou: true, resultado };
      },
    }),

    Buscar_pedidos_por_cliente: tool({
      description:
        'Busca pedidos recentes de um cliente quando ele NÃO sabe o número do pedido. ' +
        'Use SOMENTE após o cliente confirmar que não tem o número e querer tentar por outro dado. ' +
        'Aceita nome, e-mail, CPF ou telefone. ' +
        'Retorna os pedidos encontrados com status e data — para ver rastreio, use Detalhar_pedido_por_numero com o número retornado.',
      parameters: z.object({
        identificador: z
          .string()
          .describe('O dado fornecido pelo cliente: nome completo, e-mail, CPF (só números) ou telefone'),
        tipo: z
          .enum(['nome', 'email', 'cpf', 'telefone'])
          .describe('Tipo do identificador: nome | email | cpf | telefone'),
      }),
      execute: async ({ identificador, tipo }) => {
        const creds = await getCredentialJson<LojaIntegradaCredentials>(tenantId, 'loja-integrada');
        const authHeader = `chave_api ${creds.chave_api} aplicacao ${creds.id_aplicacao}`;

        const encontrados = await scanPedidosPorCliente(authHeader, identificador, tipo);

        if (encontrados.length === 0) {
          return {
            encontrou: false,
            resultado: `Não encontrei pedidos recentes para esse ${tipo}. Verifique se o dado está correto, ou peça ao cliente o número do pedido.`,
          };
        }

        const linhas = encontrados.slice(0, 5).map(
          (p) => `Pedido #${p.numero} — ${p.situacao} (${p.dataPedido})`,
        );

        const plural = encontrados.length > 1 ? 'pedidos encontrados' : 'pedido encontrado';
        return {
          encontrou: true,
          resultado:
            `${encontrados.length} ${plural}:\n${linhas.join('\n')}\n\n` +
            `Para ver rastreio de algum desses, pergunte ao cliente qual deseja e use Detalhar_pedido_por_numero.`,
        };
      },
    }),
  };
}
