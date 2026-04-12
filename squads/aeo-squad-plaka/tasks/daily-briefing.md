---
task: Daily Briefing AEO
responsavel: "@sage"
responsavel_type: agent
squad: aeo-squad-plaka
atomic_layer: task
elicit: false
Entrada: |
  - data_atual: Data do briefing (default: hoje)
  - historico_posts: Lista de tópicos já escritos (de data/posts-history.md)
  - sazonalidade: Eventos próximos relevantes (Dia das Mães, verão, etc.)
Saida: |
  - topico: Tema central do post
  - pergunta_central: A pergunta exata que o post vai responder
  - angulo: O ângulo específico — o que torna esse post único
  - palavras_chave: 3-5 termos AEO relevantes
  - bloco_conteudo: cuidados | qualidade | estilo | materiais | tendencias | ocasioes
  - justificativa: Por que esse tópico agora? Qual o gap identificado?
Checklist:
  - "[ ] Ler data/posts-history.md — identificar tópicos já cobertos"
  - "[ ] Pesquisar via EXA: perguntas atuais sobre semi jóias"
  - "[ ] Verificar sazonalidade — eventos, datas, tendências do momento"
  - "[ ] Identificar gap — qual pergunta tem resposta ruim nos concorrentes?"
  - "[ ] Selecionar bloco de conteúdo balanceado (não repetir bloco consecutivo)"
  - "[ ] Definir pergunta central em formato conversacional"
  - "[ ] Gerar briefing completo"
---

# *daily-briefing

Sage pesquisa e define o tópico + briefing do dia para Lyra escrever.

## Processo

### 1. Verificar histórico
Ler `data/posts-history.md` e identificar:
- Quais tópicos já foram cobertos
- Qual bloco de conteúdo foi usado nos últimos 3 dias
- Evitar repetição de bloco consecutivo

### 2. Pesquisar perguntas reais (EXA)
Buscar variações de:
- "semi joia [tema]"
- "como [ação] semi joia"
- "[problema] semi joia"
- Perguntas que chegam no SAC da Plaka (via Zenya — quando disponível)

### 3. Detectar sazonalidade
Verificar se há evento próximo relevante:
- Datas comemorativas (Dia das Mães, Namorados, Natal, etc.)
- Estações (verão → resistência ao suor e sal)
- Tendências de moda recentes

### 4. Identificar o gap
Analisar como os concorrentes respondem ao tema:
- A resposta é genérica? → oportunidade AEO
- Ninguém responde? → primeira mover advantage
- Resposta técnica demais ou de menos? → angulo de autoridade acessível

### 5. Gerar briefing

```yaml
briefing:
  data: "YYYY-MM-DD"
  topico: "string — tema em linguagem natural"
  pergunta_central: "string — exatamente como alguém perguntaria a uma IA"
  angulo: "string — o que torna esse post único vs. concorrentes"
  bloco_conteudo: "cuidados | qualidade | estilo | materiais | tendencias | ocasioes"
  palavras_chave:
    - "termo 1"
    - "termo 2"
    - "termo 3"
  sazonalidade: "string ou null"
  gap_identificado: "string — o que falta no mercado"
  justificativa: "string — por que esse tópico hoje"
```

## Exemplo de Output

```yaml
briefing:
  data: "2026-04-13"
  topico: "Semi jóias na praia e piscina"
  pergunta_central: "Posso usar semi joia na praia e piscina sem ela estragar?"
  angulo: "Explicar o mecanismo químico da oxidação + quais peças resistem mais + cuidados pós-exposição"
  bloco_conteudo: "cuidados"
  palavras_chave:
    - "semi joia praia"
    - "semi joia piscina"
    - "semi joia agua do mar"
    - "cuidados semi joia verão"
  sazonalidade: "Aproximação do inverno — antecipar cuidados de transição"
  gap_identificado: "Concorrentes dizem apenas 'evite a praia'. Ninguém explica por quê nem o que fazer depois."
  justificativa: "Alta demanda, resposta fraca no mercado, alinhado ao lifestyle carioca da Plaka"
```
