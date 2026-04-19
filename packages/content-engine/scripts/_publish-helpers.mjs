/**
 * _publish-helpers.mjs — Story 8.2
 * Funções reutilizáveis para scripts de publicação manual do squad Plaka.
 *
 * Exports:
 *   buildJwt(id, secret)                          → JWT HS256 para Ghost Admin API
 *   slugify(text)                                  → slug URL-safe
 *   resolveFeatureImage(title, topic)              → { url, productName } | null
 *   loadEnv()                                      → carrega .env do content-engine
 */

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Carregamento de .env ─────────────────────────────────────────────────────

/**
 * Carrega o arquivo .env do pacote content-engine e injeta em process.env.
 * Idempotente: chamadas repetidas não sobrescrevem valores já existentes.
 */
export function loadEnv() {
  const envPath = join(__dirname, '../.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.warn(`[publish-helpers] Não foi possível carregar .env: ${String(err)}`);
  }
}

// ─── JWT (Ghost Admin API — HS256 com secret em hex) ─────────────────────────

/**
 * Gera um JWT HS256 válido por 5 minutos para a Ghost Admin API.
 * Padrão extraído de ghost-publisher.ts (Story 6.2).
 *
 * @param {string} id     — parte antes do ":" em GHOST_ADMIN_API_KEY
 * @param {string} secret — parte após o ":" em GHOST_ADMIN_API_KEY (hex)
 * @returns {string} JWT assinado
 */
export function buildJwt(id, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const sig = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// ─── Slug ─────────────────────────────────────────────────────────────────────

/**
 * Converte um título em slug URL-safe.
 * Padrão idêntico ao de ghost-publisher.ts e todos os scripts manuais.
 *
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

// ─── Feature Image via NuvemShop ─────────────────────────────────────────────

/**
 * Tenta importar fetchRelevantProductImageUrl do dist compilado.
 * Se dist não estiver disponível, cai para implementação direta via API.
 *
 * Graceful degradation: retorna null em qualquer falha —
 * publicação segue sem imagem (padrão publication-orchestrator.ts).
 *
 * @param {string} title  — título do post (usado como query NuvemShop se sem LLM)
 * @param {string} topic  — tópico do post (ex: "cuidados brinco")
 * @returns {Promise<{ url: string, productName: string } | null>}
 */
export async function resolveFeatureImage(title, topic) {
  // Tenta usar o dist compilado (product-enricher.js) — preferível pois usa LLM
  try {
    const distPath = join(__dirname, '../dist/product-enricher.js');
    const { fetchRelevantProductImageUrl } = await import(distPath);
    const result = await fetchRelevantProductImageUrl(title, topic);
    return result ?? null;
  } catch (distErr) {
    console.warn(`[publish-helpers] dist/product-enricher.js indisponível — usando fallback direto: ${String(distErr)}`);
  }

  // Fallback direto: chama NuvemShop API sem LLM
  return _resolveFeatureImageDirect(title, topic);
}

/**
 * Implementação direta da busca de imagem na NuvemShop.
 * Usada quando dist/product-enricher.js não está disponível.
 * Busca produtos com query baseada no tópico e retorna a primeira imagem.
 *
 * @param {string} title
 * @param {string} topic
 * @returns {Promise<{ url: string, productName: string } | null>}
 */
async function _resolveFeatureImageDirect(title, topic) {
  const accessToken = process.env['NUVEMSHOP_ACCESS_TOKEN'];
  const userId = process.env['NUVEMSHOP_USER_ID'];

  if (!accessToken || !userId) {
    console.warn('[publish-helpers] NUVEMSHOP_ACCESS_TOKEN ou NUVEMSHOP_USER_ID não configurados — sem feature image');
    return null;
  }

  // Monta query a partir do tópico — usa a última palavra (mais específica)
  // Ex: "cuidados brinco" → "brinco", "colares layering" → "colar"
  const words = (topic ?? title).split(/\s+/).filter(Boolean);
  const query = words[words.length - 1] ?? words[0];

  const url = `https://api.tiendanube.com/v1/${userId}/products?q=${encodeURIComponent(query)}&fields=id,name,images&per_page=5`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authentication: `bearer ${accessToken}`,
        'User-Agent': 'MauronStore (mauromattosnegocios@gmail.com)',
      },
    });
  } catch (err) {
    console.warn(`[publish-helpers] Falha de rede ao buscar produtos NuvemShop: ${String(err)}`);
    return null;
  }

  if (!response.ok) {
    console.warn(`[publish-helpers] NuvemShop API retornou ${response.status} — sem feature image`);
    return null;
  }

  let products;
  try {
    products = await response.json();
  } catch {
    console.warn('[publish-helpers] Resposta inválida da NuvemShop');
    return null;
  }

  if (!Array.isArray(products) || products.length === 0) {
    // Tenta busca sem filtro para pegar o primeiro produto disponível
    return _resolveFirstProductImage(accessToken, userId);
  }

  for (const product of products) {
    // Preferir foto lifestyle (img_*) sobre foto de produto (UUID)
    const images = product.images ?? [];
    const lifestyle = images.find(img => img.src?.split('/').pop()?.startsWith('img_'));
    const chosen = lifestyle ?? images[0];
    const imageUrl = chosen?.src;
    const productName = product.name?.pt ?? product.name?.en ?? product.name;
    if (imageUrl && productName) {
      return { url: imageUrl, productName: String(productName) };
    }
  }

  return _resolveFirstProductImage(accessToken, userId);
}

/**
 * Busca o primeiro produto publicado com imagem sem filtro de query.
 * Último fallback antes de retornar null.
 */
async function _resolveFirstProductImage(accessToken, userId) {
  try {
    const url = `https://api.tiendanube.com/v1/${userId}/products?per_page=10&fields=id,name,images,published`;
    const response = await fetch(url, {
      headers: {
        Authentication: `bearer ${accessToken}`,
        'User-Agent': 'MauronStore (mauromattosnegocios@gmail.com)',
      },
    });

    if (!response.ok) return null;

    const products = await response.json();
    if (!Array.isArray(products)) return null;

    for (const product of products) {
      const imageUrl = product.images?.[0]?.src;
      const productName = product.name?.pt ?? product.name?.en ?? product.name;
      if (imageUrl && productName) {
        return { url: imageUrl, productName: String(productName) };
      }
    }
  } catch {
    // silencia — graceful degradation
  }

  return null;
}
