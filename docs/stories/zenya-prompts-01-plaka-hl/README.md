# Story zenya-prompts-01-plaka-hl — Migrar HL Importados e preparar PLAKA para o padrão ADR-001

**Status:** Draft — aguardando validação do @po e Fase F da Scar-AI-01 estar Done
**Owner:** @pm criou o epic · @sm refinou · @po valida · @dev implementa
**Epic:** `docs/stories/epics/epic-zenya-prompts-refactor/README.md`
**ADR:** `docs/architecture/adr/ADR-001-zenya-prompt-storage.md`

**Executor Assignment** (Projeto Bob):
- `executor: @dev`
- `quality_gate: @architect`
- `quality_gate_tools: [coderabbit, typescript-check, vitest]`

**Complexity:** S (pequeno) — 3 story points. Tenants LOW risk (HL pré-cutover · PLAKA em research). Reuso direto do padrão já validado no Scar AI.

## Contexto

Primeira story do epic `zenya-prompts-refactor`. Depois que a Fase F da Scar-AI-01 deixar a infra pronta (`gray-matter`, pasta `docs/zenya/tenants/`, seed Scar refatorado), esta story traz HL e PLAKA para o padrão:

- **HL Importados:** hoje com `SYSTEM_PROMPT` hardcoded em `packages/zenya/scripts/seed-hl-tenant.mjs` (linhas 57-163). Cutover n8n→core ainda não aconteceu — momento perfeito para migrar, zero risco de regressão.
- **PLAKA:** em research phase. Quando o seed do PLAKA for criado, já nasce no padrão novo.

## Acceptance Criteria

1. `docs/zenya/tenants/hl-importados/prompt.md` existe com front-matter YAML válido (`tenant`, `version`, `updated_at`, `author`, `sources`) e com o **mesmo conteúdo** do `SYSTEM_PROMPT` atual de `seed-hl-tenant.mjs`.
2. `packages/zenya/scripts/seed-hl-tenant.mjs` refatorado para carregar o prompt via `gray-matter` a partir do path canônico. `SYSTEM_PROMPT` hardcoded removido.
3. Diff textual entre o prompt aplicado pelo seed novo e o `system_prompt` atual do banco Supabase (tenant HL) é **zero**. Validação via SQL: `SELECT system_prompt FROM zenya_tenants WHERE name = 'HL Importados'`.
4. `seed-hl-tenant.mjs` continua idempotente (`upsert` por `chatwoot_account_id`).
5. O diretório `docs/zenya/tenants/plaka/` existe (vazio ou com README.md stub), sinalizando onde o prompt do PLAKA deve nascer.
6. `HL_PROMPT_PATH` env var opcional (sobrepor o default) para dev/sandbox, seguindo o padrão do Scar.

## Dependências

- **Bloqueante:** Fase F da `scar-ai-onboarding-01` Done (gray-matter instalado, pasta `docs/zenya/tenants/` criada, padrão definido e validado no Scar).
- **Não-bloqueante:** cutover do HL ainda não realizado — se acontecer antes desta story, a migração vira post-cutover com risco um pouco maior (ainda LOW).

## Escopo — IN

- Refactor de `seed-hl-tenant.mjs`
- Criação de `docs/zenya/tenants/hl-importados/prompt.md` com front-matter
- Validação via diff SQL
- Stub de diretório `docs/zenya/tenants/plaka/`

## Escopo — OUT

- Implementação do seed do PLAKA (pertence ao épico do PLAKA quando sair de research)
- Migração de Zenya Prime ou Fun Personalize (stories 2 e 3)
- Implementação de `--dry-run` (story 2)
- Atualização do TENANT-PLAYBOOK.md (story 4, escopo de governança)

## Tasks / Subtasks

- [ ] **T1.** Criar branch `feature/zenya-prompts-01-plaka-hl` a partir de `main` (ou da branch onde Scar-AI-01 foi mergeada).
- [ ] **T2.** Extrair o valor completo da constante `SYSTEM_PROMPT` (linhas 57-163) do arquivo `packages/zenya/scripts/seed-hl-tenant.mjs`.
- [ ] **T3.** Criar `docs/zenya/tenants/hl-importados/prompt.md` com front-matter YAML:
  ```yaml
  ---
  tenant: hl-importados
  version: 1
  updated_at: 2026-04-XX
  author: Mauro Mattos
  sources:
    - Secretária v3 (n8n flow original)
  notes: |
    Migração do prompt hardcoded para padrão ADR-001. Conteúdo idêntico ao original.
  ---
  ```
  seguido pelo conteúdo literal do `SYSTEM_PROMPT`. Aponta para AC 1.
- [ ] **T4.** Refatorar `seed-hl-tenant.mjs`:
  - Importar `gray-matter`
  - Remover constante `SYSTEM_PROMPT` hardcoded
  - Carregar o `.md` via `readFile` + `matter(content).content`
  - Suportar `HL_PROMPT_PATH` env var com fallback para path relativo
  - Preservar upsert idempotente por `chatwoot_account_id`. Aponta para AC 2, 4, 6.
- [ ] **T5.** Rodar `seed-hl-tenant.mjs` refatorado localmente em modo `--dry-run` (quando story 2 for Done) — OU validar manualmente via script temporário que carrega o `.md` e compara com o banco. Aponta para AC 3.
- [ ] **T6.** Criar `docs/zenya/tenants/plaka/` com `README.md` stub referenciando o epic do PLAKA. Aponta para AC 5.
- [ ] **T7.** Se HL ainda não teve cutover: rodar o seed na VPS contra Supabase ativo (idempotente) para aplicar o padrão novo. Se já teve cutover: executar o mesmo upsert após validar diff zero.
- [ ] **T8.** Commit atômico na branch. Handoff para @qa via `*qa-gate`.

## Dev Notes

### Padrão do front-matter (ADR-001 D2)
```yaml
---
tenant: <slug>
version: <int>
updated_at: <yyyy-mm-dd>
author: <nome>
sources:
  - <referência1>
  - <referência2>
notes: |
  <opcional>
---
<conteúdo do prompt>
```

### Carregamento via gray-matter
```js
import matter from 'gray-matter';
const raw = await readFile(PROMPT_PATH, 'utf-8');
const { content: SYSTEM_PROMPT, data: metadata } = matter(raw);
// data contém tenant, version, updated_at, etc.
```

### Validação de diff zero
Abordagem simples sem `--dry-run` ainda disponível:
```sql
SELECT md5(system_prompt) FROM zenya_tenants WHERE name = 'HL Importados';
```
Comparar com `md5(content)` do arquivo `.md` gerado. Se bater, seguro para rodar o upsert real.

### Reuso de padrão
Segue exatamente o modelo do `seed-scar-tenant.mjs` pós-Fase F. Não inventar convenção diferente.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Extração do `SYSTEM_PROMPT` perder whitespace significativo (quebras de linha trailing, indentação de XML tags) | Comparar md5 do conteúdo `.md` com md5 do banco antes do upsert. Diff zero é gate obrigatório |
| HL passar pelo cutover antes desta story rodar | Não é regressão — basta rodar idempotente depois. Risco mais alto porque já há tráfego, mas ainda LOW |
| Alguém achar que precisa migrar PLAKA nesta story | AC 5 deixa claro que PLAKA só terá stub de diretório. Implementação do seed PLAKA é outro epic |

## Definição de pronto

- [ ] Branch criada e commit isolado
- [ ] `docs/zenya/tenants/hl-importados/prompt.md` com front-matter e conteúdo idêntico
- [ ] `seed-hl-tenant.mjs` usa gray-matter, sem hardcode
- [ ] Diff md5 (arquivo vs banco) = zero, evidenciado no Completion Notes
- [ ] Stub `docs/zenya/tenants/plaka/README.md` criado
- [ ] @qa PASS no gate

## Histórico

- **2026-04-21** — Criada pelo @sm. Em Draft aguardando validação do @po e término da Fase F da Scar-AI-01.
