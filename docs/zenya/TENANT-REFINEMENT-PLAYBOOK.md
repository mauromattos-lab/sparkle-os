# Zenya — Tenant Refinement Playbook

**Versão:** 1.0 · **Criado em:** 2026-04-22 · **Autor:** @dev Dex (implementação Story 15.1)
**Fonte primária:** [`docs/stories/plaka-01/lessons-for-pm.md`](../stories/plaka-01/lessons-for-pm.md) (brief 284 linhas destilado pós-sessão PLAKA + Scar AI)

Guia **operacional** de execução para colocar um tenant Zenya no ar com qualidade e baixo risco. Complementa o [`TENANT-PLAYBOOK.md`](./TENANT-PLAYBOOK.md) — aquele é referência técnica do core (schema, tools, fluxos); este é o "como fazer na prática".

**Princípio:** testar antes de expor. Medir antes de declarar pronto. Admin antes de cliente.

---

## 1. Propósito e quando usar

### Para que serve

- Colocar um **tenant novo** (greenfield) no ar do zero.
- Refinar um **tenant em produção** (brownfield) sem regredir comportamento.
- Reduzir o risco de "bot respondendo errado na cara do cliente" a quase zero antes do go-live.

### Quando aplicar

Sempre que houver **mudança de comportamento do agente** que o cliente final veria: prompt novo, prompt ajustado, tools ativadas/desativadas, KB nova, integração nova.

### Quando NÃO aplicar

- Mudanças **invisíveis** ao cliente (refactor interno, migração de banco, ajuste de logging).
- Hotfixes de infra (ex: `pm2 reload` após bug já identificado).
- Adição de credencial nova (sem mudança de prompt/tools).

---

## 2. Os 7 passos do método

### Passo 1 — Seed do tenant

Criar (greenfield) ou confirmar (brownfield) o registro em `zenya_tenants` com nome, prompt canônico, `active_tools` e admins preenchidos.

```bash
cd packages/zenya
node --env-file=.env scripts/seed-<tenant>-tenant.mjs --dry-run   # inspeciona
node --env-file=.env scripts/seed-<tenant>-tenant.mjs             # aplica
```

Referência: [`TENANT-PLAYBOOK.md §9.3-9.5`](./TENANT-PLAYBOOK.md). Em brownfield, antes de `--dry-run`, validar `md5` do banco contra o `.md` do prompt (ADR-001). Se divergir: backup e investigar.

### Passo 2 — REPL local (conversar sem WhatsApp)

Antes de conectar Z-API/Chatwoot, testar prompt+tools diretamente via terminal usando o AI SDK. Pula toda a camada de transporte.

```bash
node --env-file=.env scripts/chat-tenant.mjs --tenant=<chatwoot_account_id>
```

Serve para: explorar fluxo conversacional, ver log de tool calls (`🔧 tool_name(...)`), validar idioma/tom/catálogo. Usado tanto por PLAKA quanto por Scar AI no onboarding.

### Passo 3 — Smoke derivado da fonte (nunca adivinhado)

Rodar bateria automática de cenários **derivados do prompt/KB/portfólios**, não inventados. Cada cenário tem classificador heurístico (`pass_if`).

```bash
node --env-file=.env scripts/smoke-<tenant>.mjs   # adaptar de smoke-template.mjs
```

Referência de template: [`packages/zenya/scripts/smoke-template.mjs`](../../packages/zenya/scripts/smoke-template.mjs). Exemplo real: [`packages/zenya/scripts/smoke-scar.mjs`](../../packages/zenya/scripts/smoke-scar.mjs).

Regra crítica: **nunca adivinhe casos a partir de nomes de aba ou categorias.** Enumere a fonte (prompt, KB entries, portfólios, tabelas de preço) e derive os cenários dela. Ver §5 armadilha 1.

### Passo 4 — Fix iterativo pelo ROI

Com o relatório do smoke em mãos, atacar o **pior gap primeiro**. Cada rodada:

1. Identificar o cenário mais crítico que falha.
2. Ajustar prompt, fuzzy, trigger, tool — não tudo de uma vez.
3. Re-rodar o smoke.
4. Parar quando comportamento inaceitável (ex: `sem-match-sem-escalar`) for 0%, não quando hit-rate for "bom o suficiente".

PLAKA precisou 3 rodadas de prompt (v2.1 → v2.2 → v2.3). Scar AI precisou 1 (v2). A quantidade depende do tenant — a regra é a mesma: parar quando parar de piorar, não quando parar de mudar.

### Passo 5 — Whitelist `allowed_phones`

Antes de qualquer deploy, preencher `allowed_phones` com números admin (Mauro + dono do negócio). **Tenant novo nasce em modo teste.**

```sql
UPDATE zenya_tenants
SET allowed_phones = ARRAY['+551299...', '+55XX...']
WHERE chatwoot_account_id = 'X';
```

Só os listados recebem resposta. Outros números são silenciosamente ignorados. Ver [`TENANT-PLAYBOOK.md §8`](./TENANT-PLAYBOOK.md#8-modo-teste).

### Passo 6 — Produção (com whitelist ativa)

Conectar Z-API, criar credencial criptografada, `pm2 reload zenya-webhook`. Rodar smokes **em produção** com o número admin — validar o caminho real WhatsApp → Chatwoot → core → resposta.

```bash
ssh sparkle-vps 'cd /root/SparkleOS/packages/zenya && pm2 reload zenya-webhook && pm2 logs zenya-webhook --lines 20'
```

### Passo 7 — Liberação + monitoramento

Só após smokes em produção OK, liberar geral:

```sql
UPDATE zenya_tenants SET allowed_phones = '{}' WHERE chatwoot_account_id = 'X';
```

Monitorar 48h (`pm2 logs zenya-webhook -f`). Acompanhar taxa de conclusão de fluxo, falsos negativos óbvios, tickets abertos pelo cliente. Se algo crítico: aplicar label `agente-off` e voltar ao Passo 4.

---

## 3. Greenfield vs Brownfield

> ⚠️ **Brownfield SEMPRE tem risco residual.** Este playbook REDUZ risco; não elimina. Clientes reais estão atendidos — regressão silenciosa é o pior cenário.

### Greenfield (tenant novo, sem tráfego)

Exemplo real: **Scar AI** (2026-04-22). Nenhum cliente real, podemos quebrar à vontade nos smokes, iterar prompt rápido, trocar tools sem receio.

- Todos os 7 passos aplicam linearmente.
- Sem backup prévio necessário.
- Janela de monitoramento padrão (48h).

### Brownfield (tenant em produção, com tráfego)

Exemplo real alvo: **Fun Personalize** (Julia) — em atendimento ativo. Qualquer mudança pode regredir comportamento que já funciona.

Ajustes obrigatórios:

| Passo | Cuidado extra em brownfield |
|-------|----------------------------|
| 1 (seed) | **Backup do prompt atual:** `SELECT system_prompt FROM zenya_tenants WHERE ... \g /tmp/backup-<tenant>-<ts>.txt`. Confirmar `md5` do banco === `md5` do `.md` antes de alterar. |
| 2 (REPL) | Rodar contra **prompt atual em produção** antes de ajustar — estabelecer baseline. Depois contra prompt proposto e comparar. |
| 3 (smoke) | Derivar cenários também de **conversas reais** recentes (exportar 20-30 últimas conversas do Chatwoot, classificar manualmente o que o bot acertou/errou, montar smoke derivado desses casos). |
| 4 (fix) | Cada iteração de prompt passa por **diff review** antes de aplicar. Mudança pequena e atômica. |
| 5 (whitelist) | **Obrigatório** — mesmo com tenant em produção. `allowed_phones` populado com admin + Mauro ANTES do seed novo ser aplicado. |
| 6 (produção) | **Janela de manutenção** combinada com o dono do negócio. Smokes rodam com whitelist ativa (tráfego real bloqueado). |
| 7 (liberação) | Monitoramento **2x maior** (96h em vez de 48h). Rollback plan pronto: `UPDATE zenya_tenants SET system_prompt = '<backup>' WHERE ...`. |

**Rollback plan obrigatório em brownfield.** Exemplo:

```sql
-- Salvo em backup antes da mudança:
UPDATE zenya_tenants
SET system_prompt = (SELECT content FROM /tmp/backup-fun-20260422.txt)
WHERE chatwoot_account_id = '5';
-- Seguido de pm2 reload.
```

---

## 4. Tipos de tenant

Cada tipo usa subconjunto diferente dos 7 passos e variante específica do smoke template.

| Tipo | Exemplo real | `active_tools` | Passos 2-7 aplicáveis | Variante smoke |
|------|-------------|----------------|----------------------|----------------|
| **Prompt-only** | Scar AI (GuDesignerPro) | `[]` | Todos. Passo 3 foca em tom, idioma, objeções, escalação. | A (prompt-only) |
| **Prompt + KB** | PLAKA (Roberta) | `[nuvemshop, sheets_kb]` | Todos + sync de KB periódico. Passo 3 inclui cobertura KB (hit/miss/fuzzy). | B (com KB) |
| **Prompt + KB + integrações externas** | HL Importados, Fun Personalize | `[ultracash]` / `[loja_integrada]` | Todos + passo extra: seed de credenciais + smoke contra endpoint real da integração. | B + cenários específicos da integração |

**Tenants atípicos** (ex: multi-role admin, catálogo condicional, stemming custom): não se encaixam no template — tratar caso a caso com `@architect`.

---

## 5. Armadilhas conhecidas

Cada armadilha abaixo tem memória persistente correspondente que **eu (ou qualquer agente futuro)** deve consultar antes de entrar na etapa relacionada.

### 5.1 LLM pode escrever "vou fazer X" e **não** invocar a tool

Observado com Roberta (PLAKA v2.2, 2026-04-21). Prompt dizia "chame escalarHumano" — LLM escrevia "vou te encaminhar para um atendente" e parava. A tool nunca era invocada, cliente ficava abandonado.

**Fix:** regra imperativa no prompt ("VOCÊ DEVE INVOCAR") + seção COMPORTAMENTO PROIBIDO com exemplos ❌/✅ + regra mental ("se escreveu 'encaminhar', OBRIGATORIAMENTE invoque"). Se ainda falhar: `toolChoice` forçado via AI SDK.

Memória: `feedback_llm_simulates_tool.md`.

### 5.2 Afrouxar prompt pode piorar silenciosamente

PLAKA v2 tentou "KB-first condicional" pra ganhar fluidez. Resultado: `no-kb-call` triplicou (9.7% → 30.3%). LLM interpretou permissão como licença ampla.

**Fix:** sempre medir pós-afrouxamento. Voltar ao rígido se regressão. Tom descritivo ("você pode") → tom imperativo ("você deve").

Memória: `feedback_prompt_iteration_reveals.md`.

### 5.3 Errors em smoke podem esconder comportamento ruim

Smoke PLAKA v1 teve 21% de errors Chatwoot 404 — pareciam irrelevantes. Quando o transporte foi corrigido, esses 404 sumiram e o comportamento real apareceu: Roberta **improvisando resposta** em vez de escalar. O error era **semáforo de segurança**.

**Fix:** investigar causa de errors antes de ignorá-los. Um error de transporte pode estar mascarando ausência de side-effect crítico. Checar aprendizado 5.1.

Memória: `feedback_errors_can_hide_bugs.md`.

### 5.4 Testes derivam da fonte, não de categorias abstratas

Smoke PLAKA v1 usou 29 perguntas chutadas a partir dos nomes das abas da planilha. Resultado: afirmou cobertura que não existia (faltam entries que JÁ existiam). Smoke derivado de fonte real (165 perguntas × 3 variações por entry) expôs o problema verdadeiro.

**Fix:** para qualquer artefato enumerável (KB, prompt, endpoints, schema), listar a fonte primeiro e gerar cenários a partir dela. Smoke adivinhado é pior que nenhum smoke — dá falsa segurança.

Memória: `feedback_test_from_source.md`.

---

## 6. Artefatos relacionados

### No código

- [`packages/zenya/scripts/chat-tenant.mjs`](../../packages/zenya/scripts/chat-tenant.mjs) — REPL local genérico (Passo 2).
- [`packages/zenya/scripts/smoke-template.mjs`](../../packages/zenya/scripts/smoke-template.mjs) — template de smoke (Passo 3), criado pela Story 15.2.
- [`packages/zenya/scripts/smoke-scar.mjs`](../../packages/zenya/scripts/smoke-scar.mjs) — exemplo real de smoke (Scar AI).

### Na documentação

- [`TENANT-PLAYBOOK.md`](./TENANT-PLAYBOOK.md) — referência técnica do core (schema, tools, fluxos, seed detalhado).
- [`ADR-001 — Zenya Prompt Storage`](../architecture/adr/ADR-001-zenya-prompt-storage.md) — por que os prompts ficam em `docs/zenya/tenants/<slug>/prompt.md` com front-matter.
- [`lessons-for-pm.md`](../stories/plaka-01/lessons-for-pm.md) — brief destilado da sessão PLAKA + Scar AI que originou este playbook.

### Nas memórias (persistentes entre sessões AIOX)

Em `~/.claude/projects/.../memory/`:

- `feedback_test_from_source.md` — armadilha §5.4
- `feedback_llm_simulates_tool.md` — armadilha §5.1
- `feedback_prompt_iteration_reveals.md` — armadilha §5.2
- `feedback_errors_can_hide_bugs.md` — armadilha §5.3

---

## 7. Histórico e evolução

| Versão | Data | Mudança | Motivo |
|--------|------|---------|--------|
| 1.0 | 2026-04-22 | Criação do documento | Consolidar método validado em N=2 (PLAKA + Scar AI). Destravar refino brownfield da Fun Personalize. Epic 15 / Story 15.1. |

### Política de manutenção

Ownership do `@pm`. Revisão obrigatória a cada novo tenant ("o playbook ainda reflete o método que eu usei?"). Mudança de método → atualizar seção + bumpar versão + registrar motivo aqui.

Em caso de conflito entre este playbook e o [`TENANT-PLAYBOOK.md`](./TENANT-PLAYBOOK.md): este **sobrepõe** em tópicos operacionais (o que fazer, em que ordem, quando parar); o outro sobrepõe em tópicos técnicos (schema, assinatura de funções, contratos).
