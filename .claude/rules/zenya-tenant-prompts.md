---
paths:
  - packages/zenya/scripts/seed-*-tenant.mjs
  - docs/zenya/tenants/**/*.md
---

# Regra — Padrão de prompts de tenants Zenya

Todo tenant Zenya DEVE ter seu `system_prompt` em `docs/zenya/tenants/{slug}/prompt.md`
com front-matter YAML, carregado em runtime pelo seed script via `gray-matter`.

## Obrigatório

- **Caminho canônico:** `docs/zenya/tenants/{slug}/prompt.md`
- **Parse:** usar `gray-matter` (dep já em `packages/zenya/package.json`)
- **Upsert:** usar `applyTenantSeed` de `packages/zenya/scripts/lib/seed-common.mjs`
- **Validação:** rodar `--dry-run` antes do upsert real em qualquer tenant já em produção. O md5 impresso TEM que bater com `SELECT md5(system_prompt) FROM zenya_tenants WHERE name='…'` antes de prosseguir.

## Proibido

- Hardcode de `const SYSTEM_PROMPT = \`…\`` como template literal em `.mjs` (seed deve ler do `.md`)
- Editar `zenya_tenants.system_prompt` direto no banco, exceto rollback emergencial (seguido de PR que sincroniza o `.md` em ≤24h)
- Rodar seed real sem `--dry-run` prévio em tenants que já têm tráfego

## Front-matter mínimo

```yaml
---
tenant: {slug}
version: 1
updated_at: YYYY-MM-DD
author: {nome}
sources:
  - {origem do conteúdo}
notes: |
  Contexto livre.
---
```

## Referências

- ADR: `docs/architecture/adr/ADR-001-zenya-prompt-storage.md`
- Playbook: `docs/zenya/TENANT-PLAYBOOK.md` §4 e "Criando um novo tenant"
- Utilitário compartilhado: `packages/zenya/scripts/lib/seed-common.mjs`
