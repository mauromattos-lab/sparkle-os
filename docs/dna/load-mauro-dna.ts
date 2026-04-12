/**
 * load-mauro-dna.ts
 *
 * Script de carga auditável — DNA de Mauro no Cérebro Coletivo
 *
 * Story:   3.8 — DNA de Mauro
 * Fonte:   docs/dna/mauro-dna.md (co-criado em sessão direta com Mauro em 2026-04-12)
 * Ingestão: POST /brain/insights via BrainClient.ingest()
 *
 * IMPORTANTE: Este script é um registro auditável das chamadas de ingestão.
 * Serve para recarregar o ambiente se necessário. Não é executado via CI.
 *
 * Uso:
 *   npx tsx docs/dna/load-mauro-dna.ts
 *
 * Pré-requisito: BRAIN_API_URL definido no ambiente (default: http://localhost:3003)
 */

import { BrainClient } from '../../packages/brain-client/src/index.js';

const BRAIN_API_URL = process.env['BRAIN_API_URL'] ?? 'http://localhost:3003';
const BRAIN_API_KEY = process.env['BRAIN_API_KEY'];

const client = new BrainClient({
  baseUrl: BRAIN_API_URL,
  apiKey: BRAIN_API_KEY,
});

// ---------------------------------------------------------------------------
// Insights do DNA de Mauro
// source='mauro_input' → confidenceLevel='authoritative' (automático pela API)
// Ref: docs/architecture/cerebro-coletivo.md §source-authoritative
// ---------------------------------------------------------------------------

const DNA_INSIGHTS = [
  // ── Princípios Fundacionais ──────────────────────────────────────────────

  {
    content:
      'IA opera em escala e paradigma completamente diferente do humano. Tudo que é feito por IA não pode ter o tempo ou funcionamento de acordo com padrões humanos. IA não leva semanas para o que humanos levam meses. IA não usa CRM em kanban. Ferramentas projetadas para humanos não devem ser impostas a sistemas de IA — precisam ser repensadas do zero. Exemplo: CRM em kanban não fará sentido quando quem gerencia os leads for a própria IA, não o humano.',
    tags: ['dna', 'principio', 'paradigma-ia', 'anti-humanizacao-ia'],
    summary: 'IA opera em paradigma próprio — não aplicar padrões humanos a sistemas de IA',
  },
  {
    content:
      'IA é o maior salto tecnológico da história humana — maior que o advento da internet. O cenário apocalíptico ignora o potencial real: o ser humano vai viver mais e melhor. IA não é ameaça — é a maior extensão de capacidade humana já vista. Pensar em apocalipse descarta o potencial transformador que a IA tem para elevar a qualidade de vida humana.',
    tags: ['dna', 'principio', 'visao-ia', 'futuro'],
    summary: 'IA é extensão do potencial humano — maior avanço tecnológico da história',
  },
  {
    content:
      'Riqueza tem responsabilidade com o mundo. Não é só quantidade de dinheiro, mas o que o dinheiro pode proporcionar de volta ao mundo de onde ele veio. Algumas iniciativas com IA não são para enriquecer Mauro financeiramente, mas para enriquecer o mundo em conhecimento e qualidade de vida.',
    tags: ['dna', 'principio', 'riqueza', 'proposito', 'impacto-social'],
    summary: 'Riqueza = o que devolve ao mundo, não só acúmulo',
  },
  {
    content:
      'O ser humano não nasceu para trabalho degradante e repetitivo. Ninguém nasceu com o propósito de ficar fazendo tarefas chatas, repetitivas e desgastantes em troca de um salário que mal cobre dignidade. Preencher planilhas e receber 250 nãos no telefone não é vocação humana. O ser humano tem muito mais potencial a ser liberado.',
    tags: ['dna', 'principio', 'proposito-humano', 'automacao', 'dignidade'],
    summary: 'IA libera o humano de trabalho degradante — vocação humana é maior que isso',
  },
  {
    content:
      'Sistema sem inteligência é só automação — e automação vai virar commodity. Um chatbot é automação. Uma Zenya que conversa e usa ferramentas é um degrau acima, mas ainda é automação em boa parte. Uma Zenya que APRENDE é diferente. A fronteira: automação executa regras definidas; inteligência aprende, adapta e melhora sem reprogramação manual.',
    tags: ['dna', 'principio', 'inteligencia-vs-automacao', 'zenya', 'diferenciacao'],
    summary: 'Inteligência = aprendizado e adaptação. Automação pura é commodity.',
  },
  {
    content:
      'O diferencial não é capacidade técnica — é visão criativa. Zenya como personagem com universo próprio, narrativa, storytelling, imagem e vídeo. AI influencer com substância real. Volume E qualidade sem abrir mão de nenhum. Omnipresença digital com personalidades de IA como canais de venda, IP, ensino e entretenimento. IA permite que um fundador solo dê voz a um universo criativo que existia só na sua mente. A visão é estar simultaneamente na Hotmart e na CCXP.',
    tags: ['dna', 'principio', 'visao-criativa', 'ip', 'zenya', 'diferenciacao', 'sparkle-universe'],
    summary: 'Diferencial de Mauro: visão criativa para IA como universo e IP — não habilidade técnica',
  },
  {
    content:
      'A visão criativa é o norte inegociável — o modelo de negócio é o veículo. Os serviços para PMEs existem por necessidade financeira, não como destino. O que move Mauro — o universo criativo que quer colocar para fora, que parece um video game — vai junto independente de sucesso financeiro, venda de empresa, ou qualquer pressão externa. Essa parte nunca é negociável.',
    tags: ['dna', 'principio', 'visao-inegociavel', 'proposito', 'sparkle-universe'],
    summary: 'Visão criativa é inegociável. Modelo de negócio é veículo, não destino.',
  },

  // ── Filtros de Raciocínio ────────────────────────────────────────────────

  {
    content:
      'Velocidade vs qualidade: a decisão depende do nível de segurança financeira. Modo sobrevivência (risco iminente, dificuldade financeira real) → velocidade não pode ceder, entrega é obrigação. Modo construção (faturamento cobre despesas) → qualidade prevalece, é o momento de fazer certo. Existe um valor de referência para viver bem — enquanto coberto e crescendo profissionalmente, a paz está presente mesmo com crescimento financeiro gradual.',
    tags: ['dna', 'filtro-raciocinio', 'velocidade-vs-qualidade', 'decisao', 'contexto-financeiro'],
    summary: 'Velocidade vs qualidade = função do nível de segurança financeira, não princípio abstrato',
  },
  {
    content:
      'Informação incompleta: ação imediata + pesquisa paralela. Não paralisa esperando informação perfeita. Faz o primeiro esforço possível com o que tem — mas sem abandonar a pesquisa que poderia entregar algo melhor. Ação e aprendizado acontecem simultaneamente, não sequencialmente.',
    tags: ['dna', 'filtro-raciocinio', 'decisao-sem-informacao', 'acao', 'aprendizado'],
    summary: 'Age com o que tem enquanto pesquisa o que poderia ser melhor — ação e aprendizado paralelos',
  },
  {
    content:
      'Priorização sob pressão: o compromisso anterior vem primeiro, sempre. Quando tudo parece urgente ao mesmo tempo, o critério não é urgência percebida — é ordem de compromisso. O que foi combinado antes, vem antes. Sem renegociação silenciosa.',
    tags: ['dna', 'filtro-raciocinio', 'priorizacao', 'compromisso', 'decisao'],
    summary: 'Prioridade = quem foi combinado primeiro. Compromisso > urgência percebida.',
  },
  {
    content:
      'Sinal de parada: perda de referência e controle decisório. O que ativa o freio não é dúvida comum — é a sensação específica de estar perdendo a referência ou o poder de decisão sobre o que está acontecendo. Quando o caminho fica incerto demais, a pergunta é: esse risco é aceitável ou não? Não é parar por medo — é avaliar conscientemente antes de continuar.',
    tags: ['dna', 'filtro-raciocinio', 'risco', 'controle', 'decisao', 'parada'],
    summary: 'Para quando perde referência ou controle decisório — avalia se risco é aceitável',
  },
  {
    content:
      'Definição de "pronto": processo seguido + saída dentro do esperado. Trabalho não está pronto só porque o resultado parece bom. Precisa ser visível que o processo foi seguido. Output correto com processo ignorado não conta como pronto.',
    tags: ['dna', 'filtro-raciocinio', 'definicao-de-pronto', 'processo', 'qualidade'],
    summary: '"Pronto" requer processo seguido AND saída dentro do esperado — não apenas resultado bom',
  },

  // ── Preferências de Trabalho ─────────────────────────────────────────────

  {
    content:
      'Detalhe apenas quando é insumo para construção ativa. Informação detalhada só faz sentido quando serve para construir algo. Métricas operacionais e relatórios devem ser resumidos ou filtrados para o que é acionável. Não há valor em receber CPM, CTA, CTR de 25 criativos diferentes — isso não gera decisão nem construção.',
    tags: ['dna', 'preferencia', 'comunicacao', 'informacao', 'foco'],
    summary: 'Detalhe só quando é insumo para construção — reportar por reportar não tem valor',
  },
  {
    content:
      'Autonomia máxima para agentes onde Mauro não precisa decidir. Agentes agem sozinhos quando: (1) a decisão não requer julgamento de Mauro, (2) o agente é mais capaz tecnicamente naquele domínio, (3) não altera nada do lado externo (clientes) de forma prejudicial. Ter que fazer manualmente coisas técnicas que não sabe o que são é o maior ponto de fricção.',
    tags: ['dna', 'preferencia', 'autonomia-agentes', 'delegacao', 'filtro-raciocinio'],
    summary: 'Agentes autônomos ao máximo — exceto quando requer julgamento de Mauro ou afeta clientes',
  },
  {
    content:
      'Clientes são sempre isolados do processo de construção interna. Clientes ficam no sistema antigo operando normalmente enquanto o sistema novo é construído. Nada chega ao cliente antes de estar pronto. O processo de desenvolvimento interno nunca pode comprometer a entrega para clientes ativos.',
    tags: ['dna', 'preferencia', 'clientes', 'isolamento', 'responsabilidade'],
    summary: 'Clientes isolados do desenvolvimento interno — comprometimento com entregas é inegociável',
  },

  // ── Anti-padrões ─────────────────────────────────────────────────────────

  {
    content:
      'Ilusão de progresso é o anti-padrão mais crítico. Ser levado a acreditar que algo está sendo feito do jeito certo, para descobrir semanas depois que não estava — isso é pior do que saber imediatamente que há um problema. Exemplo real: acreditar que o processo AIOX estava sendo seguido e querer refazer tudo ao perceber que não foi. Agentes devem ser honestos sobre falhas e desvios imediatamente, não confortáveis com aparência de conformidade.',
    tags: ['dna', 'anti-padrao', 'honestidade', 'transparencia', 'processo', 'filtro-raciocinio'],
    summary: 'Falsa conformidade é pior que erro declarado — transparência imediata sobre desvios é obrigatória',
  },
  {
    content:
      'Dar um jeitinho porque é mais fácil é inaceitável. Mauro confia em IA para construir os ativos mais importantes do restante da sua vida. Atalhos porque é mais conveniente quebram exatamente o que torna a IA valiosa. Uma SDR de IA não é melhor que a humana por conhecer a técnica — é melhor por atender SEMPRE como deveria. O valor da IA é consistência absoluta, não inteligência superior.',
    tags: ['dna', 'anti-padrao', 'consistencia', 'processo', 'confianca'],
    summary: 'Sem atalhos. O valor da IA é consistência absoluta — atender sempre como deveria, sem exceção',
  },
] as const;

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

async function main() {
  console.log(`🧠 Carregando DNA de Mauro no Cérebro Coletivo...`);
  console.log(`   Brain API: ${BRAIN_API_URL}`);
  console.log(`   Total de insights: ${DNA_INSIGHTS.length}`);
  console.log('');

  const results: Array<{ index: number; id: string; status: string; preview: string }> = [];
  let failed = 0;

  for (let i = 0; i < DNA_INSIGHTS.length; i++) {
    const insight = DNA_INSIGHTS[i];
    const preview = insight.content.slice(0, 60) + '...';

    process.stdout.write(`   [${i + 1}/${DNA_INSIGHTS.length}] ${preview} `);

    try {
      const result = await client.ingest({
        source: 'mauro_input',
        content: insight.content,
        tags: [...insight.tags],
        summary: insight.summary,
        nucleusId: undefined,
      });

      results.push({ index: i + 1, id: result.id, status: result.status, preview });
      console.log(`→ ✅ ${result.id} (${result.confidenceLevel})`);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`→ ❌ ERRO: ${message}`);
      results.push({ index: i + 1, id: 'ERROR', status: message, preview });
    }
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log(`✅ Ingeridos com sucesso: ${results.length - failed}/${DNA_INSIGHTS.length}`);
  if (failed > 0) {
    console.log(`❌ Falhas: ${failed}`);
  }
  console.log('');
  console.log('Próximo passo: executar verificação de recuperação (AC4)');
  console.log('  BrainClient.search("como priorizar quando há múltiplas demandas")');
  console.log('  BrainClient.search("qualidade vs velocidade de entrega")');
  console.log('  BrainClient.search("como tomar decisões sem informação completa")');
  console.log('');
  console.log('Verificar filtros de raciocínio (AC5):');
  console.log('  BrainClient.getContext("filtro de raciocinio")');
  console.log('  → Esperado: >= 5 resultados com tag "filtro-raciocinio"');
}

main().catch((err) => {
  console.error('Falha ao carregar DNA:', err);
  process.exit(1);
});
