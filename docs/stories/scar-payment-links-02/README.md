# Story scar-payment-links-02 — Scar AI continua na conversa até comprovante (prompt v5)

**Tipo:** Story standalone — refino brownfield Scar AI (continuação direta da scar-payment-links-01)
**Status:** Ready for Review (implementado 2026-04-25 22:55 BRT por @dev — aguardando @qa gate)
**Owner:** @pm cria · @dev implementa · @qa gate · @devops deploy
**Complexity:** S (Small) — 3 story points. Mudanças cirúrgicas no prompt (Regra §1 BR) + 2 cenários novos no smoke. Sem código novo, sem schema.

**Executor Assignment:**
- `executor: @dev`
- `quality_gate: @qa`
- `quality_gate_tools: [smoke-scar.mjs, typescript-check, vitest]`

## Contexto

Story `scar-payment-links-01` (prompt v4) foi deployada hoje (2026-04-25 ~16h, commit `ed02d6d`). Smoke produção 7/8 PASS confirmou os 3 fixes do v4 (fluxo dual BR/US + sem desconto + links Cakto).

Gustavo testou o fluxo BR completo às ~22:30 BRT e mandou 2 áudios de feedback identificando 2 issues novos (transcritos em `docs/zenya/tenants/scar-ai/feedback-gustavo-20260425-evening.md`):

1. **Issue #3** — Scar escala cedo demais após mandar link. Deve **continuar na conversa** até cliente confirmar pagamento (ou ficar em silêncio).
2. **Issue #4** — Cliente pode mudar de pacote depois do link. Scar deve aceitar sem fricção e mandar link novo.

Não é regressão — é refino esperado do fluxo de fechamento que apareceu na primeira validação real do v4 com cliente humano.

## Modo de execução

**Exploratório com cliente no loop** (memória `feedback_exploratory_then_retroactive_aiox.md`). Gustavo está em sessão ativa de teste de produção, decisão veio dele direto durante teste, latência de SDC formal seria custosa.

**Trilha de auditoria:** este README + arquivo de feedback (`feedback-gustavo-20260425-evening.md`) + handoff @pm→@dev formal + commit explícito + handoffs @dev→@qa→@devops na sequência.

## Objetivo

Atualizar prompt Scar AI v4 → v5 incorporando os 2 fixes do feedback do Gustavo, **mantendo intacto** todo o resto que já está funcionando em produção (links Cakto, fluxo dual BR/US, regras §6/§7/§8 v3, idioma PT/EN, qualificação em camadas, catálogo, postura).

## Acceptance Criteria

1. **Front-matter v5** em `docs/zenya/tenants/scar-ai/prompt.md` com `version: 5`, `updated_at: 2026-04-25` (mesmo dia, ~6h após v4), sources +1 (feedback noturno Gustavo), notes com changelog v5 explicando os 2 issues.

2. **Issue #3 resolvido — Regra Crítica §1 BR reescrita com 3 cenários pós-link:**

   **Cenário A — Cliente confirma pagamento (texto):**
   - Detecção via palavras-chave: `paguei`, `fechei`, `transferi`, `comprovante`, `acabei de pagar`, `feito`, `pix enviado` (case-insensitive, ver lista completa nas regras críticas)
   - Mensagem padrão pós-confirmação: *"Show, valeu! Agora o Gu vai te puxar pro grupo de produção pra começar o projeto."* → chama `escalarHumano`

   **Cenário B — Cliente fica em silêncio depois do link:**
   - Scar **NÃO escala sozinha** — aguarda mensagem subsequente
   - Se cliente perguntar dúvida sobre pagamento (ex: "consigo parcelar mais?"), responde dentro do escopo
   - Se sumir, comportamento normal (Gustavo monitora Cakto manualmente — escopo OUT)

   **Cenário C — Cliente diz que vai pagar mais tarde:**
   - "Vou pagar amanhã" / "Pago hoje à noite" / "Quando chegar em casa pago"
   - Scar acolhe, **NÃO escala**, deixa portas abertas: *"Tranquilo! Quando pagar me avisa aqui que aí o Gu já dá o pontapé inicial no projeto."*

3. **Issue #4 resolvido — sub-regra "Cliente muda de pacote" adicionada à Regra §1 BR:**

   > Se o cliente, depois de receber um link, indicar que prefere outro pacote (ex: *"pensei melhor, quero o Premium"*, *"acho que vou pegar o Super VIP"*, *"e se eu pegar o Essencial?"*), você **aceita sem julgar e sem cobrar o pacote anterior** (cliente ainda não pagou). Manda o link Cakto correto do novo pacote + opção de pagamento mantida (ou pergunta de novo se cliente não disse).
   >
   > Pode reforçar a escolha alta sutilmente: *"Boa escolha, o Premium tem [diferencial]. Te mando o link aqui."* — mas **nunca pressione a escolher o mais caro**.

4. **Edge case "imagem de comprovante sem texto":** se cliente mandar attachment (imagem) sem mensagem de texto reconhecível, Scar **não vê a imagem** (limitação técnica conhecida — sem multimodal vision). Resposta padrão:
   > *"Show, recebi aqui — vou conferir e o Gu já te chama no grupo se tiver tudo certo."*
   → escala (Gustavo verifica no Cakto).

5. **Smoke `smoke-scar.mjs` estendido com 2 cenários novos:**

   - **D7c** (`D7c_MudaPacote_v5`) — Input multi-turn: 1ª mensagem cliente "Quero o Essencial, pode mandar o link" / 2ª mensagem (após Scar mandar link Essencial) "pensei melhor, quero o Premium". `pass_if`:
     - Resposta da Scar contém link Cakto Premium (`/3duoqqe` ou `/3eamnbx`)
     - NÃO contém link Cakto Essencial (`/xx2ep54` ou `/faan5fw`)
     - NÃO menciona "tem certeza?", "confirma?", "você disse essencial" (sem fricção)
     - NÃO chama `escalarHumano` neste turno

     Nota: D7c precisa de **smoke multi-turn** (não single-turn). Adaptar `smoke-scar.mjs` se necessário, OU usar `messages` com histórico fake pré-populado.

   - **D7d** (`D7d_ConfirmaPagamento_v5`) — Input multi-turn: 1ª mensagem cliente "Quero o Premium, valor completo" / 2ª mensagem (após Scar mandar link) "paguei!". `pass_if`:
     - Resposta da Scar contém algum termo de agradecimento + menção a Gustavo + grupo: `/show.+gu.+grupo|valeu.+gu|agradec.+gu/i` (regex flexível)
     - Chama `escalarHumano` neste turno
     - NÃO contém pergunta tipo "tem certeza que pagou?"

6. **Não tocar:**
   - Idioma PT/EN + Consistência (v2)
   - Camadas de Qualificação 1-4 (v3)
   - Regras Críticas §6 (releia histórico), §7 (densidade), §8 (hook por nicho) — todas v3
   - Regra Crítica §2 (não criar grupos)
   - Regra Crítica §3 (sem desconto automático) — v4
   - Regra Crítica §4 (sem promessas milagrosas)
   - Regra Crítica §5 (escale para humano) — atualizar **apenas** os itens BR pra refletir novo timing (escala só após confirmação ou fluxo Cenário B/C)
   - Catálogo (pacotes + avulsas) — v4 inclui Cakto, preservado
   - Formas de pagamento — v4
   - Seção "Links de Pagamento (BR)" — tabela 6 links preservada literal
   - Objeções §1 ("Tá caro"), §2 ("Faz mais barato?" v4), §3 ("Posso pagar só no final?"), §4 ("Esse design garante crescimento?")
   - Postura
   - Cliente US: fluxo continua escalar imediato (Cakto não atende US, sem mudança)

7. **Zero regressão:**
   - Build TypeScript PASS
   - 104 testes vitest PASS
   - Cenários D1, D2, D5, D5b, D6, D7 BR (passo 1 — pergunta opção), D7b US, D9 (smoke) — `pass_if` literal igual à v4

8. **Deploy via PR + seed VPS** (idempotente, upsert por `chatwoot_account_id`).

9. **Re-teste manual do Gustavo:**
   - Aceita pacote → Scar pergunta opção → Scar manda link → Gustavo **muda de ideia** ("pensei melhor, quero o Premium") → Scar manda link novo sem fricção
   - Aceita pacote → Scar manda link → Gustavo manda *"paguei"* → Scar agradece + escala
   - Aceita pacote → Scar manda link → Gustavo fica em silêncio → Scar não escala (comportamento esperado)

10. **Story marcada Done após Gustavo confirmar OK** no fluxo completo.

## Escopo — IN

- `docs/zenya/tenants/scar-ai/prompt.md` — v4 → v5 (front-matter + Regra §1 BR reescrita + Regra §5 ajustada nos itens BR)
- `packages/zenya/scripts/smoke-scar.mjs` — D7c + D7d novos (multi-turn). Considerar refactor pequeno do smoke pra suportar `messages: [...]` array em vez de só `input: string`.
- `docs/stories/scar-payment-links-02/README.md` — esta story
- `docs/zenya/tenants/scar-ai/feedback-gustavo-20260425-evening.md` — input

## Escopo — OUT

- Mudança no fluxo US (continua escalar imediato — Cakto BR-only)
- Detecção de imagem de comprovante via OCR/multimodal vision (fora — limitação técnica conhecida, fallback de texto cobre)
- Validação programática de pagamento Cakto (não há webhook Cakto integrado — Gustavo monitora manualmente)
- Reativação de descontos (mantido sem desconto da v4)
- Mudanças no message-chunker
- Smoke com cliente fica em silêncio (Cenário B) — single-turn não testa, validação humana

## Dependências

- **Não-bloqueante:** v4 já em produção (commit `ed02d6d`), v5 é incremento.
- **Input crítico:** `feedback-gustavo-20260425-evening.md` (criado).

## Riscos

| Risco | Mitigação |
|-------|-----------|
| LLM detecta "paguei" em contexto errado (ex: "ainda não paguei nada") e agradece prematuramente | Lista de palavras-chave no prompt + smoke D7d cobre caso positivo. Negações ("não paguei", "ainda não") podem confundir LLM — adicionar regra explícita: "se cliente diz 'não paguei' ou 'ainda não paguei', NÃO agradeça nem escale" |
| Cliente muda de pacote 5 vezes em loop | Aceitar — comportamento humano. Sem limite no prompt. Confiar na paciência da Scar. |
| LLM perde regra de Cenário B (silêncio) — escala mesmo sem cliente confirmar | Smoke single-turn não testa, mas regra imperativa no prompt + validação humana cobrem. Concern documentado. |
| Cliente manda imagem de comprovante sem texto | AC4 cobre — Scar acolhe e escala condicionalmente |
| Smoke multi-turn requer refactor do `smoke-scar.mjs` | Refactor pequeno: aceitar `messages: [{ role, content }, ...]` em `scenario.input` quando array. Se string, comportamento atual mantido. ~10 linhas de código. |

## Definição de pronto

- [ ] Prompt v5 commitado em `docs/zenya/tenants/scar-ai/prompt.md`
- [ ] `smoke-scar.mjs` refatorado pra suportar multi-turn + D7c + D7d adicionados
- [ ] Build TS PASS + Vitest 104+ PASS (zero regressão)
- [ ] Smoke local — bloqueado por dívida D2 (Supabase legado no `.env`); roda na VPS pós-deploy
- [ ] @qa gate aprovado
- [ ] @devops push + deploy + seed na VPS + smoke produção (10 cenários esperados: D1-D9 + D7c + D7d)
- [ ] Mauro pede Gustavo re-testar 3 sub-fluxos:
  - Cliente muda de pacote
  - Cliente confirma pagamento via texto
  - Cliente fica em silêncio (validação humana)
- [ ] Gustavo reporta OK ou novo feedback (novo abre v6)
- [ ] Story marcada Done

## Dev Notes

### Mudanças cirúrgicas v4 → v5 — diff resumido

**Front-matter:**
- `version: 4 → 5`, `updated_at: 2026-04-25` (mesmo dia, ~6h após v4)
- `sources` +1 (feedback noturno Gustavo)
- `notes` com changelog v5 explicando 2 issues (#3 e #4)

**Seções modificadas:**
1. Regra Crítica §1 BR — reescrita com 3 cenários pós-link (A confirma, B silêncio, C "vou pagar mais tarde") + sub-regra "Cliente muda de pacote".
2. Regra Crítica §5 — atualizar itens BR pra refletir novo timing de escalação (só após Cenário A confirmação, NÃO imediato após link).

**Seções preservadas (ZERO mudança):**
- Tom de voz, Idioma (v2), Camadas Qualificação 1-4 (v3), Regras §2/§3/§4/§6/§7/§8, Postura, Catálogo (pacotes + avulsas), Prazos, Objeções §1-§4, Formas de pagamento (v4), Seção "Links de Pagamento (BR)" com 6 URLs.

**Smoke estendido:**
- Refactor leve: `scenario.input` aceita string OU array `[{ role, content }]` (multi-turn)
- D7c (multi-turn): cliente muda Essencial → Premium
- D7d (multi-turn): cliente confirma "paguei!"

### Padrão a seguir

- **PLAKA v2.3 + Scar v3 + v4** — tom imperativo > instrucional. Listas explícitas com cenários numerados. Exemplos literais entre aspas.
- **3 cenários pós-link na §1 BR** — A/B/C. Mesmo padrão da Regra de Idioma v2 (cliente troca → você troca).

### Pseudocódigo das mudanças no smoke

```js
// Refactor leve: scenario.input aceita string OU array
const messagesForScenario = (scenario) =>
  Array.isArray(scenario.input)
    ? scenario.input  // multi-turn: array literal de { role, content }
    : [{ role: 'user', content: scenario.input }];

// D7c — Cliente muda de pacote
{
  id: 'D7c_MudaPacote_v5',
  input: [
    { role: 'user', content: 'Quero o Essencial, pode mandar o link de valor completo' },
    { role: 'assistant', content: 'Show! Aqui o link do Pack Essencial: https://pay.cakto.com.br/xx2ep54 — qualquer dúvida me chama.' },
    { role: 'user', content: 'pensei melhor, quero o Premium' },
  ],
  expect: {
    language: 'pt',
    pass_if: (text, toolCalls) => {
      const linkPremium = /pay\.cakto\.com\.br\/(3duoqqe|3eamnbx)/i.test(text);
      const noLinkEssencial = !/pay\.cakto\.com\.br\/(xx2ep54|faan5fw)/i.test(text);
      const noFriction = !/tem certeza|confirma|você disse essencial/i.test(text);
      const notEscalated = !toolCalls.some(c => /escalar|escala|handoff|humano/i.test(c.name ?? c.toolName ?? ''));
      return {
        pass: linkPremium && noLinkEssencial && noFriction && notEscalated,
        linkPremium, noLinkEssencial, noFriction, notEscalated,
      };
    },
  },
},

// D7d — Cliente confirma pagamento
{
  id: 'D7d_ConfirmaPagamento_v5',
  input: [
    { role: 'user', content: 'Fechado, quero o Premium, valor completo' },
    { role: 'assistant', content: 'Show! Aqui o link: https://pay.cakto.com.br/3duoqqe — qualquer dúvida me chama.' },
    { role: 'user', content: 'paguei!' },
  ],
  expect: {
    language: 'pt',
    pass_if: (text, toolCalls) => {
      const ackPayment = /show.+(?:valeu|obrigad)|valeu.+pagamento|recebi/i.test(text);
      const mentionsGuGroup = /gu.+(?:grupo|projeto)|grupo.+(?:projeto|produção)/i.test(text);
      const escalated = toolCalls.some(c => /escalar|escala|handoff|humano/i.test(c.name ?? c.toolName ?? ''));
      const noDoubt = !/tem certeza|confirma que pagou|consegue mostrar/i.test(text);
      return {
        pass: escalated && noDoubt && (ackPayment || mentionsGuGroup),
        ackPayment, mentionsGuGroup, escalated, noDoubt,
      };
    },
    critical: true,
  },
},
```

## Histórico

- **2026-04-25 ~22:30** — Gustavo testa fluxo BR completo do prompt v4 e identifica 2 issues
- **2026-04-25 22:33-22:34** — Gustavo manda 2 áudios pelo WhatsApp pra Mauro
- **2026-04-25 22:35** — @pm transcreve áudios via Whisper API e consolida em `feedback-gustavo-20260425-evening.md`
- **2026-04-25 22:40** — @pm cria esta story (Ready for Dev). Handoff `@pm→@dev` em `.aiox/handoffs/handoff-pm-to-dev-20260425-scar-payment-links-02.yaml`.
- **2026-04-25 22:55** — @dev (Dex) implementa prompt v5 cirúrgico + smoke multi-turn. Build PASS, 104 testes PASS (zero regressão). Smoke local não rodou por dívida D2 — smoke real roda na VPS pós-deploy. Status → Ready for Review.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.7 (claude-opus-4-7) via Claude Code, agente `@dev` (Dex).

### Tasks/Subtasks Executados

- [x] Step 1 — Ler inputs completos (handoff PM→Dev, feedback noturno Gustavo, story scar-payment-links-02 com pseudocódigo, prompt v4 atual, smoke v4 atual)
- [x] Step 2 — Editar prompt v4 → v5:
  - [x] Front-matter: `version: 4 → 5`, sources +1 (feedback noturno), notes com changelog v5 (Issues #3 e #4 explicados)
  - [x] **Regra Crítica §1 BR reescrita** com 3 cenários pós-link estruturados:
    - **Cenário A** (cliente confirma pagamento) — lista de palavras-chave (12 termos: paguei, fechei, transferi, comprovante, acabei de pagar, feito, pago, pix enviado, pix feito, pagamento feito, tá pago, concluído, pronto, pode começar) + edge case attachment de imagem + mensagens padrão de resposta + escalação como passo final
    - **Cenário B** (silêncio) — não escala, aguarda mensagem subsequente, responde dúvidas dentro do escopo Cakto
    - **Cenário C** ("vou pagar mais tarde") — acolhe sem pressão, NÃO escala
  - [x] **Sub-regra "Cliente muda de pacote" adicionada** com 4 instruções imperativas (aceita sem julgar, manda link novo, opcionalmente reforça escolha alta, NUNCA pressiona/confirma repetidas vezes/escala por mudança)
  - [x] **Edge case "imagem sem texto"** integrado ao Cenário A — assume confirmação probabilística, agradece condicional, escala (Gustavo verifica Cakto)
  - [x] **Cliente US** preservado intacto — escala imediato (Cakto BR-only, sem mudança)
  - [x] **Regra Crítica §5 atualizada** — itens BR reescritos: escala APENAS após Cenário A (confirmação ou imagem), NÃO mais imediato após link. Item US mantido (escala imediato).
- [x] Step 3 — Refatorar `smoke-scar.mjs` pra multi-turn:
  - [x] Header atualizado D1-D9 + D7c + D7d com nota explicando suporte multi-turn (string OU array de messages)
  - [x] `messages: [...]` agora aceita `scenario.input` como string (single-turn, wrappa em user) OU array (multi-turn, usa literal)
  - [x] `console.log` IN renderiza `[role] content | [role] content` quando array
  - [x] **D7c** (`D7c_MudaPacote_v5`) — multi-turn 3 messages: cliente Essencial → assistant link Essencial → cliente "pensei melhor, quero o Premium". `pass_if`: linkPremium ✅ + noLinkEssencial + noFriction + notEscalated
  - [x] **D7d** (`D7d_ConfirmaPagamento_v5`) — multi-turn 3 messages: cliente Premium completo → assistant link → cliente "paguei!". `pass_if`: ackOrThanks + escalated + noDoubt. Critical=true.
- [x] Step 4 — Validar localmente:
  - [x] `npm run build` — PASS, zero erros TypeScript (Build correto após adição multi-turn no .mjs)
  - [x] `npm test` — PASS, 104/104 testes vitest (zero regressão — smoke é runtime, não unit)
  - [ ] `node --env-file=.env scripts/smoke-scar.mjs` — **NÃO rodou** (`fetch failed` por dívida D2: `.env` local aponta pra Supabase legado bloqueado). Não-impactante: smoke real roda na VPS pelo `@devops` pós-deploy (Step 8 do execution plan QA→Devops).

### Debug Log References

- Build: `npm run build` → exit 0 (TypeScript check OK)
- Tests: `npm test` → 104 passed em 13 test files, 3.71s
- Smoke local: pulado por D2 (Supabase legado no `.env` local — gap conhecido)
- Tamanhos finais: prompt.md 338 linhas (era 293 em v4, +15%), smoke-scar.mjs 392 linhas (era 320 em v4, +22%)
- md5 do arquivo prompt.md (com front-matter): `2c99f7220301c10809c52c8780ae0575`. md5 do `system_prompt` (sem front-matter, gray-matter parse) será diferente — `@devops` valida via `--dry-run` no seed VPS

### File List

**Modificados:**
- `docs/zenya/tenants/scar-ai/prompt.md` — v4 → v5 (front-matter + Regra §1 BR reescrita totalmente em 3 cenários A/B/C + sub-regra muda pacote + Regra §5 ajustada)
- `packages/zenya/scripts/smoke-scar.mjs` — header D1-D9+D7c+D7d, suporte multi-turn (`Array.isArray(scenario.input)`), display de input renderizado, 2 cenários novos D7c (muda pacote) + D7d (confirma pagamento), ambos com 3 messages multi-turn

**Não-modificados (referência/contexto apenas):**
- `docs/zenya/tenants/scar-ai/feedback-gustavo-20260425-evening.md` (input)
- `.aiox/handoffs/handoff-pm-to-dev-20260425-scar-payment-links-02.yaml` (input — marcar consumed=true)

### Completion Notes

- **Mudanças cirúrgicas — preservou v4 intacto exceto Regra §1 BR + Regra §5.** Tom de voz, Idioma + Consistência (v2), Camadas Qualificação 1-4 (v3), Catálogo (pacotes + avulsas), Prazos, Formas de pagamento (v4), seção Links de Pagamento (v4), Objeções §1-§4, Regras Críticas §2/§3/§4/§6/§7/§8 — **literalmente intactos** em v5.
- **Regra §1 BR reestruturada em "Passos do fechamento" + "3 cenários pós-link" + "Sub-regra muda pacote".** Estrutura visual com headers (## **Passos**, ## **Cenário A/B/C**) ajuda LLM a parsear o fluxo. Cada cenário tem sinais de detecção concretos.
- **Lista de 13 palavras-chave para Cenário A** (paguei, fechei, transferi, comprovante, acabei de pagar, feito, pago, pix enviado, pix feito, pagamento feito, tá pago, concluído, pronto, pode começar). Cobre variações naturais brasileiras. Case-insensitive.
- **Edge case attachment de imagem** integrado ao Cenário A com mensagem condicional ("vou conferir e o Gu já te chama no grupo se tiver tudo certo"). Sem multimodal vision, é o melhor que conseguimos — Gustavo verifica no Cakto.
- **Sub-regra muda pacote** com tom imperativo ("NUNCA pressione", "NUNCA peça pra cliente confirmar repetidas vezes", "NUNCA chame escalarHumano apenas porque cliente trocou de ideia"). Padrão PLAKA/Scar v3 de "tom imperativo > instrucional" mantido.
- **Smoke multi-turn — refactor mínimo (~15 linhas).** Aceita string OU array sem quebrar API existente. D1-D9 single-turn continuam funcionando idênticos.
- **D7c valida 4 critérios:** link Premium correto + ausência de link Essencial + ausência de fricção (regex contra "tem certeza?", "confirma de novo", "você (já) disse essencial") + ausência de escalação prematura. Pass exige TODOS.
- **D7d valida 3 critérios:** ack/agradecimento + escalação + ausência de dúvida (regex contra "tem certeza que pagou", "consegue mostrar", "manda o comprovante", "me manda print"). Critical=true (regressão aqui é grave).
- **Smoke local bloqueado por dívida D2** — mesmo gap das 3 stories anteriores Scar. Smoke produção rolará na VPS pelo `@devops`.

### Change Log

- **2026-04-25 (dev)** — Implementação completa do prompt v5 + smoke multi-turn estendido + Dev Agent Record. Build PASS + 104 testes PASS. Smoke local bloqueado por dívida D2 (não-impactante). Status → Ready for Review. Próximo handoff: `@qa` gate (em `handoff-dev-to-qa-20260425-scar-payment-links-02.yaml`).

---

## QA Results

### Review 2026-04-25 — `@qa` (Quinn)

**Verdict:** **PASS with observations**
**Gate file:** [`docs/qa/gates/scar-payment-links-02.yml`](../qa/gates/scar-payment-links-02.yml)

#### Resumo

Mudanças cirúrgicas, padrão PLAKA + Scar v3/v4 mantidos. Os 2 fixes do feedback noturno do Gustavo
implementados conforme spec: Regra §1 BR reestruturada com 3 cenários condicionais (A confirma /
B silêncio / C "vou pagar mais tarde") + sub-regra "muda pacote" com 3 NUNCAs explícitos.
Cliente US preservado intacto. Regra §5 mais restritiva (escala APENAS após Cenário A).

Smoke estendido com refactor multi-turn (backwards compat preservada) + D7c (4 critérios) +
D7d (3 critérios + critical=true).

Build PASS + 104/104 testes pass (zero regressão). Smoke local não rodou por dívida D2 (mesmo
gap das 3 stories Scar anteriores) — smoke produção é obrigatório pelo @devops.

#### Checks (todos PASS)

| Check | Resultado | Notas |
|-------|-----------|-------|
| Code review | ✅ PASS — Tom imperativo nas regras (PERMANEÇA, NÃO chame, NUNCA pressione). 13 palavras-chave para Cenário A. Edge case attachment imagem com mensagem condicional diferenciada. Sub-regra muda pacote com 3 NUNCAs. |
| Unit tests | ✅ PASS — 104/104 vitest, zero regressão |
| Acceptance criteria | ✅ PASS — 7/10 ACs validáveis aqui (8-10 post-deploy/Gustavo) |
| No regressions | ✅ PASS — Verificação tripla: (1) diff confirma seções v4 intactas, (2) Cliente US preservado, (3) refactor multi-turn é backwards compat |
| Performance | ✅ PASS — +15% linhas (~+8% tokens). Aceitável |
| Security | ✅ **MELHORIAS** — §5 mais restritiva, defesas explícitas no prompt, smoke D7c/D7d com gates programáticos contra regressão |
| Documentation | ✅ PASS — Story com Dev Agent Record completo. Front-matter v5 com changelog. Comentários inline no smoke. Lista de palavras-chave inline (não dispersa) |

#### Anti-patterns das memórias `feedback_*` — todos respeitados

- ✅ `feedback_test_from_source` — D7c/D7d derivados dos 2 issues reais do Gustavo, multi-turn fiel ao caso real
- ✅ `feedback_llm_simulates_tool` — 3 NUNCAs explícitos na sub-regra muda pacote + tom imperativo "PERMANEÇA NA CONVERSA"
- ✅ `feedback_prompt_iteration_reveals` — escopo cirúrgico, preservou tudo o que funcionava em v4
- ✅ `feedback_errors_can_hide_bugs` — D7d critical=true exige escalation correta (defesa contra escalação prematura por dúvida)
- ✅ `feedback_exploratory_then_retroactive_aiox` — modo exploratório autorizado + formalização retroativa feita
- ✅ `feedback_process_integrity` — desvio do SDC documentado e justificado, trilha completa preservada

#### Observations (3 low-severity, não-bloqueantes)

- **scar-payment-links-02-01** (testing) — Smoke local não-executado por dívida D2 (mesmo gap das 3 stories Scar anteriores). Smoke produção **obrigatório** pelo @devops.
- **scar-payment-links-02-02** (prompt-design) — Lista de 13 palavras-chave pode gerar falsos-positivos sutis em contextos específicos (ex: "feito", "pronto", "pode começar" em frases interrogativas). LLM contextual deve desambiguar; refinamento desejável em v6 se emergirem queixas reais.
- **scar-payment-links-02-03** (process) — 2ª iteração consecutiva em modo exploratório hoje (scar-payment-links-01 + 02). Próxima v6 (se houver) deve voltar ao SDC formal salvo nova urgência justificada.

#### Handoff

→ `@devops` (Gage). Comando: push + deploy + seed VPS + smoke produção.
Handoff yaml em `.aiox/handoffs/handoff-qa-to-devops-20260425-scar-payment-links-02.yaml`.

#### Pós-handoff

1. `@devops` executa branch + commit + push + PR + merge + deploy VPS + seed dry-run + seed real + pm2 reload + smoke produção
2. Smoke produção: 10/10 PASS esperado (ou 9/10 com D7b REPL 404 aceito). **D7c e D7d são novos críticos do v5 — DEVEM passar.**
3. Mauro coordena re-teste manual do Gustavo nos 3 sub-fluxos:
   - Muda pacote (Essencial → Premium) → link Premium sem fricção
   - Confirma pagamento ("paguei!") → agradece + escala
   - Silêncio depois do link → Scar NÃO escala automaticamente
4. Gustavo confirma OK → fechar `scar-payment-links-02` + `scar-payment-links-01` + `17.2` + `scar-ai-onboarding-01` parent (todas Done)

— Quinn, guardião da qualidade 🛡️
