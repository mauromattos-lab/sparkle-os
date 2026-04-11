# SOP-1.9-A — Como Atualizar o Mapa de Capacidades dos Agentes

**Versão:** 1.0  
**Data:** 2026-04-11  
**Autor:** @sm (River)  
**Story de origem:** 1.9 — Mapa de Capacidades dos Agentes  
**Revisão:** @qa (PASS)

---

## Objetivo

Garantir que o `docs/agents/AGENT-MAP.md` reflita com precisão as capacidades, ferramentas e restrições de todos os agentes AIOX do SparkleOS após cada mudança.

---

## Pré-requisitos

- [ ] Story que gerou a mudança (novo agente, nova ferramenta, nova restrição) implementada
- [ ] Acesso de escrita a `docs/agents/AGENT-MAP.md`
- [ ] Familiaridade com `.claude/rules/agent-authority.md` (fonte de verdade para autoridade)

---

## Responsável

@sm (River) — dono do documento. Para restrições de autoridade, consultar @architect ou @po antes de atualizar.

---

## Passos

### Passo 1 — Identificar o Tipo de Mudança

Determinar qual seção do mapa precisa ser atualizada:

| Evento | Seção a Atualizar |
|--------|------------------|
| Novo agente AIOX adicionado | Tabela "Agentes AIOX — Construtores" |
| Nova ferramenta / MCP habilitado | Coluna "Ferramentas Disponíveis" + tabela "Ferramentas por Agente" |
| Nova restrição de autoridade | Coluna "Restrições" + tabela "Autoridade Exclusiva" |
| Novo worker de Órgão criado | Tabela "Agentes Workers dos Órgãos" |
| Nova relação de delegação | Seção "Delegação e Handoffs" |

**Resultado esperado:** Tipo de mudança identificado com seção correspondente.

---

### Passo 2 — Verificar Consistência com agent-authority.md

Antes de qualquer mudança de restrição ou autoridade exclusiva:

```bash
# Ler o arquivo de autoridade
# .claude/rules/agent-authority.md
```

Garantir que:
- Novas restrições estão alinhadas com a Delegation Matrix
- Autoridade exclusiva adicionada está refletida em ambos os documentos
- Não há contradições entre os documentos

**Resultado esperado:** Documentos consistentes entre si.

---

### Passo 3 — Atualizar a Tabela Principal

Na tabela de Agentes AIOX, preencher todas as colunas:

```markdown
| `@novo-agente` (Nome) | Archetype | Escopo | Ferramentas (vírgula-separadas) | ❌ O que não pode |
```

Regras para a coluna Restrições:
- Sempre usar ❌ como prefixo visual
- Indicar para onde delegar quando aplicável: `❌ git push (→ @devops)`
- Ser específico — "sem implementação" é menos útil que "❌ modificar packages/"

**Resultado esperado:** Linha adicionada/atualizada com todas as 5 colunas preenchidas.

---

### Passo 4 — Atualizar a Tabela de Ferramentas

Na seção "Ferramentas por Agente":

```markdown
| Nova Ferramenta | @agente1, @agente2 |
```

Verificar:
- Se a ferramenta já existe na tabela (adicionar agente à linha existente)
- Se é ferramenta nova (adicionar linha nova)
- Se tem documentação em `docs/sops/sop-credenciais.md`

**Resultado esperado:** Tabela de ferramentas atualizada e sem duplicações.

---

### Passo 5 — Atualizar a Data e Referência de Story

No cabeçalho do documento:

```markdown
**Última atualização:** Story X.Y (YYYY-MM-DD)
```

**Resultado esperado:** Cabeçalho reflete a story e data da última atualização.

---

### Passo 6 — Para Agentes Workers dos Órgãos

Quando um worker de Órgão é criado nos Épicos futuros, adicionar à tabela correspondente:

```markdown
| Worker XYZ | `organs/xyz/` | Active | Epic N |
```

Incluir:
- Nome do worker
- Caminho do Núcleo no repositório
- Status: Planned / In Development / Active
- Épico que o criou

**Resultado esperado:** Tabela de workers atualizada.

---

## Resultado Final

Ao final do processo:
1. `docs/agents/AGENT-MAP.md` reflete a mudança com todas as colunas preenchidas
2. Consistente com `.claude/rules/agent-authority.md`
3. Data e referência de story atualizadas no cabeçalho
4. Nenhuma informação existente removida sem justificativa

---

## Troubleshooting

| Problema | Causa Provável | Solução |
|----------|---------------|---------|
| Contradição com agent-authority.md | Mudança feita em apenas um arquivo | Atualizar ambos na mesma story |
| Worker e construtor confundidos | Distinção não clara | Verificar seção "Distinção Fundamental" — workers = output, construtores = builders |
| Restrição removida incorretamente | Edição descuidada | Usar `git diff` para verificar remoções antes de commitar |

---

## Histórico de Revisões

| Data | Versão | Mudança | Autor |
|------|--------|---------|-------|
| 2026-04-11 | 1.0 | Criação | @sm (River) |
