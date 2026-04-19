/**
 * Publicação: "Guia Completo de Cuidados com Semi Joias: Tudo o Que Você Precisa Saber"
 * Pillar page do cluster "cuidados" — agrega e linka os 3 posts de cuidados existentes.
 * Story 8.3 — Squad AEO Plaka — 2026-04-19
 * Agentes: Lyra (redação pillar) + script de publicação direta via Ghost Admin API
 */

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '../.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

function buildJwt(id, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: id, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const sig = createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

const title = 'Guia Completo de Cuidados com Semi Joias: Tudo o Que Você Precisa Saber';
const slug = 'guia-completo-de-cuidados-com-semi-joias';

const bodyHtml = `
<p><strong>Cuidar de semi joias corretamente é o que separa uma peça que dura meses de uma que dura anos.</strong> Semi joias são acessórios feitos de metal base — geralmente latão ou aço inox — com banho de ouro, ródio ou rutênio. Esse banho tem espessura entre 3 e 5 micras nas peças de qualidade, e é exatamente ele que determina a aparência e a durabilidade da peça. Quando o banho cede — por exposição à água, suor, produtos químicos ou armazenamento incorreto — a peça muda de cor, perde o brilho e pode manchar a pele. A boa notícia é que a maioria dessas situações é completamente evitável com hábitos simples. Este guia reúne as informações essenciais sobre os principais cuidados com semi joias para que suas peças durem muito mais.</p>

<h2>Por Que Semi Joias Mancham a Pele?</h2>

<p><strong>A mancha na pele é causada pela reação entre o metal base da peça, o suor e o oxigênio</strong> — um processo chamado oxidação. Quando o banho de ouro cede em algum ponto, o metal base (geralmente latão, que contém cobre e zinco) entra em contato direto com a pele. Na presença de umidade e suor, o cobre oxida e forma compostos de cor esverdeada ou escura que tingem a pele temporariamente.</p>

<p>Isso não significa que a peça seja ruim — pode indicar que o banho era fino, que a peça teve contato frequente com água ou produtos químicos, ou simplesmente que chegou ao fim da vida útil do banho. A solução é sempre a mesma: banho mais espesso (acima de 3 micras), menos contato com agentes corrosivos e armazenamento adequado.</p>

<p>Entenda em detalhes <a href="https://blog.plakaacessorios.com/por-que-semi-joia-deixa-a-pele-verde/">por que semi joia deixa a pele verde e o que fazer para evitar</a>.</p>

<h2>Pode Usar Semi Joia no Banho?</h2>

<p><strong>A resposta direta é: não.</strong> O banho — seja de chuveiro, piscina ou mar — é um dos principais fatores de desgaste acelerado do banho de ouro. A água morna do chuveiro abre os poros do banho metálico e permite que a umidade penetre nas microfissuras da camada protetora. Já o cloro da piscina é um agente oxidante forte que ataca diretamente o banho de ouro, acelerando o processo de deterioração.</p>

<p>O sal do mar tem efeito similar ao cloro — age como agente corrosivo nas microfissuras e acelera a oxidação do metal base. Mesmo a água corrente do chuveiro, com o uso diário, vai erodindo progressivamente a camada de banho. A recomendação é sempre retirar as peças antes do banho e colocá-las de volta quando a pele estiver completamente seca.</p>

<p>Veja a análise completa sobre <a href="https://blog.plakaacessorios.com/pode-usar-semi-joia-no-banho-ou-precisa-tirar-antes/">semi joia no banho: pode ou precisa tirar antes?</a></p>

<h2>Como Limpar Semi Joia em Casa</h2>

<p><strong>A limpeza correta é feita com pano macio levemente umedecido com água morna</strong> — sem detergentes, sem álcool, sem ultrasson caseiro. Esfregões, esponjas abrasivas e produtos de limpeza químicos danificam o banho de forma irreversível. A técnica certa é passar o pano macio em movimentos suaves sobre a superfície da peça, remover o excesso de umidade com um pano seco e deixar secar completamente ao ar antes de guardar.</p>

<p>Para sujeira mais acumulada — como resíduos de creme ou maquiagem — uma solução de água morna com uma gota de sabão neutro pode ser usada pontualmente, desde que o enxágue e a secagem sejam feitos com cuidado. O segredo é nunca mergulhar a peça e nunca deixar umidade retida nas partes metálicas.</p>

<p>Confira o passo a passo completo de <a href="https://blog.plakaacessorios.com/como-limpar-semi-joia-em-casa-sem-danificar-3/">como limpar semi joia em casa sem danificar</a>.</p>

<h2>Outros Cuidados Essenciais</h2>

<p><strong>Guardar corretamente é tão importante quanto usar corretamente.</strong> Semi joias devem ser armazenadas em local seco, longe de umidade e luz solar direta. O ideal é guardá-las em caixinhas individuais forradas com veludo ou flanela — o atrito entre peças pode arranhar o banho e acelerar o desgaste. Sacos de voil ou pequenas embalagens zip-lock também funcionam bem para separar as peças.</p>

<p>Perfumes e cremes corporais são inimigos silenciosos das semi joias. As substâncias químicas presentes nesses produtos reagem com o banho metálico e aceleram a oxidação. A regra é sempre aplicar perfume e hidratante antes de colocar as peças — nunca por cima.</p>

<p>Quando o banho cede visivelmente e a peça perde o brilho, a replatagem é uma opção viável para peças de qualidade. O processo consiste em remover a camada oxidada e reaplicar o banho, devolvendo à peça a aparência original. Nem toda joalheria faz o serviço em semi joias, mas lojas especializadas ou o próprio fabricante costumam oferecer o serviço.</p>

<p>Um cuidado que muita gente ignora: evite usar semi joias durante atividades físicas intensas. O suor em grande quantidade, combinado com o calor e o atrito, cria as condições ideais para a deterioração rápida do banho. Guarde as peças antes da academia e recoloque-as após o banho.</p>

<h2>Perguntas Frequentes sobre Cuidados</h2>

<h3>Com que frequência devo limpar semi joias?</h3>
<p>Após cada uso, passe um pano macio seco para remover suor e resíduos. Uma limpeza mais cuidadosa com pano levemente umedecido pode ser feita uma vez por semana nas peças de uso frequente. O importante é não acumular resíduos — quanto mais tempo o suor e a sujeira ficam em contato com o metal, maior o risco de oxidação.</p>

<h3>Posso usar semi joia na academia?</h3>
<p>Não é recomendado. O suor intenso, o calor e o atrito durante os exercícios são condições que aceleram significativamente o desgaste do banho de ouro. Se você usa pesos ou equipamentos, o atrito mecânico também pode arranhar a superfície da peça. O ideal é retirar todas as semi joias antes do treino e recolocá-las após o banho pós-academia.</p>

<h3>Qual a diferença entre semi joia que mancha e uma que não mancha?</h3>
<p>A diferença está na espessura do banho e na qualidade do metal base. Semi joias com banho abaixo de 1 micra cedem rapidamente ao contato com suor e umidade, expondo o metal base e causando manchas. Peças com banho acima de 3 micras, em metal base de alta pureza (latão sem níquel), duram muito mais e raramente mancham com uso normal. Marcas sérias informam a espessura do banho — é o dado mais importante na hora de comparar peças.</p>

<p>Se você busca semi joias com banho de alta espessura que aguentam o uso do dia a dia — conheça a <a href="https://plakaacessorios.com">Coleção Essentials da Plaka</a>, desenvolvida para durar.</p>
`.trim();

const now = new Date().toISOString();
const ghostUrl = process.env.GHOST_API_URL;

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    author: { '@type': 'Organization', name: 'Plaka Acessórios' },
    publisher: { '@type': 'Organization', name: 'Plaka Acessórios' },
    datePublished: now,
    inLanguage: 'pt-BR',
    url: `${ghostUrl}/${slug}/`,
    wordCount: bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    articleSection: 'Cuidados',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Com que frequência devo limpar semi joias?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Após cada uso, passe um pano macio seco para remover suor e resíduos. Uma limpeza mais cuidadosa com pano levemente umedecido pode ser feita uma vez por semana nas peças de uso frequente. O importante é não acumular resíduos — quanto mais tempo o suor e a sujeira ficam em contato com o metal, maior o risco de oxidação.',
        },
      },
      {
        '@type': 'Question',
        name: 'Posso usar semi joia na academia?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Não é recomendado. O suor intenso, o calor e o atrito durante os exercícios aceleram significativamente o desgaste do banho de ouro. O ideal é retirar todas as semi joias antes do treino e recolocá-las após o banho pós-academia.',
        },
      },
      {
        '@type': 'Question',
        name: 'Qual a diferença entre semi joia que mancha e uma que não mancha?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A diferença está na espessura do banho e na qualidade do metal base. Semi joias com banho abaixo de 1 micra cedem rapidamente ao contato com suor e umidade. Peças com banho acima de 3 micras, em metal base de alta pureza, duram muito mais e raramente mancham com uso normal.',
        },
      },
    ],
  },
];

const codeinjection_head = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;

async function publish() {
  const apiKey = process.env.GHOST_ADMIN_API_KEY;
  if (!ghostUrl || !apiKey) {
    console.error('❌ GHOST_API_URL ou GHOST_ADMIN_API_KEY não configurados');
    process.exit(1);
  }

  const [keyId, keySecret] = apiKey.split(':');
  const token = buildJwt(keyId, keySecret);
  const baseUrl = ghostUrl.replace(/\/$/, '');

  const postBody = {
    posts: [{
      title,
      slug,
      status: 'published',
      html: bodyHtml,
      codeinjection_head,
      tags: [{ slug: 'cuidados' }],
      custom_excerpt: 'Tudo sobre cuidados com semi joias: como limpar, por que mancha, o que evita o desgaste do banho de ouro. Guia técnico completo — Plaka Acessórios.',
    }],
  };

  console.log(`📤 Publicando pillar page "${title}" em ${baseUrl}...`);

  const response = await fetch(`${baseUrl}/ghost/api/admin/posts/?source=html`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Ghost ${token}`,
      'Accept-Version': 'v5.0',
    },
    body: JSON.stringify(postBody),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`❌ Ghost API ${response.status}: ${err.slice(0, 300)}`);
    process.exit(1);
  }

  const data = await response.json();
  const post = data.posts?.[0];
  const url = post?.url ?? `${baseUrl}/p/${post?.uuid}`;

  console.log(`✅ Pillar page publicada com sucesso!`);
  console.log(`🔗 URL: ${url}`);
  console.log(`\n📋 Registrar em squads/aeo-squad-plaka/data/posts-history.md:`);
  console.log(`| ${new Date().toISOString().slice(0, 10)} | Guia Completo de Cuidados com Semi Joias (pillar) | Guia Completo de Cuidados com Semi Joias: Tudo o Que Você Precisa Saber | cuidados | cuidados semi joia, como cuidar de semi joia, semi joia durabilidade | ${url} |`);
}

publish().catch((err) => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
