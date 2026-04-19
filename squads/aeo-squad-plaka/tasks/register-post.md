---
task: Registrar Post no Histórico
responsavel: "@sage"
responsavel_type: agent
squad: aeo-squad-plaka
atomic_layer: task
elicit: false
Entrada: |
  - post_aprovado: Post completo aprovado pelo Rex
  - briefing: Briefing original da Sage que gerou o post
  - data_publicacao: Data de publicação (default: hoje)
Saida: |
  - historico_atualizado: data/posts-history.md com nova entrada
  - confirmacao: "Registro concluído — tópico X adicionado"
Checklist:
  - "[ ] Extrair: data, tópico, pergunta central, bloco, palavras-chave do briefing"
  - "[ ] Adicionar linha na tabela de posts em data/posts-history.md (incluindo a URL do post publicado)"
  - "[ ] Marcar tópico como concluído no backlog (se presente)"
  - "[ ] Atualizar distribuição por bloco (tabela de meta semanal)"
  - "[ ] Confirmar registro"
---

# *register-post

Sage registra o post aprovado no histórico após aprovação do Rex.

## Quando executar

Imediatamente após Rex emitir veredicto `APROVADO` ou `APROVADO_COM_OBSERVACOES`.
A publicação no Ghost (https://blog.plakaacessorios.com) é automática via content-engine — este step registra o histórico.

## Processo

### 1. Extrair dados do briefing
```
data:            do briefing.data
topico:          do briefing.topico
pergunta:        do briefing.pergunta_central
bloco:           do briefing.bloco_conteudo
palavras_chave:  primeiras 2-3 do briefing.palavras_chave
```

### 2. Adicionar entrada na tabela

Abrir `data/posts-history.md` e adicionar linha na tabela de Registro de Posts.
**Obrigatório incluir a URL do post publicado no Ghost** — necessária para contextual linking nos posts futuros.

```markdown
| {data} | {topico} | {pergunta_central} | {bloco} | {palavras_chave} | {url} |
```

A URL é retornada pelo content-engine após publicação no Ghost (`https://blog.plakaacessorios.com/{slug}/`).
Se o post foi publicado manualmente, copiar a URL do browser após a publicação.

### 3. Marcar no backlog

Se o tópico estava no backlog, marcar como concluído:
```
- [x] {tópico} ← marcar com x
```

### 4. Atualizar distribuição por bloco

Incrementar o contador do bloco correspondente na tabela de Meta Semanal.

## Posição no Workflow

```
Rex (APROVADO)
    ↓
Sage *register-post   ← esta task
    ↓
content-engine publica automaticamente no Ghost CMS
```
