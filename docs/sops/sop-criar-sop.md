# SOP-1.7-A — Como Criar um SOP no SparkleOS

**Versão:** 1.0  
**Data:** 2026-04-11  
**Autor:** @dev (Dex)  
**Story de origem:** 1.7 — Framework de SOPs  
**Revisão:** @qa (PASS)

---

## Objetivo

Documentar o processo padrão para criar um novo SOP (Standard Operating Procedure) no SparkleOS, garantindo que todos os processos repetíveis sejam documentados de forma consistente e utilizável pelos agentes AIOS.

---

## Pré-requisitos

- [ ] Story que gerou a necessidade do SOP implementada (ou em implementação)
- [ ] Template `docs/sops/SOP-TEMPLATE.md` disponível no repositório
- [ ] Acesso de escrita ao diretório `docs/sops/`

---

## Responsável

@dev (ou agente que implementou a story de origem). Para SOPs de processo de negócio, pode ser @pm ou @po.

---

## Passos

### Passo 1 — Identificar a Necessidade

Verificar se a story atual contém um processo repetível que justifica um SOP:

- Processo que será executado mais de uma vez
- Processo com múltiplos passos que podem falhar
- Processo que um novo agente precisaria aprender
- AC da story explicitamente exige SOP no Definition of Done

**Resultado esperado:** Decisão clara de criar o SOP (ou não).

---

### Passo 2 — Definir o Slug

Escolher um slug curto, descritivo e em kebab-case:

```
sop-{ação}-{contexto}.md
```

Exemplos:
- `sop-criar-adr.md`
- `sop-escalacao-mauro.md`
- `sop-health-check.md`
- `sop-context-store.md`

Regra: O slug deve ser autoexplicativo sem precisar ler o conteúdo.

**Resultado esperado:** Nome do arquivo definido no formato `sop-{slug}.md`.

---

### Passo 3 — Copiar o Template

Criar o arquivo em `docs/sops/sop-{slug}.md` a partir do template:

```bash
# O conteúdo base está em docs/sops/SOP-TEMPLATE.md
# Copiar e preencher os campos
```

Campos obrigatórios no cabeçalho:
- `Versão` — começar em 1.0
- `Data` — data de criação no formato YYYY-MM-DD
- `Autor` — ID do agente (@dev, @qa, etc.)
- `Story de origem` — ID da story que criou este SOP (ex: 1.6)
- `Revisão` — @qa preenche após revisão; deixar em branco se ainda não revisado

**Resultado esperado:** Arquivo criado com estrutura completa do template.

---

### Passo 4 — Preencher o Conteúdo

Preencher cada seção seguindo as diretrizes:

**Objetivo** — Uma ou duas frases. Responde: *"O que este processo faz?"* e *"Por que existe?"*

**Pré-requisitos** — Checkboxes de itens verificáveis antes de iniciar. Ser específico.

**Responsável** — Agente ou pessoa que executa. Não usar "qualquer um".

**Passos** — Cada passo deve:
  - Ter título ativo (verbo no imperativo: "Criar", "Executar", "Verificar")
  - Incluir comandos exatos quando aplicável (blocos de código)
  - Ter "Resultado esperado" claro e verificável
  - Ser granular o suficiente para não deixar ambiguidade

**Resultado Final** — Estado verificável ao final. Inclui como confirmar que o processo funcionou.

**Troubleshooting** — Pelo menos os problemas mais comuns. Mínimo 1 linha se processo tem pontos de falha conhecidos.

**Resultado esperado:** SOP preenchido completamente, sem campos `[...]` ou `...` vazios.

---

### Passo 5 — Registrar no Índice

Adicionar entrada no `docs/sops/README.md`:

```markdown
| [sop-{slug}.md](./sop-{slug}.md) | Título do SOP | Story de origem |
```

**Resultado esperado:** README.md atualizado com o novo SOP listado.

---

### Passo 6 — Referenciar na Story

Na seção **File List** da story de origem, adicionar:
```
- `docs/sops/sop-{slug}.md` — SOP-X.Y-Z: Título
```

Na seção **Definition of Done**, marcar o checkbox correspondente ao SOP como `[x]`.

**Resultado esperado:** Story reflete o SOP como entregável completo.

---

## Resultado Final

Ao final deste processo, devem existir:
1. Arquivo `docs/sops/sop-{slug}.md` preenchido sem campos em branco
2. Entrada no `docs/sops/README.md`
3. Referência no File List da story de origem

---

## Troubleshooting

| Problema | Causa Provável | Solução |
|----------|---------------|---------|
| SOP fica vago e inutilizável | Passos muito abstratos | Cada passo deve ter "Resultado esperado" verificável |
| Slug conflita com SOP existente | Nome muito genérico | Adicionar contexto ao slug (ex: `sop-criar-adr-sparkle-os.md`) |
| Agente não sabe quando criar SOP | Critério indefinido | Verificar se a story tem AC "criar SOP" ou se o processo se repete ≥2× |

---

## Histórico de Revisões

| Data | Versão | Mudança | Autor |
|------|--------|---------|-------|
| 2026-04-11 | 1.0 | Criação | @dev (Dex) |
