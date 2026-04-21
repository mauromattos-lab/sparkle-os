# ADR-001 — Armazenamento de system prompts dos tenants Zenya

- **Status:** Accepted
- **Data:** 2026-04-21
- **Autor:** @architect (Aria)
- **Decisão solicitada por:** @pm (Morgan), após proposta do @dex (Dex) durante story `scar-ai-onboarding-01`
- **Tipo:** Convenção estrutural + processo de desenvolvimento

---

## Contexto

O core Zenya é multi-tenant. Cada tenant tem um `system_prompt` que define personalidade, catálogo, fluxos e regras. Em runtime, o core **lê o prompt do Supabase** (tabela `zenya_tenants.system_prompt`) com cache de 5 minutos — isto está documentado em `docs/zenya/TENANT-PLAYBOOK.md §10-11`.

O problema não é runtime. É **onde mora a fonte da verdade do prompt antes de chegar no banco**. Hoje, os scripts `packages/zenya/scripts/seed-{tenant}-tenant.mjs` contêm o prompt inline como JavaScript template literal (ex: `seed-hl-tenant.mjs` linhas 57-163). Efeitos colaterais:

1. Diff de prompt em PR é ilegível (diff dentro de string JS sem highlight markdown)
2. Atualizar prompt exige editar código (`.mjs`) → risco maior, revisão mais cara
3. Metadata do prompt (fonte, autor, versão) não fica visível
4. Impossível testar o prompt isoladamente (sem executar o seed)
5. Sem separação clara entre "código da engine" e "conteúdo do tenant"

Durante a implementação de Scar AI (5º tenant), @dev introduziu uma abordagem alternativa:
- Prompt mora em `docs/stories/scar-ai-onboarding-01/prompt-scar-ai.md`
- `seed-scar-tenant.mjs` carrega o arquivo em runtime via `readFile`
- Metadata é removida por `split(/\n---\n/)`

A proposta veio pro @pm, que escalou pra decisão arquitetural.

### Tenants impactados

| # | Tenant | Situação | Risco de refactor |
|---|--------|----------|-------------------|
| 1 | Zenya Prime | Produção interna (Sparkle) | MED |
| 2 | Fun Personalize | Produção comercial (primeiro cliente) | HIGH |
| 3 | HL Importados | Migração n8n → core, pré-cutover | LOW |
| 4 | PLAKA | Spec Pipeline completo, sem produção | LOW |
| 5 | Scar AI | Implementação em andamento | já no padrão proposto |

---

## Decisão

**APPROVE_WITH_CHANGES.** Adotar "prompt em markdown versionado" como padrão para todos os tenants Zenya, com 4 ajustes sobre a proposta original:

### D1 — Caminho canônico: `docs/zenya/tenants/{tenant-slug}/prompt.md`

Não em `packages/zenya/tenants/` nem em `packages/zenya/src/tenants/`. Razões:

- **Tenant é dados/conteúdo, não código**. `packages/` fica reservado a código da engine multi-tenant, que é genérico e vale para todos.
- **Alinhamento com estrutura existente**: `docs/zenya/TENANT-PLAYBOOK.md`, `docs/zenya/hl-import/INVENTARIO.md`, `docs/zenya/contratos/…` já vivem em `docs/zenya/`.
- **Impede import acidental do .md pelo código TS** — o compilador TS não atravessa `docs/`.
- **Futuro-compatível:** permite adicionar por tenant `README.md` (visão de negócio), `kb.md` (base de conhecimento textual), `changelog.md` (se necessário), `references/` (PDFs, prints de conversa), sem poluir o pacote.

Slug do tenant: kebab-case, derivado do `name` mais curto possível. Exemplos:
- `zenya-prime`
- `fun-personalize`
- `hl-importados`
- `plaka`
- `scar-ai`

### D2 — Metadata via front-matter YAML com `gray-matter`

Trocar o split frágil `\n---\n` por front-matter YAML, padrão universal (Jekyll/Hugo/MDX/Next.js/Obsidian). Adicionar dependência `gray-matter` em `packages/zenya/package.json`.

**Formato obrigatório:**

```markdown
---
tenant: scar-ai
version: 1
updated_at: 2026-04-21
author: Mauro Mattos
sources:
  - GuDesignerPro briefing (2026-04-19)
  - Portfólios PDF BR/US
notes: |
  Primeiro tenant com active_tools vazio — valida o core sem integrações.
---

Você é o **Scar AI**, atendente virtual da **GuDesignerPro**…
```

**Vantagens vs split:**
- O SOP pode conter `---` livremente (separadores de seção markdown) sem quebrar parsing
- Campos semânticos (`version`, `sources`, `notes`) ficam consultáveis programaticamente
- Ferramentas comuns de markdown (preview, linting) entendem o formato

### D3 — Load apenas no seed. Core continua lendo do banco.

**Não introduzir** carregamento do `.md` em runtime do core. O cache de 5 minutos sobre `zenya_tenants.system_prompt` (decisão arquitetural anterior, TENANT-PLAYBOOK §11) permanece. A seed é quem transfere `.md` → banco.

Razões:
- Minimiza superfície de mudança (zero risco pros tenants em produção)
- Preserva a propriedade de multi-tenant: qualquer mudança de prompt precisa passar por um seed consciente, não "hot reload silencioso"
- `.md` é o artefato de desenvolvimento; Supabase é o runtime. Separação limpa.

Fluxo oficial de atualização de prompt:
```
editar docs/zenya/tenants/{tenant}/prompt.md
  → PR review
  → merge
  → rodar seed-{tenant}-tenant.mjs (local apontando pro banco prod, ou na VPS)
  → cache 5min expira automático
  → prompt novo em produção sem precisar de reload do processo
```

### D4 — Versionamento: git log + `version` no front-matter

Sem CHANGELOG.md por tenant. Git log é autoridade.

Front-matter `version: N` (inteiro, incrementa manualmente em mudanças substanciais) é opcional, serve só como telemetria pro seed logar qual versão foi aplicada. Não é chave de bump automático nem de migration. Se ninguém atualizar, tudo bem — git log resolve.

---

## Consequências

### Positivas

- Diff em PR: 100% legível (markdown puro)
- Revisão de prompt deixa de ser revisão de código — gente não-dev consegue revisar
- Desbloqueia edição colaborativa (Mauro e agentes AIOX editam prompt sem tocar em `.mjs`)
- Permite lint de conteúdo (ex: checar que todo tenant tem seção "Regras críticas")
- Sobras conceituais: pasta do tenant pode crescer para abrigar artefatos de negócio (briefings, contratos, referências)
- Escopo de mudança é pequeno: só seeds + organização de docs

### Negativas

- Adiciona dependência `gray-matter` ao pacote (~8KB, mantido pelo autor do Yeoman/Jekyll — baixo risco)
- Mais um lugar para ficar desatualizado: se alguém editar `system_prompt` direto no Supabase sem atualizar o `.md`, a fonte da verdade diverge. **Mitigação:** D3 define `.md` + seed como único caminho oficial. Edição direta no banco vira "ação de emergência" documentada, nunca rotina.
- Migração retroativa tem custo (ver rollout)
- Versionamento via front-matter exige disciplina (aceita-se — opcional)

### Rejeitadas (e por quê)

- **`packages/zenya/tenants/`**: atrai imports acidentais do pacote. Viola separação código/conteúdo.
- **`packages/zenya/src/tenants/`**: `src/` é reservado pra código TypeScript compilado.
- **`tenants/` no root**: overkill até termos múltiplos pacotes precisando acessar.
- **Split `\n---\n`**: frágil como demonstrado. Perde quando o SOP tem separador markdown.
- **Marker custom `<!-- PROMPT-START -->`**: não é padrão da indústria, nenhuma ferramenta externa entende.
- **CHANGELOG.md por tenant**: overhead sem retorno — git log cumpre.
- **Core lê `.md` em runtime**: aumenta acoplamento, elimina caching, sem ganho claro.

---

## Plano de Rollout

Por ordem de risco crescente. Cada passo é uma story isolada em `docs/stories/`.

### Fase 0 — Setup (story `zenya-prompts-00`)
- Criar pasta `docs/zenya/tenants/`
- Adicionar `gray-matter` ao `packages/zenya/package.json`
- Refatorar `seed-scar-tenant.mjs` para usar gray-matter (em vez de `split`)
- Mover `docs/stories/scar-ai-onboarding-01/prompt-scar-ai.md` → `docs/zenya/tenants/scar-ai/prompt.md` + adicionar front-matter YAML
- Atualizar `SCAR_PROMPT_PATH` default no seed
- Re-executar seed do Scar AI (idempotente, sem side effect)
- Atualizar `TENANT-PLAYBOOK.md` documentando o padrão

### Fase 1 — Baixo risco (story `zenya-prompts-01`)
- **PLAKA** — hoje em research. Nasce diretamente no padrão quando sair pra implementação. Zero refactor.
- **HL Importados** — ainda não teve cutover. Extrair `SYSTEM_PROMPT` literal do `seed-hl-tenant.mjs` para `docs/zenya/tenants/hl-importados/prompt.md`, adaptar o seed. Validar com diff: `md → banco via seed` é idêntico ao hardcoded atual.

### Fase 2 — Médio risco (story `zenya-prompts-02`)
- **Zenya Prime** — tenant interno, mas em produção. Mesmo processo do HL.
- **Pré-requisito:** seed com flag `--dry-run` que faz o load do `.md` e imprime o prompt que seria enviado ao banco, sem executar o UPSERT. Diff do `--dry-run` vs prompt atual no banco (via SQL `SELECT system_prompt`) deve ser **zero** antes de permitir o upsert.

### Fase 3 — Alto risco (story `zenya-prompts-03`)
- **Fun Personalize** — primeiro cliente comercial, em produção há mais tempo.
- Requisitos adicionais:
  - `--dry-run` obrigatório antes do upsert real
  - Janela de manutenção (baixo tráfego)
  - Smoke test imediato pós-cutover: mandar 1 mensagem de teste e validar resposta idêntica ao comportamento anterior
  - Plano de rollback: backup do `system_prompt` antes do seed (`SELECT system_prompt FROM zenya_tenants WHERE id = 'xxx'` salvo em `.ai/backups/`). Rollback = UPSERT do backup.

### Fase 4 — Governança contínua
- Adicionar rule no `.claude/rules/`: **novos tenants nascem com `docs/zenya/tenants/{slug}/prompt.md` + front-matter YAML**. Seed carrega via gray-matter. Sem hardcode em `.mjs`.
- Documentar no `TENANT-PLAYBOOK.md` como requisito de PR.

---

## Critérios de sucesso (por tenant migrado)

- [ ] `docs/zenya/tenants/{slug}/prompt.md` existe com front-matter YAML válido
- [ ] Seed script carrega via gray-matter, faz UPSERT no Supabase
- [ ] `--dry-run` disponível e testado
- [ ] Diff `md-load vs banco-atual` é zero antes do upsert em produção
- [ ] Smoke test pós-cutover passa (1 mensagem = resposta equivalente)
- [ ] Git log tem 1 commit isolado por tenant migrado (fácil revert)

---

## Referências

- Proposta inicial: `.aiox/handoffs/handoff-dev-to-pm-20260421.yaml`
- Análise @pm: `.aiox/handoffs/handoff-pm-to-architect-20260421.yaml`
- Padrão vigente: `packages/zenya/scripts/seed-hl-tenant.mjs` (hardcoded)
- Padrão proposto: `packages/zenya/scripts/seed-scar-tenant.mjs` (file-based)
- Runtime: `docs/zenya/TENANT-PLAYBOOK.md §3, §10-11`
- gray-matter: https://www.npmjs.com/package/gray-matter

---

## Histórico de revisões

- **2026-04-21** — Criação. @architect (Aria). Status: Accepted.
