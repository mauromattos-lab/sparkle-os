# Story zenya-prompts-04-governance — Formalizar o padrão de prompts via rule + playbook

**Status:** Blocked — aguardando `zenya-prompts-03-fun-personalize` Done
**Owner:** @pm criou o epic · @sm refinou · @po valida · @dev implementa
**Epic:** `docs/stories/epics/epic-zenya-prompts-refactor/README.md`
**ADR:** `docs/architecture/adr/ADR-001-zenya-prompt-storage.md`

**Executor Assignment:**
- `executor: @dev`
- `quality_gate: @architect`
- `quality_gate_tools: [coderabbit]`

**Complexity:** S (pequeno) — 2 story points. Só documentação + rule. Mas fecha o epic e previne regressão de padrão no longo prazo.

## Contexto

Quarta e última story do epic. Todos os 5 tenants migrados (Scar via Fase F da Scar-AI-01, HL e PLAKA via story 1, Prime via story 2, Fun Personalize via story 3). Agora o objetivo é **tornar o padrão permanente** via:

1. **Rule em `.claude/rules/`** garantindo que agentes AIOX futuros (especialmente @sm e @dev) saibam que novos tenants Zenya nascem com `docs/zenya/tenants/{slug}/prompt.md` + front-matter YAML, nunca com hardcode em `.mjs`.
2. **Atualização do `TENANT-PLAYBOOK.md`** referenciando ADR-001 e documentando o fluxo correto de criação e atualização de prompts.

Sem esta story, o padrão depende de memória institucional de quem fez o rollout — alto risco de alguém esquecer e criar um tenant novo no padrão antigo.

## Acceptance Criteria

1. `.claude/rules/zenya-tenant-prompts.md` criado com frontmatter `paths:` apontando para `packages/zenya/scripts/seed-*-tenant.mjs` e `docs/zenya/tenants/**/prompt.md`. Conteúdo:
   - Regra clara: "novos tenants Zenya DEVEM ter `docs/zenya/tenants/{slug}/prompt.md` + front-matter YAML"
   - Proibição: "não hardcode `SYSTEM_PROMPT` como template literal em scripts `.mjs`"
   - Referência ao ADR-001
2. `docs/zenya/TENANT-PLAYBOOK.md` atualizado:
   - Seção "4. System Prompt — Estrutura Padrão" referencia ADR-001
   - Nova seção "Criando um novo tenant" documenta o fluxo: criar `.md` → criar seed → rodar com `--dry-run` → rodar real
   - Seção "10. Operação e Manutenção" subseção "Atualizar SOP de um tenant" reescrita: "editar `docs/zenya/tenants/{slug}/prompt.md` → commit → rodar seed" (não mais "editar direto no Supabase")
3. O `TENANT-PLAYBOOK.md` lista os 5 tenants vigentes com link direto para seus respectivos `prompt.md`.
4. Nenhum seed em `packages/zenya/scripts/` ainda contém `SYSTEM_PROMPT` hardcoded como template literal. Validação: `grep -l "const SYSTEM_PROMPT = " packages/zenya/scripts/seed-*.mjs` retorna vazio.

## Dependências

- **Bloqueante:** `zenya-prompts-03-fun-personalize` Done — último tenant migrado. Só faz sentido formalizar o padrão quando 100% dos tenants estão nele.

## Escopo — IN

- Criar rule file
- Atualizar TENANT-PLAYBOOK.md
- Validação automática de que nenhum seed tem hardcode

## Escopo — OUT

- Automação de lint/pre-commit (pode virar follow-up)
- Treinamento dos agentes AIOX via prompt update (rule carrega automático quando path bate)
- Criação de templates de tenant (pode virar follow-up)

## Tasks / Subtasks

- [ ] **T1.** Criar branch `feature/zenya-prompts-04-governance` após story 3 Done.
- [ ] **T2.** Criar `.claude/rules/zenya-tenant-prompts.md`:
  ```markdown
  ---
  paths:
    - packages/zenya/scripts/seed-*-tenant.mjs
    - docs/zenya/tenants/**/*.md
  ---

  # Regra: Padrão de prompts de tenants Zenya

  Todo tenant Zenya DEVE ter seu prompt em `docs/zenya/tenants/{slug}/prompt.md`
  com front-matter YAML, carregado em runtime pelo seed script via `gray-matter`.

  - NUNCA hardcode `SYSTEM_PROMPT` como template literal em scripts `.mjs`
  - NUNCA edite `zenya_tenants.system_prompt` direto no banco (exceto rollback emergencial)
  - SEMPRE rode `--dry-run` antes do upsert real em produção

  Referência: `docs/architecture/adr/ADR-001-zenya-prompt-storage.md`
  ```
  Aponta para AC 1.
- [ ] **T3.** Atualizar `docs/zenya/TENANT-PLAYBOOK.md`:
  - Adicionar referência ao ADR-001 no topo ou seção dedicada
  - Refazer §4 citando o novo caminho canônico
  - Adicionar nova seção "Criando um novo tenant" (fluxo passo-a-passo)
  - Reescrever §10 "Atualizar SOP" para refletir o novo fluxo
  - Adicionar no fim uma tabela com os 5 tenants vigentes + link para cada `prompt.md`
  Aponta para AC 2, 3.
- [ ] **T4.** Rodar `grep -l "const SYSTEM_PROMPT = " packages/zenya/scripts/seed-*.mjs` e confirmar output vazio. Se algum seed ainda tem hardcode → a story anterior ficou incompleta, escalar. Aponta para AC 4.
- [ ] **T5.** Commit atômico. Handoff @qa.

## Dev Notes

### Formato do rule file (carregamento contextual)
Rule files em `.claude/rules/` com frontmatter `paths:` são carregados automaticamente pelo Claude Code quando o usuário edita arquivos que batem com os globs. Isso garante que o contexto da regra aparece para qualquer agente que for mexer em seeds ou prompts de tenant, sem poluir o prompt base.

### Atualização de PLAYBOOK — o que mudar especificamente

**Antes** (§10):
> Editar `system_prompt` diretamente no Supabase. Cache de 5 minutos — próxima mensagem já pega o novo prompt.

**Depois:**
> Editar `docs/zenya/tenants/{slug}/prompt.md` → commit → rodar `node scripts/seed-{slug}-tenant.mjs`. Cache de 5 minutos expira automaticamente — próxima mensagem já pega o novo prompt. **Emergência:** edição direta no Supabase é permitida apenas como rollback/hotfix, seguida de sincronização do `.md` via PR dentro de 24h.

### Lista de tenants para o playbook
Obter no momento da execução:
```sql
SELECT name, chatwoot_account_id, array_length(active_tools, 1) AS tools_count
FROM zenya_tenants ORDER BY name;
```

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Alguém criar tenant novo sem ler o rule | Rule file carrega automático quando globs batem. Também será visível em code review |
| Playbook ficar desatualizado no futuro | Essa story não resolve — é responsabilidade contínua do @architect/@pm |
| `grep` do AC 4 falhar com paths com espaços | Validar manualmente também. Se houver seed legítimo com `const SYSTEM_PROMPT` por outro motivo (não tenant), renomear a constante |

## Definição de pronto

- [ ] Branch criada
- [ ] `.claude/rules/zenya-tenant-prompts.md` criado
- [ ] `docs/zenya/TENANT-PLAYBOOK.md` atualizado com ADR ref + fluxo novo + tabela de tenants
- [ ] `grep` do AC 4 vazio
- [ ] @qa PASS
- [ ] Epic `zenya-prompts-refactor` pode ser fechado

## Histórico

- **2026-04-21** — Criada pelo @sm. Blocked por story 3.
