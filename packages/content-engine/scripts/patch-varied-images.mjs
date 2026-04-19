/**
 * patch-varied-images.mjs — Story 8.2 (melhoria: variedade visual)
 *
 * Redistribui as feature images dos 7 posts para usar categorias variadas.
 * Difere do backfill-feature-images.mjs em 2 aspectos:
 *   1. Força update mesmo se o post já tiver feature_image (não é idempotente)
 *   2. Usa mapeamento explícito de categoria por post para garantir variedade
 *
 * Categorias usadas:
 *   como-limpar         → pulseira (1ª)
 *   qualidade           → anel
 *   colares             → colar longo
 *   dia-das-maes        → brinco (1º)
 *   banhada-folheada    → choker diferente (6ª — pula as primeiras Escamas)
 *   banho               → pulseira (2ª)
 *   hipoalergenica      → brinco (2º)
 *
 * Após rodar este script, executar:
 *   node packages/content-engine/scripts/process-feature-images.mjs
 */

import { loadEnv, buildJwt } from './_publish-helpers.mjs';
loadEnv();

const [keyId, keySecret] = process.env.GHOST_ADMIN_API_KEY.split(':');
const base = process.env.GHOST_API_URL.replace(/\/$/, '');
const NS_TOKEN = process.env.NUVEMSHOP_ACCESS_TOKEN;
const NS_USER = process.env.NUVEMSHOP_USER_ID;

// ─── Mapeamento post → produto + índice de imagem com modelo confirmado ───────
// nth: índice do produto nos resultados da busca (0-based)
// imgIdx: índice da imagem dentro do produto que TEM foto com modelo (verificado por Sharp)
const POST_CATEGORIES = [
  {
    slug: 'como-limpar-semi-joia-em-casa-sem-danificar-3',
    title: 'Como Limpar Semi Joia em Casa Sem Danificar',
    query: 'estrelinhas',      // Choker Estrelinhas Dourada — img[1] tem modelo (img_8332)
    nth: 0,
    imgIdx: 1,
  },
  {
    slug: 'como-identificar-semi-joia-de-qualidade-ao-comprar-online',
    title: 'Como Identificar Semi Joia de Qualidade ao Comprar Online',
    query: 'colar longo coracoes', // Colar Longo Mini Corações — img[1] tem modelo (img_2209)
    nth: 0,
    imgIdx: 1,
  },
  {
    slug: 'como-usar-varios-colares-ao-mesmo-tempo-sem-errar',
    title: 'Como Usar Vários Colares ao Mesmo Tempo Sem Errar',
    query: 'colar choker disco', // Colar Choker Disco Heart — img[1] tem modelo
    nth: 0,
    imgIdx: 1,
  },
  {
    slug: 'qual-semi-joia-dar-de-presente-no-dia-das-maes-guia-por-perfil',
    title: 'Qual Semi Joia Dar de Presente no Dia das Mães',
    query: 'galax',            // Choker Galáxia — img[0] já é modelo (img_0100)
    nth: 0,
    imgIdx: 0,
  },
  {
    slug: 'semi-joia-banhada-a-ouro-ou-folheada-qual-a-diferenca-e-o-que-isso-muda-na-pratica',
    title: 'Semi Joia Banhada a Ouro ou Folheada',
    query: 'corrente bicolor', // Choker Corrente Bicolor — img[1] tem modelo
    nth: 0,
    imgIdx: 1,
  },
  {
    slug: 'pode-usar-semi-joia-no-banho-ou-precisa-tirar-antes',
    title: 'Pode Usar Semi Joia no Banho?',
    query: 'bolinhas ouro',    // Choker Bolinhas — img[2] tem modelo (img_0756)
    nth: 0,
    imgIdx: 2,
  },
  {
    slug: 'o-que-e-semi-joia-hipoalergenica-e-como-saber-se-e-de-verdade',
    title: 'O Que É Semi Joia Hipoalergênica?',
    query: 'medalhas prata',   // Choker Medalhas Prata — img[1] tem modelo (img_1568, prata=hipoalergênico)
    nth: 0,
    imgIdx: 1,
  },
];

// ─── NuvemShop ────────────────────────────────────────────────────────────────

/**
 * Busca produtos no NuvemShop por query e retorna a imagem no índice imgIdx.
 * nth: índice do produto nos resultados; imgIdx: índice da imagem dentro do produto.
 * imgIdx verificado previamente com Sharp para garantir foto com modelo.
 * @returns {{ url: string, productName: string } | null}
 */
async function fetchProductImage(query, nth, imgIdx) {
  const url = `https://api.tiendanube.com/v1/${NS_USER}/products?q=${encodeURIComponent(query)}&fields=id,name,images&per_page=20`;

  const res = await fetch(url, {
    headers: {
      Authentication: `bearer ${NS_TOKEN}`,
      'User-Agent': 'MauronStore (mauromattosnegocios@gmail.com)',
    },
  });

  if (!res.ok) throw new Error(`NuvemShop ${res.status} para query "${query}"`);

  const products = await res.json();
  if (!Array.isArray(products)) throw new Error('Resposta inválida da NuvemShop');

  const withImage = products.filter(p => p.images?.length > 0);
  if (withImage.length === 0) return null;

  const product = withImage[Math.min(nth, withImage.length - 1)];
  const images = product.images ?? [];

  // Usa índice específico (verificado previamente para ter foto de modelo)
  const safeIdx = Math.min(imgIdx ?? 0, images.length - 1);
  const chosen = images[safeIdx];

  const imageUrl = chosen?.src;
  const productName =
    (typeof product.name === 'object'
      ? product.name?.pt ?? product.name?.en
      : product.name) ?? 'Produto Plaka';

  if (!imageUrl) return null;
  return { url: imageUrl, productName: String(productName) };
}

// ─── Ghost helpers ────────────────────────────────────────────────────────────

async function getPostBySlug(slug) {
  const token = buildJwt(keyId, keySecret);
  const url = `${base}/ghost/api/admin/posts/?filter=slug:${slug}&fields=id,title,slug,feature_image,codeinjection_head,updated_at`;
  const res = await fetch(url, {
    headers: { Authorization: `Ghost ${token}`, 'Accept-Version': 'v5.0' },
  });
  if (!res.ok) throw new Error(`Ghost GET "${slug}": ${res.status}`);
  const data = await res.json();
  return data.posts?.[0] ?? null;
}

async function patchPost(postId, updatedAt, imageUrl, imageAlt) {
  const token = buildJwt(keyId, keySecret);
  const res = await fetch(`${base}/ghost/api/admin/posts/${postId}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Ghost ${token}`,
      'Accept-Version': 'v5.0',
    },
    body: JSON.stringify({
      posts: [{
        feature_image: imageUrl,
        feature_image_alt: imageAlt,
        updated_at: updatedAt,
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => String(res.status));
    throw new Error(`Ghost PATCH ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎨  patch-varied-images — redistribuindo fotos com variedade\n');

  if (!NS_TOKEN || !NS_USER) {
    console.error('[ERRO] NUVEMSHOP_ACCESS_TOKEN ou NUVEMSHOP_USER_ID não configurados');
    process.exit(1);
  }

  const results = { ok: 0, noImage: 0, notFound: 0, error: 0 };

  for (const def of POST_CATEGORIES) {
    const { slug, title, query, nth } = def;
    process.stdout.write(`→ [${query}:${nth}] ${slug.slice(0, 45).padEnd(45)} `);

    try {
      // Busca imagem no NuvemShop (imgIdx aponta para foto com modelo, verificado previamente)
      const imageResult = await fetchProductImage(query, nth, def.imgIdx);
      if (!imageResult) {
        console.log(`⚠️  sem imagem para "${query}"`);
        results.noImage++;
        continue;
      }

      // Busca post no Ghost
      const post = await getPostBySlug(slug);
      if (!post) {
        console.log(`❌  post não encontrado no Ghost`);
        results.notFound++;
        continue;
      }

      const imageAlt = `${imageResult.productName} — Plaka Acessórios`;

      // PATCH
      await patchPost(post.id, post.updated_at, imageResult.url, imageAlt);

      // Mostra nome do produto escolhido
      const productShort = imageResult.productName.slice(0, 40);
      console.log(`✅  ${productShort}`);
      results.ok++;
    } catch (err) {
      console.log(`❌  ${err.message.slice(0, 80)}`);
      results.error++;
    }
  }

  console.log(`\nResultado: ${results.ok} atualizados | ${results.noImage} sem imagem | ${results.notFound} não encontrados | ${results.error} erros`);

  if (results.ok > 0) {
    console.log('\nPróximo passo: node packages/content-engine/scripts/process-feature-images.mjs');
  }
}

main().catch(console.error);
