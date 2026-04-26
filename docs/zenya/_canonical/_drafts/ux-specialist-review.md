# UX Specialist Review — Brownfield Zenya

**Versão:** 0.1 (Draft, Brownfield Discovery Fase 6)
**Autora:** `@ux-design-expert` Uma
**Data:** 2026-04-25
**Inputs consolidados:**
- Cap. 1 v0.2 — System Architecture (Aria, Fase 1 + correções Fase 2/3)
- Cap. 2 — Schema & Data (Dara, Fase 2)
- Frontend Spec (eu mesma, Fase 3 — 3 personas + 9 princípios + 10 anti-patterns)
- Tech Debt Draft (Aria, Fase 4 — 28 dívidas em waves)
- DB Specialist Review (Dara, Fase 5 — 8 TDs aprovados, 6 migrations propostas)
- Decisões Mauro (5/5 elicitations resolvidas + 5 questões refinadas)

> Esta review **valida ou refina** as propostas técnicas das Fases 4-5 pela ótica das 3 personas: cliente final no WhatsApp, agente humano no Chatwoot, dono via canal admin. Foco em: TD-04 (lembretes), TD-07 (`/reset`+label), TD-08 (burst), TD-22 (observabilidade); Frontend D-P/D-Q/D-R/D-T. Plus cross-cutting: padronização de tom no template canônico.

---

## §1 — Sumário executivo

### Decisões UX por item

| Item | Status | Refinamento UX | Impacto persona |
|------|--------|----------------|-----------------|
| **TD-04** Lembretes proativos derivados | ✅ Aprovado em conceito | **Adicionar 4 sub-decisões UX:** tom do lembrete, timing por procedimento, comportamento se cliente cancela após disparo, indicador de "esta é mensagem automática vs conversa" | Persona 1 (cliente) |
| **TD-07** `/reset` + label | ✅ Aprovado o fix técnico Dara | Adicionar **mensagem clara** ao cliente sobre o que aconteceu — não basta "Memória zerada"; explicar que label foi removida | Persona 1 (test mode) + Persona 2 |
| **TD-08** Burst admin filter | ⚠️ Refinar threshold | **Threshold = 60 segundos pós-boot** (não menor) + log do que foi filtrado pra Mauro auditar | Persona 3 |
| **TD-22** Observabilidade | ✅ Aprovado schema Dara | **Definir quais perguntas Persona 3 deve poder fazer**; calibrar densidade da resposta (≤2 msgs) | Persona 3 |
| **Frontend D-P** Visibilidade do porquê escalation auto | ✅ Aprovado private_note | Refinar **conteúdo** do private note (template) | Persona 2 |
| **Frontend D-Q** Aviso label expirando 72h | ⚠️ **Recomendo descartar** — UX overhead alto, cicatriz fraca | Pendente decisão | Persona 2 |
| **Frontend D-R** Ações operacionais admin | ✅ Aprovado em conceito | **Roadmap UX em 3 fases** (leitura → consulta complexa → ação) | Persona 3 |
| **Frontend D-T** Convenções de tom | ✅ Aprovado consolidação | **Template canônico** (Cap. 8a) define defaults; tenant override só com motivo explícito | Cross-persona |

### Achados novos da Fase 6 (5 itens)

| # | Achado | Severidade | Persona |
|---|--------|-----------|---------|
| **UX-1** | Mensagem de "Memória zerada" não diferencia se label `agente-off` foi removida | P2 (junto com TD-07) | Persona 1 |
| **UX-2** | Bot revela vibe artificial em momentos transitórios (audio fallback pra texto) | P2 | Persona 1 |
| **UX-3** | Não há indicador visual no Chatwoot de qual prompt version está rodando — atendente não sabe se feedback foi aplicado | P1 | Persona 2 |
| **UX-4** | Persona 3 não tem feedback claro do que aconteceu quando ferramenta admin falha (silenciosa) | P2 | Persona 3 |
| **UX-5** | Lembretes proativos podem disparar conversa "do nada" pro cliente — UX ambígua se cliente já mudou de status (resolveu sozinho, cancelou, etc.) | **P1** novo | Persona 1 |

---

## §2 — Review item por item

### §2.1 TD-04 — Lembretes proativos derivados (Wave 3) ⭐

**Diagnóstico aprovado:** princípio P9 do Frontend Spec (`feedback_automation_over_input`) está sólido. Dara propôs worker PM2 dedicado lendo Calendar + dispatch via Chatwoot/Z-API. Tecnicamente sound.

#### 4 sub-decisões UX que faltam ser tomadas

##### Sub-decisão 1 — Tom do lembrete

Propostas de microcopy pro **caso Thainá (micropigmentação)**:

| Tipo | Tom robótico (❌) | Tom Zenya (✅) |
|------|--------------------|----------------|
| Lembrete T-24h | "Lembrete: agendamento amanhã 14h. Confirme." | "Oi! Tudo bem? Só passando pra confirmar sua sessão amanhã (terça) às 14h, beleza? Qualquer mudança me avisa por aqui 🩵" |
| Lembrete T-2h | "Lembrete: agendamento em 2h." | "Daqui a pouco te espero hein 😊 Estou no endereço {endereço}, confirma que tá tudo certo?" |
| Manutenção +15 dias | "Lembrete: manutenção sobrancelha." | "Oi! Já fazem 15 dias da sua sessão de sobrancelha — esse é o momento ideal pra agendar a manutenção. Quer que eu já te mostre os horários?" |

**Princípio:** o lembrete deve **se sentir como continuação natural da conversa anterior**, não como notificação de sistema. Tom igual ao do bot atendendo, com identidade do tenant (cada tenant configura microcopy no SOP).

**Implicação técnica:** os 3 templates ficam em `zenya_tenants` ou em arquivo separado por tenant (ex: `docs/zenya/tenants/{slug}/reminders.md`). Decisão arquitetural pra Aria/Dara: prompt SOP do tenant tem campo `reminders_microcopy` ou tabela separada `zenya_tenant_reminders`?

##### Sub-decisão 2 — Timing padrão e exceções

| Tipo | Default sugerido | Configurável por tenant? |
|------|-----------------|--------------------------|
| Pré-agendamento "véspera" | T-24h (mas no horário comercial — não 14:00 do dia anterior se sessão é 14:00, sim 09:00 do dia anterior pra dar tempo de cancelar/confirmar) | Sim (alguns tenants podem querer T-48h) |
| Pré-agendamento "véspera próxima" | T-2h | Sim (Doceria que tem retirada talvez T-30min) |
| Manutenção pós-procedimento (caso Thainá) | Por tipo: sobrancelha 15d, lábios 20d (config no onboarding) | **Sim — obrigatório** (varia por tipo) |

**Decisão UX:** janela "T-X horas" deve ser **calculada relativa ao horário comercial do tenant** (`HORÁRIO DE ATENDIMENTO HUMANO` no SOP). Lembrete às 03h da madrugada é desastre UX — silenciar entre 22h-08h cross-tenant default.

##### Sub-decisão 3 — Comportamento se cliente cancela/altera após disparo

Cenário: Maria marcou pra terça 14h. Worker disparou lembrete T-24h na segunda 09h. Maria cancelou na segunda 11h pelo WhatsApp.

**O que acontece com lembrete T-2h da terça?**

| Opção | UX | Implementação |
|-------|-----|---------------|
| **A** Worker re-checa Calendar antes de cada disparo | ✅ Limpa | Worker faz `freebusy.query` pré-disparo; se evento removido/alterado, skip |
| **B** Worker só checa no schedule inicial | ❌ Lembrete fantasma chega | Cliente recebe lembrete de algo que ele já cancelou — ranço |

**Decisão:** **Opção A** — re-check obrigatório. Custo: 1 chamada extra ao Calendar por lembrete. ROI: zero lembrete fantasma.

##### Sub-decisão 4 — Indicador "mensagem automática vs conversa"

Cliente recebe lembrete proativo. Pode responder no WhatsApp como se fosse conversa normal:

| Resposta cliente | Comportamento bot |
|------------------|-------------------|
| "Beleza, vou estar lá!" | Bot processa como mensagem normal — agente analisa contexto + agradece + encerra naturalmente |
| "Posso remarcar pra quinta?" | Bot processa como pedido de reagendamento — usa tool Calendar pra mostrar janelas |
| "Não vou conseguir" | Bot processa como cancelamento — usa tool Calendar pra cancelar + confirma + (opcional) sugere remarcar |

**Decisão UX:** lembretes **abrem conversa normalmente** — não há flag especial "estou em modo lembrete". Bot trata cada resposta como mensagem regular do cliente. Isso é coerente com **P9** (automação derivada): o bot já tem todo contexto de Calendar + history pra processar a resposta corretamente.

**Risco identificado (UX-5 da Fase 6):** se cliente marcou consulta há 1 mês, ignora todos os lembretes, **e** responde "como remarcar?" 1 hora antes do horário, o bot precisa processar contexto temporal corretamente (não "remarcar pra quando?", mas "vamos remarcar a sua sessão de hoje 14h?"). Princípio P2 (releia histórico) cobre, mas vale **smoke específico** pra validar.

#### Esforço UX adicional (sobre o esforço técnico Dara)

S — meio dia: documentar microcopy templates + smoke específico de "cliente responde lembrete".

---

### §2.2 TD-07 — `/reset` + label `agente-off` (Wave 1)

**Estado atual** (validado em `webhook.ts:241-248`):
- `/reset` só funciona em test mode (`allowed_phones.length > 0`)
- Limpa `zenya_conversation_history` da sessão
- Envia "🔄 Memória zerada. Nova conversa!"
- **NÃO** remove label `agente-off`

**Cicatriz:** Gustavo (Scar AI test mode 2026-04-24) ficou travado — `/reset` não destravou a label aplicada por Mauro pra parar bot.

**Fix técnico Dara aprovado:** chamar `removeAgenteOffLabel` antes de `clearHistory`.

#### Refinamento UX (Achado UX-1)

A mensagem atual `"🔄 Memória zerada. Nova conversa!"` é **insuficiente** quando label foi removida. Cliente em test mode não sabe **se o bot voltou a atender** ou se ele ainda precisa fazer algo. Propostas:

| Cenário | Mensagem proposta |
|---------|-------------------|
| `/reset` + tinha `agente-off` | "🔄 Memória zerada e bot reativado. Pode mandar nova mensagem!" |
| `/reset` + não tinha `agente-off` | "🔄 Memória zerada. Nova conversa!" (atual) |

**Implementação:** condicional simples — após `removeAgenteOffLabel` retornar, decidir mensagem:

```typescript
const hadLabel = await removeAgenteOffLabel(chatwootParams);  // retorna boolean
await clearHistory(config.id, phone);
const msg = hadLabel
  ? '🔄 Memória zerada e bot reativado. Pode mandar nova mensagem!'
  : '🔄 Memória zerada. Nova conversa!';
await sendMessage(chatwootParams, msg);
```

#### Cross-persona — afeta também Persona 2

Quando `/reset` remove label `agente-off`, **atendente humano que estava acompanhando a conversa no Chatwoot precisa saber que o bot voltou**. Hoje, atendente vê apenas a label sumir — sem aviso explícito.

**Proposta:** após remover label, postar **`private_note`** (Chatwoot — só atendente vê) com:
> *"Bot reativado pelo cliente via /reset. Histórico de conversa zerado."*

**Esforço UX adicional:** trivial — 1 chamada extra de `sendPrivateNote` quando `hadLabel === true`.

---

### §2.3 TD-08 — Burst admin filter (Wave 1)

**Cicatriz Mauro:** pareou Z-API → Z-API sincronizou histórico recente → cada msg virou webhook → admin agent respondeu rajada de "Hoje: 1 conversa iniciada...".

**Fix técnico Dara:** filtrar `payload.created_at < (process.boot + threshold)` no admin agent.

#### Refinamento UX — threshold

| Threshold | UX | Risco |
|-----------|-----|-------|
| 5s | ❌ Muito agressivo — Mauro mandando exatamente no segundo do boot é filtrado | Falso positivo |
| 30s | ⚠️ Bom mas Z-API às vezes demora mais que isso pra sync | Falsos positivos remanescentes |
| **60s** | ✅ Seguro — sync típico Z-API < 30s; 60s dá folga | Mauro mandar dentro de 60s do boot é raríssimo |
| 5min | ❌ Muito lento — Mauro testando feature pós-deploy fica filtrado | Mauro reclama |

**Decisão UX: 60 segundos**, com **2 garantias adicionais**:

##### Garantia 1 — Log do que foi filtrado

```typescript
// admin-agent.ts pre-process
const bootGracePeriodMs = 60 * 1000;
const ageMs = Date.now() - (payload.created_at * 1000);
if (ageMs < 0 || ageMs > bootGracePeriodMs) {  // só filtra se mensagem é DO PASSADO recente
  // não filtra
} else if (payload.created_at * 1000 < processBootTime + bootGracePeriodMs) {
  console.log(`[admin] FILTERED burst — created_at=${payload.created_at}, age=${ageMs}ms`);
  return; // skip
}
```

> Mauro pode ver no `pm2 logs zenya-webhook | grep FILTERED` se algum dia ele suspeitar que mensagem real foi filtrada.

##### Garantia 2 — Mensagens do PRESENTE nunca filtradas

Filtro só se aplica a mensagens com `created_at` mais antigo que o boot do processo (= sync histórico). Mensagem nova com `created_at = Date.now()` jamais é filtrada, mesmo nos primeiros 60s.

**Esforço:** trivial (já incluso na proposta Dara).

---

### §2.4 TD-22 — Observabilidade core (Wave 3)

**Schema técnico Dara aprovado:** `zenya_execution_log` (granular) + `zenya_ai_usage_daily` (rollup).

#### Pergunta UX-chave: o que Persona 3 (dono) deve poder perguntar?

Hoje, admin tem 3 tools: `consultar_metricas`, `listar_conversas_abertas`, `listar_escaladas`. Ficam aquém. Listei o que dono típico pergunta na operação real (extraído de minha leitura do material + 9 fluxos do dono OP-1 a OP-9):

| Pergunta natural do dono | Tool admin proposta | Schema necessário |
|--------------------------|---------------------|-------------------|
| "Quantas conversas hoje?" | ✅ `consultar_metricas` (existe) | — |
| "Quanto tô gastando de IA esse mês?" | **Nova: `consultar_custo_mensal`** | `zenya_ai_usage_daily` |
| "Qual conversa tá demorando mais pra resolver?" | **Nova: `listar_conversas_lentas`** | `zenya_execution_log` (calc duration) |
| "O bot escalou muito hoje? Qual o motivo principal?" | **Nova: `listar_escalacoes_motivos`** | `zenya_execution_log` (escalation_source + tools_invoked) |
| "Em quais perguntas o bot mais erra?" | **Nova (sofisticada): `listar_falhas_recentes`** | `zenya_execution_log` (status='error' + agrupar por padrão) |
| "Quem é o cliente que mais mandou mensagem essa semana?" | **Nova: `listar_top_clientes`** | `zenya_execution_log` (group by phone_number) |
| "Qual a taxa de resolução do bot esse mês?" (% que NÃO escalou) | **Nova: `consultar_taxa_resolucao`** | `zenya_execution_log` (escalation_triggered count) |

#### Refinamento UX — densidade na resposta admin

Princípio P1 (densidade ≤2 msgs/turno) **vale também pra admin agent**. Hoje a tool retorna JSON estruturado e o LLM compõe resposta. Risco: admin pergunta "quantas conversas hoje?" e LLM manda 4 mensagens com detalhamento desnecessário.

**Recomendação:** prompt admin ganha regra explícita de densidade:
> *"Responda com 1-2 mensagens curtas. Se a tool retornou muitos dados, pergunte ao admin qual recorte interessa mais (ex: 'quer ver o top 5 ou todos?'). Nunca despeje JSON ou listas longas."*

#### Refinamento UX — tom admin

Admin agent atual: *"Você é a Zenya em modo admin. Responda de forma objetiva e direta com as métricas e informações solicitadas. Seja concisa..."*

**Adicionar:**
> *"Você fala com o dono do negócio, que confia no bot. Não seja excessivamente formal nem polida — seja como uma assistente competente que conhece a operação. Se o admin pede dado e você sabe que ele provavelmente vai querer perguntar mais, antecipe (ex: 'Hoje 15 conversas, 12 resolvidas, 3 escaladas. Quer ver os 3 escalados?')."*

#### Esforço UX adicional

S — 2-4h: definir microcopy admin + smoke 5-7 cenários de perguntas reais (validar que admin não despeja JSON).

---

### §2.5 Frontend D-P — Visibilidade do "porquê" da escalation auto (Wave 2)

**Cenário:** humano da equipe da Julia abre Chatwoot, vê conversa com label `agente-off`. **Por que** o bot escalou? Hoje pra saber, atendente lê 50 mensagens da conversa. UX ruim.

**Fix proposto na Fase 3:** `private_note` automático no Chatwoot quando `escalateToHuman` é chamado, especificando origem.

#### Refinamento UX — conteúdo do private note

Template proposto:

```
🤖 [Zenya] Escalado para humano
Origem: {tool | human-reply | reset}
Tenant: {nome do tenant}
Cliente: {phone} | {nome se conhecido}
Tools usadas neste turn: {lista de tools, sem args sensíveis}
Última mensagem do cliente: "{conteúdo, max 100 chars}"
Versão do prompt: v{X} (md5 {primeiros 7 chars})
```

**Por que incluir versão do prompt:** atendente vê e entende imediatamente qual prompt está rodando. Se ele identifica padrão de bug, sabe relatar pro Mauro com versão exata. Conecta com **achado UX-3** abaixo.

**Implementação (Story candidata):**
- Adicionar coluna `system_prompt_version` em `zenya_tenants` (texto livre, ex: "v3")
- `escalation.ts` ganha função `buildEscalationPrivateNote(ctx)` chamada após adicionar label
- `sendPrivateNote(chatwootParams, content)` posta como nota interna

**Esforço:** S — 2-3h.

---

### §2.6 Frontend D-Q — Aviso label expirando 72h ⚠️ recomendo descartar

**Proposta original (Frontend Spec Fase 3):** notificação ou label visual transitória "auto-cleanup em 4h" pra avisar atendente que bot vai voltar.

**Análise UX revisada:**

| Argumento contra | Razão |
|------------------|-------|
| Cicatriz fraca | Não há registro de incidente "atendente perdeu contexto porque label sumiu" |
| Auto-cleanup 72h é raro na prática | Maioria das conversas é resolvida pelo humano em <24h e ele remove label manualmente |
| Adicionar UI/notificação ao Chatwoot fork = custo alto | Chatwoot fork fazer.ai não é nosso código — modificar UI exige fork-no-fork |
| Solução alternativa zero-custo: comunicar via canal admin | Quando label vai expirar, admin agent pode ser alertado proativamente (Wave 3 capacidade) |

**Recomendação:** **descartar D-Q da lista de dívidas.** Marcar como "**candidato pra Epic 11 — Capacidades Globais**" se algum dia surgir cicatriz real. Mover pra backlog não-prioritário.

---

### §2.7 Frontend D-R — Persona 3 sem ações operacionais (Wave 3)

**Proposta:** tools admin novas: pausar bot por conv X, agendar campanha, atualizar prompt rápido.

#### Refinamento UX — roadmap em 3 fases

| Fase | Capacidades | Esforço | Princípio |
|------|-------------|---------|-----------|
| **R-Fase 1 — Leitura aprofundada** | `consultar_custo_mensal`, `consultar_taxa_resolucao`, `listar_escalacoes_motivos` (já em TD-22) | M | Dono entende a operação antes de agir |
| **R-Fase 2 — Consulta complexa** | `buscar_conversa_por_nome` (cruzar phone↔nome), `historico_cliente_X` (todas as conversas dele) | M | Dono pega caso específico antes de agir |
| **R-Fase 3 — Ações** | `pausar_bot_conversa_X`, `reativar_bot_conversa_X`, `marcar_lead_quente`, `solicitar_atualizacao_prompt` | L | Dono age com contexto |

**Princípio UX:** **leitura precede ação**. Dono não pode pausar bot numa conversa que ele nem sabe que existe. Sequência R-Fase 1 → 2 → 3.

**Plus — princípio P9 (`feedback_automation_over_input`):** muitas dessas "ações" deveriam ser **automatizações derivadas** ao invés de ações manuais:
- `marcar_lead_quente` → bot detecta sinais de lead quente automaticamente (palavras-chave, comportamento) e marca; admin só vê e revisa
- `solicitar_atualizacao_prompt` → bot detecta padrão de feedback negativo e abre issue automaticamente

A **R-Fase 3 (ações)** deveria ser muito enxuta — só pra casos onde automação não funciona.

#### Esforço

L — 4-7 dias R-Fase 1; M-L — 3-5 dias R-Fase 2; M — 2-3 dias R-Fase 3 minimal.

---

### §2.8 Frontend D-T — Convenções de tom no template canônico (Wave 0)

**Decisão Mauro 2026-04-25:**
- Densidade ≤2 msgs/turno (cross-tenant default)
- Emoji livre (cross-tenant default), opt-out por tenant via SOP

**Pergunta aberta:** o que mais entra no **template canônico** do SOP de tenant?

#### Proposta — template canônico v1 (vai pro Cap. 8a)

```markdown
# Template Canônico — SOP de tenant Zenya

## Defaults inviolável (P1-P9 do canon)
- Densidade: ≤2 mensagens por turno (90% dos casos), max 3
- Emoji: permitido, com moderação. Use pra acolher, não pra encher.
- Tom imperativo > descritivo nas regras críticas
- Sempre releia histórico antes de perguntar
- Chame ferramenta + envie mensagem ao cliente NO MESMO turno (escalations)
- Mirror áudio↔texto (default; cliente pode forçar via ferramenta)
- Nunca invente dados — escale na dúvida
- Nunca revele que é IA, exceto se perguntado diretamente

## Estrutura obrigatória do SOP

### PAPEL
- Nome do bot (cada tenant escolhe — Roberta, Gê, Scar, Zenya, ...)
- Empresa
- Canal (sempre WhatsApp)

### PERSONALIDADE E TOM DE VOZ
- Características-chave (3-5 adjetivos)
- Vocabulário (formal/informal, jargão setorial)
- Política de emoji (se override do default)
- Política de idioma (se multilíngue como Scar)

### INFORMAÇÕES DA EMPRESA
- Site, redes sociais
- Políticas-chave (devolução, garantia, prazos)
- Horário de atendimento humano

### SOP — Procedimento Operacional Padrão
- Fluxo 1: abertura
- Fluxo 2-N: específicos do tenant
- Fluxo N+1: encaminhamento humano

### REGRAS CRÍTICAS
- Densidade (override default se necessário)
- Releia histórico (sempre presente, com exemplo ❌/✅)
- Outras regras anti-pattern conhecidas (LLM simula tool, etc.)

### HORÁRIO DE ATENDIMENTO HUMANO
- Dias e horários
- Mensagem fora-de-horário
```

**Esforço:** S — 2h pra Aria materializar no Cap. 8a.

---

## §3 — Achados secundários da Fase 6

### UX-2 — Bot revela vibe artificial em fallback áudio→texto

**Cenário:** cliente manda áudio. Bot tenta responder áudio. ElevenLabs falha. Bot manda texto silenciosamente (fallback).

**Problema UX:** cliente esperava áudio, recebeu texto. Não há aviso. Vibe artificial — bot que normalmente responde áudio "perde a voz" sem explicar.

**Proposta UX:**
- Se fallback acontece, primeira mensagem texto começa com: *"(estou tendo um probleminha com a voz, vou responder por texto)"* — único nesse turno
- Próximos turnos do mesmo cliente, se ele volta a mandar áudio, tenta áudio de novo (não fica preso em modo texto)

**Esforço:** S — 1h em `agent/index.ts` linha 102-110 (catch do generateAudio).

**Severidade:** P2 — não é crítico (cliente recebe a resposta), mas erode confiança na consistência.

### UX-3 — Sem indicador de versão do prompt no Chatwoot

**Cenário:** atendente Julia vê bot agindo estranho numa conversa. Não sabe se prompt foi atualizado essa semana, qual versão está rodando, se o issue dela já foi corrigido em versão posterior.

**Proposta UX:** já incluída no D-P refinement (private note de escalation inclui `Versão do prompt: vX`). **Esforço: trivial** (incluso em D-P).

**Adicional opcional:** quando atendente abre conversa com `agente-off`, ver no header da conversa um chip ou badge "Bot v3" — mas isso depende do Chatwoot fork. Pra agora, **basta o private note**.

### UX-4 — Persona 3 sem feedback claro quando tool admin falha

**Cenário:** Mauro pede "Quantas conversas hoje?". `fetchConversationStats` falha (Chatwoot 500). Tool retorna `{erro: "..."}` (admin-agent.ts linha 115). LLM compõe resposta tipo "tive um problema, tenta de novo depois".

**Problema UX:** Mauro não sabe **se foi erro temporário ou se a feature está quebrada**. Tom de erro é vago.

**Proposta UX:**
- Tool retorna `{erro: "...", retry_recommended: bool}` em vez de só `erro`
- Prompt admin ganha regra: *"Quando tool retorna erro, distinga: temporário (sugira tentar de novo) vs permanente (sugira ao admin reportar pro Mauro)."*

**Esforço:** S — 2h em `admin-agent.ts` + prompt admin.

**Severidade:** P2.

### UX-5 — Lembrete proativo + cliente que mudou de status

Já documentado em §2.1 sub-decisão 4. Smoke específico necessário.

---

## §4 — Cross-cutting: padronização de tom no template canônico

> Esta seção alimenta diretamente Cap. 8a (template canônico) que Aria materializa na Fase 8.

### Defaults universais (não-negociáveis)

São os 9 princípios P1-P9 do Frontend Spec. **Replicar literal** no Cap. 8a.

### Defaults configuráveis por tenant (no SOP)

| Decisão | Default | Override por SOP? | Override técnico (DB column)? |
|---------|---------|-------------------|--------------------------------|
| Densidade ≤2 msgs/turno | sim, default cross-tenant | Sim — tenant pode reforçar (≤1) ou afrouxar (≤3 com justificativa) | Não |
| Emoji policy | livre/moderado | Sim — opt-out total ("Nunca emojis") como Scar | Não |
| Idioma | PT-BR | Sim — multilíngue como Scar (PT/EN) | Não |
| Mirror áudio↔texto | ativo | Não (cross-tenant invariante) | Não — mas contato pode setar `preferencia_audio_texto` |
| `escalation_public_summary` | TRUE | Não (é flag de código) | **Sim** (`zenya_tenants.escalation_public_summary`) |
| Densidade do admin agent | ≤2 msgs/turno | Não (regra fixa do prompt admin) | Não |
| Lembretes proativos (TD-04) | desligado | Sim — opt-in por tenant ao seedar `active_tools: ['reminders']` ou similar | **Sim** (provável nova flag) |
| Janela manutenção pós-procedimento (caso Thainá) | n/a | Sim — tenant configura mapping procedimento→dias no onboarding | **Sim** (`zenya_tenants.maintenance_windows JSONB`) |

### Pattern: quando flag em DB vs regra em SOP?

| Cenário | Local |
|---------|-------|
| Comportamento que **muda shape de tool** ou afeta código | DB column (ex: `escalation_public_summary`) |
| Comportamento que **muda só tom/conteúdo** do output | SOP regra |
| Configuração derivada que **alimenta worker** (lembrete) | DB column |
| Personalidade do bot (nome, vibe) | SOP regra |

---

## §5 — Sequência recomendada da Wave 1 — perspectiva cliente-impact

Dara propôs sequência técnica (TD-06 → TD-07 → TD-08 → TD-01 → TD-02). Eu valido pela perspectiva de **impacto cliente final** (princípio cross-tenant: nenhuma mudança pode degradar UX do cliente sem aviso).

| Ordem Dara | TD | Impacto cliente | Risco UX |
|------------|-----|-----------------|----------|
| 1 | TD-06 lock TTL | Cliente que tinha lock órfão volta a poder atender → **melhoria** | Zero risco |
| 2 | TD-07 reset+label | Cliente em test mode (= apenas Mauro/admins hoje) destrava → **melhoria pra admin** | Zero risco — não afeta clientes finais |
| 3 | TD-08 admin burst | **Sem impacto cliente** — só Persona 3 (Mauro) | Zero |
| 4 | TD-01 KB sync | PLAKA quando Roberta atualizar planilha — bot terá info atualizada → **melhoria latente** | Zero (PLAKA está pré-deploy) |
| 5 | TD-02 queue leak | **Maior impacto cliente** — fix garante que mensagem nova nunca fica em limbo | Médio: smoke de path de erro precisa cobrir áudio/Chatwoot fail |

**Validação UX da sequência:** ✅ aprovada. Os primeiros 4 TDs são zero-risco pra UX cliente. TD-02 entra por último porque carrega **smoke completo de path de erro** — paths que hoje estão silenciosamente quebrados. Tempo extra de smoke (cf. Dara 2-3 dias) é justificado.

### Recomendação adicional Uma — smoke da Wave 1

Cada TD ganha smoke cliente-impact específico **antes do deploy**:

| TD | Smoke obrigatório |
|----|-------------------|
| TD-06 | Acquire lock + crash simulado + acquire de novo (deve sucesso) |
| TD-07 | Test mode tenant + admin aplica `agente-off` + cliente envia `/reset` + verifica label removida + bot responde próxima |
| TD-08 | Boot de novo zenya-webhook + simular sync Z-API (mensagens com `created_at < boot+60s`) + verificar admin não responde rajada + Mauro manda mensagem real (created_at = now) → admin responde |
| TD-01 | Forçar mudança em planilha PLAKA + esperar 15-20min + verificar `last_synced_at` atualizado + verificar bot consulta KB com info nova |
| TD-02 | 5 cenários: tenant inexistente / test-mode-skip / Whisper falha / Chatwoot 5xx / race burst → todos resultam em `done` ou `failed`, **zero pending** |

---

## §6 — Resumo executivo das mudanças vs Tech Debt Draft

### Aprovações sem mudança

- TD-04 (lembretes proativos derivados) — princípio P9 sólido
- TD-07 (`/reset` + label) — fix técnico Dara aprovado
- TD-22 (observabilidade) — schema Dara aprovado

### Refinamentos UX adicionais sobre o Tech Debt Draft

- TD-04: 4 sub-decisões UX (microcopy, timing, cancelamento, indicador)
- TD-07: mensagem ao cliente diferenciada + `private_note` pro atendente (UX-1)
- TD-08: threshold = 60s + log de filtrados + garantia "presente nunca filtrado"
- TD-22: 7 perguntas naturais de Persona 3 → 7 tools admin novas; densidade ≤2 vale pra admin agent
- D-P: template do `private_note` com versão do prompt (UX-3 cobre)
- D-R: roadmap em 3 fases (leitura → consulta → ação) com princípio P9 atravessando

### Recomendação de descarte

- **D-Q (aviso label expirando 72h):** descartar — cicatriz fraca, custo alto. Mover pra backlog não-prioritário.

### Achados novos da Fase 6 catalogados

- UX-1 (mensagem `/reset` insuficiente) — incluso em refinement TD-07
- UX-2 (vibe artificial fallback áudio→texto) — P2 novo
- UX-3 (sem indicador versão do prompt) — incluso em refinement D-P
- UX-4 (persona 3 sem feedback claro de erro tool) — P2 novo
- UX-5 (lembrete + cliente mudou status) — incluso em refinement TD-04

---

## §7 — Próximas fases

Esta review desbloqueia:

- **Fase 7 (Quinn — QA Gate):** input completo agora — Cap. 1 v0.2 + Cap. 2 + Frontend Spec + Tech Debt Draft + DB Specialist Review + esta UX Specialist Review. Quinn aplica os 6 critérios de sucesso §3 do briefing
- **Fase 8 (Aria — Final Assessment + Template Canônico):** consume tudo acima + verdict de Quinn

**Handoff de retorno** pra Aria em `.aiox/handoffs/handoff-ux-design-expert-to-architect-20260425-fase6-return.yaml` com sumário das decisões + recomendação de descarte de D-Q + 5 achados novos UX-1 a UX-5.

### Prerequisites pra Fase 7 (Quinn) ✅ todos atendidos

- [x] Cap. 1 v0.2 corrigido (organs/zenya, Epic 10 InProgress parcial)
- [x] Cap. 2 publicado (schema validado, Migration 008 aplicada)
- [x] Runtime Drift Audit completo
- [x] Frontend Spec publicado (3 personas, 9 princípios, 10 anti-patterns)
- [x] Tech Debt Draft consolidado (28 dívidas em waves)
- [x] DB Specialist Review (8 TDs aprovados, 6 migrations 009-014 propostas)
- [x] UX Specialist Review (este doc — TDs UX validados, 5 achados novos)

---

*UX Specialist Review — Brownfield Zenya, Fase 6, 2026-04-25.*
*Decisões consolidadas: 7 TDs UX aprovados (com refinements), 1 recomendado descartar (D-Q), 5 achados novos catalogados (UX-1 a UX-5). Template canônico v1 proposto pra Fase 8 (Aria).*
