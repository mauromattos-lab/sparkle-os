// product-enricher.ts — Stories 6.6 + 6.7 + 6.8
// Fetches product catalog from NuvemShop API to enrich squad briefing
// Graceful degradation: returns empty string / null if API unavailable or misconfigured

import OpenAI from 'openai';

const MODEL = process.env['CONTENT_ENGINE_MODEL'] ?? 'gpt-4o-mini';

let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) return null;
  if (!_openai) _openai = new OpenAI({ apiKey });
  return _openai;
}

// Story 6.8 — prompt conciso e determinístico para seleção de produto por relevância
export function buildSelectionPrompt(
  postTitle: string,
  postTopic: string | undefined,
  productNames: string[],
): string {
  const topicLine = postTopic ? `\nTópico: ${postTopic}` : '';
  const list = productNames.map((n, i) => `${i}: ${n}`).join('\n');
  return (
    `Título do post: ${postTitle}${topicLine}\n\n` +
    `Produtos disponíveis:\n${list}\n\n` +
    `Responda APENAS com o número (índice) do produto mais relevante para o post. ` +
    `Responda somente com um número inteiro.`
  );
}

interface NuvemShopProduct {
  name: { pt?: string; en?: string };
  canonical_url: string;
  published: boolean;
  images?: Array<{ src: string }>;
}

const NUVEMSHOP_API = (userId: string) =>
  `https://api.tiendanube.com/v1/${userId}/products?per_page=10`;

async function fetchProducts(): Promise<NuvemShopProduct[] | null> {
  const accessToken = process.env['NUVEMSHOP_ACCESS_TOKEN'];
  const userId = process.env['NUVEMSHOP_USER_ID'];

  if (!accessToken || !userId) return null;

  let response: Response;
  try {
    response = await fetch(NUVEMSHOP_API(userId), {
      headers: {
        Authentication: `bearer ${accessToken}`,
        'User-Agent': 'SparkleOS (mauro@sparkleai.tech)',
      },
    });
  } catch (err) {
    console.warn(`[product-enricher] Falha de rede ao buscar produtos: ${String(err)}`);
    return null;
  }

  if (!response.ok) {
    console.warn(`[product-enricher] NuvemShop API retornou ${response.status}`);
    return null;
  }

  try {
    return (await response.json()) as NuvemShopProduct[];
  } catch {
    console.warn('[product-enricher] Resposta inválida da NuvemShop');
    return null;
  }
}

/**
 * Fetches up to 10 products from the NuvemShop store and formats them
 * as a markdown context block for injection into the squad briefing.
 *
 * Returns empty string on any failure (graceful degradation — AC5).
 */
export async function fetchClientProducts(): Promise<string> {
  const accessToken = process.env['NUVEMSHOP_ACCESS_TOKEN'];
  const userId = process.env['NUVEMSHOP_USER_ID'];

  if (!accessToken || !userId) {
    console.log('[product-enricher] NUVEMSHOP_ACCESS_TOKEN ou NUVEMSHOP_USER_ID não configurado — sem produtos no briefing');
    return '';
  }

  const products = await fetchProducts();
  if (!products) return '';

  const validProducts = products.filter(
    (p) => p.published && p.canonical_url && (p.name.pt ?? p.name.en),
  );

  if (!validProducts.length) return '';

  const lines = validProducts
    .map((p) => `- ${(p.name.pt ?? p.name.en)!}: ${p.canonical_url}`)
    .join('\n');

  return `## Produtos da Loja (para referência no artigo)\nUse esses produtos e links reais quando relevante para o tópico:\n${lines}`;
}

/**
 * Returns the CDN URL of the first image from the first published product with an image.
 * Used as feature_image for Ghost posts (AEO — Story 6.7).
 * Used as fallback by fetchRelevantProductImageUrl (Story 6.8).
 *
 * Returns null on any failure (graceful degradation — AC6).
 */
export async function fetchFirstProductImageUrl(): Promise<string | null> {
  const accessToken = process.env['NUVEMSHOP_ACCESS_TOKEN'];
  const userId = process.env['NUVEMSHOP_USER_ID'];

  if (!accessToken || !userId) return null;

  const products = await fetchProducts();
  if (!products) return null;

  for (const product of products) {
    if (product.published && product.images?.[0]?.src) {
      return product.images[0].src;
    }
  }

  return null;
}

/**
 * Selects the most semantically relevant product image for a post using gpt-4o-mini.
 * Falls back to fetchFirstProductImageUrl() if LLM fails or returns invalid response.
 * Returns null if no products with images available (graceful degradation — AC5).
 *
 * Story 6.8 — AC1, AC2, AC5, AC6
 */
export async function fetchRelevantProductImageUrl(
  postTitle: string,
  postTopic?: string,
): Promise<{ url: string; productName: string } | null> {
  const products = await fetchProducts();
  if (!products) return null;

  const publishedWithImages = products.filter(
    (p) => p.published && p.images?.[0]?.src && (p.name.pt ?? p.name.en),
  );

  if (!publishedWithImages.length) return null;

  // Fallback: primeiro produto publicado com imagem (comportamento 6.7)
  const fallbackToFirst = (): { url: string; productName: string } | null => {
    const first = publishedWithImages[0];
    if (!first?.images?.[0]?.src) return null;
    return {
      url: first.images[0].src,
      productName: (first.name.pt ?? first.name.en) as string,
    };
  };

  const client = getOpenAIClient();
  if (!client) {
    console.warn('[product-enricher] OPENAI_API_KEY não configurado — usando primeiro produto (fallback 6.7)');
    return fallbackToFirst();
  }

  const productNames = publishedWithImages.map((p) => (p.name.pt ?? p.name.en) as string);
  const prompt = buildSelectionPrompt(postTitle, postTopic, productNames);

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 10,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '';
    const idx = parseInt(raw, 10);

    if (isNaN(idx) || idx < 0 || idx >= publishedWithImages.length) {
      console.warn(`[product-enricher] LLM retornou índice inválido "${raw}" — usando primeiro produto`);
      return fallbackToFirst();
    }

    const selected = publishedWithImages[idx];
    if (!selected?.images?.[0]?.src) return fallbackToFirst();

    return {
      url: selected.images[0].src,
      productName: (selected.name.pt ?? selected.name.en) as string,
    };
  } catch (err) {
    console.warn(`[product-enricher] LLM falhou ao selecionar produto (non-blocking): ${String(err)}`);
    return fallbackToFirst();
  }
}
