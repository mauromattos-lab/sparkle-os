# Story zenya-prompts-03-fun-personalize — Migrar Fun Personalize com gates de produção

**Status:** Blocked — aguardando `zenya-prompts-02-prime` Done (precisa do `--dry-run`)
**Owner:** @pm criou o epic · @sm refinou · @po valida · @dev implementa · **Mauro operacionaliza o cutover**
**Epic:** `docs/stories/epics/epic-zenya-prompts-refactor/README.md`
**ADR:** `docs/architecture/adr/ADR-001-zenya-prompt-storage.md`

**Executor Assignment:**
- `executor: @dev`
- `quality_gate: @architect`
- `quality_gate_tools: [coderabbit, typescript-check, vitest]`

**Complexity:** M (médio) — 5 story points. Trabalho técnico é pequeno, mas **HIGH RISK** por ser o primeiro cliente comercial em produção. Toda a margem de segurança está nos gates, não no volume de código.

## Contexto

Terceira story do epic. Migração do tenant **Fun Personalize** — primeiro cliente comercial no core Zenya (referenciado em TENANT-PLAYBOOK.md como caso de referência). Risco de regressão afeta cliente pagante, por isso gates explícitos são obrigatórios:

1. `--dry-run` executado primeiro, validado md5
2. Backup textual do `system_prompt` atual salvo em arquivo
3. Janela de manutenção combinada com Mauro (baixo tráfego)
4. Smoke test pós-cutover (1 mensagem real, resposta equivalente)
5. Plano de rollback documentado e testado

## Acceptance Criteria

1. `docs/zenya/tenants/fun-personalize/prompt.md` existe com front-matter YAML (`tenant: fun-personalize`, versão, sources, notas) e conteúdo idêntico ao `system_prompt` atual do banco.
2. `packages/zenya/scripts/seed-fun-personalize-tenant.mjs` criado usando `applyTenantSeed` e `gray-matter`.
3. `--dry-run` executado antes do upsert real. md5 do prompt carregado do `.md` bate com md5 do banco atual.
4. Backup textual salvo em `.ai/backups/fun-personalize-system_prompt-YYYYMMDD-HHMM.sql` contendo um statement `UPDATE zenya_tenants SET system_prompt = $$...$$ WHERE id = '<uuid>';` que permite rollback imediato.
5. Cutover executado em janela combinada (documentada em `cutover-log.md` dentro da pasta da story). Upsert real ocorre apenas nessa janela.
6. Smoke test pós-cutover passa: mensagem de teste de número admin para Fun Personalize recebe resposta dentro do padrão (mesmo tom, mesmas regras — sem regressão visível).
7. Plano de rollback documentado em `rollback-plan.md` dentro da pasta da story, incluindo comando SQL exato para reverter.

## Dependências

- **Bloqueante:** `zenya-prompts-02-prime` Done (precisa do `--dry-run` e do `applyTenantSeed` validados).
- **Bloqueante:** janela de manutenção combinada com Mauro. Idealmente fim de semana ou horário de baixo tráfego (fora do horário comercial do cliente).
- **Não-bloqueante:** identificar `chatwoot_account_id` e nome exato do tenant Fun Personalize no Supabase ativo.

## Escopo — IN

- Migração do Fun Personalize para o padrão ADR-001
- Backup do `system_prompt` atual (rollback enabler)
- Rollback plan documentado
- Cutover log
- Smoke test pós-cutover

## Escopo — OUT

- Refactor/melhorias no prompt em si (fora de escopo — objetivo é migração invisível para o cliente)
- Revisão de `active_tools` do Fun Personalize (outra story/epic se necessário)
- Automação do rollback (manual é suficiente para esta migração)

## Tasks / Subtasks

### Pré-cutover (zero risco, qualquer momento)

- [ ] **T1.** Criar branch `feature/zenya-prompts-03-fun-personalize` após story 2 Done.
- [ ] **T2.** Consultar Supabase ativo para obter `id`, `chatwoot_account_id`, `system_prompt` atual do tenant Fun Personalize:
  ```sql
  SELECT id, chatwoot_account_id, name, md5(system_prompt) AS hash, length(system_prompt) AS chars
  FROM zenya_tenants WHERE name LIKE '%Fun Personalize%';
  ```
  Anotar tudo em `cutover-log.md` draft.
- [ ] **T3.** Extrair o `system_prompt` atual e salvar em `docs/zenya/tenants/fun-personalize/prompt.md` adicionando front-matter YAML. Preservar whitespace e estrutura **exata**.
- [ ] **T4.** Criar `packages/zenya/scripts/seed-fun-personalize-tenant.mjs` espelhando o Prime (usa `applyTenantSeed`, gray-matter, env vars `FUN_*`, suporta `--dry-run`).
- [ ] **T5.** Executar `node scripts/seed-fun-personalize-tenant.mjs --dry-run` localmente (apontando para Supabase ativo) e **validar md5 = md5 do banco**. Se não bater → investigar whitespace/encoding no `.md`, corrigir, repetir. Aponta para AC 3.
- [ ] **T6.** Gerar backup textual:
  ```sql
  -- copiar resultado para .ai/backups/fun-personalize-system_prompt-YYYYMMDD-HHMM.sql
  SELECT format('UPDATE zenya_tenants SET system_prompt = $backup$%s$backup$ WHERE id = %L;', system_prompt, id)
  FROM zenya_tenants WHERE name LIKE '%Fun Personalize%';
  ```
  Aponta para AC 4.
- [ ] **T7.** Escrever `rollback-plan.md` na pasta da story com: localização do backup, comando exato de rollback, quando acionar, critério de acionamento. Aponta para AC 7.
- [ ] **T8.** Alinhar janela de cutover com Mauro. Documentar em `cutover-log.md`.

### Cutover (janela combinada, atenção máxima)

- [ ] **T9.** `pm2 logs zenya-webhook -f` em um terminal.
- [ ] **T10.** Rodar `--dry-run` uma última vez imediatamente antes do cutover — garantir que md5 ainda bate (se alguém editou o prompt no banco enquanto escrevíamos o `.md`, aqui detecta).
- [ ] **T11.** Executar seed real (sem `--dry-run`). Esperar confirmação no stdout. Aponta para AC 5.
- [ ] **T12.** Imediatamente após: cliente Fun Personalize envia mensagem de teste (coordenar com Mauro). Validar resposta dentro do padrão. Aponta para AC 6.
- [ ] **T13.** Se regressão detectada: aplicar rollback imediato usando backup do T6. Documentar incidente em `cutover-log.md`.
- [ ] **T14.** Monitorar 30 min pós-cutover sem ação. Se estável → marcar story como completa.

### Pós-cutover

- [ ] **T15.** Commit final incluindo `cutover-log.md` e `rollback-plan.md`. Handoff @qa.

## Dev Notes

### Backup SQL — formato oficial
```sql
-- Gerado em: 2026-MM-DD HH:MM:SS UTC
-- Tenant: Fun Personalize (id=<uuid>)
-- Rollback rápido:
UPDATE zenya_tenants
SET system_prompt = $backup$<conteúdo literal, preservando quebras e caracteres especiais>$backup$
WHERE id = '<uuid>';
```

Usar delimitador `$backup$...$backup$` para evitar escape de aspas internas.

### Rollback path
```bash
# via psql ou Management API
curl -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  --data-binary "@.ai/backups/fun-personalize-system_prompt-YYYYMMDD-HHMM.sql"
```

Cache de 5min do core expira sozinho — próxima mensagem pega o prompt rollbackado. Sem precisar de `pm2 reload`.

### Smoke test (T12)
Uma mensagem simples de número admin (Mauro ou proprietária do Fun). Validações:
- Resposta não vazia
- Tom consistente (comparar com histórico recente)
- Nenhum erro em `pm2 logs zenya-webhook`
- Tempo de resposta dentro do normal

Fun Personalize é tenant maduro — qualquer agente humano conhecendo o cliente sabe identificar comportamento anormal em 2 mensagens.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Whitespace/encoding do banco difere sutilmente do `.md` exportado | Dry-run com md5 é gate. Só segue se igual. Se não bater após ajustes → escalar pro @architect repensar estratégia |
| Cutover gera regressão visível no cliente | Backup + rollback plan (T6, T7). Detecção rápida via T12 |
| Prompt atual do banco foi editado por alguém (não-sm, não-dev) durante a janela de preparação | T10 repete dry-run imediatamente antes do upsert — captura divergência de última hora |
| Cache de 5 min atrasa propagação do rollback | Pequeno. Documentar na rollback plan que máximo 5 min até voltar ao comportamento antigo |
| Conflito de horário com atividade comercial do cliente | Mauro alinha janela. Não fazer sem confirmação |

## Definição de pronto

- [ ] Branch criada
- [ ] `.md` criado com front-matter
- [ ] Seed criado
- [ ] Dry-run + md5 match evidenciado (colar output no Completion Notes)
- [ ] Backup SQL salvo em `.ai/backups/`
- [ ] Rollback plan escrito
- [ ] Cutover executado em janela combinada, smoke test OK
- [ ] Cutover log fechado com "sem regressão detectada"
- [ ] @qa PASS

## Histórico

- **2026-04-21** — Criada pelo @sm. Blocked por story 2.
