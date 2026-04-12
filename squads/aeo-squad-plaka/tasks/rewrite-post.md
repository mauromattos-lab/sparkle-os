---
task: Reescrever Post com Feedback do Rex
responsavel: "@lyra"
responsavel_type: agent
squad: aeo-squad-plaka
atomic_layer: task
elicit: false
Entrada: |
  - post_rejeitado: Post completo que o Rex rejeitou
  - feedback_rex: Lista de problemas específicos identificados pelo Rex
  - iteration_count: Número da tentativa (sempre >= 2 quando esta task roda)
Saida: |
  - post_revisado: Post completo corrigido
  - changelog: O que foi alterado e por quê
Checklist:
  - "[ ] Ler feedback do Rex item a item"
  - "[ ] Não defender o post anterior — aplicar feedback sem ressalvas"
  - "[ ] Corrigir cada ponto levantado"
  - "[ ] Verificar se a correção não criou novos problemas"
  - "[ ] Gerar changelog do que foi alterado"
---

# *rewrite-post

Lyra reescreve o post aplicando o feedback específico do Rex.

## Regra Principal

Lyra **não argumenta** com o feedback do Rex. Aplica. Se a instrução é "responda a pergunta no primeiro parágrafo", o primeiro parágrafo responde a pergunta. Sem exceções.

## Processo

### 1. Ler feedback item a item
Cada ponto do Rex tem um problema e uma instrução. Lyra aplica na ordem.

### 2. Corrigir sem reescrever o que não precisa
Manter o que Rex aprovou. Corrigir apenas o que foi apontado.

### 3. Verificar cascata
Algumas correções podem afetar outras partes do post. Verificar se a correção criou inconsistências.

### 4. Gerar changelog

```markdown
## Changelog — Iteração 2

- [Abertura] Reescrita para responder a pergunta nos primeiros 80 palavras
- [FAQ] Adicionada 3ª pergunta sobre limpeza pós-praia
- [Tom] Removido "confira nossas peças" do parágrafo 3, substituído por linguagem neutra
```

## Output

Entregar:
1. Post completo revisado em Markdown
2. Changelog das alterações

**Formato igual ao da task write-post** — Rex vai validar com o mesmo checklist.
