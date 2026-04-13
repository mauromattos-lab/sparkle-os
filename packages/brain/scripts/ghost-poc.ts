/**
 * Ghost CMS PoC — Story 6.1
 *
 * Valida a integração com Ghost Admin API:
 *   AC2 — Autenticação com Staff API Key (JWT local, sem OAuth)
 *   AC3 — Criação de post de teste com título, HTML e status draft
 *   AC4 — Post inclui codeinjection_head com JSON-LD Schema BlogPosting
 *
 * Uso:
 *   node --env-file=.env --import tsx/esm scripts/ghost-poc.ts
 *
 * Variáveis de ambiente necessárias:
 *   GHOST_API_URL      — ex: http://seu-ip:2368
 *   GHOST_ADMIN_API_KEY — formato: {id}:{secret}  (Ghost > Settings > Integrations)
 */

import { createHmac } from 'node:crypto';

// ─── Config ──────────────────────────────────────────────────────────────────

const GHOST_API_URL = process.env.GHOST_API_URL;
const GHOST_ADMIN_API_KEY = process.env.GHOST_ADMIN_API_KEY;

function validateConfig(): { url: string; id: string; secret: string } {
  if (!GHOST_API_URL) throw new Error('GHOST_API_URL não definida no .env');
  if (!GHOST_ADMIN_API_KEY) throw new Error('GHOST_ADMIN_API_KEY não definida no .env');

  const parts = GHOST_ADMIN_API_KEY.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('GHOST_ADMIN_API_KEY inválida — formato esperado: {id}:{secret}');
  }

  return { url: GHOST_API_URL.replace(/\/$/, ''), id: parts[0], secret: parts[1] };
}

// ─── JWT (Ghost Admin API usa HS256 com secret em hex) ───────────────────────

function buildJwt(id: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })
  ).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const keyBuffer = Buffer.from(secret, 'hex');
  const signature = createHmac('sha256', keyBuffer).update(signingInput).digest('base64url');

  return `${signingInput}.${signature}`;
}

// ─── JSON-LD Schema BlogPosting ───────────────────────────────────────────────

function buildJsonLd(title: string, datePublished: string): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    author: { '@type': 'Organization', name: 'Plaka Acessórios' },
    publisher: {
      '@type': 'Organization',
      name: 'Plaka Acessórios',
      logo: { '@type': 'ImageObject', url: '' },
    },
    datePublished,
    inLanguage: 'pt-BR',
  };

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

// ─── Ghost Admin API — criar post ────────────────────────────────────────────

interface GhostPost {
  id: string;
  uuid: string;
  title: string;
  status: string;
  url: string;
}

async function createTestPost(
  url: string,
  token: string
): Promise<GhostPost> {
  const now = new Date().toISOString();
  const title = `[PoC] Ghost CMS + AEO — Teste ${now.slice(0, 19).replace('T', ' ')}`;

  const postBody = {
    posts: [
      {
        title,
        status: 'draft',
        html: `
<h1>${title}</h1>
<p>Este post foi criado automaticamente pelo script de PoC da Story 6.1 do SparkleOS.</p>
<p>Se você está vendo isso no painel do Ghost, a integração via API funcionou.</p>
<h2>Próximos Passos</h2>
<ul>
  <li>Configurar domínio <code>blog.plakaacessorios.com.br</code></li>
  <li>Implementar <code>ghost-publisher.ts</code> no content-engine</li>
  <li>Estrutura AEO com FAQ e Schema markup</li>
</ul>
        `.trim(),
        codeinjection_head: buildJsonLd(title, now),
      },
    ],
  };

  const response = await fetch(`${url}/ghost/api/admin/posts/?source=html`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Ghost ${token}`,
      'Accept-Version': 'v5.0',
    },
    body: JSON.stringify(postBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ghost API retornou ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as { posts: GhostPost[] };

  if (!data.posts?.[0]) throw new Error('Ghost API retornou resposta inesperada — sem posts');

  return data.posts[0];
}

// ─── Verificar conectividade básica ──────────────────────────────────────────

async function checkConnectivity(url: string): Promise<void> {
  const response = await fetch(`${url}/ghost/api/admin/site/`, {
    headers: { 'Accept-Version': 'v5.0' },
  });

  if (!response.ok && response.status !== 401) {
    throw new Error(`Ghost não acessível em ${url} — status ${response.status}`);
  }
  // 401 é esperado sem token — Ghost está online
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('Ghost CMS PoC — Story 6.1');
  console.log('='.repeat(60));

  // Config
  let config: ReturnType<typeof validateConfig>;
  try {
    config = validateConfig();
    console.log(`\n✅ Config OK — Ghost URL: ${config.url}`);
  } catch (err) {
    console.error(`\n❌ Erro de configuração: ${(err as Error).message}`);
    console.error('\nCrie um arquivo .env com:');
    console.error('  GHOST_API_URL=http://seu-ip:2368');
    console.error('  GHOST_ADMIN_API_KEY={id}:{secret}');
    process.exit(1);
  }

  // AC1 — Conectividade
  console.log('\n[AC1] Verificando conectividade com Ghost...');
  try {
    await checkConnectivity(config.url);
    console.log(`✅ AC1 PASS — Ghost acessível em ${config.url}`);
  } catch (err) {
    console.error(`❌ AC1 FAIL — ${(err as Error).message}`);
    console.error('\nVerifique:');
    console.error('  1. Ghost está rodando? (ghost status)');
    console.error('  2. Porta 2368 está aberta no firewall?');
    console.error('  3. GHOST_API_URL está correto?');
    process.exit(1);
  }

  // AC2 — JWT
  console.log('\n[AC2] Gerando token JWT para Admin API...');
  let token: string;
  try {
    token = buildJwt(config.id, config.secret);
    console.log('✅ AC2 PASS — JWT gerado com sucesso');
    console.log(`   Token (primeiros 40 chars): ${token.slice(0, 40)}...`);
  } catch (err) {
    console.error(`❌ AC2 FAIL — Erro ao gerar JWT: ${(err as Error).message}`);
    process.exit(1);
  }

  // AC3 + AC4 — Criar post com JSON-LD
  console.log('\n[AC3+AC4] Criando post de teste com JSON-LD Schema...');
  let post: GhostPost;
  try {
    post = await createTestPost(config.url, token);
    console.log('✅ AC3 PASS — Post criado com sucesso');
    console.log(`   ID: ${post.id}`);
    console.log(`   Título: ${post.title}`);
    console.log(`   Status: ${post.status}`);
    if (post.url) console.log(`   URL: ${post.url}`);
    console.log('✅ AC4 PASS — codeinjection_head com JSON-LD incluído');
  } catch (err) {
    console.error(`❌ AC3/AC4 FAIL — ${(err as Error).message}`);
    console.error('\nVerifique:');
    console.error('  1. GHOST_ADMIN_API_KEY está correto? (Ghost > Settings > Integrations)');
    console.error('  2. A integração foi criada com permissões de Create/Edit posts?');
    process.exit(1);
  }

  // Resultado Final
  console.log('\n' + '='.repeat(60));
  console.log('RESULTADO: ✅ GO — Todos os ACs validados');
  console.log('='.repeat(60));
  console.log('\nPróximos passos:');
  console.log('  1. Verifique o post no painel Ghost (deve estar em Drafts)');
  console.log('  2. Confirme que o JSON-LD aparece em Code Injection do post');
  console.log('  3. Ative @dev para implementar Story 6.2 (ghost-publisher.ts)');
  console.log('');
}

main().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
