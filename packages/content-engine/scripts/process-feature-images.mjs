/**
 * process-feature-images.mjs — Story 8.2 (melhoria)
 *
 * Para cada post com feature_image:
 *   1. Baixa a imagem original (1:1) do NuvemShop
 *   2. Gera versão 1200×630 com fundo desfocado + imagem centralizada
 *   3. Faz upload para o Ghost media library
 *   4. PATCH no post com a nova URL hospedada no Ghost
 */

import { createHmac } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('./node_modules/sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── .env ─────────────────────────────────────────────────────────────────────
const envContent = readFileSync(join(__dirname, '../.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) continue;
  const key = line.slice(0, eqIdx).trim();
  const val = line.slice(eqIdx + 1).trim();
  if (key && !(key in process.env)) process.env[key] = val;
}

// ─── JWT ──────────────────────────────────────────────────────────────────────
function buildJwt(id, secret) {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const s = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

const [keyId, keySecret] = process.env.GHOST_ADMIN_API_KEY.split(':');
const base = process.env.GHOST_API_URL.replace(/\/$/, '');

// ─── Processar imagem: 1:1 → 1200×630 com fundo desfocado ────────────────────
async function makeHeroImage(sourceUrl) {
  // Baixar imagem
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const TARGET_W = 1200;
  const TARGET_H = 630;

  // Fundo: imagem esticada + desfocada fortemente
  const bg = await sharp(buffer)
    .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' })
    .blur(30)
    .modulate({ brightness: 0.6 }) // escurecer um pouco pra contrastar
    .toBuffer();

  // Imagem principal: caber dentro de TARGET_H com margem
  const MAX_H = TARGET_H - 40; // 20px margem cima e baixo
  const fg = await sharp(buffer)
    .resize({ height: MAX_H, withoutEnlargement: true })
    .toBuffer();

  const fgMeta = await sharp(fg).metadata();
  const left = Math.round((TARGET_W - fgMeta.width) / 2);
  const top = Math.round((TARGET_H - fgMeta.height) / 2);

  const result = await sharp(bg)
    .composite([{ input: fg, left, top }])
    .jpeg({ quality: 88 })
    .toBuffer();

  return result;
}

// ─── Upload para Ghost media library ─────────────────────────────────────────
async function uploadToGhost(imageBuffer, filename) {
  const token = buildJwt(keyId, keySecret);

  // Ghost Admin API espera multipart/form-data
  const FormData = (await import('node:buffer')).Blob ? globalThis.FormData : null;

  // Usar fetch com FormData nativo (Node 18+)
  const form = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  form.append('file', blob, filename);
  form.append('purpose', 'image');

  const res = await fetch(`${base}/ghost/api/admin/images/upload/`, {
    method: 'POST',
    headers: {
      Authorization: `Ghost ${token}`,
      'Accept-Version': 'v5.0',
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload falhou ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.images?.[0]?.url;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🖼  process-feature-images — 1:1 → 16:9 hero\n');

  const token = buildJwt(keyId, keySecret);
  const res = await fetch(`${base}/ghost/api/admin/posts/?limit=all&fields=id,slug,title,feature_image,feature_image_alt,updated_at`, {
    headers: { Authorization: `Ghost ${token}`, 'Accept-Version': 'v5.0' },
  });
  const { posts } = await res.json();

  const withImage = posts.filter(p => p.feature_image && p.feature_image.includes('mitiendanube'));
  console.log(`Posts com imagem NuvemShop: ${withImage.length}\n`);

  for (const post of withImage) {
    process.stdout.write(`→ ${post.slug.slice(0, 50).padEnd(50)} `);
    try {
      const processed = await makeHeroImage(post.feature_image);
      const filename = `plaka-hero-${post.slug.slice(0, 30)}.jpg`;
      const ghostUrl = await uploadToGhost(processed, filename);

      const patchToken = buildJwt(keyId, keySecret);
      await fetch(`${base}/ghost/api/admin/posts/${post.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Ghost ${patchToken}`,
          'Accept-Version': 'v5.0',
        },
        body: JSON.stringify({
          posts: [{
            feature_image: ghostUrl,
            feature_image_alt: post.feature_image_alt,
            updated_at: post.updated_at,
          }],
        }),
      });

      console.log(`✅ ${ghostUrl.split('/').pop()}`);
    } catch (err) {
      console.log(`❌ ${err.message.slice(0, 80)}`);
    }
  }

  console.log('\nConcluído.');
}

main().catch(console.error);
