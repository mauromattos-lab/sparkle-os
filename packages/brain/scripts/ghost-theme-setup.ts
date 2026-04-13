/**
 * Ghost Theme Setup — Story 6.5
 *
 * Configura identidade visual da Plaka Acessórios no Ghost CMS via Admin API.
 * Design spec produzida por @ux-design-expert (Uma) a partir de pesquisa @analyst (Atlas).
 *
 * ACs cobertos:
 *   AC1 — accent_color: #0197b2 (teal Plaka)
 *   AC2 — Logo Plaka uploaded e configurado no header
 *   AC3 — Título "Blog Plaka Acessórios" e tagline AEO configurados
 *   AC4 — CSS Poppins + overrides Casper via codeinjection_head
 *   AC5 — Este script (reproduzível via env vars)
 *
 * Uso:
 *   node --env-file=.env --import tsx/esm scripts/ghost-theme-setup.ts
 *
 * Variáveis de ambiente necessárias:
 *   GHOST_API_URL       — ex: http://187.77.37.88:2368
 *   GHOST_ADMIN_API_KEY — formato: {id}:{secret}  (Ghost > Settings > Integrations)
 */

import { createHmac } from 'node:crypto';

// ─── Brand Constants (Spec: @ux-design-expert) ───────────────────────────────

const BRAND = {
  title: 'Blog Plaka Acessórios',
  description: 'Dicas de moda, acessórios e tendências para você se expressar com estilo.',
  accentColor: '#0197b2',
  // CDN NuvemShop — logo oficial da Plaka (webp, fundo transparente/branco)
  logoSourceUrl:
    'https://acdn-us.mitiendanube.com/stores/001/447/473/themes/common/' +
    'logo-698749882-1755258081-5734deba66e37e04a36ad720321b63f01755258081-480-0.webp',
} as const;

// ─── Custom CSS (Design Spec: @ux-design-expert + Pesquisa: @analyst) ────────

const CUSTOM_CSS = `
/* Plaka Acessórios — Blog Theme (Story 6.5) */
/* Design: @ux-design-expert | Pesquisa de marca: @analyst */
@import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

/* CSS Variables Casper — overrides de cor e tipografia */
:root {
  --ghost-accent-color: #0197b2;
  --color-accent: #0197b2;
  --gh-font-body: 'Poppins', system-ui, sans-serif;
  --gh-font-heading: 'Poppins', system-ui, sans-serif;
}

/* Tipografia global Poppins */
body {
  font-family: 'Poppins', system-ui, sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Poppins', system-ui, sans-serif;
  font-weight: 600;
}

/* Header — fundo teal Plaka (#0197b2) */
.gh-head {
  background-color: #0197b2 !important;
}

/* Logo — invertido para branco no fundo teal */
.gh-head-logo {
  filter: brightness(0) invert(1);
}

/* Links e botões do header em branco */
.gh-head a,
.gh-head button {
  color: #ffffff !important;
}

/* Post cards — bordas arredondadas, estilo premium minimalista */
.post-card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.10);
}

/* Tags/categorias — rosa secundário Plaka (#d94f73) */
.post-card-primary-tag {
  color: #d94f73;
  font-weight: 500;
}

/* Botões CTA */
.gh-btn,
button[type="submit"] {
  background: #0197b2;
  color: #ffffff;
  border-radius: 8px;
  border: none;
}

.gh-btn:hover {
  background: #017a90;
}
`.trim();

// ─── Config ───────────────────────────────────────────────────────────────────

interface GhostConfig {
  url: string;
  id: string;
  secret: string;
}

function validateConfig(): GhostConfig {
  const apiUrl = process.env.GHOST_API_URL;
  const adminKey = process.env.GHOST_ADMIN_API_KEY;

  if (!apiUrl) throw new Error('GHOST_API_URL não definida no .env');
  if (!adminKey) throw new Error('GHOST_ADMIN_API_KEY não definida no .env');

  const parts = adminKey.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('GHOST_ADMIN_API_KEY inválida — formato esperado: {id}:{secret}');
  }

  return { url: apiUrl.replace(/\/$/, ''), id: parts[0], secret: parts[1] };
}

// ─── JWT (HS256 — mesmo padrão do ghost-poc.ts) ──────────────────────────────

function buildJwt(id: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })
  ).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const keyBuffer = Buffer.from(secret, 'hex');
  const signature = createHmac('sha256', keyBuffer)
    .update(signingInput)
    .digest('base64url');
  return `${signingInput}.${signature}`;
}

// ─── Ghost Fetch (com timeout 30s) ────────────────────────────────────────────

async function ghostFetch(
  baseUrl: string,
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const existingHeaders = options.headers as Record<string, string> | undefined;
    const headers: Record<string, string> = {
      Authorization: `Ghost ${token}`,
      'Accept-Version': 'v5.0',
      ...existingHeaders,
    };
    return await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ─── AC2: Upload de Logo ──────────────────────────────────────────────────────

async function uploadLogo(baseUrl: string, token: string): Promise<string> {
  console.log('  Baixando logo da CDN NuvemShop...');
  const logoRes = await fetch(BRAND.logoSourceUrl);
  if (!logoRes.ok) {
    throw new Error(`Falha ao baixar logo: HTTP ${logoRes.status}`);
  }

  const logoBuffer = await logoRes.arrayBuffer();
  const logoBlob = new Blob([logoBuffer], { type: 'image/webp' });

  const form = new FormData();
  form.append('file', logoBlob, 'logo-plaka.webp');
  form.append('purpose', 'site_logo');
  form.append('ref', 'logo-plaka');

  console.log('  Enviando logo para Ghost Admin API...');
  const uploadRes = await ghostFetch(baseUrl, token, '/ghost/api/admin/images/upload', {
    method: 'POST',
    body: form,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Upload de logo falhou: HTTP ${uploadRes.status} — ${errText}`);
  }

  const uploadData = (await uploadRes.json()) as { images?: Array<{ url: string }> };
  const logoUrl = uploadData.images?.[0]?.url;
  if (!logoUrl) throw new Error('Ghost retornou resposta de upload sem URL de imagem');

  return logoUrl;
}

// ─── AC1 + AC3 + AC4: Aplicar Settings ───────────────────────────────────────

interface GhostSettingInput {
  key: string;
  value: string;
}

async function applySettings(
  baseUrl: string,
  token: string,
  logoUrl: string
): Promise<void> {
  const settings: GhostSettingInput[] = [
    { key: 'title', value: BRAND.title },
    { key: 'description', value: BRAND.description },
    { key: 'accent_color', value: BRAND.accentColor },
    { key: 'logo', value: logoUrl },
    { key: 'codeinjection_head', value: `<style>\n${CUSTOM_CSS}\n</style>` },
  ];

  const res = await ghostFetch(baseUrl, token, '/ghost/api/admin/settings/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao aplicar settings: HTTP ${res.status} — ${errText}`);
  }
}

// ─── Verificação Pós-Aplicação ────────────────────────────────────────────────

interface SettingEntry {
  key: string;
  value: string | null;
}

async function verifySettings(
  baseUrl: string,
  token: string
): Promise<Record<string, string | null>> {
  const res = await ghostFetch(baseUrl, token, '/ghost/api/admin/settings/');
  if (!res.ok) throw new Error(`Falha ao verificar settings: HTTP ${res.status}`);

  const data = (await res.json()) as { settings?: SettingEntry[] };
  const result: Record<string, string | null> = {};
  for (const entry of data.settings ?? []) {
    result[entry.key] = entry.value;
  }
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Ghost Theme Setup — Story 6.5 — Plaka Acessórios');
  console.log('='.repeat(60));

  // Config
  let config: GhostConfig;
  try {
    config = validateConfig();
    console.log(`\n✅ Config OK — Ghost URL: ${config.url}`);
  } catch (err) {
    console.error(`\n❌ Erro de configuração: ${(err as Error).message}`);
    console.error('\nCrie um arquivo .env com:');
    console.error('  GHOST_API_URL=http://187.77.37.88:2368');
    console.error('  GHOST_ADMIN_API_KEY={id}:{secret}');
    process.exit(1);
  }

  const token = buildJwt(config.id, config.secret);
  console.log('✅ JWT gerado (válido por 5 minutos)');

  // AC2 — Upload do logo
  console.log('\n[AC2] Fazendo upload do logo Plaka...');
  let logoUrl: string;
  try {
    logoUrl = await uploadLogo(config.url, token);
    console.log(`✅ AC2 PASS — Logo uploaded: ${logoUrl}`);
  } catch (err) {
    console.error(`❌ AC2 FAIL — ${(err as Error).message}`);
    console.error('\nVerifique:');
    console.error('  1. Ghost está rodando e acessível?');
    console.error('  2. A API key tem permissão de upload de imagens?');
    process.exit(1);
  }

  // AC1 + AC3 + AC4 — Aplicar configurações
  console.log('\n[AC1 + AC3 + AC4] Aplicando configurações de tema...');
  try {
    await applySettings(config.url, token, logoUrl);
    console.log(`✅ AC1 PASS — accent_color: ${BRAND.accentColor}`);
    console.log(`✅ AC3 PASS — título: "${BRAND.title}"`);
    console.log(`✅ AC3 PASS — descrição: "${BRAND.description}"`);
    console.log('✅ AC4 PASS — CSS Poppins + Casper overrides aplicados via codeinjection_head');
  } catch (err) {
    console.error(`❌ FAIL ao aplicar settings — ${(err as Error).message}`);
    console.error('\nVerifique:');
    console.error('  1. GHOST_ADMIN_API_KEY tem permissões de editar Settings?');
    console.error('  2. Ghost Admin API está respondendo?');
    process.exit(1);
  }

  // Verificação
  console.log('\n[Verificação] Confirmando settings no Ghost...');
  try {
    const applied = await verifySettings(config.url, token);

    const checks: Array<{ label: string; expected: string; actual: string | null | undefined }> = [
      { label: 'title', expected: BRAND.title, actual: applied['title'] },
      { label: 'description', expected: BRAND.description, actual: applied['description'] },
      { label: 'accent_color', expected: BRAND.accentColor, actual: applied['accent_color'] },
      { label: 'logo', expected: logoUrl, actual: applied['logo'] },
    ];

    let allOk = true;
    for (const check of checks) {
      if (check.actual === check.expected) {
        console.log(`  ✅ ${check.label}: OK`);
      } else {
        console.log(`  ⚠️  ${check.label}: esperado "${check.expected}", recebido "${String(check.actual)}"`);
        allOk = false;
      }
    }

    const cssHead = applied['codeinjection_head'] ?? '';
    if (cssHead.includes('@import url') && cssHead.includes('#0197b2')) {
      console.log('  ✅ codeinjection_head: CSS Poppins + cores Plaka presentes');
    } else {
      console.log('  ⚠️  codeinjection_head: CSS não confirmado — verifique manualmente');
      allOk = false;
    }

    if (!allOk) {
      console.warn('\n⚠️  Algumas configurações precisam de verificação manual no painel Ghost.');
    }
  } catch (err) {
    console.warn(`⚠️  Verificação falhou (não-bloqueante): ${(err as Error).message}`);
  }

  // Resultado Final
  console.log('\n' + '='.repeat(60));
  console.log('RESULTADO: ✅ DONE — Identidade visual Plaka aplicada ao Ghost');
  console.log('='.repeat(60));
  console.log(`\nBlog: ${config.url}`);
  console.log('\nVerifique no browser:');
  console.log('  — Header com fundo teal (#0197b2)');
  console.log('  — Logo Plaka em branco no header');
  console.log('  — Fonte Poppins em todo o blog');
  console.log('  — Cards com bordas arredondadas e hover suave');
  console.log('  — Tags em rosa (#d94f73)');
  console.log('  — Botões e links na cor teal');
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Erro inesperado:', err);
  process.exit(1);
});
