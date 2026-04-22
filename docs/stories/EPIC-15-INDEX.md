# Epic 15 — Método de Refino e Onboarding de Tenants Zenya

**Status:** ✅ Done — 3/3 stories fechadas (15.1 PASS, 15.2 PASS, 15.3 PASS) em 2026-04-22
**Criado por:** Morgan (@pm) — 2026-04-22
**Depende de:** — (nenhum epic bloqueante)
**Destrava:** Epic 14 (Onboarding Automático) — automação precisa de método manual bem definido antes
**Objetivo:** Consolidar em disco o método validado de refino e onboarding de tenants Zenya (N=2 confirmado após PLAKA + Scar AI), sem engessar o processo. Transformar conhecimento tácito em checklist executável + template de smoke + taxonomia de tenant.

---

## Contexto

Entre 2026-04-21 e 2026-04-22, durante o onboarding do tenant Scar AI, emergiu um método mais eficaz que o padrão anterior ("coloca bot em produção e corrige reativo"). O método foi aplicado a 2 tenants de perfis radicalmente diferentes:

- **PLAKA (Roberta):** e-commerce com KB grande, fuzzy matcher, tools externas (Nuvemshop, sheets_kb)
- **Scar AI:** pré-venda, zero KB, zero tools externos, prompt-only, multilíngue PT/EN

Com N=2 o método foi validado — algumas partes são **universais** (REPL local, smoke derivado da fonte, whitelist `allowed_phones`, iteração de prompt em camadas), outras são **específicas** de tenant com KB (fuzzy morfológico, multi-trigger split, kb-coverage script). Documentar essa diferenciação agora evita que futuros tenants reinventem o método e evita que a gente imponha práticas KB-specific em tenants prompt-only.

**Brief-fonte:** `docs/stories/plaka-01/lessons-for-pm.md` (284 linhas consolidando o aprendizado)
**Memórias persistentes já criadas:**
- `feedback_test_from_source.md` — derivar testes da fonte, não adivinhados
- `feedback_llm_simulates_tool.md` — LLM pode escrever sem invocar tool
- `feedback_prompt_iteration_reveals.md` — cada iteração expõe gap novo
- `feedback_errors_can_hide_bugs.md` — errors em smoke mascaram comportamento

**Por que agora (e não depois da Fun):** aplicar o método na Fun Personalize vai ser o **primeiro caso brownfield** (tenant em produção, com tráfego real). Mexer em produção sem playbook formal é risco desnecessário — regressão silenciosa, prompt ajustado errado, cliente real afetado. O playbook precisa sair **antes** da Fun.

**Por que NÃO formalizar totalmente ainda:** N=2 confirma o método mas N=3 (brownfield Fun) vai revelar ajustes no playbook que só aparecem em tenant com tráfego. Este epic entrega o **MVP do playbook** — depois da Fun a gente itera em epic-refinement próprio se fizer sentido.

---

## Arquitetura

```
Artefatos do método (em disco, não na cabeça)
  │
  ├── docs/zenya/TENANT-REFINEMENT-PLAYBOOK.md          [NEW — Story 15.1]
  │     ├── Checklist 7 passos (seed → REPL → smoke → fix → whitelist → prod → monitorar)
  │     ├── Seção "Greenfield vs Brownfield" (decisão de risco)
  │     └── Seção "Tipos de tenant" (prompt-only / prompt+KB / prompt+KB+integrações)
  │
  ├── packages/zenya/scripts/smoke-template.mjs         [NEW — Story 15.2]
  │     ├── Estrutura padrão de smoke automático
  │     ├── Cenários derivados da fonte (prompt/portfólios/KB)
  │     └── Classificador por cenário (pass/fail + severidade)
  │
  └── docs/zenya/TENANT-PLAYBOOK.md §9                  [UPDATED — Story 15.3]
        ├── Taxonomia explícita de tipos de tenant
        ├── Decisão de fases aplicáveis por tipo
        └── Link pro TENANT-REFINEMENT-PLAYBOOK
```

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|-----------|-----------|----------|
| [15.1](./15.1.story.md) | TENANT-REFINEMENT-PLAYBOOK — método documentado | ✅ Done | P1 | — | @dev |
| [15.2](./15.2.story.md) | smoke-template.mjs — template genérico de smoke | ✅ Done | P1 | 15.1 (conceitual) | @dev |
| [15.3](./15.3.story.md) | TENANT-PLAYBOOK §9 taxonomia de tenant | ✅ Done | P1 | **15.1 + 15.2** | @dev |

**Observação de paralelismo:** 15.2 e 15.3 podem ser implementadas em paralelo após 15.1 existir como referência. Não há bloqueio entre elas.

---

## Escopo — IN

- Playbook formal `.md` com 7 passos do método + decisão greenfield/brownfield + taxonomia tenant
- Template genérico de smoke com comentários explicativos pra cada cenário
- Atualização de `TENANT-PLAYBOOK.md §9` (Criando Novo Tenant) referenciando os novos artefatos
- Link cruzado entre os 3 artefatos

## Escopo — OUT

- **Workflow AIOX formal** pro método (ex: `.aiox-core/development/workflows/tenant-refinement-cycle.md`) — adiar pra pós-Fun
- **Automação de smoke** (ex: CI rodando smoke a cada mudança de prompt) — fora do escopo, requer infra extra
- **Aplicação do playbook** em tenant específico — é epic separado (refino Fun = novo epic após 15 fechar)
- **Stemming PT-BR pra KB fuzzy** — adiar, fuzzy morfológico atual cobre
- **Condicionais na KB** (colunas "Tem Condicional? SIM/NÃO" da planilha PLAKA) — adiar até tenant real precisar
- **Zenya Admin como tier de produto** (Anexo A do brief) — trilha própria, epic separado pós-Scar ao vivo

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Formalizar processo que ainda vai evoluir | Playbook versionado; iterações em PRs pequenos após uso em tenants novos |
| Template de smoke ficar genérico demais e ninguém usar | 2 variantes claras (prompt-only vs com KB) + exemplos concretos PLAKA/Scar no comentário |
| Taxonomia forçar tenants futuros em categorias que não servem | Deixar categoria "outro — especificar" aberta; não travar decisão de arquitetura |
| Playbook ficar dessincronizado com práticas reais ao longo do tempo | Ownership do @pm — revisão obrigatória a cada novo tenant (checklist: "playbook ainda reflete o método?") |

---

## Definição de pronto

- [ ] Story 15.1: `TENANT-REFINEMENT-PLAYBOOK.md` criado, 7 passos documentados, seção brownfield explícita
- [ ] Story 15.2: `smoke-template.mjs` criado, testado localmente (copia e adapta pra PLAKA ou Scar — deve rodar)
- [ ] Story 15.3: `TENANT-PLAYBOOK.md §9` atualizado, links cruzados funcionando
- [ ] @qa aprovou todas as 3 stories (gate PASS ou CONCERNS)
- [ ] Epic 15 fechado — pronto pra abrir epic de **refino Fun Personalize** usando o playbook

---

## Próximo movimento após fechamento

Com Epic 15 Done, abre-se naturalmente o **refino brownfield da Fun Personalize** como epic/story própria. O playbook vai prescrever os passos seguros em tenant ao vivo (backup, janela de teste, rollback plan). Sem esse epic antes, a gente entra na Fun sem mapa.

---

## Histórico

- **2026-04-22** — Epic criado por @pm. Aguardando @sm refinar as 3 stories individuais via `*draft`.
- **2026-04-22** — 3 stories detalhadas por @sm River (`15.1`, `15.2`, `15.3`). Todas em Draft, prontas pra validação `@po *validate-story-draft`.
- **2026-04-22** — @po Pax validou as 3 com **10/10 GO**. Status Draft → Ready.
- **2026-04-22** — @dev Dex implementou: `TENANT-REFINEMENT-PLAYBOOK.md` (238 linhas), `smoke-template.mjs` (372 linhas, 32% comentário), `TENANT-PLAYBOOK.md §9` (+17/-1 linhas). Status Ready → Ready for Review.
- **2026-04-22** — @qa Quinn aprovou as 3 com **PASS**. Gate files em `docs/qa/gates/15.x-*.yml`. Tech debts low registrados (não-bloqueantes).
- **2026-04-22** — @po Pax fechou as 3 stories. **Epic 15 → Done (3/3)**. Destravado: refino brownfield da Fun Personalize (novo epic).
