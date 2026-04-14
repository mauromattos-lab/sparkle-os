---
task: Curar Visual — Blog e Pinterest
responsavel: "@vista"
responsavel_type: agent
squad: aeo-squad-plaka
atomic_layer: task
elicit: false
Entrada: |
  - post_aprovado: Post completo aprovado pelo Rex
  - briefing: Briefing da Sage (tópico, bloco_conteudo, palavras_chave)
Saida: |
  - imagem_blog: {fonte, descricao_da_imagem, alt_text}
  - post_final: Post em Markdown com referência de imagem inserida
  - pin: {titulo, descricao, hashtags}
Checklist:
  - "[ ] Identificar bloco de conteúdo do briefing"
  - "[ ] Escrever imageDesc semântico — descrever produto ideal para o tópico"
  - "[ ] Escrever alt text AEO-otimizado (máx 125 chars)"
  - "[ ] Inserir referência de imagem no post (após primeiro H2)"
  - "[ ] Escrever título do pin (máx 100 chars)"
  - "[ ] Escrever descrição do pin (2-3 frases + CTA)"
  - "[ ] Definir hashtags (5-8)"
  - "[ ] Entregar post_final e pin"
---

# *curate-visual

Vista processa o post aprovado e entrega tudo que é necessário para publicar no blog e no Pinterest.

## Lógica de Seleção de Imagem

```
bloco = cuidados  → foto do produto isolado
bloco = qualidade → foto do produto com detalhe de acabamento
bloco = estilo    → foto de pessoa usando (look completo)
bloco = materiais → foto do produto isolado (destaque no material)
bloco = tendencias → foto de pessoa usando (tendência em contexto)
bloco = ocasioes  → foto de pessoa usando (contexto da ocasião)
```

**Como a imagem é resolvida:**
A Vista entrega `imageDesc` — descrição semântica do produto ideal para o post.
O `content-engine` (product-enricher.ts + gpt-4o-mini) seleciona automaticamente
o produto mais relevante do catálogo NuvemShop e resolve a URL real.
Vista não faz chamada de API diretamente.

## Formato de Output

### Imagem para o Blog

```yaml
imagem_blog:
  imageDesc: "string — descrição semântica do produto ideal (usada pelo content-engine para seleção LLM)"
  alt_text: "string — máx 125 caracteres, com palavra-chave principal"
  posicao_no_post: "após primeiro H2"
```

### Post Final (Markdown)

O post com a referência de imagem inserida:

```markdown
# Título do Post

Parágrafo de abertura...

## Primeiro H2

![{alt_text}]({url_ou_placeholder})

Conteúdo do H2...
```

### Pin do Pinterest

```yaml
pin:
  titulo: "string — máx 100 chars, inclui pergunta central"
  descricao: "string — 2-3 frases diretas + CTA sutil"
  hashtags:
    - "#semijoia"
    - "#semijoias"
    - "#{palavra_chave_especifica}"
    - "#{topico_relacionado}"
    - "#plakaacessorios"
  imagem: "mesma imagem do blog OU foto 9:16 do Drive (Pinterest prefere 9:16)"
```

## Regras do Alt Text

**Bom:**
- "colar semi joia banhado a ouro — resistente ao suor e uso diário"
- "argola dourada semi joia — como limpar em casa sem danificar"
- "mix de anéis semi joia — como combinar sem errar"

**Ruim:**
- "foto de colar" ← não descreve
- "imagem da Plaka" ← não tem palavra-chave
- "produto semi joia acessório bijuteria colar brinco pulseira" ← keyword stuffing

## Regras do Pin

**Título:** Pergunta direta ou afirmação de valor
- "Por que sua semi joia manchou? Entenda e resolva"
- "Semi joia que dura: o que você precisa saber"

**Descrição:** Responde a pergunta em 2 frases + onde encontrar mais
- "Semi joia que escurece nem sempre é defeito — é química. Entenda o mecanismo e aprenda a conservar suas peças por anos. Leia o guia completo no blog da Plaka."

**Hashtags — estrutura:**
- 2-3 amplas: #semijoia #semijoias #acessorios
- 2-3 específicas do tópico: #cuidadoscomsemijoias #oxidacao
- 1 de marca: #plakaacessorios
- 1 de lifestyle quando cabível: #modacarioca #ipanema
