# Frontend Spec — UX da Zenya

**Versão:** 0.1 (Draft, Brownfield Discovery Fase 3)
**Autora:** `@ux-design-expert` Uma
**Data:** 2026-04-25
**Pergunta-mãe:** *"Como as 3 personas da Zenya experimentam o sistema, e quais patterns governam essa experiência?"*

> ⚠️ **A Zenya não tem UI tradicional.** A "interface" é a mensagem trocada — texto ou áudio — entre 3 personas distintas em 3 canais distintos. UX da Zenya é **patterns conversacionais** (tom, timing, densidade, escalação), não componentes visuais.
>
> Atomic Design aplicado aqui não é "Atom = Button". É **Atom = uma frase de saudação**, **Molecule = sequência de qualificação**, **Organism = fluxo completo de venda/SAC**, **Template = SOP de tenant**, **Page = uma conversa real ponta-a-ponta**.
>
> Este doc alimenta o **Capítulo 6 — Owner Playbook** (na consolidação Fase 8) e parte do **Capítulo 5 — Test Strategy & Variants** (validação de comportamento conversacional).

---

## §1 — As 3 personas e os 3 canais

| # | Persona | Canal | Identidade técnica | Volume real (7d) |
|---|---------|-------|---------------------|------------------|
| **1** | **Cliente final** | WhatsApp do tenant (via Z-API ↔ Chatwoot) | `payload.sender.phone_number` ∉ `admin_phones` | 882 mensagens (Julia 738 + Doceria 68 + Prime 58 + Scar 18) |
| **2** | **Agente humano** | Chatwoot panel (UI) ou WhatsApp Business do dono (via Z-API mirror) | `payload.message_type === 'outgoing' && !sent_by_zenya` | Trigger de escalation (não medido — registrado por label `agente-off`) |
| **3** | **Dono / proprietário do negócio** | WhatsApp dele → WhatsApp do tenant → `runAdminAgent` | `payload.sender.phone_number` ∈ `admin_phones` | Não medido (vive na queue do tenant) |

**Princípio fundamental:** as 3 personas **compartilham o mesmo canal técnico** (Chatwoot conversation), mas **nunca devem se confundir**. O webhook `worker/webhook.ts` é responsável pelo roteamento correto:

```
incoming + phone in admin_phones      → runAdminAgent (Persona 3)
incoming + phone in allowed_phones[]   → runZenyaAgent (Persona 1, modo teste)
incoming + sem allowed_phones          → runZenyaAgent (Persona 1, produção)
incoming + label 'agente-off'          → SKIP — Persona 2 está atendendo
outgoing + sent_by_zenya=false         → escalateToHuman (Persona 2 detectada)
outgoing + sent_by_zenya=true          → SKIP — é eco do próprio bot
```

---

## §2 — Princípios universais da experiência conversacional Zenya

> Estes 9 princípios atravessam **todos os tenants**. São invariantes do método. Cada um tem cicatriz documentada — não é teoria.

### P1 — Densidade ≤ 2 mensagens por turno (default cross-tenant)

Cliente no WhatsApp **não lê parede de texto**. Cinco mensagens em 60 segundos viram spam mesmo que cada uma seja boa isoladamente.

**Decisão Mauro 2026-04-25:** padronizar densidade BAIXA cross-tenant. *"Fica ruim de ler em qualquer contexto, e não adianta ela falar muito de uma vez — precisa conversar com a pessoa."*

**Regra canônica:** **≤ 2 mensagens por turno em 90% dos casos. Máximo absoluto: 3.** Tenants podem reforçar mais (≤ 1 em SAC ultra-direto), nunca afrouxar.

**Cicatriz:** Gustavo (Scar AI) testando em 2026-04-24, prompt v2 mandou 5 mensagens em ~60s no primeiro turno. Feedback explícito: "está direta demais". Fix v3 trouxe regra crítica §7. Ver `docs/zenya/tenants/scar-ai/feedback-gustavo-20260424.md`.

**Como se manifesta no código:**
- `message-chunker.ts` divide até 5 partes via gpt-4.1-mini
- Mas o **prompt de cada tenant** **deve** trazer regra explícita ≤ 2
- Pause de 1s entre chunks + `calcTypingDelay` por mensagem

**Aplicação:** template canônico do SOP (Cap. 8a) traz regra default. Tenants existentes que estão acima desse limite (Scar ≤ 3) ficam alinhados na próxima iteração de prompt.

### P2 — Releia histórico antes de perguntar

Repetir pergunta cuja resposta o cliente acabou de dar é o **erro mais grave** do atendimento conversacional. Sinaliza que o bot não está prestando atenção. Cliente que se sente ignorado **não fecha**.

**Cicatriz:** Gustavo turno 2 (2026-04-24): cliente disse *"Tô começando agora na twitch, faço gta rp"* — Scar respondeu *"Você já faz live? Qual plataforma usa?"*. Mesma cicatriz Roberta v2.2 PLAKA. Memória cross-tenant: `feedback_llm_simulates_tool.md` (subset desse problema).

**Como se manifesta no prompt:**
- Regra imperativa: *"Sempre releia o histórico antes de perguntar."*
- Exemplo ❌/✅ concreto no SOP (não basta dizer a regra)
- Hook por nicho específico mencionado: cliente diz *"GTA RP"* → bot puxa estética cyberpunk; cliente diz *"oxidação"* → bot puxa garantia 6 meses

**Validação:** smoke do tenant tem que ter cenário "cliente entrega 3 infos juntas no primeiro turno" — bot **não pode** repetir nenhuma.

### P3 — Tom imperativo > tom descritivo

LLM interpreta **"você pode"** como licença ampla. Interpreta **"você deve"** como instrução binding. Brando produz drift; rígido produz comportamento previsível.

**Cicatriz:** PLAKA v2 → v2.1 (2026-04-21). v2 afrouxou prompt buscando "fluidez"; resultado: `no-kb-call` triplicou (9.7% → 30.3%). Memória `feedback_prompt_iteration_reveals.md`. Mesmo padrão Fun v5 → v6 (instrução suave do `resumo_conversa` foi ignorada — fix migrou pro código com flag `escalation_public_summary`).

**Aplicação:** seções de regra crítica usam `OBRIGATORIAMENTE`, `DEVE`, `NUNCA`, `SEMPRE` em maiúsculas. Tom didático fica nas seções explicativas, não nas regras.

### P4 — Tool description vence regra de prompt — fix vai pro código

Quando o bot quebra uma regra do tenant prompt **e a regra contrária está na description de uma tool**, a description da tool **vence**. A description é re-apresentada a cada tool-call; o prompt de sistema fica "mais longe" no contexto.

**Cicatriz:** Julia (Fun) v5 → v6 (2026-04-23). Prompt v5 tentou proibir `resumo_conversa` estruturado via regra imperativa. LLM ignorou. Causa: `escalarHumano` description em `tool-factory.ts` **ordenava** `[ATENDIMENTO] ...` formato. Fix migrado pro código: flag `escalation_public_summary` (boolean por tenant). Quando false, factory **muda o shape da tool** (sem param `resumo`). Memória `feedback_tool_description_beats_tenant_prompt.md`.

**Aplicação no design system:**
- Quando capacidade vai contra description default → flag opt-in/opt-out por tenant em `zenya_tenants`
- Default preserva comportamento existente (não quebra outros tenants)
- Padrão: `escalation_public_summary` foi o primeiro caso. Próximas capacidades globais com variação seguem o mesmo padrão.

### P5 — LLM simula tool sem executar — fix dupla instrução

Quando prompt diz *"chame a ferramenta X ao fazer Y"*, LLM **pode** interpretar como *"mencione no texto que vai fazer X"* sem invocar de fato. Texto fica convincente — *"vou te encaminhar"* — mas side effect crítico (label `agente-off`, mensagem `[ATENDIMENTO]`) não acontece. Cliente fica abandonado.

**Cicatriz:** Roberta (PLAKA) v2.2, 2026-04-21. Cliente perguntou *"vocês fazem personalização com foto?"* → KB sem_match → bot escreveu *"vou te encaminhar para atendente"* e parou. Tool nunca foi invocada. Memória `feedback_llm_simulates_tool.md`.

**Fix que funciona (validado):**
1. **Regra imperativa**: *"VOCÊ DEVE INVOCAR a ferramenta X no MESMO turno"*
2. **Seção COMPORTAMENTO PROIBIDO** com ❌/✅:
   - ❌ *"Escrever 'vou encaminhar' e parar."*
   - ✅ *"Enviar mensagem ao cliente E invocar a ferramenta no mesmo turno."*
3. **Regra mental explícita**: *"Se você escreveu 'encaminhar/atendente/escalar/humano', OBRIGATORIAMENTE invoque a ferramenta. Sem exceção."*
4. **Explicar o porquê**: *"Sem a ferramenta, o atendente humano nunca vai saber que a conversa foi escalada — cliente fica abandonado."*
5. **Fallback código** (último recurso): `toolChoice` forçado via AI SDK.

**Aplicação:** toda tool com side effect crítico (escalation, pagamento, cancelamento, deleção, envio) ganha esse padrão no SOP do tenant.

### P6 — Mirror de formato áudio↔texto

Cliente que envia áudio recebe áudio. Cliente que envia texto recebe texto. **Default = mirror**. **Override = preferência explícita** salva em `Chatwoot contact.additional_attributes.preferencia_audio_texto`.

**Lógica em `agent/index.ts`:**
```typescript
const audioPref = await getContactAudioPreference(...);
const respondWithAudio =
  audioPref === 'audio' ||
  (audioPref === null && inputIsAudio === true);
```

**Fluxo de áudio:**
1. Cliente manda áudio → Chatwoot recebe → webhook trigger
2. `transcribeAudioUrl` (Whisper) → texto pra LLM
3. LLM gera resposta texto
4. `formatSSML` (gpt-4.1-mini) — strip markdown/emojis, adiciona `<break time="0.4s"/>` em pontuação forte
5. `generateAudio` (ElevenLabs `eleven_flash_v2_5`) → MP3 buffer
6. `sendAudioMessage` (multipart Chatwoot)
7. **Fallback**: se ElevenLabs falhar, `chunkAndSend` texto (cliente recebe a resposta, não silêncio)

**Indicador "gravando áudio"** durante geração via `setTypingStatus(params, 'on', 'recording')`.

**Tool `alterarPreferenciaAudioTexto`** disponível em **todos os tenants** — cliente pode forçar formato a qualquer momento.

### P7 — Aviso ao cliente no MESMO turno do `escalarHumano`

Quando o bot escala, o cliente **não pode ficar em silêncio**. Mesmo que o resumo público vá pra equipe (`[ATENDIMENTO]`), o cliente precisa ver mensagem direta dirigida a ele.

**Cicatriz:** Julia v2 fix (2026-04-22). Antes do fix, bot pedia CEP, recebia, e silenciosamente escalava — cliente esperando resposta sem saber que foi handoff. Fix: seção SOP inclui *"Antes de chamar `escalarHumano`, envie uma mensagem ao cliente avisando o handoff."*

**Padrão validado em PLAKA, Doceria, Scar, Fun:**
```
[Mensagem 1] "Já vamos te encaminhar para um atendente 🩵 Nosso atendimento humano é
              de Segunda a sexta, das 10h até 16h..."
[Mensagem 2] (tool escalarHumano invocada — passa label agente-off)
```

### P9 — Automação derivada > input manual (princípio inviolável)

A IA da Zenya **infere do contexto que ela já tem**, não pede ao dono pra duplicar input que o sistema poderia derivar sozinho. Pedir input manual onde a IA poderia derivar é traição da promessa do produto.

**Decisão Mauro 2026-04-25** (literal): *"se tiver que colocar lembrete manualmente acaba perdendo o sentido de ter a IA capaz disso. (para esses casos, em uma assistente talvez fizesse sentido)."*

**Aplicação concreta — caso lembretes proativos:**
- ❌ **Errado:** dono cadastra cada lembrete (cliente X, data Y, texto Z) via WhatsApp ou UI
- ✅ **Certo:** worker periódico lê agendamentos no Google Calendar do tenant → dispara lembretes em janelas pré-definidas (ex: T-24h, T-2h) → texto gerado a partir do evento (data, horário, tipo)

**Exceção legítima:** quando o dado **não pode** ser derivado do contexto. Caso Thainá (micropigmentação): **janela de manutenção pós-procedimento varia por procedimento** (sobrancelha ≈ 15 dias, lábios ≈ 20 dias, etc.). Esse mapeamento *procedimento → janela* não está em lugar derivável — precisa ser configurado no **onboarding** (uma vez por tenant), não em cada agendamento. Pattern: configuração one-time é OK; configuração por evento não é.

**Como aplicar em design de tools/features novas:**
1. Antes de propor "tool de cadastro X" → perguntar "que dado a IA já tem que poderia derivar X?"
2. Se 100% derivável → tool é AUTOMATIZAÇÃO (worker, cron), não input
3. Se parcialmente derivável → input só pra parte não-derivável, e UMA vez (onboarding/preferências), não recorrente
4. Se nada derivável → input legítimo, mas avaliar se o produto precisa mesmo dessa feature

**Anti-pattern correlato:** "ferramenta de assistente pessoal" (cadastrar lembrete arbitrário) é diferente de "atendente IA" (lembrete derivado de operação do negócio). A Zenya é a segunda. Não vire a primeira sem decisão estratégica.

### P8 — Resposta concisa não invente, escale na dúvida

Quando o bot **não sabe**, ele não inventa — escala. Inventar valor de bolo, prazo de entrega, horário, dado de pedido sem consultar API → cliente recebe info errada → reclamação grave.

**Aplicação:** todo tenant tem regra `Não invente {dados}` e tool de consulta + escalação. Tipo: `Buscar_pedido_Nuvemshop` (PLAKA), `Detalhar_pedido_por_numero` (Fun), `consultarKBSheets` (PLAKA), `buscarJanelasDisponiveis` (Calendar). Sem retorno positivo → escalation.

---

## §3 — Persona 1: Cliente final (WhatsApp)

### 3.1 Quem é

Pessoa real que mensageia o WhatsApp Business do tenant. **Não sabe que está falando com IA** (regra cross-tenant: *"Nunca revele que é IA, a menos que o usuário pergunte diretamente"*). Vive em ambiente de baixa atenção (notificações, multitarefa). Lê em chunks curtos, responde com 1 linha ou áudio rápido.

### 3.2 Variações por tenant (paleta de tons)

| Tenant | Persona | Tom | Emojis? | Densidade SOP | Natureza |
|--------|---------|-----|---------|--------------|----------|
| **PLAKA** | Roberta | Simpática, acolhedora, "atendente jovem bem-treinada" | ✅ `🩵 😊 ✨` | (sem regra explícita — herda P1) | SAC e-commerce semijoias |
| **Doceria** | Gê | Próximo, caloroso, "jeitinho acolhedor" | ✅ (parece moderado) | Máx 2 msgs/turno | Encomendas + vitrine artesanal |
| **Fun** | Zenya | Despojada, leve, prática, "loja criativa" | ✅ (presente, não excessivo) | Máx 2 em 90% (regra v2) | Loja personalizados festas |
| **Scar AI** | Scar | Informal mano, próximo, seguro | ❌ **NUNCA** (regra explícita) | ≤ 3 msgs/turno (regra v3) | Venda consultiva overlays streamers |
| **Zenya Prime** | Zenya | Profissional, empática, objetiva | (default base) | (herda base) | Atendimento interno SparkleOS |

> **Insight de método:** o tenant define `personalidade` no SOP. O **core não impõe tom** — só estrutura (P1-P8). Por isso a Zenya pode atender SAC de semijoias E venda consultiva de design de overlays no mesmo dia, no mesmo código.

### 3.3 Ciclo de vida de uma conversa

```
┌────────────────────────────────────────────────────────────────────┐
│ CHEGADA                                                            │
│  • Primeira msg do dia → bot saúda com identidade do tenant        │
│  • PLAKA: "Oi! Tudo bem? 😊 Quem fala aqui é a Roberta..."         │
│  • Scar:  "Fala mano, tranquilo? Vi que você chamou aqui..."       │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ DECODIFICAÇÃO DE INTENÇÃO                                          │
│  • PLAKA: dúvida produto / pedido específico / reclamação?         │
│  • Doceria: pedido bolo / vitrine / informação?                    │
│  • Scar: lead novo / objeção / pronto pra fechar?                  │
│  → cada tenant tem fluxos numerados (FLUXO 1, 2, ...) no SOP       │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ EXECUÇÃO (variantes)                                               │
│  A. Resposta direta (KB hit, info no prompt)                       │
│  B. Consulta API + resposta (Nuvemshop/UltraCash/LojaIntegrada)    │
│  C. Qualificação consultiva (Scar 4 camadas)                       │
│  D. Coleta dados (CEP, número pedido, CPF) antes de avançar        │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ RESOLUÇÃO ou ESCALATION                                            │
│  • Resolução: cliente sai satisfeito, conversa fica aberta         │
│  • Escalation explícita (regra crítica): cliente pede pessoa OU    │
│    bot detecta gap (sem KB match, fora escopo, reclamação grave)   │
│  • Escalation implícita: humano responde direto pelo WhatsApp do   │
│    dono (Z-API mirror) → bot detecta `outgoing && !sent_by_zenya`  │
│    → adiciona label agente-off automaticamente                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ PÓS-ESCALATION                                                     │
│  • Bot fica em silêncio (label `agente-off` ativa)                 │
│  • Conversa idle 72h → label removida automaticamente              │
│    → próxima msg do cliente reativa o bot                          │
│  • Humano remove label manualmente → bot volta a atender           │
└────────────────────────────────────────────────────────────────────┘
```

### 3.4 Patterns de timing percebidos

| Sinal | Implementação | Percepção do cliente |
|-------|---------------|----------------------|
| **Read receipt (✓✓ azul)** | `markConversationRead` ao iniciar processamento | "Bot viu minha mensagem" — instantâneo |
| **"digitando..."** | `setTypingStatus(on, 'typing')` durante LLM call | Bot está "pensando" — fim do silêncio entre webhook e resposta |
| **"gravando áudio..."** | `setTypingStatus(on, 'recording')` durante TTS | Resposta vai vir em áudio — preparar fone |
| **Typing delay por chunk** | `calcTypingDelay` = 60×chars/4.5/150 (cap 25s) | Bot "digita" cada msg em ritmo humano (~150 wpm) |
| **Pause 1s entre chunks** | `await sleep(1000)` em chunkAndSend | Mensagens separadas, não rajada |
| **Debounce 2.5s** | `ZENYA_DEBOUNCE_MS` antes do agente | Cliente que mandou 3 mensagens rápidas → bot responde uma vez agregada (não 3 respostas separadas) |

**Tempo total esperado** (cliente percebe):
- Resposta texto curta (1 chunk): ~3-5s (debounce 2.5s + LLM ~1s + chunk delay ~0.5s + send ~0.5s)
- Resposta texto longa (3 chunks): ~12-18s
- Resposta áudio: ~10-25s (LLM + SSML + ElevenLabs + upload)

### 3.5 Modos especiais

**Modo teste (`allowed_phones` populado):**
- Apenas números listados recebem resposta
- Outros são silenciosamente ignorados (SEM mensagem de erro)
- Comando `/reset` disponível → limpa `zenya_conversation_history` da sessão
- Bug conhecido (D5): `/reset` **não** limpa label `agente-off` no Chatwoot — cliente pode ficar travado

**Modo `agente-off`:**
- Bot **silenciado** pra essa conversa
- Cliente continua mensageando — Chatwoot mostra normalmente, mas webhook ignora
- Humano (no Chatwoot ou pelo celular) responde diretamente
- Auto-cleanup: 72h sem mensagem do agente → label removida → bot volta

---

## §4 — Persona 2: Agente humano (Chatwoot + WhatsApp Business)

### 4.1 Quem é

Atendente da equipe do tenant. Pode ser:
- **Atendente dedicado no Chatwoot** (Mauro Prime, equipe Plaka, equipe Doceria)
- **Próprio dono atendendo direto pelo celular do tenant** (Julia, Hiago, Gustavo, Ariane) — neste caso tem WhatsApp Business pareado via Z-API, e mensagens dele aparecem como `outgoing` no Chatwoot

### 4.2 Como ele recebe sinal de "preciso atender"

**3 caminhos** — em ordem de visibilidade:

#### Caminho A — Mensagem pública `[ATENDIMENTO] ...` na conversa (default)

Quando `zenya_tenants.escalation_public_summary = TRUE` (default), a tool `escalarHumano` recebe um parâmetro `resumo` que vira **mensagem pública na conversa**. Cliente também vê.

Exemplo (PLAKA):
```
[ATENDIMENTO] Cliente Manuela Padula (CPF 467.426.738-26) relatou oxidação no
pedido #58177, feito em 20/04 e já enviado (rastreio 888030674501140). Já expliquei
que a garantia é de 6 meses e ela quer falar com a equipe para acionar a troca.
Pedido dentro do prazo de garantia.
```

**Por que pública e não privada (Chatwoot tem `private_note`):**
- Funciona pra equipe que atende **só pelo WhatsApp** (sem Chatwoot panel)
- Funciona pra dono que pega conversa pelo celular dele (mirror Z-API)
- Cliente vê o resumo — handoff transparente, mas em contrapartida o resumo precisa ser bem escrito ("linguagem humana e profissional")
- Convenção: começa com `[ATENDIMENTO]` pra preview visível

#### Caminho B — Escalation silenciosa (opt-in por tenant)

`zenya_tenants.escalation_public_summary = FALSE` → tool `escalarHumano` **muda de shape** (sem param `resumo`). Bot escala apenas com label, sem mensagem pública. Cliente nem percebe que escalou — só percebe que o tom mudou na próxima resposta.

**Caso real:** Julia (Fun, account 5). Reportou desconforto com `[ATENDIMENTO]` aparecendo na conversa do cliente final ("parece log técnico"). PR #9 introduziu a flag. Default preservado pros outros tenants.

#### Caminho C — Auto-detecção em human-reply

Humano responde **direto pelo Chatwoot panel ou pelo celular do dono** (sem passar pelo bot). Webhook detecta:

```typescript
if (payload.message_type === 'outgoing' && !sent_by_zenya) {
  // Humano assumiu — adicionar label automaticamente
  await escalateToHuman({ source: 'human-reply', /* sem summary */ });
}
```

**Efeito**: o ato de responder já vira o sinal. Próxima mensagem do cliente nessa conversa não passa pelo bot.

### 4.3 Como ele reativa o bot

| Caminho | Ação | Latência |
|---------|------|----------|
| **Manual via Chatwoot UI** | Remover label `agente-off` | Imediato |
| **Auto-cleanup 72h idle** | Worker `agente-off-cleanup.ts` (setInterval 1h) checa: se conversa não teve mensagem de agente nos últimos 72h, remove label | Até 1h |

**Bug conhecido (D5):** `/reset` no modo teste não limpa label. Cliente em test mode com label `agente-off` aplicada por Mauro fica travado — `/reset` zera história mas bot continua silencioso. Precisa de fix: `/reset` chamar `removeAgenteOffLabel` antes de `clearHistory`.

### 4.4 Gaps de UX da Persona 2 (não-implementados)

| Gap | Impacto | Proposta |
|-----|---------|----------|
| **Sem visibilidade do "porquê" da escalation** | Caminho C (auto human-reply) não deixa rastro do motivo | Adicionar `private_note` na conversa: "*Escalado automaticamente — humano respondeu via X*" |
| **Sem aviso de label expirando 72h** | Bot volta sem aviso, atendente perde contexto | Notificação ou label visual "auto-cleanup em 4h" |
| **Sem histórico das ações do bot** | Atendente que pega conversa não sabe quais tools foram chamadas | `additional_attributes` na conversa com array de tools recentes (ou aproveitar `console.log` que já existe) |
| **Sem indicação de modo do tenant** | Atendente não sabe se conversa está em test mode (whitelist) | Label `testando-agente` (já existe convenção, mas não automática) |

---

## §5 — Persona 3: Dono / proprietário do negócio (canal admin)

### 5.1 Quem é

Pessoa que **manda do próprio celular pessoal pro número do WhatsApp do tenant**. Phone está em `zenya_tenants.admin_phones`. Recebe tratamento especial: roteado pra `runAdminAgent` (não cliente flow).

**Hoje em produção (validado Q3 Fase 2):**
- Zenya Prime: Mauro
- Julia (Fun): Julia + Mauro
- Doceria: Mauro
- Scar AI: Mauro + Gustavo
- PLAKA: Isa
- HL: (vazio — bug conhecido, esperado popular Mauro+Hiago)
- Ensinaja: (não-aplicável — tenant não seedado)

### 5.2 Patterns conversacionais admin

**Saudação:** personalizada via `admin_contacts.name`:
- *"Você está falando com Mauro."*
- *"Você está falando com Julia."*

**Tom:** objetivo, conciso, técnico. *"Você é a Zenya em modo admin... Seja concisa — o admin está consultando pelo WhatsApp, não quer respostas longas."*

**Sem KB cliente, sem fluxos de venda.** Admin agent é **utilitário**, não consultivo.

**Histórico isolado:** chave de sessão é `admin:{phone}` (não `{phone}` puro). Admin **não vê** mensagens do cliente final no histórico do agente — e vice-versa.

### 5.3 Tools do admin agent (3 hardcoded)

| Tool | O que faz | Side effect |
|------|-----------|-------------|
| `consultar_metricas` | Hoje × Abertas × Resolvidas × Escaladas (Chatwoot API) | 4× GET /conversations |
| `listar_conversas_abertas` | Lista até N conversas abertas com nome + tempo | 1× GET conversations?status=open |
| `listar_escaladas` | Lista conversas com label `agente-off` ativa | 1× GET conversations?labels[]=agente-off |

**Resposta sai pelo mesmo pipeline áudio/texto** (mirror, ElevenLabs).

### 5.4 Gaps de UX da Persona 3 (catalogados pra Cap. 6 / Epic 18)

| Gap | Impacto |
|-----|---------|
| **Sem ações operacionais** — só leitura | Dono não consegue "pausar bot pra conv X", "agendar campanha", "dropar histórico de cliente Y", "atualizar prompt rapidamente" pelo canal admin |
| **Métricas básicas** | Sem custo OpenAI por dia, sem tendência semanal, sem satisfação, sem tempo médio até escalation |
| **Burst no pareamento Z-API** (cicatriz D6 do Cap. 1) | Z-API sincroniza histórico recente → cada mensagem vira webhook → admin agent responde **rajada** de "Hoje: 1 conversa..." Esperado tecnicamente, ruim UX |
| **Sem cliente-finder** | "Quanto pedidos do João Silva?" — admin não consegue cruzar nome ↔ phone |
| **Sem painel pra pendências** | "Quais conversas estão idle há mais de 30min com agente-off?" — exigiria tool nova |

### 5.5 Capacidade prometida mas não implementada (D4 do Cap. 1)

**Lembretes proativos (cron outbound)** — contrato Thainá Oliveira (2026-04-25, micropigmentação) cláusula 1.2 promete a capacidade. Não existe worker no core que leia agendamentos do tenant e dispare WhatsApp via Z-API.

**Persona afetada na promessa:** cliente final (recebe lembrete *"Sua sessão é amanhã às 14h, confirma?"*).
**Persona que opera a capacidade:** dono (define lembrete + horário) → admin canal seria a forma natural de configurar.

**Implicação UX:** o canal admin precisa ganhar capacidade de **agendar lembretes** pra atender essa categoria de tenant.

---

## §6 — Padrões transversais de fluxo (Atomic Design conversacional)

### 6.1 Atoms (frases canônicas)

| Atom | Quando usar | Exemplo |
|------|-------------|---------|
| **Saudação** | Primeira mensagem do dia | *"Oi! Tudo bem? 😊 Quem fala aqui é a Roberta..."* |
| **Reconhecimento de info** | Cliente entrega dado | *"Massa, Twitch + GTA RP tem uma vibe própria."* |
| **Pergunta de qualificação** | Mapear contexto | *"O que você sente que tá faltando hoje no visual do teu canal?"* |
| **Aviso de handoff** | Antes de tool escalation | *"Já vamos te encaminhar para um atendente 🩵..."* |
| **Aviso fora-do-horário** | Outside `horario-atendimento` | *"...nosso atendimento humano é de seg-sex 8h-18h. Vamos te retornar amanhã cedo."* |
| **Não invente, vou verificar** | Bot não sabe → escalation | *"Deixa eu confirmar com a equipe — já te aviso!"* (Doceria) |

### 6.2 Molecules (sequências de 2-3 atoms encadeados)

| Molecule | Composição | Tenant exemplo |
|----------|-----------|----------------|
| **Qualificação consultiva** | Reconhecimento + Pergunta dor + Pergunta contexto | Scar 4 camadas |
| **Coleta antes de escalar** | Pergunta dado (CPF/pedido/CEP) + Confirma dado + Aviso handoff + Tool | PLAKA fluxo "falar com atendente" |
| **Resposta KB** | KB lookup + Resposta literal + Pergunta-âncora | PLAKA com `consultarKBSheets` |
| **Saudação + identificação** | Saudação + "Sou a {Persona}" + Convite a perguntar | Default cross-tenant |

### 6.3 Organisms (fluxos completos)

| Organism | Padrão | Tenants |
|----------|--------|---------|
| **SAC e-commerce** | Saudação → KB-first → Pedido específico (consulta API) → Coleta dados → Resolve OU escala | PLAKA, Fun |
| **Venda consultiva** | Saudação → 4 camadas (dor, contexto, estilo, oferta) → Catálogo ancorado → Objeções → Fechamento → Escala | Scar |
| **SAC artesanal/agenda** | Saudação → Decodifica intenção (vitrine vs encomenda vs info) → Coleta dados → Confirma com humano (vitrine) ou agenda | Doceria |
| **Lead-gen + agenda** | Saudação → Qualifica → Apresenta serviço → Agenda Calendar → Lembrete proativo (futuro) | Thainá (futuro), Doceria |

### 6.4 Templates (tenant SOP estrutura)

Template canônico do SOP de tenant (validado em 5+ tenants):

```markdown
---
tenant: {slug}
version: N
updated_at: YYYY-MM-DD
author: ...
sources: [...]
notes: |
  Histórico de mudanças
---

# PAPEL
<papel>Quem é o bot, nome, empresa, canal</papel>

# PERSONALIDADE E TOM DE VOZ
<personalidade>Tom, vocabulário, público-alvo, emoji-policy</personalidade>

# INFORMAÇÕES DA EMPRESA
<informacoes-empresa>Contato, produtos/serviços, links, políticas</informacoes-empresa>

# SOP — PROCEDIMENTO OPERACIONAL PADRÃO

## 1. FLUXO DE ATENDIMENTO
### 1.1 Abertura
### 1.2 Encaminhamento humano (com regras P5+P7)

## 2. ESCOPO
### Dentro do escopo
### Fora do escopo

## 3-N. FLUXOS ESPECÍFICOS
(produtos, pedidos, agenda, etc.)

# REGRAS CRÍTICAS
(densidade P1, releia histórico P2, tom imperativo P3, dupla instrução P5,
horário humano, não invente P8)

# HORÁRIO DE ATENDIMENTO HUMANO
(seg-sex 8h-18h, retorno fora horário)
```

### 6.5 Pages (conversa real ponta-a-ponta)

Não documentadas inline aqui — exemplos vivos em:
- `docs/zenya/tenants/scar-ai/feedback-gustavo-20260424.md` (cicatriz real)
- Logs `pm2 logs zenya-webhook` em produção (não persistidos formalmente)
- Memórias `feedback_*` capturam padrões emergentes

---

## §7 — Anti-patterns documentados (com cicatrizes)

> Cada anti-pattern tem cicatriz específica em produção. Sem cicatriz, é especulação.

### A1 — Apresentar oferta antes de qualificar dor

**Cicatriz:** Scar v2 (2026-04-24) mandou portfólio no turno 1. Gustavo: *"vira cara de catálogo, não de consultor"*. Fix v3: 4 camadas obrigatórias antes da Camada 4 (oferta).

**Aplicação cross-tenant:** templates de venda consultiva precisam de "qualificação obrigatória antes de catálogo". Templates SAC podem ir direto à informação (cliente já sabe o que quer).

### A2 — Mensagens em rajada (5+ por turno)

**Cicatriz:** Scar v2 mandou 5 mensagens em 60s. Gustavo: spam. Fix v3: regra crítica densidade ≤3.

**Padrão de fix:** **regra de densidade obrigatória em todo SOP**. Validar via smoke ("cliente manda 1 mensagem → bot deve responder com ≤2-3").

### A3 — Repetir pergunta cuja resposta já foi dada

**Cicatriz:** Gustavo turno 2 (2026-04-24). Cliente disse "tô começando agora na twitch, faço gta rp" → Scar perguntou "você já faz live? Qual plataforma?". Mesmo padrão Roberta.

**Padrão de fix:** regra crítica + exemplo concreto ❌/✅. Detectar via smoke "cliente entrega 3 infos juntas".

### A4 — LLM simula tool sem invocar

Já detalhado em P5. Cicatriz Roberta v2.2.

### A5 — Description de tool venceu prompt

Já detalhado em P4. Cicatriz Julia v5→v6.

### A6 — Afrouxar prompt sem medir → drift silencioso

**Cicatriz:** PLAKA v2 (2026-04-21). v1 era 100% rígido KB-first. v2 afrouxou pra "fluidez". Resultado: `no-kb-call` triplicou (9.7% → 30.3%). Memória `feedback_prompt_iteration_reveals.md`.

**Padrão de fix:** **toda mudança de tom (rígido→suave)** exige smoke pós-mudança comparando vs. baseline. Tom imperativo > descritivo (P3).

### A7 — Inventar dados (data, preço, prazo, estoque)

**Cicatriz:** Julia v6→v7 (2026-04-24). Tool retornou *"Pedido #15361 — Enviado (06/04/2026)"* onde a data era `data_criacao` (do pedido), não data de envio. Bot interpretou como data de envio. Cliente recebeu info errada.

**Padrão de fix:** quando tool retorna dado ambíguo, **prompt explícito sobre o que NÃO mencionar** ("não cite data em mensagem de pedido enviado"). Alternativa: tool retorna dado **menos ambíguo** (não retornar `data_criacao` em status `enviado`).

### A8 — Ofuscamento de identidade (revelar IA quando perguntado)

**Cross-tenant:** todo SOP tem regra "não revele que é IA, a menos que o usuário pergunte diretamente". Defaults cumprem isso por design (tom natural). Mas LLM **pode** vazar ("como modelo de linguagem..."). Validar via smoke "cliente pergunta 'você é robô?'".

### A9 — Misturar idiomas no mesmo turno (caso multilíngue)

**Cicatriz:** Scar v1→v2 (2026-04-22). Bot detectou inglês na 1ª msg, mas resposta misturou *"Hey!"* + *"Me conta..."* no mesmo turno. Smoke D2 detectou. Fix v2: regra crítica idioma 100% consistente.

**Aplicação:** tenants multilíngues (Scar PT/EN) precisam regra explícita de consistência. Tenants monolíngues herdam por default.

### A10 — Burst de mensagens no pareamento Z-API

**Cicatriz:** Mauro pareou QR e recebeu rajada de "Hoje: 1 conversa iniciada..." (2026-04-24). Z-API sincronizou histórico recente → cada msg virou webhook → admin agent respondeu cada uma. Esperado tecnicamente, UX ruim.

**Fix proposto** (D6 Cap. 1): filtrar `payload.created_at < (process.boot + threshold)` no admin agent.

---

## §8 — Variantes de teste por tipo de tenant

(Alimenta Capítulo 5 — Test Strategy)

| Tipo | Exemplo real | Smoke obrigatório | Tempo de smoke |
|------|--------------|-------------------|----------------|
| **Prompt-only** | Scar AI (`active_tools: []`) | Tom + idioma + densidade + handoff + escalation | ~15-30 min |
| **Prompt + KB** | PLAKA (`['nuvemshop','sheets_kb']`) | + cobertura KB (hit/miss/fuzzy) + idempotência API + sync KB | ~30-60 min |
| **Prompt + KB + integrações** | Fun, HL, Doceria | + smoke contra endpoint real (sandbox quando possível) + tratamento de erro de API | ~60-90 min |

**Cenários que TODO smoke deve cobrir** (cross-tenant, derivados de cicatrizes):
- C1 — Cliente entrega 3 infos juntas (testa A3)
- C2 — Cliente pede pessoa explicitamente (testa P5+P7)
- C3 — Cliente pergunta info que NÃO está no KB/prompt (testa A4)
- C4 — Cliente manda áudio (testa P6 mirror)
- C5 — Cliente pergunta "você é robô?" (testa A8)
- C6 — Cliente envia 5 mensagens em 30s (testa debounce + densidade P1)
- C7 — Cliente fora-do-horário (testa horario-atendimento)

---

## §9 — Decisões UX abertas pra Capítulo 6 (Owner Playbook)

A Fase 8 (Aria consolida) vai usar este doc pra construir o Owner Playbook. Decisões UX que afetam os 9 fluxos canônicos do dono:

| OP do briefing §12 | Decisão UX relacionada |
|---------------------|------------------------|
| **OP-1** Cliente reporta bug no comportamento | Gatilho: feedback do dono (canal admin OU mensagem direta). Ação: extrair cicatriz textual + cenário de smoke + iterar prompt (loop refino brownfield validado em 5+ tenants) |
| **OP-2** Implementar função nova (global vs específica) | UX gate: cabe em **regra de prompt** (específica) ou exige **flag no código** (global, opt-in/opt-out)? Padrão `escalation_public_summary` é referência |
| **OP-4** Rodar teste (smoke / piloto / sandbox) | Variantes §8 + cenários cross-tenant C1-C7 |
| **OP-6** Capacidade específica de tenant | `active_tools` / `allowed_phones` / prompt v.X — sem novo código |
| **OP-7** Cliente pede extra fora do contrato | UX gate: cabe em prompt do tenant (extensão) ou exige nova tool/integração (cobrável)? |

---

## §10 — Próximas fases

| Fase | Responsável | Como este doc é consumido |
|------|-------------|---------------------------|
| **5** UX Specialist Review | Uma | Eu mesma reviso após Aria publicar Cap. 4 (Tech Debt Draft consolidado) |
| **6** Aria consolida no Capítulo 6 | Aria | Owner Playbook (9 fluxos do dono) baseado em §3-§5 + §9 |
| **7** QA Gate | Quinn | Critério §3 do briefing — **teste do dono** (5-10 min identifica fluxo + ação) deve passar usando o Cap. 6 |
| **8** Final Assessment + Template Canônico | Aria | Extrai os P1-P8 + atoms/molecules/organisms (§6) como **template do método SparkleOS** que vira herança pros próximos núcleos |

---

## §11 — Elicitations e decisões de Mauro

### Decisões resolvidas 2026-04-25

| ID | Pergunta original | Decisão Mauro | Ação documental |
|----|-------------------|---------------|-----------------|
| **U-2** | Densidade — padronizar ou livre? | ✅ **Padronizar BAIXA cross-tenant: ≤ 2 msgs/turno default.** Justificativa Mauro: *"fica ruim de ler em qualquer contexto, e não adianta ela falar muito de uma vez — precisa conversar com a pessoa"* | P1 reescrito: *"Densidade ≤ 2 mensagens por turno em 90% dos casos. Máximo absoluto: 3."* SOPs de tenant herdam essa regra como base; podem reforçar mais (ex: ≤ 1) mas não afrouxar |
| **U-3** | Emoji policy | ✅ **Default cross-tenant: emoji livre + moderado.** Opt-out por tenant quando cliente não quer (caso Scar). Implementação: regra explícita no SOP do tenant ("Nunca use emojis") — **não** exige flag em código | Pattern de método: emoji é **decisão de personalidade do tenant**, não capacidade global. Documentar no template canônico (Cap. 8a) |
| **U-5** | Auto-cleanup `agente-off` 72h — fixo ou variável? | ✅ **72h fixo cross-tenant. Mudar conforme demanda no onboarding.** | Pattern futuro: se algum tenant precisar ciclo diferente, adicionar coluna `agente_off_cleanup_hours INT NOT NULL DEFAULT 72` em `zenya_tenants` (padrão similar a `escalation_public_summary`). Não-bloqueante — só fazer quando primeiro tenant pedir |

### Decisões resolvidas 2026-04-25 (segunda rodada)

| ID | Decisão Mauro | Implicação |
|----|---------------|------------|
| **U-1** | ✅ **Lembretes são DERIVADOS de agendamentos existentes**, não cadastro manual. Worker periódico lê eventos do Google Calendar do tenant + janelas pré-definidas (ex: T-24h, T-2h) + dispara via Chatwoot. Exceção legítima: janela de manutenção pós-procedimento (caso Thainá — varia por tipo: sobrancelha 15d, lábios 20d) — esse mapeamento é configuração de **onboarding** (one-time por tenant), não input recorrente | Eleva P9 (princípio inviolável). Story remediation D4 ganha shape claro: (1) worker `outbound-reminders.ts` que lê GoogleCalendar + filtra agente-off + dispara `sendMessage` Chatwoot; (2) coluna `zenya_tenants.maintenance_windows JSONB` com map procedimento→dias; (3) configuração no seed do tenant |
| **U-4** | ✅ **Direção: Cockpit pro cliente (dono do tenant) primeiro**, multi-tenant pra Mauro depois. Mauro: *"o cockpit para o cliente parece o caminho mais óbvio"*. Pré-condição forte: *"primeiro preciso da estrutura desse departamento da Zenya muito bem estruturado"* — significa **brownfield Zenya antes de evoluir Cockpit em si** | (i) Não pausar `zenya-api` PM2; (ii) Epic 10 segue Draft com escopo (a) "Cockpit do dono"; (iii) **brownfield Zenya é pré-requisito do Epic 10**; (iv) "a+b futuramente" — multi-tenant Mauro fica pra Epic 10.X após (a) estabilizar; (v) NUCLEUS-CONTRACT v2 (Aria, Fase 8) reescreve documentando que organs/zenya hospeda **Cockpit do dono em estado parcial** com auth via `auth.uid()` + `zenya_client_users` |

### Elicitations ainda abertas

| ID | Pergunta | Status |
|----|----------|--------|
| (todas resolvidas — U-1 a U-5) | — | ✅ |

---

*Frontend Spec — Brownfield Zenya, Fase 3 (UX Discovery), 2026-04-25.*
*Próxima revisão: Fase 6 (UX Specialist Review pós-Tech Debt Draft) e Fase 8 (consolidação Owner Playbook).*
