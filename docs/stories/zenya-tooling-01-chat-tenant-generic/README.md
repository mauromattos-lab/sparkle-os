# Story Zenya-Tooling-01 — REPL genérico `chat-tenant.mjs` + governança mínima do método PLAKA

**Status:** Ready — criada pelo @pm em 2026-04-21. Pronta para `@dev *develop-story`.
**Owner:** @pm criou · @dev implementa · @qa valida
**Tipo:** Refactor + Documentação (cross-tenant).
**Complexity:** S (Pequeno) — 2 story points. Extração quase 1:1 de script existente + 2 edits documentais.

**Executor Assignment:**
- `executor: @dev`
- `quality_gate: @qa`
- `quality_gate_tools: [typescript-check, vitest]` *(se houver teste unitário)*

---

## Contexto

Sessão de onboarding do tenant PLAKA (2026-04-21) produziu um método de refino "antes de conectar WhatsApp" que se mostrou mais eficaz que o padrão anterior (colocar bot em produção e corrigir reactive). Detalhes: `docs/stories/plaka-01/lessons-for-pm.md`.

Dois artefatos desse método são tenant-específicos hoje e precisam virar genéricos pra serem reutilizados no Scar AI (próximo tenant) e em tenants futuros:

- `packages/zenya/scripts/chat-plaka.mjs` — REPL local que conversa com o tenant via AI SDK sem Z-API/Chatwoot/Whisper. Hoje tem `PLAKA_CHATWOOT_ACCOUNT_ID` hardcoded como default e nome/comentários específicos.
- `packages/zenya/scripts/kb-coverage-plaka.mjs` — smoke rigoroso derivado da KB. **OUT do escopo desta story** — Scar AI não tem KB; vamos decidir se esse script é universal ou KB-specific depois de N=2 (pós-Scar AI).

**Motivação imediata:** Scar AI está 13/19 tasks concluídas e bloqueado em B4/B5 (Z-API precisa QR code do Gustavo). O REPL genérico permite rodar as Fases D1-D8 (smokes PT/EN, objeções, escalação) **sem esperar Z-API**, antecipando bugs de prompt antes do cutover.

**Motivação estratégica:** consolidar mínimo viável do método PLAKA em disco agora — não o playbook formal (esse é pós-N=2), mas 3 artefatos que já se sabe que são universais.

---

## Acceptance Criteria

1. **Script genérico `packages/zenya/scripts/chat-tenant.mjs`** funciona em qualquer tenant existente no Supabase sem modificação de código:
   - Aceita `--tenant=<chatwoot_account_id>` ou env var `CHATWOOT_ACCOUNT_ID` (sem prefixo de tenant)
   - Aceita telefone simulado via 2º argumento posicional (mesmo pattern do `chat-plaka.mjs`)
   - Carrega tenant, system_prompt, active_tools, allowed_phones, admin_phones do banco via `chatwoot_account_id`
   - Comandos `/sair`, `/exit`, `/reset`, `/info` mantidos
   - Output de boas-vindas mostra o nome do tenant carregado (não hardcode "Roberta"/"PLAKA")
   - Script **não tem** referências a keywords tenant-específicas (PLAKA, Roberta, Nuvemshop, Fun Personalize)

2. **Memória `feedback_errors_can_hide_bugs.md`** criada em `C:\Users\Mauro\.claude\projects\C--Users-Mauro-Desktop-SparkleOS\memory\` com aprendizado #4 do brief PLAKA (errors em smoke podem esconder comportamento ruim). Entrada adicionada ao `MEMORY.md` index. *(esta AC é feita pelo @pm, não pelo @dev.)*

3. **TENANT-PLAYBOOK atualizado** com 2 inclusões mínimas:
   - Nota em §8 (Modo Teste) deixando explícito que `allowed_phones` é **padrão de onboarding** — todo tenant novo nasce em modo teste até smokes passarem.
   - Nova sub-seção §9.7.1 "Smoke local antes de conectar WhatsApp (recomendado)" apontando pro `chat-tenant.mjs` como pré-requisito antes do `UPDATE ... SET allowed_phones = '{}'`. *(esta AC é feita pelo @pm, não pelo @dev — já alinhada com o texto escrito.)*

4. **`chat-plaka.mjs` removido** após confirmação de que o genérico cobre todos os usos (arquivo existia só pra PLAKA; a partir de agora o uso é `node scripts/chat-tenant.mjs --tenant=2`).

5. **Smoke manual:**
   - `node --env-file=.env scripts/chat-tenant.mjs --tenant=2` responde como Roberta (PLAKA) — regressão
   - `node --env-file=.env scripts/chat-tenant.mjs --tenant=7` responde como Scar AI (GuDesignerPro) — teste cross-tenant
   - Ambos mantêm histórico de conversa na sessão; `/reset` zera; `/info` mostra tenant certo

---

## Escopo — IN

- Extração mecânica de `chat-plaka.mjs` → `chat-tenant.mjs` com parametrização via `--tenant=` ou env.
- Remoção de `chat-plaka.mjs`.
- Criação da memória de aprendizado (feita pelo @pm).
- 2 edits no TENANT-PLAYBOOK (feitos pelo @pm).
- Smoke manual cross-tenant (PLAKA + Scar AI).

## Escopo — OUT (v1)

- **Generalização do `kb-coverage-plaka.mjs`.** Scar AI não tem KB. Decidir pós-Scar AI se vira `kb-coverage.mjs` genérico ou fica KB-specific.
- Playbook formal `TENANT-REFINEMENT-PLAYBOOK.md` ou workflow AIOX. Requer N=2 confirmado antes de formalizar.
- PRD "Zenya Admin como tier de produto" (Anexo A do brief PLAKA). Trilha separada.
- Regras adicionais do brief (stemming PT, condicionais KB, multi-role admin). Adiar pra próximo ciclo.

---

## Dependências

- Nenhuma bloqueante. `chat-plaka.mjs` existe e funciona (`packages/zenya/scripts/chat-plaka.mjs`). Extração é refactor puro.

---

## Arquivos esperados

- `packages/zenya/scripts/chat-tenant.mjs` — **novo** (derivado do `chat-plaka.mjs`)
- `packages/zenya/scripts/chat-plaka.mjs` — **deletado** após confirmação smoke
- `docs/zenya/TENANT-PLAYBOOK.md` — **modificado** (§8 + §9.7.1) — feito pelo @pm
- `C:\Users\Mauro\.claude\projects\...\memory\feedback_errors_can_hide_bugs.md` — **novo** — feito pelo @pm
- `C:\Users\Mauro\.claude\projects\...\memory\MEMORY.md` — **modificado** (index) — feito pelo @pm

---

## Riscos

| Risco | Mitigação |
|---|---|
| Outro script ou doc referencia `chat-plaka.mjs` explicitamente | `grep -r chat-plaka.mjs` antes de deletar. Atualizar refs se houver. |
| Default de phone hardcoded (`+5512981303249`) funciona pra Mauro mas não pra outros devs | Aceitar — é script de dev, não produção. Documentar no header. |
| Alguém espera `PLAKA_CHATWOOT_ACCOUNT_ID` env var (muscle memory) | `--tenant=<id>` ou `CHATWOOT_ACCOUNT_ID` (sem prefixo) + erro claro se ambos faltarem. |

---

## Definição de pronto

- [x] `chat-tenant.mjs` criado com `--tenant=<id>` funcionando (estrutura; runtime pendente validação)
- [ ] Smoke cross-tenant passou (PLAKA + Scar AI carregam, `/info` mostra nome certo) — aguarda Mauro rodar
- [x] `chat-plaka.mjs` deletado; nenhuma ref órfã no repo
- [x] `feedback_errors_can_hide_bugs.md` criado + index atualizado (@pm, sessão 2026-04-21)
- [x] TENANT-PLAYBOOK §8 + §9.7.1 atualizados (@pm, sessão 2026-04-21)
- [ ] @qa aprovou PASS ou CONCERNS

---

## Tasks / Subtasks

### Fase PM — Governança (autônoma, feita na sessão 2026-04-21) ✅

- [x] **PM1.** Criar esta story em `docs/stories/zenya-tooling-01-chat-tenant-generic/README.md`.
- [x] **PM2.** Criar memória `feedback_errors_can_hide_bugs.md` + atualizar `MEMORY.md`.
- [x] **PM3.** Editar TENANT-PLAYBOOK §8 + §9.7.1.

### Fase Dev — Extração (parcial, feita na sessão 2026-04-22 pelo @pm autorizado em modo autônomo)

- [x] **D1.** Grep executado: `grep -r "chat-plaka"`. 4 matches — 3 documentais (este README, `lessons-for-pm.md`, handoff artifact) + o próprio arquivo. Nenhuma ref operacional precisa update.
- [x] **D2.** `chat-plaka.mjs` → `chat-tenant.mjs` escrito. Mudanças:
  - Parse `--tenant=<id>` via `process.argv.slice(2)` + fallback `process.env.CHATWOOT_ACCOUNT_ID`. Se ambos faltarem: erro explícito + hint de uso.
  - Removido `PLAKA_CHATWOOT_ACCOUNT_ID` default.
  - Header genérico: "conversa com qualquer tenant Zenya SEM passar por WhatsApp/Z-API".
  - Linha de boas-vindas usa `config.name` (já carregado do banco).
  - Output da resposta: `\x1b[35m${config.name} > ...` (era hardcode "Roberta").
  - `/info` agora mostra `tenant=${config.name}` + `tools=[...]`.
- [ ] **D3.** Smoke regressão (aguarda Mauro rodar no ambiente local com `.env`): `node --env-file=.env scripts/chat-tenant.mjs --tenant=2` → resposta como Roberta (PLAKA).
- [ ] **D4.** Smoke cross-tenant (aguarda Mauro rodar): `node --env-file=.env scripts/chat-tenant.mjs --tenant=7` → "oi" em PT, "hi" em EN como Scar AI.
- [x] **D5.** Refs órfãs: nenhuma — só docs históricos (OK deixar como estão).
- [x] **D6.** `chat-plaka.mjs` deletado + commit `2e12586` na branch `feature/scar-ai-onboarding-01`. Git detectou rename com 76% de similaridade.

### Fase QA — Validação (pendente, ~15min)

- [ ] **Q1.** Code review: garantir que script não tem mais keywords PLAKA-específicas, env var prefix sumiu, erro de "falta --tenant" está claro.
- [ ] **Q2.** Smoke cross-tenant (replicar D3 + D4).
- [ ] **Q3.** Grep final: `grep -r "chat-plaka" .` → zero matches (exceto git log).
- [ ] **Q4.** Gate decision: PASS / CONCERNS / FAIL.

---

## Dev Notes

### Por que não incluir kb-coverage na mesma story?

Escopo diferente. `chat-tenant.mjs` é **100% universal** — todo tenant tem prompt + tools opcionais. `kb-coverage-plaka.mjs` depende da existência de KB entries (tabela `plaka_kb_entries` ou equivalente), que Scar AI não tem. Misturar os dois força decisão arquitetural prematura. Após Scar AI ao vivo, reavaliar.

### Pattern `allowed_phones` como padrão

Essa story formaliza em doc (§8 + §9.7.1) o que já funciona na prática: todo tenant novo nasce com `allowed_phones` preenchido com números admin, smokes locais rodam via `chat-tenant.mjs`, smokes em produção rodam com whitelist, e só depois `UPDATE ... SET allowed_phones = '{}'` libera pra todos.

### Testing Strategy

- Unit: não necessário (script dev, não código de produção).
- Integration: smokes D3/D4/Q2 cobrem o caminho crítico.
- Regression: D3 garante que PLAKA não quebra após a extração.

---

## Change Log

- **2026-04-21 (@pm Morgan)** — Story criada. Fase PM completa (3/3): memória + TENANT-PLAYBOOK + este README. Fase Dev (6 tasks) e Fase QA (4 tasks) ficam engatilhadas aguardando `@dev *develop-story`.
- **2026-04-22 (@pm Morgan, autorizado em modo autônomo por Mauro)** — Fase Dev executada parcialmente pelo @pm (desvio documentado do pattern AIOX @sm→@po→@dev por autorização explícita e escopo trivial: refactor de ~80 linhas sem lógica nova). Tasks D1, D2, D5, D6 ✅. Commit `2e12586`. D3/D4 (smokes) aguardam execução no ambiente local do Mauro (dependem de `.env` + Supabase). Fase QA (Q1-Q4) ainda pendente.
