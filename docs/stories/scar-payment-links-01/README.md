# Story scar-payment-links-01 — Scar AI fecha pagamento via Cakto (prompt v4)

**Tipo:** Story standalone (não pertence a Epic) — refino brownfield Scar AI
**Status:** Ready for Review (implementada 2026-04-25 por @dev em modo exploratório, formalizada retroativamente)
**Owner:** @dev (Dex) implementou direto após confirmação do Mauro · @qa valida · @devops deploy
**Complexity:** S (Small) — 3 story points. Mudanças cirúrgicas no prompt (sem código novo, sem schema).

**Executor Assignment:**
- `executor: @dev`
- `quality_gate: @qa`
- `quality_gate_tools: [smoke-scar.mjs, typescript-check, vitest]`

## Contexto

Story 17.2 (refino prompt v3) acabou de ser deployada na produção (2026-04-25 ~15h). Smoke produção 6/7 PASS (D7 falhou por addLabel 404 esperado em REPL). Gustavo ia re-testar quando Mauro decidiu adicionar capacidade nova: **fechamento direto pela Scar via links Cakto**, sem precisar escalar pro Gustavo cobrar Pix manualmente.

Mauro forneceu 6 links Cakto (Essencial / Premium / Super VIP × completo / 50%-50%) e confirmou 3 decisões de policy:

1. ✅ Scar manda link Cakto direto, sem escalar antes (fecha BR pela Scar)
2. ✅ Tirar descontos por enquanto (Pix 7% off + 5% pra fechar) — Mauro decide depois o que fazer
3. ✅ Cliente US continua escalando pro Gustavo (Cakto é BR-only, Gustavo manda PayPal/Higlobe manualmente)

Mudança é capacidade nova (não bugfix), mas **não cabe na 17.2** (escopo daquela: 2 fixes do feedback Gustavo de 2026-04-24). Cabe em story própria — esta.

## Modo de execução

**Exploratório com formalização retroativa** (memória `feedback_exploratory_then_retroactive_aiox.md`). Justificativa: cliente real (Gustavo) está em loop de teste, decisão de Mauro veio durante a sessão, processo formal completo (sm draft → po validate → dev develop) custaria latência inaceitável.

**Trilha de auditoria:** este README + commit explícito + handoff @qa formal.

## Objetivo

Atualizar prompt Scar AI v3 → v4 incorporando os 6 links Cakto e o fluxo de fechamento direto BR, mantendo escalação pra Gustavo no caso US, **sem regressão** nos comportamentos validados nas v2 e v3 (consistência idioma PT/EN, qualificação em camadas, regras §6-§8 de uso de histórico/densidade/hook por nicho).

## Acceptance Criteria

1. **Front-matter v4** em `docs/zenya/tenants/scar-ai/prompt.md` com `version: 4`, `updated_at: 2026-04-25`, sources +1 (links Cakto), notes com changelog v4.

2. **Seção "Links de Pagamento (BR)"** adicionada ao prompt com tabela dos 6 links + regras de uso (qual link mandar baseado no pacote escolhido + opção completo/50%).

3. **Regra Crítica §1 reescrita** com fluxo dual:
   - Cliente BR → pergunta opção → manda link Cakto correto → escala pro Gustavo
   - Cliente US → escala pro Gustavo direto (sem link)

4. **Regra Crítica §3 reescrita** — sem desconto automático. Resposta a pedido de desconto: oferecer avulsas OU escalar pro Gustavo. **Nunca prometer 5% nem 7%.**

5. **Catálogo de pacotes atualizado** — remover "10x R$ X" (Cakto gerencia parcelamento até 12x). Manter valores cheios. Adicionar referência aos Links de Pagamento.

6. **Seção "Formas de pagamento" reescrita** — BR via Cakto (link enviado pela Scar), US via Gustavo (link manual).

7. **Objeção "Faz mais barato?" reescrita** — sem 5% off. Sugerir avulsas OU escalar.

8. **Smoke `smoke-scar.mjs` atualizado:**
   - **D6** (`D6_PedidoDesconto`) — `pass_if` checa `noFivePercent` + `noSevenPercent` + (`offeredAvulsas` OR `escalated`)
   - **D7** (`D7_Fechamento_BR_CRITICO`) — `pass_if` checa `!leakedPix` AND (`askedOption` OR (`linkSent` AND `escalated`))
   - **D7b NOVO** (`D7b_Fechamento_US_CRITICO`) — input em inglês, `pass_if` checa `!linkLeaked` AND `escalated` AND `noPortuguese`

9. **Zero regressão:**
   - Build TypeScript PASS
   - 104 testes vitest PASS (zero novo, nenhum quebrou)
   - D1, D2, D5, D5b, D9 (smoke) continuam PASS na lógica

10. **Não tocar em:**
    - Seção Idioma (consistência PT/EN — já passou no v2)
    - Camadas de Qualificação 1-4 (v3)
    - Regras §6, §7, §8 (v3 — uso de histórico, densidade, hook por nicho)
    - Regra Crítica §2 (não criar grupos — Gustavo+ilustrador fazem)
    - Regra Crítica §4 (sem promessas milagrosas)
    - Postura

## Escopo — IN

- `docs/zenya/tenants/scar-ai/prompt.md` — v3 → v4 (front-matter + 4 seções editadas + 1 seção nova + Regras §1/§3/§5)
- `packages/zenya/scripts/smoke-scar.mjs` — D6 atualizado, D7 atualizado, D7b novo
- `docs/stories/scar-payment-links-01/README.md` — esta story (retroativa)

## Escopo — OUT

- Mudança de código no core Zenya (zero alterações)
- Mudança no schema (zero migrations)
- Integração programática com Cakto (links são estáticos no prompt — futura story se quiser integration via API ou webhook)
- Validação de pagamento confirmado (Gustavo monitora Cakto manualmente por enquanto — futura story se automatizar)
- Reativação de descontos (Mauro decide depois — futura story se for definir nova policy)

## Dependências

- **Não-bloqueante:** prompt v3 já em produção, v4 é incremento.
- **Input crítico:** os 6 links Cakto fornecidos pelo Mauro na sessão 2026-04-25 ~16h BRT (preservados na seção "Links de Pagamento (BR)" do prompt).

## Riscos

| Risco | Mitigação |
|-------|-----------|
| LLM mistura os 6 links (manda link Essencial pro cliente Premium) | Tabela explícita no prompt + Regra §1 passo 1 ("apenas o link correspondente, não os dois") + smoke D7 testa link válido na regex |
| Cliente clica no link 50%, paga 50%, depois esquece dos outros 50% | Comportamento humano fora do escopo deste prompt — Gustavo cobra na entrega via processo dele |
| Cliente pede desconto e Scar libera 5% mesmo (regressão) | Smoke D6 explicitamente checa `noFivePercent` + `noSevenPercent`. Falha se reaparecer |
| Cliente em inglês recebe link Cakto (link inválido ou cobrança em BRL) | Smoke D7b checa `!linkLeaked` em inputs em inglês. Falha se Scar mandar link |
| Cakto cair / Gustavo desligar conta | Rollback simples: re-seed v3 ou v2 (idempotente) |

## Definição de pronto

- [x] Prompt v4 commitado em `docs/zenya/tenants/scar-ai/prompt.md`
- [x] `smoke-scar.mjs` atualizado com D6, D7 redesenhados + D7b novo
- [x] Build TS PASS
- [x] Vitest 104/104 PASS (zero regressão)
- [ ] Smoke local — bloqueado por dívida D2 (Supabase legado no `.env`); roda na VPS pós-deploy
- [ ] @qa gate aprovado (próximo passo)
- [ ] @devops push + deploy + seed na VPS + smoke produção
- [ ] Mauro confirma com Gustavo que Scar fecha BR via link e escala US corretamente
- [ ] Story marcada Done (após Gustavo OK)

## Dev Notes

### Mudanças cirúrgicas v3 → v4 — diff resumido

**Front-matter:**
- `version: 3 → 4`, `updated_at: 2026-04-25` (mesmo dia da v3, ~3h depois)
- `sources` +1 (links Cakto fornecidos pelo Mauro)
- `notes` com changelog v4 explicando as 3 mudanças

**Seções modificadas:**
1. Catálogo pacotes fechados: removido `"10x R$ X"` em todos os 3 packs. Adicionado `"(Pix ou cartão até 12x via Cakto — ver Links de Pagamento)"` no BR e `"(link enviado pelo Gustavo — PayPal/Higlobe)"` no US.
2. Formas de pagamento: reescrita completa BR (Cakto via Scar) e US (manual via Gustavo).
3. Objeção "Faz mais barato?": removido 5% off, agora oferece avulsas OU escala.
4. Regra Crítica §1: reescrita totalmente — fluxo dual BR/US com instruções literais.
5. Regra Crítica §3: reescrita — sem desconto automático.
6. Regra Crítica §5 (escale para humano): adicionados 2 itens (cliente BR após mandar link, cliente US sempre que aceitar).

**Seções novas:**
- "Links de Pagamento (BR)" — tabela 3×2 + regra de uso (3 passos).

**Seções preservadas (zero mudança):**
- Tom de voz, Idioma + Consistência (v2)
- Qualificação em camadas 1-4 (v3)
- Catálogo de artes avulsas (preços inalterados)
- Prazos e entrega
- Objeção "Tá caro" (v2 — ainda relevante)
- Objeção "Posso pagar só no final?" (v2)
- Objeção "Esse design garante crescimento?" (v2)
- Regras Críticas §2 (não criar grupos), §4 (sem promessas), §6 (releia histórico), §7 (densidade), §8 (hook por nicho)
- Postura

### Padrão a seguir

- **PLAKA v2.3 + Scar v3** — tom imperativo > instrucional. Cada nova regra usa "DEVE", "NUNCA", listas explícitas com passos numerados.
- **Regra dupla cliente BR vs cliente US** — espelha padrão de detecção de idioma da v2 (idioma do input define resposta). Em v4, idioma também define fluxo de fechamento.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.7 (claude-opus-4-7) via Claude Code, agente `@dev` (Dex).

### Tasks/Subtasks Executados

- [x] Step 1 — Receber inputs do Mauro (6 links Cakto + 3 decisões de policy)
- [x] Step 2 — Confirmar 3 conflitos com Regra Crítica §1 atual e obter resposta de policy do Mauro
- [x] Step 3 — Editar prompt v3 → v4:
  - [x] Front-matter (version 4, sources +1, notes changelog v4)
  - [x] Catálogo pacotes (3 packs com referência Cakto + remoção "10x")
  - [x] Formas de pagamento reescrita (BR Cakto / US Gustavo)
  - [x] Seção "Links de Pagamento (BR)" adicionada com tabela + regra de uso
  - [x] Objeção "Faz mais barato?" reescrita sem 5%
  - [x] Regra Crítica §1 reescrita com fluxo dual BR/US
  - [x] Regra Crítica §3 reescrita sem desconto automático
  - [x] Regra Crítica §5 atualizada com novos itens de escalação
- [x] Step 4 — Atualizar `smoke-scar.mjs`:
  - [x] Header documentando D1-D9 atualizados pra v4
  - [x] D6: `pass_if` checa noFivePercent + noSevenPercent + (avulsas OR escalated)
  - [x] D7 renomeado pra D7_Fechamento_BR_CRITICO: `pass_if` checa !leakedPix + (askedOption OR (linkSent + escalated))
  - [x] D7b NOVO `D7b_Fechamento_US_CRITICO`: input em inglês, escala obrigatória, sem link Cakto
- [x] Step 5 — Validar local:
  - [x] `npm run build` — PASS (zero erros TypeScript)
  - [x] `npm test` — 104/104 PASS (zero regressão)
  - [ ] Smoke local — não rodou (dívida D2 conhecida, smoke real na VPS pós-deploy)

### Debug Log References

- Build: `cd packages/zenya && npm run build` → exit 0
- Tests: `npm test` → 104 passed (13 test files), 3.31s
- Smoke local: pulado por dívida D2 (`.env` local aponta pra Supabase legado bloqueado). Smoke real na VPS via @devops.
- Tamanho final: prompt.md 293 linhas (era 239 em v3, +23%), smoke-scar.mjs 320 linhas (era 266 em v3, +20%).

### File List

**Modificados:**
- `docs/zenya/tenants/scar-ai/prompt.md` — v3 → v4 (front-matter + Catálogo + Formas de pagamento + nova seção Links de Pagamento + Objeção "Faz mais barato" + Regras Críticas §1, §3, §5)
- `packages/zenya/scripts/smoke-scar.mjs` — header v3→v4 + D6 redesenhado + D7 renomeado e redesenhado + D7b novo

**Novos:**
- `docs/stories/scar-payment-links-01/README.md` — esta story (formalização retroativa)

### Completion Notes

- **Mudanças cirúrgicas — preservou tudo o que estava funcionando v3.** Idioma PT/EN, Camadas Qualificação, Regras §2/§4/§6/§7/§8, Postura, Catálogo avulsas, Prazos, Objeções §1/§3/§4 — todos intactos.
- **Regra Crítica §1 reescrita com fluxo dual** — BR e US têm fluxos diferentes. Padrão consistente com a regra de Idioma (v2): idioma do cliente define comportamento.
- **Tabela de links é exposição literal** — 6 URLs Cakto direto no prompt. Risco de LLM "embaralhar" mitigado por: (a) tabela visual com headers explícitos, (b) regra §1 passo 2 "apenas o link correspondente, não os dois", (c) smoke D7 valida regex de link válido contra os 6 IDs específicos.
- **Smoke D7 flexibilizado** — aceita 2 cenários válidos (Scar pergunta opção primeiro OU Scar manda link direto). Single-turn não captura turn 2 onde link viria. Cenário "perguntou opção" é o caminho mais natural conversacional.
- **Smoke D7b novo** — testa fluxo US explicitamente. Pass exige: escalação + sem link Cakto + zero português na resposta.
- **Hook por nicho v3 (Regra §8) preservado** — engaje com GTA RP, Valorant, etc. Mantém aprofundamento conversacional antes do fechamento.
- **Modo exploratório com cliente no loop** (memória `feedback_exploratory_then_retroactive_aiox.md`) — Mauro confirmou as 3 decisões de policy, implementação saiu na sessão, story formalizada retroativamente. Trilha completa: este README + git log + handoff @qa.

### Change Log

- **2026-04-25 (dev)** — Implementação completa do prompt v4 + smoke estendido + story formalizada retroativamente. Build PASS + 104 testes PASS. Smoke local bloqueado por dívida D2 (não-impactante). Status → Ready for Review. Próximo handoff: @qa gate.

## Histórico

- **2026-04-25 ~15h** — Story 17.2 (prompt v3) deployada em produção
- **2026-04-25 ~16h** — Mauro decide testar fechamento direto. Fornece 6 links Cakto e confirma 3 decisões de policy. @dev implementa em modo exploratório.
- **2026-04-25 ~16:15h** — Story formalizada retroativamente. Status: Ready for Review.

---

## QA Results

### Review 2026-04-25 — `@qa` (Quinn)

**Verdict:** **PASS with observations**
**Gate file:** [`docs/qa/gates/scar-payment-links-01.yml`](../qa/gates/scar-payment-links-01.yml)

#### Resumo

Mudanças cirúrgicas, padrão PLAKA + Scar v3 mantidos (tom imperativo,
exemplos concretos, defesa contra regressão). Os 3 fixes do feedback do
Mauro implementados conforme spec: Regra §1 dual BR/US, descontos
removidos com proteção explícita, tabela Cakto com regra de uso 3 passos.

Smoke estendido com defesas programáticas: D6 verifica `noFivePercent` +
`noSevenPercent` (regressão impossível); D7 valida link Cakto contra os
6 IDs específicos (proteção contra link inventado); D7b NOVO testa fluxo
US explicitamente.

Build PASS + 104/104 testes pass (zero regressão). Smoke local não rodou
por dívida D2 (mesmo gap da 17.2) — smoke produção é obrigatório pelo
@devops pós-deploy.

#### Checks (todos PASS)

| Check | Resultado | Notas |
|-------|-----------|-------|
| Code review | ✅ PASS | Cirúrgico. Diff confirma seções v2/v3 (Idioma, Camadas, §6/§7/§8, Postura, Catálogo avulsas, Prazos, Objeções §1/§3/§4) literalmente intactas. |
| Unit tests | ✅ PASS | 104/104 testes vitest, zero regressão. |
| Acceptance criteria | ✅ PASS | 10/10 ACs validáveis aqui (AC8/AC9 da definição-de-pronto são post-deploy/Gustavo). |
| No regressions | ✅ PASS | Verificação tripla: diff intacto, testes pass, smoke D1/D2/D5/D5b/D9 pass_if literal igual à v3. |
| Performance | ✅ PASS | +23% linhas no prompt (~+10-15% tokens). Custo marginal aceitável. |
| Security | ✅ PASS | **Melhorias de superfície**: §1 proíbe Pix manual; §3 proíbe percentual; smoke D6/D7/D7b com regex defensiva. |
| Documentation | ✅ PASS | Story formalizada com Dev Agent Record + Histórico. Front-matter v4 com changelog. Comentários inline no smoke. |

#### Anti-patterns das memórias `feedback_*` — todos respeitados

- ✅ `feedback_test_from_source` — D6/D7/D7b derivados das 3 decisões do Mauro, não chutados
- ✅ `feedback_llm_simulates_tool` — Regra §1 BR é imperativa em 4 sub-passos com exemplos literais entre aspas
- ✅ `feedback_prompt_iteration_reveals` — escopo cirúrgico, preservou tudo o que funcionava em v3
- ✅ `feedback_errors_can_hide_bugs` — D7 já foi fixado na 17.2 (`c.toolName` → fallback) — preservado em v4
- ✅ `feedback_exploratory_then_retroactive_aiox` — modo exploratório autorizado + formalização retroativa feita
- ✅ `feedback_process_integrity` — desvio do SDC documentado e justificado, trilha completa preservada

#### Observations (3 low-severity, não-bloqueantes)

- **scar-payment-links-01-01** (testing) — Smoke local não-executado por dívida D2 (mesmo gap da 17.2). Smoke produção **obrigatório** pelo @devops.
- **scar-payment-links-01-02** (prompt-design) — Edge case potencial entre Regra §1 BR e Regra §6 (releia histórico) se cliente declarar opção de pagamento no input inicial. Não é regressão, refinamento desejável em v5.
- **scar-payment-links-01-03** (process) — Modo exploratório justificado mas deve ser **exceção, não rotina**. Próximas iterações da Scar voltam ao SDC formal.

#### Handoff

→ `@devops` (Gage). Comando: push + deploy + seed VPS + smoke produção.
Handoff yaml em `.aiox/handoffs/handoff-qa-to-devops-20260425-scar-payment-links.yaml`.

#### Pós-handoff

1. `@devops` executa branch + commit + push + PR + merge + deploy VPS + seed dry-run + seed real + pm2 reload + smoke produção
2. Smoke produção: 8/8 PASS esperado (D1, D2, D5, D5b, D6, D7, D7b, D9). Aceita falha REPL em D7/D7b SE for apenas addLabel/sendMessage 404
3. Mauro coordena re-teste manual do Gustavo:
   - Cliente BR: aceita pacote → Scar pergunta opção → manda link Cakto correto → escala
   - Cliente US: aceita pacote em inglês → Scar escala sem link
4. Gustavo confirma OK → fechar story scar-payment-links-01 (Done) + 17.2 (Done) + scar-ai-onboarding-01 parent (Done)

— Quinn, guardião da qualidade 🛡️
