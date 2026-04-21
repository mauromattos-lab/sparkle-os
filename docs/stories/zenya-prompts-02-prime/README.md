# Story zenya-prompts-02-prime — Migrar Zenya Prime e implementar --dry-run genérico

**Status:** Blocked — aguardando `zenya-prompts-01-plaka-hl` Done. @po já validou o conteúdo (10/10, GO condicional). Transiciona para Ready automaticamente quando a dependência for resolvida.
**Owner:** @pm criou o epic · @sm refinou · @po valida · @dev implementa
**Epic:** `docs/stories/epics/epic-zenya-prompts-refactor/README.md`
**ADR:** `docs/architecture/adr/ADR-001-zenya-prompt-storage.md`

**Executor Assignment:**
- `executor: @dev`
- `quality_gate: @architect`
- `quality_gate_tools: [coderabbit, typescript-check, vitest]`

**Complexity:** M (médio) — 5 story points. Dois trabalhos combinados: refactor do Prime (MED risk — produção interna) + entregar capacidade `--dry-run` que é **pré-requisito** para a Story 3 (Fun Personalize).

## Contexto

Segunda story do epic. Tem dois objetivos combinados:

1. **Capability-first:** implementar `--dry-run` como flag genérica reutilizável em todos os seeds de tenant. Carrega o prompt do `.md`, mostra o que *seria* enviado ao banco, e **não executa o UPSERT**. Essa flag é gate obrigatório para Story 3 (Fun Personalize em produção comercial).
2. **Aplicar no Prime:** migrar Zenya Prime (tenant interno da própria Sparkle AI) usando o `--dry-run` como validação pré-upsert.

## Acceptance Criteria

1. Módulo utilitário (ex: `packages/zenya/scripts/lib/seed-common.mjs`) exporta função `applyTenantSeed({ row, dryRun })` que:
   - Se `dryRun: true` → imprime JSON da row + hash (md5) do `system_prompt` e **não** faz UPSERT
   - Se `dryRun: false` → executa o UPSERT idempotente
2. `seed-scar-tenant.mjs`, `seed-hl-tenant.mjs` e `seed-prime-tenant.mjs` (novo) usam a função utilitária — sem duplicação de lógica.
3. Flag `--dry-run` (via `process.argv`) é suportada em todos os 3 seeds. Default = `false`.
4. `docs/zenya/tenants/zenya-prime/prompt.md` existe com front-matter YAML e conteúdo idêntico ao prompt atual do banco (tenant "Zenya Prime" ou equivalente — validar nome exato).
5. `packages/zenya/scripts/seed-prime-tenant.mjs` criado espelhando estrutura do Scar/HL: usa gray-matter, suporta env vars `PRIME_*`, `--dry-run`.
6. Diff md5 (dry-run output vs `zenya_tenants.system_prompt` no banco) = zero antes de executar upsert real.
7. Upsert real executado com `--dry-run` removido, validando que o Prime continua respondendo normalmente (smoke test manual: 1 mensagem admin do Mauro).

## Dependências

- **Bloqueante:** `zenya-prompts-01-plaka-hl` Done (pattern do gray-matter validado em HL).
- **Bloqueante:** Fase F da Scar-AI-01 Done (infra base).
- **Não-bloqueante:** identificar o `chatwoot_account_id` e o nome exato do tenant Zenya Prime no Supabase ativo antes de começar.

## Escopo — IN

- Criar módulo utilitário `lib/seed-common.mjs` (ou similar)
- Refatorar 3 seeds para usar o utilitário (Scar, HL, Prime)
- Criar seed Prime novo
- Criar `docs/zenya/tenants/zenya-prime/prompt.md`
- Validar via dry-run + md5 + smoke test

## Escopo — OUT

- Fun Personalize (story 3 — usa o `--dry-run` entregue aqui)
- Backup automático de system_prompt anterior (pertence à story 3 como gate adicional)
- Testes unitários formais do utilitário (pode virar follow-up — a lógica é trivial)

## Tasks / Subtasks

- [ ] **T1.** Criar branch `feature/zenya-prompts-02-prime` após story 1 Done e mergeada.
- [ ] **T2.** Criar `packages/zenya/scripts/lib/seed-common.mjs` exportando `applyTenantSeed({ supabase, table, row, conflict, dryRun })`:
  - Em `dryRun: true`, imprime `{tenant, chatwoot_account_id, system_prompt_md5, active_tools, admins}` e retorna sem chamar o banco
  - Em `dryRun: false`, executa `supabase.from(table).upsert(row, { onConflict }).select().single()` e retorna
  - Inclui parsing de `process.argv.includes('--dry-run')` como helper
  Aponta para AC 1, 3.
- [ ] **T3.** Refatorar `seed-scar-tenant.mjs` e `seed-hl-tenant.mjs` para usar `applyTenantSeed`. Remover duplicação de lógica de upsert. Validar com `--dry-run` que output é consistente. Aponta para AC 2.
- [ ] **T4.** Consultar o Supabase ativo para descobrir o `chatwoot_account_id` e nome exato do tenant Zenya Prime:
  ```sql
  SELECT id, name, chatwoot_account_id FROM zenya_tenants;
  ```
- [ ] **T5.** Criar `docs/zenya/tenants/zenya-prime/prompt.md` com front-matter YAML e conteúdo idêntico ao `system_prompt` atual do banco (extraído via SQL). Aponta para AC 4.
- [ ] **T6.** Criar `packages/zenya/scripts/seed-prime-tenant.mjs` espelhando estrutura do Scar, com env vars `PRIME_CHATWOOT_ACCOUNT_ID`, `PRIME_ADMIN_PHONES`, `PRIME_ADMIN_CONTACTS`, `PRIME_PROMPT_PATH`, `PRIME_ACTIVE_TOOLS`. Usa `applyTenantSeed`. Aponta para AC 5.
- [ ] **T7.** Executar `node scripts/seed-prime-tenant.mjs --dry-run` na VPS e validar que `system_prompt_md5` bate com `md5(system_prompt)` do banco. Aponta para AC 6.
- [ ] **T8.** Executar seed real sem `--dry-run`. Rodar smoke test: mandar 1 mensagem admin do Mauro e validar resposta dentro do padrão esperado. Aponta para AC 7.
- [ ] **T9.** Commit atômico. Handoff @qa.

## Dev Notes

### Assinatura do utilitário
```js
export async function applyTenantSeed({ supabase, table = 'zenya_tenants', row, conflict = 'chatwoot_account_id', dryRun = false }) {
  if (dryRun) {
    const hash = crypto.createHash('md5').update(row.system_prompt).digest('hex');
    console.log('🧪 DRY RUN — não executando UPSERT');
    console.log(JSON.stringify({
      table,
      conflict,
      row: { ...row, system_prompt: `<${row.system_prompt.length} chars, md5=${hash}>` },
    }, null, 2));
    return { dryRun: true, hash };
  }
  return supabase.from(table).upsert(row, { onConflict: conflict }).select().single();
}

export function isDryRun(argv = process.argv) {
  return argv.includes('--dry-run');
}
```

### Validação md5 (sem `--dry-run`, no banco)
```sql
SELECT id, name, md5(system_prompt) AS hash
FROM zenya_tenants
WHERE name LIKE '%Zenya Prime%';
```
Comparar com hash do `dry-run`.

### Nome do tenant Zenya Prime
Ainda não documentado formalmente — pode ser "Zenya Prime", "Zenya", "Sparkle AI" ou outro. T4 resolve isso antes de qualquer refactor.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Nome do tenant no banco difere do esperado → upsert pode criar duplicata | T4 resolve a ambiguidade antes de T6. Sem certeza do nome, não prosseguir |
| Prime é o agente que a própria Sparkle usa — regressão afeta Mauro e colaboradores | Dry-run + md5 gate. Smoke test obrigatório pós-cutover |
| Refactor dos 2 seeds já migrados (Scar, HL) pode quebrá-los | T3 valida com `--dry-run` em ambos. Sem regressão de md5 |
| Utilitário vira complexo e difícil de usar | Manter assinatura enxuta. Se precisar mais de 2 opções, revisitar |

## Definição de pronto

- [ ] Branch criada
- [ ] `lib/seed-common.mjs` + `isDryRun` utilitário
- [ ] Scar e HL seeds refatorados, dry-run funcionando
- [ ] `docs/zenya/tenants/zenya-prime/prompt.md` criado com front-matter
- [ ] `seed-prime-tenant.mjs` criado
- [ ] Dry-run Prime → md5 match evidenciado
- [ ] Seed Prime real executado, smoke test manual OK
- [ ] @qa PASS

## Histórico

- **2026-04-21** — Criada pelo @sm. Em Draft bloqueada por story 1.
- **2026-04-21** — @po valida conteúdo. Score 10/10 → **GO condicional** (desbloqueio automático quando story 1 fechar).
