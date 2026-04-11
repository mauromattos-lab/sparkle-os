# SOP-1.2-A: Como Verificar que AIOX está Operacional no SparkleOS

**SOP ID:** SOP-1.2-A  
**Criado por:** @dev (Dex) — Story 1.2  
**Atualizado:** 2026-04-11

---

## Objetivo

Verificar que o framework AIOX está funcional dentro do SparkleOS, garantindo que todos os agentes respondem corretamente e o processo de stories está ativo.

## Pré-requisitos

- Claude Code aberto no diretório `SparkleOS/`
- Skills AIOX disponíveis (via `/AIOS:agents:*`)

## Passos

### Passo 1 — Verificar `.aiox-core/` presente

```bash
ls .aiox-core/
```

Esperado: diretório existe com subpastas `core/`, `development/`, etc.

### Passo 2 — Verificar `core-config.yaml`

```bash
cat .aiox-core/core-config.yaml | grep -A3 "project:"
```

Esperado:
```yaml
project:
  name: SparkleOS
  type: greenfield
```

### Passo 3 — Ativar `@sm` e verificar greeting

No Claude Code, digitar: `/AIOS:agents:sm`

Esperado: greeting `🌊 River (Facilitator) ready. Let's flow together!` + lista de comandos sem erro.

### Passo 4 — Executar `*help` no `@sm`

Digitar: `*help`

Esperado: lista de comandos disponíveis exibida (draft, story-checklist, etc.).

### Passo 5 — Ativar `@qa` e verificar greeting

No Claude Code, digitar: `/AIOS:agents:qa`

Esperado: greeting `✅ Quinn (Guardian) ready. Let's ensure quality!` + lista de comandos.

### Passo 6 — Verificar `devStoryLocation`

```bash
cat .aiox-core/core-config.yaml | grep devStoryLocation
```

Esperado: `devStoryLocation: docs/stories`

Verificar que diretório existe: `ls docs/stories/`

### Passo 7 — Verificar QA gates

```bash
ls docs/qa/gates/
```

Esperado: pelo menos um arquivo `.yml` com `gate: PASS` (ex.: `1.1-estrutura-repositorio-sparkle-os.yml`).

## Resultado Esperado

| Check | Status |
|-------|--------|
| `.aiox-core/` presente | ✅ |
| `project.name: SparkleOS` | ✅ |
| `devStoryLocation: docs/stories` | ✅ |
| `@sm *help` responde sem erro | ✅ |
| `@qa *help` responde sem erro | ✅ |
| `docs/qa/gates/` com gates válidos | ✅ |

## Frequência

- Na abertura de cada sessão de desenvolvimento (opcional, mas recomendado)
- Após qualquer atualização do `.aiox-core/`
- Quando houver suspeita de configuração incorreta
