---
task: Escrever Post AEO
responsavel: "@lyra"
responsavel_type: agent
squad: aeo-squad-plaka
atomic_layer: task
elicit: false
Entrada: |
  - briefing: Output completo da task daily-briefing (Sage)
  - voz_plaka: Referência em data/plaka-context.md
  - historico_posts: Posts anteriores para coerência de linguagem
Saida: |
  - titulo: Título H1 — pergunta direta (max 70 caracteres)
  - meta_description: Até 160 caracteres — resposta condensada + CTA implícito
  - corpo: Artigo completo em Markdown (800-1200 palavras)
  - faq: Mínimo 3 pares pergunta/resposta relacionados
  - cta: Call-to-action sutil no final
Checklist:
  - "[ ] Ler briefing completo da Sage"
  - "[ ] Consultar data/plaka-context.md — voz e DNA da marca"
  - "[ ] Verificar data/posts-history.md — coerência com posts anteriores"
  - "[ ] Escrever título em formato de pergunta"
  - "[ ] Escrever meta description (máx 160 caracteres)"
  - "[ ] Parágrafo de abertura responde a pergunta em até 100 palavras"
  - "[ ] Corpo com H2/H3 limpos e listas onde cabem"
  - "[ ] FAQ com mínimo 3 perguntas em H3"
  - "[ ] CTA sutil no final — sem linguagem de loja"
  - "[ ] Verificar: 800-1200 palavras"
  - "[ ] Verificar: tom de especialista, não de vendedor"
  - "[ ] Incluir 1-2 links internos contextuais no corpo do texto para posts relacionados existentes"
  - "[ ] Incluir 1 citação externa verificável para posts com afirmações técnicas (dados de mercado, saúde, química)"
---

# *write-post

Lyra escreve o artigo AEO do dia a partir do briefing da Sage.

## Estrutura Obrigatória do Post

```
[TÍTULO] — Pergunta direta (H1)
           Ex: "Posso Usar Semi Joia na Praia? O Que Acontece e Como Proteger"

[META DESCRIPTION] — 160 caracteres
           Ex: "Semi joias podem ir à praia, mas com cuidados específicos.
                Entenda o que acontece com o banho de ouro na água salgada e
                como proteger suas peças."

[PARÁGRAFO DE ABERTURA] — Resposta direta em até 100 palavras
           A regra é clara: semi joias podem ser usadas na praia, mas o contato
           prolongado com água salgada, cloro e protetor solar acelera a oxidação
           do banho de ouro. O sal age como agente corrosivo nas microfissuras do
           banho, enquanto o cloro ataca diretamente a camada protetora da peça...

[H2] Por que a Água do Mar e o Cloro Danificam Semi Joias?
  [conteúdo técnico mas acessível]

[H2] Quais Peças Resistem Mais à Água?
  [lista comparativa — ouro 18k vs banho padrão vs aço inox]

[H2] O Que Fazer Depois de Usar Semi Joia na Praia
  [passo a passo prático]

[H2] Perguntas Frequentes
  [H3] Semi joia de aço inox pode ir à praia?
  [resposta direta]

  [H3] Quanto tempo dura o banho de ouro se eu usar na praia?
  [resposta direta]

  [H3] Como limpar semi joia depois da praia?
  [resposta direta]

[CTA] — sutil, no rodapé
  "Se você busca peças que combinam com o lifestyle carioca — praias,
   trabalho e noites — a Plaka tem coleções pensadas para durar."
```

## Regras de Linguagem

**Use:**
- "a regra é", "o correto é", "especialistas recomendam"
- Frases curtas e diretas no parágrafo de abertura
- Dados específicos quando disponíveis ("mínimo 3 micras de banho")
- Voz ativa

**Evite:**
- "confira", "aproveite", "não perca", "clique aqui"
- Adjetivos vazios ("incrível", "maravilhoso", "perfeito")
- Generalidades sem suporte ("algumas peças podem...", "dependendo do caso...")
- Menções forçadas à marca Plaka no meio do conteúdo

## Links Internos

**Regra:** Lyra deve incluir 1-2 links internos contextuais **no corpo do texto** — não apenas no rodapé ou seção final.

**Processo:**
1. Consultar `data/posts-history.md` e identificar posts publicados relacionados ao tópico do dia
2. Identificar o parágrafo mais relevante onde o link se encaixa naturalmente
3. Inserir o link dentro da frase, como texto âncora descritivo — nunca como "clique aqui" ou "veja também"

**Exemplo correto:**
> "A espessura do [banho de ouro](https://blog.plakaacessorios.com/semi-joia-banhada-a-ouro-ou-folheada-qual-a-diferenca-e-o-que-isso-muda-na-pratica/) é o principal fator que determina a durabilidade da peça..."

**Exemplo incorreto:**
> "Para saber mais sobre banho de ouro, [clique aqui](URL)."

**Critério:** O link deve fazer sentido para o leitor naquele ponto — ele deve agregar contexto, não parecer inserção forçada.

## Citações Externas

**Regra:** Posts com afirmações técnicas (dados de mercado, saúde, química, regulamentação) devem incluir 1 citação externa verificável.

**Fontes recomendadas:**
- SBD — Sociedade Brasileira de Dermatologia (saúde da pele, alergias)
- ABNT — normas técnicas de composição metálica
- INMETRO — regulamentação de produtos e certificações
- Publicações científicas sobre ligas metálicas (artigos indexados)

**Formato:** Citação inserida no corpo do parágrafo como referência entre parênteses ou como link no final da frase afirmativa — não como nota de rodapé formal.

**Exemplo:**
> "A alergia ao níquel afeta entre 10% e 15% da população brasileira (Sociedade Brasileira de Dermatologia)."

**Quando aplicar:** Posts dos blocos "cuidados", "qualidade" e "materiais" quase sempre contêm afirmações técnicas. Posts de "estilo" e "ocasiões" raramente precisam.

## Comprimento

- Mínimo: 800 palavras
- Máximo: 1200 palavras
- FAQ: não conta no limite — escreva quantas forem necessárias

## Output Format

Entregar o post completo em Markdown — publicação automática no Ghost (https://blog.plakaacessorios.com) via content-engine.
