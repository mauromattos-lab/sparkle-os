# Smoke Report — HL Importados pré-cutover (2026-04-22)

**Executor:** @dev (Dex)
**Timebox:** iniciado ~15h, concluído ~16h BRT (dentro da janela pré-23h)
**Estratégia:** smoke offline com tools mockadas (foco no comportamento do LLM; API UltraCash já coberta por 11 unit tests + teste de conexão real em 20/04)

## Resultado final

```
RESUMO: 7/7 passaram (0 crítico(s) falho(s))
```

✅ **Cutover autorizado a prosseguir às 23h BRT hoje** com prompt v2.

---

## Cenários executados

| # | Cenário | Input | Mock mode | Crítico | Verdict |
|---|---------|-------|-----------|---------|---------|
| 1 | `HL1_Recepcao` | "oi, tudo bem?" | — | ✓ | ✅ PASS |
| 2 | `HL2_BuscaIphone_ComEstoque` | "quanto tá o iphone 12 pro?" | in-stock | ✓ | ✅ PASS (warn: `citouExtras=false` — não mencionou 18x/garantia) |
| 3 | `HL3_ProdutoNaoEncontrado` | "tem Samsung Galaxy S25 Ultra aí?" | not-found | ✓ | ✅ PASS (warn: ofereceu encomenda sem escalar imediato — aceitável, pois escala viria após confirmação do cliente) |
| 4 | `HL4_FalarHumano_Imediato` | "quero falar com alguém da loja" | — | ✓ | ✅ PASS com prompt v2 (v1 FALHOU) |
| 5 | `HL5_PedidoDesconto` | "dá um desconto aí? tô meio apertado" | — | ✓ | ✅ PASS |
| 6 | `HL6_PerguntaSeEhIA` | "você é um robô?" | — | ✗ | ✅ PASS |
| 7 | `HL7_Encomenda` | "queria uma cafeteira Nespresso Vertuo nova, vocês têm?" | not-found | ✗ | ✅ PASS |

---

## Iteração crítica — HL4 prompt v1 → v2

### v1 FAIL (primeira execução)
- Agente chamou `escalarHumano` corretamente
- **Mas pulou a mensagem 🔄 obrigatória** de repasse antes da tool
- Resposta foi genérica: *"Seu atendimento já está sendo direcionado para um dos nossos atendentes..."*

### Root cause
Contradição interna no prompt:
- **Regra 3 (REGRAS INVIOLÁVEIS):** "Se o cliente pedir para falar com alguém da loja → chame escalarHumano imediatamente, sem perguntar motivo"
- **Passo 5.5 (MENSAGEM OBRIGATÓRIA):** "SEMPRE envie esta mensagem ao cliente ANTES de chamar a ferramenta escalarHumano — nunca pule essa etapa"

GPT-4.1 priorizou "imediatamente" da regra 3 e ignorou o passo 5.5.

### Fix aplicado (prompt v2)
1. **Regra 3 reescrita** pra explicitar a sequência:
   > "dispare a sequência de handoff imediatamente, SEM perguntar motivo. SEQUÊNCIA OBRIGATÓRIA: (1) envie a mensagem 🔄 de repasse descrita no PASSO 5.5 → (2) SÓ DEPOIS chame a ferramenta escalarHumano. Nunca pule a mensagem, mesmo em pedido urgente."

2. **Passo 5.5 reforçado** como "REGRA INVIOLÁVEL" com sequência numerada explícita + lista de gatilhos (falar com humano, desconto, reclamação).

### v2 PASS
- Agente agora usa `enviarTextoSeparado` pra mandar 🔄 ANTES, **depois** chama `escalarHumano`
- Funciona em ambos os cenários que escalam (HL4 e HL5)

---

## Warns residuais (não bloqueantes)

### HL2 — `citouExtras=false`
Agente informou preço certo mas não mencionou espontaneamente "parcelamento em 18x" ou "garantia de 3 meses pros seminovos". Classificação: **nice-to-have**, não bloqueia cutover. Pode virar ajuste menor no prompt pós-produção se Hiago reportar.

### HL3 — `escalou=false`
Agente ofereceu encomenda ("posso verificar a possibilidade de trazer sob encomenda") mas não invocou `escalarHumano` na mesma mensagem. Comportamento aceitável: o prompt sugere escalar **após** coletar detalhes do pedido especial. Smoke considerou PASS porque a oferta de encomenda já cumpre o objetivo.

### HL4 — `nao_insistiu=false` (falso positivo do classificador)
Classificador foi `!/qual|motiv|por qu[eê]|razão/i`. A mensagem 🔄 contém "Motivo do repasse" (template do prompt), então o regex disparou. **Bug do classificador, não do bot.** Na prática o bot não insistiu por motivo algum — escalou direto com a mensagem 🔄.

---

## Lições pro Epic 15 v2 (retroalimentar playbook)

1. **Smoke offline com tools mockadas é padrão válido** quando a tool já tem unit tests robustos. Ganho: reproducibilidade, sem dependência de credenciais. Deve entrar no playbook como alternativa ao smoke com API real.

2. **Contradição interna no prompt é risco comportamental sistêmico.** O mesmo padrão (regra imperativa contradizendo passo operacional) pode existir nos prompts de PLAKA, Fun, Scar. **Ação pro Epic 17:** revisar prompts dos outros 3 tenants em busca de contradições similares.

3. **Concern 16-3-01 (Julia — aviso antes de escalar) pode ter a mesma raiz.** A Fun usou padrão semelhante ao prompt HL v1. Vale re-testar com smoke derivado pra confirmar se Julia também se beneficiaria do fix v2.

4. **Agente usa `enviarTextoSeparado` pra cumprir "mensagem antes de tool"** — insight valioso. Documentar no playbook que esse pattern (separar mensagem de cortesia + tool call) é esperado.

---

## Status final

| Item | Estado |
|------|--------|
| Código (`integrations/ultracash.ts`) | ✅ Na main desde commit `1382286` |
| Unit tests | ✅ 11/11 (`ultracash.test.ts`) |
| Smoke end-to-end (`smoke-hl.mjs`) | ✅ 7/7 após prompt v2 |
| Prompt v2 | ⏳ Precisa push via @devops antes do cutover 23h |
| Seed scripts | ✅ Prontos (`seed-hl-tenant.mjs`, `seed-hl-ultracash.mjs`) |
| Runbook cutover | ✅ `docs/stories/hl-onboarding-01/CUTOVER-RUNBOOK.md` |

## Próximo passo

@dev entrega bastão pro @devops:
- Commit do prompt v2 + smoke-hl.mjs + este relatório
- @devops faz push + PR + merge (timing: até ~22h pra dar margem)
- @devops executa runbook de cutover às 23h
- Prompt v2 é seedado no banco **durante** o cutover (`seed-hl-tenant.mjs` lê do `.md` atualizado)
