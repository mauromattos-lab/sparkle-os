// product-enricher.ts — Stories 6.6 + 6.7
// Fetches product catalog from NuvemShop API to enrich squad briefing
// Graceful degradation: returns empty string / null if API unavailable or misconfigured

interface NuvemShopProduct {
  name: { pt?: string; en?: string };
  canonical_url: string;
  published: boolean;
  images?: Array<{ src: string }>;
}

const NUVEMSHOP_API = (userId: string) =>
  `https://api.tiendanube.com/v1/${userId}/products?per_page=10&sort_by=updated_at&sort_direction=desc`;

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
