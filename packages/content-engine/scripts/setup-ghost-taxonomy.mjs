/**
 * setup-ghost-taxonomy.mjs
 * Story 8.1 — Ghost: Tags, Taxonomia e Correções de Estrutura
 *
 * Cria 6 tags AEO no Ghost CMS, aplica nos 8 posts existentes,
 * atualiza tagline do blog e bio do autor. Idempotente.
 */

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ─── Carregar .env ─────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '../.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

// ─── JWT HS256 ─────────────────────────────────────────────────────────────────
function buildJwt(id, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const sig = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// ─── Config ────────────────────────────────────────────────────────────────────
const TAGS = [
  { slug: 'cuidados',   name: 'Cuidados',    description: 'Como limpar, guardar e preservar semi joias' },
  { slug: 'qualidade',  name: 'Qualidade',   description: 'Como identificar e avaliar a qualidade de semi joias' },
  { slug: 'estilo',     name: 'Estilo',      description: 'Como usar e combinar semi joias em diferentes looks' },
  { slug: 'materiais',  name: 'Materiais',   description: 'Tipos de metais, banhos e composição de semi joias' },
  { slug: 'tendencias', name: 'Tendências',  description: 'O que está em alta no mundo das semi joias' },
  { slug: 'ocasioes',   name: 'Ocasiões',    description: 'Semi joias certas para cada momento' },
];

// Mapeamento: slug do post → slug da tag
// O slug do post "como-limpar" pode ter variante com sufixo — será resolvido via GET com filtro
const POST_TAG_MAP = [
  { slugPattern: 'como-limpar-semi-joia-em-casa',                                             tag: 'cuidados'  },
  { slugPattern: 'por-que-semi-joia-deixa-a-pele-verde',                                      tag: 'cuidados'  },
  { slugPattern: 'como-identificar-semi-joia-de-qualidade-ao-comprar-online',                  tag: 'qualidade' },
  { slugPattern: 'como-usar-varios-colares-ao-mesmo-tempo-sem-errar',                          tag: 'estilo'    },
  { slugPattern: 'qual-semi-joia-dar-de-presente-no-dia-das-maes-guia-por-perfil',             tag: 'ocasioes'  },
  { slugPattern: 'semi-joia-banhada-a-ouro-ou-folheada-qual-a-diferenca-e-o-que-isso-muda-na-pratica', tag: 'materiais' },
  { slugPattern: 'pode-usar-semi-joia-no-banho-ou-precisa-tirar-antes',                        tag: 'cuidados'  },
  { slugPattern: 'o-que-e-semi-joia-hipoalergenica-e-como-saber-se-e-de-verdade',              tag: 'qualidade' },
];

const BLOG_DESCRIPTION = 'Semi joias: guias técnicos, cuidados e tendências — Plaka Acessórios';

const AUTHOR_BIO = 'Especialistas em semi joias premium acessíveis. Desde Ipanema, com coleções que combinam sofisticação mediterrânea e lifestyle carioca. Guias técnicos sobre materiais, cuidados e estilo para quem leva semi joias a sério.';
const AUTHOR_WEBSITE = 'https://plakaacessorios.com';
const AUTHOR_NAME = 'Plaka Acessórios';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function ghostFetch(baseUrl, token, path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Ghost ${token}`,
      'Accept-Version': 'v5.0',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ghost API ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

// ─── 1. Criar tags (idempotente) ──────────────────────────────────────────────
async function ensureTags(baseUrl, token) {
  console.log('\n── TAGS ─────────────────────────────────────────────────────');
  const existing = await ghostFetch(baseUrl, token, '/ghost/api/admin/tags/?limit=all');
  const existingBySlug = Object.fromEntries((existing.tags ?? []).map(t => [t.slug, t]));

  const tagIdMap = {};

  for (const tag of TAGS) {
    if (existingBySlug[tag.slug]) {
      tagIdMap[tag.slug] = existingBySlug[tag.slug].id;
      console.log(`  ✓ Tag já existe: ${tag.slug} (id: ${existingBySlug[tag.slug].id})`);
    } else {
      const res = await ghostFetch(baseUrl, token, '/ghost/api/admin/tags/', 'POST', { tags: [tag] });
      const created = res.tags?.[0];
      tagIdMap[tag.slug] = created.id;
      console.log(`  ✅ Tag criada:    ${tag.slug} (id: ${created.id})`);
    }
  }

  return tagIdMap;
}

// ─── 2. Resolver slugs de posts via GET com filtro ────────────────────────────
async function resolvePostSlugs(baseUrl, token) {
  console.log('\n── RESOLUÇÃO DE SLUGS ──────────────────────────────────────');
  const allPosts = await ghostFetch(baseUrl, token, '/ghost/api/admin/posts/?limit=all&include=tags');
  const posts = allPosts.posts ?? [];
  console.log(`  Posts encontrados no Ghost: ${posts.length}`);

  const resolved = [];

  for (const entry of POST_TAG_MAP) {
    // Busca por inclusão no slug (para cobrir variantes com sufixo numérico como -3)
    const match = posts.find(p => p.slug.includes(entry.slugPattern) || entry.slugPattern.includes(p.slug));
    if (match) {
      resolved.push({ id: match.id, slug: match.slug, title: match.title, tag: entry.tag, existingTags: match.tags ?? [] });
      console.log(`  ✓ Resolvido: "${match.slug}" → tag: ${entry.tag}`);
    } else {
      console.log(`  ⚠ Não encontrado: padrão "${entry.slugPattern}" — pulando`);
    }
  }

  return resolved;
}

// ─── 3. Aplicar tags nos posts (merge — não replace cego) ─────────────────────
async function applyTagsToPosts(baseUrl, token, resolvedPosts) {
  console.log('\n── APLICAÇÃO DE TAGS NOS POSTS ─────────────────────────────');

  for (const post of resolvedPosts) {
    // Fetch post completo para obter updated_at (necessário para PATCH no Ghost)
    const postData = await ghostFetch(baseUrl, token, `/ghost/api/admin/posts/${post.id}/?include=tags`);
    const current = postData.posts?.[0];
    if (!current) {
      console.log(`  ⚠ POST ${post.id} não retornou dados — pulando`);
      continue;
    }

    const existingSlugs = (current.tags ?? []).map(t => t.slug);
    const alreadyHasTag = existingSlugs.includes(post.tag);

    if (alreadyHasTag) {
      console.log(`  ✓ Post já tem tag "${post.tag}": ${post.slug}`);
      continue;
    }

    // Merge: manter tags existentes + adicionar nova
    const mergedTags = [...(current.tags ?? []).map(t => ({ slug: t.slug })), { slug: post.tag }];

    await ghostFetch(baseUrl, token, `/ghost/api/admin/posts/${post.id}/`, 'PUT', {
      posts: [{
        tags: mergedTags,
        updated_at: current.updated_at,
      }],
    });

    console.log(`  ✅ Tag "${post.tag}" aplicada em: ${post.slug}`);
  }
}

// ─── 4. Atualizar tagline do blog ──────────────────────────────────────────────
async function updateBlogDescription(baseUrl, token) {
  console.log('\n── BLOG DESCRIPTION ────────────────────────────────────────');
  const current = await ghostFetch(baseUrl, token, '/ghost/api/admin/settings/');
  // Ghost v5 returns settings as array [ { key, value }, ... ]
  const settingsData = current.settings;
  const desc = Array.isArray(settingsData)
    ? settingsData.find(s => s.key === 'description')?.value
    : settingsData?.description;

  if (desc === BLOG_DESCRIPTION) {
    console.log('  ✓ Blog description já está correta');
    return;
  }

  console.log(`  Valor atual: "${desc}"`);
  console.log(`  Valor alvo:  "${BLOG_DESCRIPTION}"`);

  try {
    await ghostFetch(baseUrl, token, '/ghost/api/admin/settings/', 'PUT', {
      settings: [{ key: 'description', value: BLOG_DESCRIPTION }],
    });
    console.log(`  ✅ Blog description atualizada`);
  } catch (err) {
    if (err.message.includes('501') || err.message.includes('NotImplemented')) {
      console.log('  ⚠ PUT /settings/ retornou 501 — limitação do plano de hosting Ghost.');
      console.log('  ⚠ Ação manual: Ghost Admin → Settings → General → Blog description');
      console.log(`  ⚠ Valor: "${BLOG_DESCRIPTION}"`);
    } else {
      throw err;
    }
  }
}

// ─── 5. Atualizar bio do autor ─────────────────────────────────────────────────
async function updateAuthorBio(baseUrl, token) {
  console.log('\n── AUTHOR BIO ──────────────────────────────────────────────');
  const usersRes = await ghostFetch(baseUrl, token, '/ghost/api/admin/users/?limit=all');
  const author = (usersRes.users ?? []).find(u => u.name === AUTHOR_NAME);

  if (!author) {
    console.log(`  ⚠ Autor "${AUTHOR_NAME}" não encontrado — pulando`);
    return;
  }

  if (author.bio === AUTHOR_BIO && author.website === AUTHOR_WEBSITE) {
    console.log(`  ✓ Bio e website do autor já estão corretos`);
    return;
  }

  try {
    await ghostFetch(baseUrl, token, `/ghost/api/admin/users/${author.id}/`, 'PUT', {
      users: [{
        bio: AUTHOR_BIO,
        website: AUTHOR_WEBSITE,
      }],
    });
    console.log(`  ✅ Bio e website do autor "${AUTHOR_NAME}" atualizados`);
  } catch (err) {
    if (err.message.includes('501') || err.message.includes('NotImplemented')) {
      console.log('  ⚠ PUT /users/ retornou 501 — limitação do plano de hosting Ghost.');
      console.log('  ⚠ Ação manual: Ghost Admin → Staff → Plaka Acessórios → editar bio e website');
      console.log(`  ⚠ Bio:     "${AUTHOR_BIO}"`);
      console.log(`  ⚠ Website: "${AUTHOR_WEBSITE}"`);
    } else {
      throw err;
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const ghostUrl = process.env.GHOST_API_URL;
  const apiKey = process.env.GHOST_ADMIN_API_KEY;

  if (!ghostUrl || !apiKey) {
    console.error('❌ GHOST_API_URL ou GHOST_ADMIN_API_KEY não configurados no .env');
    process.exit(1);
  }

  const [keyId, keySecret] = apiKey.split(':');
  const baseUrl = ghostUrl.replace(/\/$/, '');
  const token = buildJwt(keyId, keySecret);

  console.log(`\n🚀 setup-ghost-taxonomy — ${baseUrl}`);
  console.log('════════════════════════════════════════════════════════════');

  await ensureTags(baseUrl, token);
  const resolvedPosts = await resolvePostSlugs(baseUrl, token);
  await applyTagsToPosts(baseUrl, token, resolvedPosts);
  await updateBlogDescription(baseUrl, token);
  await updateAuthorBio(baseUrl, token);

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('✅ setup-ghost-taxonomy concluído com sucesso');
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
