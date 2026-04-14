# AEO Squad Plaka

Time de agentes especializado em geração de conteúdo AEO para a **Plaka Acessórios** — uma das maiores lojas de semi jóias do Rio de Janeiro.

## O que este squad faz

Gera 1 artigo por dia para o blog da Plaka, otimizado para **AEO (Answer Engine Optimization)** — o padrão de conteúdo que faz o ChatGPT, Perplexity e Google AI Overview citarem a Plaka como referência quando alguém pergunta sobre semi jóias.

## Os Agentes

| Agente | Persona | Função |
|--------|---------|--------|
| **Sage** 🔭 | Estrategista + Pesquisadora | Define o tópico do dia via pesquisa real (EXA) |
| **Lyra** ✍️ | Redatora AEO | Escreve o artigo em formato AEO-ready |
| **Rex** ✅ | Revisor de Qualidade | Valida contra checklist AEO + identidade da Plaka |

## Pipeline Diária

```
Sage (briefing) → Lyra (escreve) → Rex (valida)
                                        ↓ se REVISAO
                               Lyra (reescreve) → Rex (revalida)
                                        ↓ se APROVADO
                               Post pronto para publicar
```

Max 2 revisões. Se não resolver, Rex escala para Mauro.

## Como Usar

### Ativar Sage para o briefing do dia
```
@aeo-plaka:sage *daily-briefing
```

### Ativar Lyra para escrever
```
@aeo-plaka:lyra *write-post
```

### Ativar Rex para validar
```
@aeo-plaka:rex *validate-post
```

### Rodar pipeline completa
```
*workflow daily-content
```

## Estrutura

```
aeo-squad-plaka/
├── squad.yaml                      # Manifesto do squad
├── README.md                       # Este arquivo
├── agents/
│   ├── sage.md                     # Estrategista + Pesquisadora AEO
│   ├── lyra.md                     # Redatora AEO
│   └── rex.md                      # Revisor de Qualidade
├── tasks/
│   ├── daily-briefing.md           # Sage define o tópico do dia
│   ├── research-topic.md           # Sage pesquisa tópico específico
│   ├── write-post.md               # Lyra escreve o artigo
│   ├── rewrite-post.md             # Lyra reescreve com feedback do Rex
│   └── validate-post.md            # Rex valida qualidade AEO + marca
├── workflows/
│   └── daily-content.yaml          # Pipeline completa com tratamento de falha
├── checklists/
│   └── aeo-quality-checklist.md    # Critérios de validação do Rex
└── data/
    ├── plaka-context.md            # DNA da marca — fonte de verdade
    └── posts-history.md            # Histórico de posts + backlog de tópicos
```

## Contexto do Produto

Este squad é parte do **SparkleOS** — sistema de orquestração de IA da Synkra.
Cliente: Luiza (Plaka Acessórios) | Operador: Mauro
Integração: Ghost CMS na VPS (publicação) + NuvemShop Catalog API (imagens) + Pinterest API (distribuição)

## Manutenção

- **data/plaka-context.md** — atualizar quando houver mudanças de marca ou coleções
- **data/posts-history.md** — atualizar após cada post publicado (responsabilidade: Sage)
- **checklists/aeo-quality-checklist.md** — revisar a cada 30 dias com base nos resultados

---

*Criado por Craft (@squad-creator) + Atlas (@analyst) + Orion (@aios-master)*
*Data: 2026-04-12 | Versão: 1.0.0*
