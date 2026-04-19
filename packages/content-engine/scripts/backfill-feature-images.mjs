/**
 * backfill-feature-images.mjs — Story 8.2
 *
 * Aplica feature_image + JSON-LD ImageObject nos posts do squad Plaka
 * que foram publicados sem imagem.
 *
 * Comportamento:
 *   - GET post por slug para obter ID, updated_at e codeinjection_head atual
 *   - Skip se o post já tiver feature_image definida (idempotente)
 *   - Chama resolveFeatureImage(title, topic) do helper
 *   - PATCH com feature_image, feature_image_alt e codeinjection_head atualizado
 *   - Se NuvemShop indisponível → loga warning e skip (graceful degradation)
 *   - Merge de JSON-LD: preserva FAQPage e outros schemas existentes
 *
 * Uso:
 *   node packages/content-engine/scripts/backfill-feature-images.mjs
 *
 * Pré-requisito: GHOST_API_URL, GHOST_ADMIN_API_KEY, NUVEMSHOP_ACCESS_TOKEN,
 *                NUVEMSHOP_USER_ID configurados em packages/content-engine/.env
 */

import { loadEnv, buildJwt, resolveFeatureImage } from './_publish-helpers.mjs';

// Carrega .env antes de qualquer outra operação
loadEnv();

// ─── Posts para backfill ──────────────────────────────────────────────────────
// "pele verde" omitido — post não está no Ghost ainda

const POSTS = [
  {
    slug: 'como-limpar-semi-joia-em-casa-sem-danificar-3',
    title: 'Como Limpar Semi Joia em Casa Sem Danificar',
    topic: 'limpeza cuidados',
  },
  {
    slug: 'como-identificar-semi-joia-de-qualidade-ao-comprar-online',
    title: 'Como Identificar Semi Joia de Qualidade ao Comprar Online',
    topic: 'qualidade banho',
  },
  {
    slug: 'como-usar-varios-colares-ao-mesmo-tempo-sem-errar',
    title: 'Como Usar Vários Colares ao Mesmo Tempo Sem Errar',
    topic: 'colares layering',
  },
  {
    slug: 'qual-semi-joia-dar-de-presente-no-dia-das-maes-guia-por-perfil',
    title: 'Qual Semi Joia Dar de Presente no Dia das Mães: Guia por Perfil',
    topic: 'presente argola',
  },
  {
    slug: 'semi-joia-banhada-a-ouro-ou-folheada-qual-a-diferenca-e-o-que-isso-muda-na-pratica',
    title: 'Semi Joia Banhada a Ouro ou Folheada: Qual a Diferença e o Que Isso Muda na Prática',
    topic: 'banho ouro colar',
  },
  {
    slug: 'pode-usar-semi-joia-no-banho-ou-precisa-tirar-antes',
    title: 'Pode Usar Semi Joia no Banho ou Precisa Tirar Antes?',
    topic: 'cuidados brinco',
  },
  {
    slug: 'o-que-e-semi-joia-hipoalergenica-e-como-saber-se-e-de-verdade',
    title: 'O Que É Semi Joia Hipoalergênica e Como Saber Se É de Verdade?',
    topic: 'hipoalergênico argola',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrai o token JWT fresco a partir das variáveis de ambiente.
 * @returns {{ keyId: string, keySecret: string, token: string, baseUrl: string }}
 */
function getGhostAuth() {
  const ghostApiUrl = process.env['GHOST_API_URL'];
  const ghostAdminApiKey = process.env['GHOST_ADMIN_API_KEY'];

  if (!ghostApiUrl || !ghostAdminApiKey) {
    throw new Error('GHOST_API_URL ou GHOST_ADMIN_API_KEY não configurados');
  }

  const parts = ghostAdminApiKey.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('GHOST_ADMIN_API_KEY inválida — formato esperado: {id}:{secret}');
  }

  const [keyId, keySecret] = parts;
  const baseUrl = ghostApiUrl.replace(/\/$/, '');
  const token = buildJwt(keyId, keySecret);

  return { keyId, keySecret, token, baseUrl };
}

/**
 * Faz GET /ghost/api/admin/posts/?filter=slug:{slug}
 * Retorna o objeto do post ou null se não encontrado.
 */
async function getPostBySlug(baseUrl, token, slug) {
  const url = `${baseUrl}/ghost/api/admin/posts/?filter=slug:${slug}&fields=id,title,slug,feature_image,codeinjection_head,updated_at`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Ghost ${token}`,
      'Accept-Version': 'v5.0',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => String(response.status));
    throw new Error(`Ghost GET por slug "${slug}" retornou ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.posts?.[0] ?? null;
}

/**
 * Faz merge inteligente do codeinjection_head existente com a nova imageUrl.
 *
 * Estratégia:
 *   1. Se não há codeinjection_head → gera novo com BlogPosting + ImageObject
 *   2. Se há codeinjection_head existente:
 *      a. Extrai o JSON-LD do script tag
 *      b. Localiza o schema BlogPosting (pode ser item do array ou raiz)
 *      c. Adiciona/substitui o campo `image`
 *      d. Re-serializa preservando todos os outros schemas (ex: FAQPage)
 *
 * @param {string|null} existingHead — valor atual de codeinjection_head
 * @param {string} postTitle
 * @param {string} imageUrl
 * @param {string} imageAlt
 * @returns {string} novo codeinjection_head
 */
function buildUpdatedCodeinjectionHead(existingHead, postTitle, imageUrl, imageAlt) {
  const imageObject = {
    '@type': 'ImageObject',
    url: imageUrl,
    description: imageAlt,
  };

  // Sem head anterior → gera estrutura mínima
  if (!existingHead || !existingHead.trim()) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: postTitle,
      author: { '@type': 'Organization', name: 'Plaka Acessórios' },
      publisher: { '@type': 'Organization', name: 'Plaka Acessórios' },
      inLanguage: 'pt-BR',
      image: imageObject,
    };
    return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
  }

  // Tenta extrair JSON-LD existente
  const scriptMatch = existingHead.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!scriptMatch || !scriptMatch[1]) {
    // Não encontrou JSON-LD — preserva head existente e adiciona novo schema ao final
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: postTitle,
      image: imageObject,
    };
    return `${existingHead}\n<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
  }

  let parsed;
  try {
    parsed = JSON.parse(scriptMatch[1].trim());
  } catch {
    // JSON malformado — substitui apenas o script tag por um novo
    console.warn(`    [warn] JSON-LD existente malformado — gerando novo schema`);
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: postTitle,
      image: imageObject,
    };
    return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
  }

  // parsed pode ser array de schemas ou objeto único
  let schemas = Array.isArray(parsed) ? parsed : [parsed];

  // Localiza o BlogPosting e injeta o image
  let foundBlogPosting = false;
  schemas = schemas.map((schema) => {
    if (schema['@type'] === 'BlogPosting') {
      foundBlogPosting = true;
      return { ...schema, image: imageObject };
    }
    return schema;
  });

  // Se não havia BlogPosting, adiciona um novo ao array
  if (!foundBlogPosting) {
    schemas.unshift({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: postTitle,
      image: imageObject,
    });
  }

  // Re-serializa: array com 1 item → objeto; array com 2+ → array
  const output = schemas.length === 1 ? schemas[0] : schemas;

  // Substitui o script tag no head preservando tudo que estava fora dele
  const newScript = `<script type="application/ld+json">\n${JSON.stringify(output, null, 2)}\n</script>`;
  return existingHead.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i, newScript);
}

/**
 * Faz PATCH /ghost/api/admin/posts/{id}/
 * Requer updated_at para evitar conflito de versão no Ghost.
 */
async function patchPost(baseUrl, token, postId, updatedAt, patchData) {
  const url = `${baseUrl}/ghost/api/admin/posts/${postId}/`;

  const body = {
    posts: [
      {
        ...patchData,
        updated_at: updatedAt,
      },
    ],
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Ghost ${token}`,
      'Accept-Version': 'v5.0',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => String(response.status));
    throw new Error(`Ghost PATCH retornou ${response.status}: ${errBody.slice(0, 300)}`);
  }

  return response.json();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Backfill Feature Images — Story 8.2 ===\n');

  let auth;
  try {
    auth = getGhostAuth();
  } catch (err) {
    console.error(`[ERRO] ${err.message}`);
    process.exit(1);
  }

  const results = {
    updated: 0,
    skipped: 0,
    noImage: 0,
    notFound: 0,
    errors: 0,
  };

  for (const postDef of POSTS) {
    const { slug, title, topic } = postDef;
    console.log(`\n→ ${slug}`);

    // Tokens expiram em 5min — regenerar a cada post para garantir validade
    const { keyId: _kid, keySecret, token, baseUrl } = getGhostAuth();
    const freshToken = buildJwt(auth.baseUrl === baseUrl ? _kid : _kid, keySecret);

    // GET post pelo slug
    let post;
    try {
      post = await getPostBySlug(auth.baseUrl, freshToken, slug);
    } catch (err) {
      console.error(`  [ERRO] Falha ao buscar post: ${err.message}`);
      results.errors++;
      continue;
    }

    if (!post) {
      console.log(`  [skip] Post não encontrado no Ghost — pode ter slug diferente`);
      results.notFound++;
      continue;
    }

    console.log(`  ID: ${post.id}`);

    // Idempotência: skip se já tem feature_image
    if (post.feature_image) {
      console.log(`  [skip] Já tem feature_image: ${post.feature_image}`);
      results.skipped++;
      continue;
    }

    // Resolve imagem via product-enricher / NuvemShop
    let imageResult;
    try {
      imageResult = await resolveFeatureImage(title, topic);
    } catch (err) {
      console.warn(`  [warn] resolveFeatureImage lançou exceção: ${err.message}`);
      imageResult = null;
    }

    if (!imageResult) {
      console.log(`  [sem imagem — NuvemShop indisponível] Post "${slug}" ficará sem feature_image`);
      results.noImage++;
      continue;
    }

    const { url: imageUrl, productName } = imageResult;
    const imageAlt = `${productName} — Plaka Acessórios`;

    console.log(`  Produto selecionado: ${productName}`);
    console.log(`  Imagem: ${imageUrl}`);

    // Atualiza codeinjection_head com merge de JSON-LD
    const updatedHead = buildUpdatedCodeinjectionHead(
      post.codeinjection_head,
      title,
      imageUrl,
      imageAlt
    );

    // PATCH
    try {
      // Token fresco para o PATCH (garante não expirado após resolveFeatureImage)
      const patchToken = buildJwt(_kid, keySecret);

      await patchPost(auth.baseUrl, patchToken, post.id, post.updated_at, {
        feature_image: imageUrl,
        feature_image_alt: imageAlt,
        codeinjection_head: updatedHead,
      });

      console.log(`  ✓ PATCH aplicado com sucesso`);
      results.updated++;
    } catch (err) {
      console.error(`  [ERRO] PATCH falhou: ${err.message}`);
      results.errors++;
    }
  }

  // ─── Sumário final ────────────────────────────────────────────────────────

  console.log('\n=== Sumário ===');
  console.log(`  Atualizados:   ${results.updated}`);
  console.log(`  Já tinham img: ${results.skipped}`);
  console.log(`  Sem imagem:    ${results.noImage}`);
  console.log(`  Não encontrado:${results.notFound}`);
  console.log(`  Erros:         ${results.errors}`);

  if (results.errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n[ERRO FATAL]', err);
  process.exit(1);
});
