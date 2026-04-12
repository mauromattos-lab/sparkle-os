---
task: Pesquisar Tópico Específico
responsavel: "@sage"
responsavel_type: agent
squad: aeo-squad-plaka
atomic_layer: task
elicit: false
Entrada: |
  - topico_candidato: Tópico a ser investigado
Saida: |
  - interesse_estimado: ALTO | MEDIO | BAIXO
  - gap_concorrentes: Descrição do que falta no mercado
  - fontes_referencia: URLs ou referências encontradas
  - recomendacao: ESCREVER_AGORA | AGUARDAR | DESCARTAR
  - justificativa: Razão da recomendação
Checklist:
  - "[ ] Pesquisar volume de interesse via EXA"
  - "[ ] Analisar como concorrentes cobrem o tópico"
  - "[ ] Identificar gap — o que falta?"
  - "[ ] Avaliar sazonalidade e urgência"
  - "[ ] Emitir recomendação com justificativa"
---

# *research-topic

Sage faz uma pesquisa focada sobre um tópico candidato específico.

## Quando usar

- Antes de incluir um tópico novo no calendário editorial
- Quando Mauro ou Luiza sugere um tema específico
- Para validar se um tópico tem demanda real antes de escrever

## Processo

### 1. Pesquisa de Interesse (EXA)
Buscar:
- "{tópico} semi joia"
- "como {tópico} semi joia"
- "{tópico} semijoias brasil"

Avaliar: quantidade de resultados, qualidade das respostas encontradas, data dos conteúdos.

### 2. Análise de Concorrentes
Verificar os principais blogs do nicho:
- blog.gazinsemijoias.com.br
- blog.veridianaquirino.com.br
- blog.donadivasemijoias.com.br

O que cada um faz bem? O que faz mal? O que não cobre?

### 3. Avaliação de Gap
- Gap FORTE: ninguém responde bem → prioridade máxima
- Gap MÉDIO: resposta existe mas é genérica → oportunidade de autoridade
- Gap FRACO: bem coberto → descartar ou abordar com ângulo muito específico

### 4. Recomendação Final

```yaml
research:
  topico: "string"
  interesse_estimado: "ALTO | MEDIO | BAIXO"
  gap_concorrentes: "string — descrição do gap"
  fontes_referencia:
    - url: "string"
      qualidade: "BOA | MEDIA | FRACA"
  recomendacao: "ESCREVER_AGORA | AGUARDAR | DESCARTAR"
  justificativa: "string"
```
