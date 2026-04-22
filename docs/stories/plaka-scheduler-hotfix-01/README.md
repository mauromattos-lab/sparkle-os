# Story plaka-scheduler-hotfix-01 — Resiliência do scheduler diário do blog PLAKA

**Status:** Done — deployado em produção 2026-04-22, validado em run `24787261371`
**Owner:** @devops diagnosticou · @dev implementou · @qa validou (PASS) · @devops mergeou (PR #1, `a1428cd`) e disparou
**Severity:** HIGH (prod — blog real de cliente sem post hoje) — RESOLVIDO

## Contexto

Blog PLAKA (`blog.plakaacessorios.com`) não recebeu o artigo diário agendado para **2026-04-21 09:00 BRT**.

Investigação do @devops (`handoff-devops-to-dev-20260421-plaka-scheduler.yaml`) identificou **2 bugs independentes** no pipeline `.github/workflows/plaka-daily-content.yml` + `packages/content-engine/scripts/daily-pipeline.mjs`:

- **Bug #2 (bloqueador de hoje):** `parseRexVeredicto` em `daily-pipeline.mjs:86-91` usa `JSON.parse` direto, sem tolerar trailing comma. Na run de 2026-04-21 13:04 UTC, o GPT-4o retornou JSON malformado (`"pais.",\n  ]\n}`) na **iteração 2 da revalidação do Rex** e o pipeline crashou com exit 1 antes do step-9b (publish). Evidência: [run 24723933245](https://github.com/mauromattos-lab/sparkle-os/actions/runs/24723933245).
- **Bug #1 (latente desde 20/04):** workflow não declara `permissions: contents: write`, então o `git-auto-commit-action@v5` falha com 403 ao tentar commitar o `posts-history.md` atualizado. No dia 20/04 o post **foi publicado** no Ghost mas o histórico ficou dessincronizado no repo. Evidência: [run 24668368883](https://github.com/mauromattos-lab/sparkle-os/actions/runs/24668368883).

Mauro pediu **solução definitiva** — não patch mínimo. Blog em produção, cliente é Luiza (Plaka Acessórios).

## Acceptance Criteria

1. `parseRexVeredicto` tolera os 3 modos de falha mais comuns de LLM: (a) trailing comma antes de `]` ou `}`; (b) texto adicional ao redor do JSON; (c) JSON envolto em bloco markdown ` ```json `. Retry implícito: se `JSON.parse` inicial falhar, aplica sanitização e tenta de novo. Se ainda falhar, erro explícito com preview do conteúdo bruto.
2. Chamada OpenAI em `callClaude` aceita parâmetro opcional `jsonMode` — quando `true`, envia `response_format: { type: 'json_object' }` e instrui no system prompt que é JSON. Usado pelo `validatePost`.
3. `.github/workflows/plaka-daily-content.yml` declara `permissions: { contents: write }` no nível do job `daily-content`.
4. `squads/aeo-squad-plaka/data/posts-history.md` tem entrada para **2026-04-20** (backfill do post publicado mas não commitado). Slug e URL verificados via Ghost Admin API.
5. Smoke test unit em `packages/content-engine/scripts/daily-pipeline.test.mjs` (ou equivalente) cobre `parseRexVeredicto` com pelo menos 4 cenários: JSON válido, trailing comma, bloco markdown, JSON com texto envolvente. Todos passam.
6. Após merge e disparo manual do workflow via `workflow_dispatch force=true`, post de 21/04 é publicado no Ghost **e** `posts-history.md` é atualizado automaticamente no repo.

## Escopo — IN

- Endurecer `parseRexVeredicto` (sanitização + retry).
- Adicionar `response_format: json_object` na `callClaude` usada pelo Rex.
- Fix de permissions no workflow.
- Backfill do entry de 2026-04-20 no `posts-history.md`.
- Teste unit do parse defensivo.

## Escopo — OUT (v1)

- Renomear `callClaude` para `callOpenAI` (confusão de nome, mas não funcional — deixar pra próximo refactor).
- Upgrade de `actions/checkout@v4` e `actions/setup-node@v4` pra Node 24 (deprecation é só em set/2026, não bloqueia).
- Refatorar pipeline pra separar em módulos (extrair Rex, Lyra, Sage em `src/`).
- Observabilidade estruturada (Pino/Winston) — fora do escopo do hotfix.

## Arquivos esperados

- `packages/content-engine/scripts/daily-pipeline.mjs` — modificado (parse defensivo + jsonMode)
- `packages/content-engine/scripts/daily-pipeline.test.mjs` — **novo** (smoke tests)
- `.github/workflows/plaka-daily-content.yml` — modificado (permissions)
- `squads/aeo-squad-plaka/data/posts-history.md` — modificado (backfill 20/04)

## Riscos

| Risco | Mitigação |
|-------|-----------|
| `response_format: json_object` requer a palavra "JSON" no prompt — OpenAI valida | Garantir que system prompt do Rex ou user message menciona "JSON" explicitamente |
| Sanitização de trailing comma pode corromper strings que legitimamente contêm `,]` ou `,}` | Regex aplicada só ao conteúdo do primeiro `{` ao último `}`, e apenas como fallback se `JSON.parse` direto falhar |
| Permissions elevadas no workflow aumentam superfície — `GITHUB_TOKEN` passa a poder escrever | Escopo é apenas `contents:write` (não `actions:write`, `packages:write`, etc). Uso é limitado ao commit do `posts-history.md` via action auditada |
| Backfill do 20/04 requer query ao Ghost — se API estiver fora, entrada fica pendente | Se Ghost indisponível, pular backfill e registrar em Dev Notes. Não bloqueia AC principais |

## Plano de verificação

1. `node --test packages/content-engine/scripts/daily-pipeline.test.mjs` — todos os cenários passam.
2. Opcional local: `FORCE=true node packages/content-engine/scripts/daily-pipeline.mjs` com credenciais reais (cuidado — publica no Ghost).
3. Pós-merge: `gh workflow run plaka-daily-content.yml -f force=true` — observar run completar com sucesso, post no Ghost e entry no `posts-history.md`.
4. Próximo run agendado (22/04 09:00 BRT): completa sem intervenção, commit automático do histórico.

## Dev Agent Record

### Agent Model Used
claude-opus-4-7 (Dex)

### Completion Notes List
- **AC1 (parseRexVeredicto defensivo):** implementado com 3 camadas — (a) extração via `extractBlock` para isolar bloco markdown ```json; (b) JSON.parse direto como primeira tentativa; (c) `stripTrailingCommas` + retry como fallback; (d) erro explícito com preview se ambos falharem. Função agora exportada (`export function`) para testabilidade.
- **AC2 (jsonMode):** `callClaude` recebe 4º parâmetro `options.jsonMode`. Quando true, envia `response_format: { type: 'json_object' }`. `validatePost` usa `jsonMode: true` e user message menciona "JSON" explicitamente (requisito da OpenAI quando response_format é json_object).
- **AC3 (workflow permissions):** adicionado `permissions: { contents: write }` no job `daily-content` do workflow.
- **AC4 (backfill 20/04):** linha adicionada no `posts-history.md` para 2026-04-20 — "Tendências de semi joias para o inverno 2026" (tag `tendencias`). Dados verificados via Ghost Admin API com script one-shot descartado após uso.
- **AC5 (smoke tests):** 9 cenários em `daily-pipeline.test.mjs` — JSON válido, trailing comma em `}`, trailing comma em `]` interno, bloco markdown, JSON com texto envolvente, reprodução literal do bug do run 24723933245, string vazia, sem chaves, JSON irrecuperável. Todos passam (`node --test`, 9/9 pass, duration 123ms).
- **AC6 (verificação em produção):** pendente — será executado pelo @devops via `workflow_dispatch force=true` após merge.

- **Extra (fora dos ACs):** `main()` passou a ser executado apenas quando o módulo é invocado diretamente (guard com `fileURLToPath`), para que o `import` nos testes não dispare a pipeline inteira. Descoberto no primeiro smoke test — gastou tokens OpenAI rodando o pipeline por acidente. Guard robusto no Windows via comparação `fileURLToPath(import.meta.url) === resolve(process.argv[1])`.

- **Problema operacional detectado:** durante a implementação, outro processo/agente em paralelo commitou na branch `feature/scar-ai-onboarding-01` (commits Wave 1-T1.1 e Wave 2-T2.1/T2.2a) e o HEAD saltou de volta de `fix/plaka-scheduler-resilience` para `feature/scar-ai-onboarding-01`. Alterações recuperadas via `git stash push -u` + `git checkout fix/plaka-scheduler-resilience` + `git stash pop`. Sem perda de código.

### File List
- `.github/workflows/plaka-daily-content.yml` — modificado (+2 linhas, `permissions: contents: write`)
- `packages/content-engine/scripts/daily-pipeline.mjs` — modificado (+44 -10 linhas): export `parseRexVeredicto`, `stripTrailingCommas`, `jsonMode` em `callClaude`, guard de execução direta
- `packages/content-engine/scripts/daily-pipeline.test.mjs` — **novo** (70 linhas, 9 cenários)
- `squads/aeo-squad-plaka/data/posts-history.md` — modificado (+1 linha, entry de 2026-04-20)
- `docs/stories/plaka-scheduler-hotfix-01/README.md` — **novo** (esta story)

### Change Log
- 2026-04-21 — Story criada pelo @dev a partir do handoff do @devops.
- 2026-04-21 — Fix #2 (parse defensivo + jsonMode) implementado em `daily-pipeline.mjs`.
- 2026-04-21 — Fix #1 (permissions contents:write) aplicado em `plaka-daily-content.yml`.
- 2026-04-21 — Smoke test `daily-pipeline.test.mjs` criado, 9/9 pass.
- 2026-04-21 — Backfill do post 2026-04-20 em `posts-history.md` (verificado via Ghost Admin API).
- 2026-04-21 — Guard de execução direta adicionado ao `daily-pipeline.mjs` para evitar side-effect no import.
- 2026-04-21 — Status: InProgress → InReview. Handoff dev→qa gerado.
- 2026-04-22 — @qa review PASS — 7/7 checks verde. Gate file em `docs/qa/gates/plaka-scheduler-hotfix-01.yml`. AC6 deferido ao @devops (verificação em prod via workflow_dispatch).
- 2026-04-22 — @devops push + PR #1 + squash merge (`a1428cd`) + workflow_dispatch force=true. Run `24787261371` SUCCESS em 54s. Post `Como escolher a semi joia certa para um look despojado` publicado no Ghost + `posts-history.md` auto-commitado (`4fede85`). **Bug #1 e Bug #2 resolvidos em produção.**
- 2026-04-22 — Evidência adicional: scheduled run `24779950434` (13:06 UTC, antes do merge) falhou com **o mesmo trailing comma** (`"sa.",\n  ]`), reproduzindo o padrão do 21/04. Confirma que o fix era necessário e endereça o root cause correto.
- 2026-04-22 — Status: InReview → Done. Story fechada.

## QA Results

**Reviewer:** Quinn (@qa) · **Data:** 2026-04-22 · **Veredito:** ✅ **PASS** · **Gate file:** `docs/qa/gates/plaka-scheduler-hotfix-01.yml`

### Resumo executivo
Hotfix cirúrgico de 5 arquivos (commit `8bb52a7`, +235/-21 linhas) resolve 2 bugs independentes do scheduler do blog PLAKA. Aprovado para push + disparo imediato.

### Checks (7/7 PASS)

| # | Check | Veredito | Destaque |
|---|-------|----------|----------|
| 1 | Code review | PASS | `stripTrailingCommas` é fallback conservador (só age após JSON.parse falhar). `jsonMode` é opt-in — retrocompat preservada. Guard de execução direta é portable Linux/Windows. |
| 2 | Unit tests | PASS | 9/9 pass em 137ms. Inclui reprodução literal do JSON que crashou em prod (run 24723933245). |
| 3 | Acceptance Criteria | PASS | AC1–AC5 verificáveis localmente; AC6 deferido ao @devops (depende de push). |
| 4 | Regression | PASS | `generateBriefing`, `writePost`, `revisionLoop`, `publishToGhost`, `resolveFeatureImage`, `processImage` intocados. |
| 5 | Performance | PASS | Regex é O(n) único, só no fallback. `response_format: json_object` sem overhead. |
| 6 | Security | PASS | `permissions: contents: write` é escopo mínimo. Nenhuma superfície nova de injection. |
| 7 | Documentation | PASS | Story completa, JSDoc adicionado, commit message estruturado com referências a evidências. |

### NFRs
- **Reliability:** PASS (parse com 2 camadas de fallback; workflow commit garantido)
- **Maintainability:** PASS (função exportada, testável, bem documentada)
- **Testability:** PASS (guard habilita import sem side-effect)
- **Observability:** CONCERNS menor (pipeline ainda usa `console.log` — fora de escopo do hotfix)

### Deferidos (não bloqueiam)
- **AC6 — Verificação em prod:** depende de `@devops` push → PR → merge → `workflow_dispatch force=true`. Deve ser executado imediatamente para cobrir o post que falhou em 2026-04-21 (próximo run agendado: 2026-04-23 09:00 BRT).
- **CodeRabbit scan:** não rodou no QA gate. Mudança cirúrgica em 5 arquivos bem localizados; review manual cobriu padrões que CodeRabbit sinalizaria. Opcional rodar na CI do PR.

### Risk profile
**Overall: LOW** — Mudança cirúrgica, escopo bem definido, teste para o bug exato, fallback conservador, permissão workflow mínima.

### Next action
Handoff `qa→devops` gerado em `.aiox/handoffs/handoff-qa-to-devops-20260422-plaka-scheduler.yaml`. Aguardando @devops para push + workflow_dispatch.

— Quinn, guardião da qualidade 🛡️
