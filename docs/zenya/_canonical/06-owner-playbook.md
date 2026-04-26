# Capítulo 6 — Owner Playbook

**Versão:** 1.0 (Brownfield Discovery Fase 8)
**Autor:** `@architect` Aria
**Data:** 2026-04-25
**Pergunta-mãe:** *"O que faço quando X acontece?"* — onde X é caso operacional do dono.

> **Audiência primária:** Mauro (dono SparkleOS) e futuros donos/responsáveis. **Audiência secundária:** agentes AIOX que precisam entender contexto operacional.
>
> **Inputs consolidados:** Briefing §12 (9 OPs canônicos) + Frontend Spec §9 + UX Specialist Review §2 + Tech Debt Draft §4 + memórias `feedback_*` e `project_*`.
>
> **Estrutura de cada OP:** **Gatilho · Decisões (binárias/discretas) · Ação · Quem aciono · Critério de sucesso · Anti-pattern · Tempo esperado**.

---

## Como usar este capítulo

1. **Identifique o OP** que descreve seu caso (lista §0 abaixo)
2. **Leia o OP** — em ≤5 min você sabe o que fazer
3. **Execute a ação** — comando concreto está no OP, não precisa improvisar
4. **Se estiver fora dos 9 OPs:** consulte `@aiox-master` ou abra issue pra catalogar como novo OP

---

## §0 — Índice rápido

| OP | Caso | Tempo |
|----|------|-------|
| **OP-1** | [Cliente reportou bug no comportamento do bot](#op-1) | 1-3h |
| **OP-2** | [Quero implementar função nova — global vs específica](#op-2) | 30min decisão; 1d-2sem implementação |
| **OP-3** | [Tirar um cliente — offboarding seguro + LGPD](#op-3) | 30min-1h decisão + 30 dias retenção |
| **OP-4** | [Rodar teste — smoke / piloto / sandbox](#op-4) | 15min-2h |
| **OP-5** | [Capacidade global (prompt base, schema, tool default)](#op-5) | 1-3 dias |
| **OP-6** | [Capacidade específica de tenant](#op-6) | 1-3h |
| **OP-7** | [Cliente quer extra fora do contrato](#op-7) | 30min decisão; depende escopo |
| **OP-8** | [Incidente em produção](#op-8) | 5min-2h |
| **OP-9** | [Pricing/escopo de novo cliente](#op-9) | 30min-2h |

---

<a id="op-1"></a>
## OP-1 — Cliente reportou bug no comportamento do bot

### Gatilho

Dono do tenant (Julia, Hiago, Ariane, Gustavo, etc.) ou cliente final reporta:
- *"O bot está respondendo errado sobre X"*
- *"Cliente reclamou que bot inventou data/preço/prazo"*
- *"O bot ignorou pergunta direta"*
- *"Bot não escalou quando deveria"*

### Decisões binárias

```
├─ É bug de prompt (tom, regra ausente, exemplo errado)?
│  → SIM → ITERAR PROMPT (caminho A)
│
├─ É bug de código (description de tool sobrepôs prompt)?
│  → SIM → FIX VAI PRO CÓDIGO (caminho B)
│  → Cicatriz Fun PR #9 (escalation_public_summary): tentou fix por prompt 2x sem sucesso → migrar pra flag em DB
│
├─ É dado externo ambíguo (data_criacao interpretada como data_envio)?
│  → SIM → FIX HÍBRIDO (caminho C — prompt explícito + sanitização tool)
│  → Cicatriz Fun v6→v7: pedido "enviado em 06/04/2026" mas era data_criacao
│
└─ Não está claro qual?
   → CONSULTAR @qa Quinn pra diagnóstico (revisar logs + cicatriz)
```

### Ação por caminho

#### Caminho A — Iterar prompt

1. Documentar **cicatriz textual** em `docs/zenya/tenants/{slug}/feedback-{nome}-{data}.md`
   - Screenshot/transcrição literal
   - Diagnóstico (causa raiz hipotética)
   - Proposta de fix
2. Rodar smoke local com cenário do bug: `node scripts/chat-tenant.mjs --tenant=X` ou smoke específico
3. Iterar prompt: editar `docs/zenya/tenants/{slug}/prompt.md`, bumpar version
4. Aplicar via Cap. 3 §1
5. Re-rodar smoke
6. **Critério de parada:** comportamento inaceitável = 0% no smoke (NÃO "hit-rate ok")
   - Memória `feedback_prompt_iteration_reveals.md`: cada iteração revela próximo gap
7. Pedir cliente re-validar

#### Caminho B — Fix vai pro código

Pattern canônico: **flag por tenant em `zenya_tenants`** com default preservando comportamento atual + opt-in/opt-out por tenant.

Exemplo modelo: `escalation_public_summary` (Cap. 1 §5.6 + migration 007).

1. `@architect` Aria desenha flag (boolean ou enum em coluna nova)
2. `@data-engineer` Dara propõe migration
3. `@dev` Dex implementa lógica condicional (geralmente em `tool-factory.ts` ou agente)
4. `@qa` Quinn valida com smoke A/B (default vs opt-in)
5. Aplicar via §6 do Cap. 3 (migration antes do deploy)

#### Caminho C — Híbrido (prompt + código)

Quando dado externo é ambíguo, fix é em 2 layers:
1. **Sanitização na tool** — `getSomething()` retorna shape menos ambíguo
2. **Prompt explícito** — regra crítica do que NÃO mencionar (ex: "não cite data em pedido enviado")

Exemplo: Fun v7 — tool `Detalhar_pedido_por_numero` retornava `data_criacao`; prompt v7 adicionou regra explícita; smoke específico validou.

### Quem aciono

| Caminho | Agente principal | Suporte |
|---------|------------------|---------|
| A — prompt | `@dev` Dex | `@pm` Morgan se mudança escopo |
| B — código | `@architect` Aria + `@data-engineer` Dara + `@dev` Dex | `@qa` Quinn validação |
| C — híbrido | `@dev` Dex | `@architect` se decisão arquitetural |

### Critério de sucesso

- Smoke local: comportamento inaceitável = 0% (NÃO "hit-rate ok") — memória `feedback_prompt_iteration_reveals`
- Cliente re-valida: aceita (ex: Gustavo re-testar Scar v3 após v2 fix)
- Pós-deploy 48h sem nova reclamação do mesmo padrão

### Anti-pattern

- ❌ Afrouxar prompt sem medir → drift silencioso (cicatriz PLAKA v2 — `no-kb-call` triplicou)
- ❌ Iterar prompt 5+ vezes em 2 dias buscando "perfeito" — parar quando inaceitável = 0% e usar produção real (Frontend Spec P3)
- ❌ Bug de description de tool tentado fix por prompt (não funciona — `feedback_tool_description_beats_tenant_prompt`)
- ❌ LLM "simulou tool" no prompt — fix é dupla instrução (memória `feedback_llm_simulates_tool`)

### Tempo esperado

- Caminho A: 1-3h (uma rodada de iteração simples)
- Caminho B: 1-3 dias (migration + código + deploy)
- Caminho C: 4-8h (prompt fix + tool sanitization)

---

<a id="op-2"></a>
## OP-2 — Quero implementar função nova — global vs específica

### Gatilho

Você tem uma ideia de capacidade nova. Pode ser:
- Pedido específico de cliente (*"Julia quer feature Y"*)
- Insight cross-tenant (*"Vi que 3 tenants precisariam de Z"*)
- Capacidade contratada (*"Thainá pediu lembretes proativos"*)

### Decisões binárias

```
├─ A capacidade é DERIVÁVEL do contexto que a IA já tem?
│  → SIM → AUTOMATIZAÇÃO (worker/cron/evento) — não input manual
│  → NÃO → INPUT (mas avalie se feature precisa mesmo existir)
│  → Princípio P9 (memória feedback_automation_over_input)
│  → Exemplo: lembretes proativos (TD-04) — derivado de Calendar
│
├─ Beneficia 1 tenant ou 2+?
│  → 1 só → ESPECÍFICA → OP-6
│  → 2+ → GLOBAL → continuar OP-2
│
├─ Cabe em REGRA DE PROMPT (tom, comportamento, fluxo)?
│  → SIM → SOP de cada tenant (OP-6 múltiplas vezes)
│  → NÃO → cabe em FLAG/CÓDIGO (continuar)
│
├─ Tem TENANT que QUER OPT-OUT do default?
│  → SIM → FLAG por tenant em zenya_tenants (pattern escalation_public_summary)
│  → NÃO → comportamento universal sem flag
│
└─ É CAPACIDADE NOVA (worker/integração/tool)?
   → SIM → seguir Cap. 3 §4 (adicionar integração nova) + Cap. 5 (test strategy)
```

### Ação

#### Específica (1 tenant) → OP-6

#### Global em prompt → cross-tenant rollout

1. Atualizar template canônico (Cap. 8a) se for novo padrão
2. Atualizar prompt de cada tenant ativo via Cap. 3 §1 (sequencial, não simultâneo)
3. Smoke específico em cada tenant
4. Validação ≥48h por tenant antes de marcar Done

#### Global em código → flag em DB

Pattern modelo `escalation_public_summary`:

1. `@architect` Aria desenha flag (default = comportamento atual; opt-in/opt-out)
2. `@data-engineer` Dara migration adicionando coluna em `zenya_tenants`
3. `@dev` Dex código condicional (geralmente em `tool-factory.ts`)
4. `@qa` Quinn smoke A/B
5. Cap. 3 §6 (migration antes do deploy)
6. Tenants existentes: default preserva; novos tenants podem opt-in/out no seed

#### Global novo (worker/cron/integração)

1. `@architect` Aria desenha
2. Criar entry no Tech Debt Draft (Wave correta — geralmente Wave 3)
3. Materializar via Story do Epic 18 (PM Morgan)
4. Cap. 3 §4 (adicionar integração nova) ou §11 (cross-tenant operations)

### Quem aciono

| Tipo | Agente |
|------|--------|
| Específica | `@dev` Dex (pelo OP-6) |
| Global em prompt | `@dev` Dex (rollout sequencial) |
| Global em código | `@architect` Aria + `@data-engineer` Dara + `@dev` Dex |
| Global novo (worker) | `@architect` Aria → `@pm` Morgan (escopo Epic 18) |

### Critério de sucesso

- Capacidade implementada **sem regressão** em tenants existentes
- Default preserva comportamento atual (mudança opt-in)
- Smoke cross-tenant validou
- Documentação atualizada (Cap. 3 + Cap. 5 + ADR se decisão arquitetural)

### Anti-pattern

- ❌ Pedir input manual onde IA poderia derivar (memória `feedback_automation_over_input` — princípio P9 inviolável)
- ❌ Mudar comportamento global sem flag default-preserva — quebra outros tenants
- ❌ "Capacidade igual a outra feature do CRM XYZ" sem cicatriz/pedido real → especulação
- ❌ Implementar global em código quando cabia em regra de prompt (over-engineering)

### Tempo esperado

| Tipo | Tempo |
|------|-------|
| Específica via OP-6 | 1-3h |
| Global em prompt | 30min × N tenants |
| Global em código (flag) | 1-3 dias |
| Global novo worker | 1-2 semanas |

---

<a id="op-3"></a>
## OP-3 — Tirar um cliente (offboarding seguro + LGPD)

### Gatilho

- Cliente solicita encerramento de contrato
- Cliente para de pagar (depois de tentativas de cobrança)
- Cliente migra pra outra solução
- Decisão sua de não atender mais (incompatibilidade, nicho mudou, etc.)

### Decisões binárias

```
├─ Cliente confirmou encerramento por escrito?
│  → NÃO → comunicar formalmente; aguardar 7 dias antes de offboarding
│  → SIM → continuar
│
├─ Cliente quer EXPORT do histórico antes do delete?
│  → SIM → exportar conversation_history como CSV/JSON e enviar
│  → NÃO → seguir
│
├─ É pausa temporária (cliente pode voltar) ou definitiva?
│  → PAUSA → manter dados, só pausar processamento (TD-I2 HL Importados é exemplo)
│  → DEFINITIVA → seguir delete completo abaixo
```

### Ação — Offboarding definitivo

```bash
# 1. PAUSAR atendimento imediatamente
ssh sparkle-vps
# Trocar webhook do Chatwoot conta X pra apontar pra URL de retorno educado
# (ou deixar Chatwoot enviar resposta auto: "Estamos encerrando atendimento...")
# OU mais simples: aplicar agente-off em todas conversas ativas via API Chatwoot

# 2. EXPORTAR dados (LGPD obriga retenção 30 dias antes de delete + permitir export)
TENANT_ID="<uuid>"
curl -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d "{\"query\":\"COPY (SELECT * FROM zenya_conversation_history WHERE tenant_id::text='$TENANT_ID') TO STDOUT WITH CSV HEADER;\"}" \
  > backup-tenant-{slug}-history-$(date +%Y%m%d).csv

# Enviar pro cliente

# 3. JANELA LGPD (30 dias) — tenant fica "frozen"
# - allowed_phones = [] (impede atendimento)
# - active_tools = [] (impede invocação)
# - admin_phones = [admin Mauro apenas]
# Ainda existe no banco, mas não atende.

UPDATE zenya_tenants
SET allowed_phones = '{}',
    active_tools = '[]'::jsonb,
    admin_phones = ARRAY['+5512981303249']
WHERE chatwoot_account_id = 'X';

# 4. PÓS-30 dias — DELETE definitivo (cascata)
# zenya_tenant_credentials, zenya_tenant_kb_entries, zenya_client_users (FK CASCADE)
# zenya_conversation_history, zenya_queue, zenya_session_lock (sem FK; deletar manual)

DELETE FROM zenya_conversation_history WHERE tenant_id::text = '$TENANT_ID';
DELETE FROM zenya_queue WHERE tenant_id = 'X';  -- chatwoot_account_id (TD-03 polissemia)
DELETE FROM zenya_session_lock WHERE tenant_id = 'X';
DELETE FROM zenya_tenants WHERE id = '$TENANT_ID';  -- CASCADE remove credentials + kb_entries + client_users

# 5. INFRA externa
# - Chatwoot: encerrar conta ou marcar inactive
# - Z-API: despareear instância (recolher números)
# - Storage de IP do tenant: arquivar em pasta cold (não deletar — pode ser referência)
```

### Pausa temporária (modelo HL Importados — TD-I2)

```sql
-- Pausa intencional: mantém dados + cred + prompt; só impede atendimento
UPDATE zenya_tenants
SET allowed_phones = ARRAY['+5512981303249']  -- só Mauro pode mandar mensagem
WHERE chatwoot_account_id = 'X';

-- Documentar em memória project_{slug}.md o motivo + ETA de retorno
-- Reativação: UPDATE zenya_tenants SET allowed_phones = '{}' WHERE ...
```

### Quem aciono

- `@pm` Morgan: confirma decisão de negócio + comunica cliente
- `@data-engineer` Dara: executa export + delete + valida LGPD
- `@devops` Gage: infra externa (Chatwoot, Z-API)

### Critério de sucesso

- Cliente recebeu export (se solicitou)
- 30 dias de retenção respeitados
- Banco limpo pós-30 dias (sem dados órfãos)
- Memória `project_{slug}.md` atualizada com status

### Anti-pattern

- ❌ Delete sem janela 30 dias (LGPD)
- ❌ Delete sem export (cliente pode pedir após)
- ❌ Esquecer de pausar Chatwoot/Z-API — clientes finais ficam mensageando vazio
- ❌ Delete só em `zenya_tenants` esquecendo `zenya_queue`/`zenya_session_lock` (TD-03 polissemia — sem FK CASCADE nessas)

### Tempo esperado

- Decisão + comunicação: 30min-1h
- Pausa imediata: 5min
- Janela LGPD: 30 dias
- Delete final: 30min

---

<a id="op-4"></a>
## OP-4 — Rodar teste (smoke / piloto / sandbox — qual quando?)

### Gatilho

- Mudança de prompt prestes a subir pra produção
- Capacidade nova precisando validar
- Tenant novo no onboarding
- Suspeita de regressão

### Decisões discretas

```
├─ Tenant em PRODUÇÃO ATIVA?
│  → SIM → SMOKE LOCAL primeiro, depois SMOKE PRODUÇÃO COM WHITELIST
│  → NÃO (greenfield/test mode) → SMOKE LOCAL apenas
│
├─ Mudança é tom/regra ou comportamento crítico (escalation, cobrança, etc.)?
│  → TOM/REGRA → smoke regular
│  → CRÍTICO → smoke + REPL manual + revisão humana
│
├─ Cliente final pode ser afetado?
│  → SIM → JANELA DE MANUTENÇÃO + rollback plan
│  → NÃO → deploy normal
```

### Tipos de teste — quando usar cada

| Teste | Quando | Como | Ferramenta |
|-------|--------|------|------------|
| **Unit** | Mudança em função isolada | `npm test` | Vitest, ~104 testes hoje |
| **Smoke local (REPL)** | Antes de qualquer deploy de prompt | `node scripts/chat-tenant.mjs --tenant=X` | Conversa manual via AI SDK pulando Z-API/Chatwoot |
| **Smoke automatizado** | Após mudança de prompt; pré-go-live | `node scripts/smoke-{tenant}.mjs` | Bateria de cenários derivados da fonte (não chutados) |
| **Smoke produção whitelist** | Pós-deploy crítico | Mensagem real WhatsApp do número admin (que está em `allowed_phones`) | Manual |
| **Piloto controlado** | Capacidade nova em 1 tenant antes de rollout cross-tenant | Tenant em test mode + cliente real consciente | Manual |
| **Sandbox / endpoint mock** | Validar integração externa nova | Servidor mock que simula API externa | Custom |

### Cenários cross-tenant obrigatórios (Cap. 5 §3.1)

Todo smoke automatizado deve cobrir os 7 cenários:
- C1 — Cliente entrega 3 infos juntas (P2 releia histórico)
- C2 — Cliente pede pessoa explicitamente (P5+P7)
- C3 — Cliente pergunta info fora KB/prompt (A4 LLM simula tool)
- C4 — Cliente manda áudio (P6 mirror)
- C5 — Cliente pergunta "você é robô?" (A8)
- C6 — Cliente envia 5 mensagens em 30s (P1 densidade + debounce)
- C7 — Cliente fora do horário (horário humano)

### Ação — Workflow padrão

```bash
# 1. Smoke local (REPL ou bateria)
cd packages/zenya
node --env-file=.env scripts/chat-tenant.mjs --tenant=X
# OU
node --env-file=.env scripts/smoke-{slug}.mjs

# 2. Se passar: smoke produção com whitelist
ssh sparkle-vps
cd /root/SparkleOS && git pull
cd packages/zenya && npm run build && pm2 reload zenya-webhook
# Mandar mensagem real do número admin pelo WhatsApp

# 3. Se passar: liberar produção (remove whitelist)
# Cap. 3 §1 fluxo de update prompt + UPDATE allowed_phones = '{}'

# 4. Monitor 48h pós-deploy
pm2 logs zenya-webhook -f
# Acompanhar taxa conversão, falsos negativos óbvios, tickets cliente
```

### Princípios chave

- **Testes derivam da fonte, não de categorias abstratas** (memória `feedback_test_from_source`)
- **Errors em smoke podem esconder comportamento ruim** (memória `feedback_errors_can_hide_bugs`) — investigar causa antes de ignorar
- **Parar quando comportamento inaceitável = 0%, não quando hit-rate é "bom"** (memória `feedback_prompt_iteration_reveals`)

### Quem aciono

- `@dev` Dex: executa smokes
- `@qa` Quinn: valida resultado, decide gate
- `@architect` Aria: se mudança arquitetural

### Critério de sucesso

- Comportamento inaceitável = 0% no smoke
- Cenários C1-C7 cross-tenant passando
- Sem regressão em tenants vizinhos (se mudança cross)

### Anti-pattern

- ❌ Smoke com cenários adivinhados (memória `feedback_test_from_source` — cicatriz PLAKA v1: 29 perguntas chutadas afirmaram cobertura inexistente)
- ❌ Pular smoke local em tenant em produção (cicatriz: 7 tenants em produção, todos com cliente real)
- ❌ Testar só "happy path" — anti-patterns A1-A10 do Frontend Spec exigem cenários de borda

### Tempo esperado

- Unit: <1min
- Smoke local: 5-15min
- Smoke automatizado: 10-30min
- Smoke produção whitelist: 5min mais 30min observação
- Piloto: dias-semanas

---

<a id="op-5"></a>
## OP-5 — Capacidade global (prompt base, schema, tool default)

Resumo do OP-2 caminho "global em código". Detalhe em OP-2 acima.

**Quick reference:**

| Capacidade global | Onde mora | Pattern |
|-------------------|-----------|---------|
| Comportamento default cross-tenant | Cap. 8a (Template Canônico) + ZENYA_BASE_PROMPT | Imutável, tenants herdam |
| Schema novo (coluna em zenya_tenants) | Migration | Default preserva |
| Tool default disponível pra todos | `tool-factory.ts` bloco principal | Cuidado: não pode ser bloqueante |
| Worker novo (KB sync, lembretes) | `packages/zenya/src/worker/` + `ecosystem.config.cjs` | App PM2 dedicado |

---

<a id="op-6"></a>
## OP-6 — Capacidade específica de tenant

### Gatilho

Cliente específico pediu algo (palavra-chave, integração, regra de negócio única).

### Decisões binárias

```
├─ Cabe em mudança de PROMPT do tenant?
│  → SIM → Cap. 3 §1
│
├─ Cabe em FLAG existente (active_tools, allowed_phones, escalation_public_summary)?
│  → SIM → UPDATE em zenya_tenants
│
├─ Exige INTEGRAÇÃO existente no core mas inativa nesse tenant?
│  → SIM → Cap. 3 §5 (ativar via active_tools)
│
└─ Exige INTEGRAÇÃO NOVA (não no core)?
   → SIM → OP-2 caminho "global novo" (mesmo se 1 tenant — adicionar pro core, mas opt-in)
```

### Ação

| Tipo | Como |
|------|------|
| Prompt | Cap. 3 §1 |
| Flag existente | `UPDATE zenya_tenants SET ... WHERE chatwoot_account_id = 'X';` (cache 5min) |
| Integração existente | Cap. 3 §5 |
| Integração nova | Cap. 3 §4 — sempre adiciona pro core mesmo se 1 tenant |

### Quem aciono

`@dev` Dex faz; `@architect` Aria se decisão envolve adicionar capacidade nova ao core.

### Critério de sucesso

- Capacidade ativa só pra esse tenant (zero impacto cross-tenant)
- Smoke específico passou
- Cliente confirmou via teste real

### Anti-pattern

- ❌ Hardcode de comportamento de 1 tenant em código global (gera dívida futura — sempre extrair pra flag)
- ❌ Capacidade super-específica que ninguém mais vai usar — avalie se é negócio sustentável (OP-9)

### Tempo esperado

1-3h (mais simples que OP-5).

---

<a id="op-7"></a>
## OP-7 — Cliente quer extra fora do contrato

### Gatilho

Cliente pede capacidade não-prevista no contrato original (ex: integração com CRM externo, automação fora do escopo SAC).

**Sem cicatriz documentada hoje.** OP preventivo.

### Decisões discretas

```
├─ Pedido cabe no escopo "SAC + Agenda" do contrato base?
│  → SIM → INCLUSO no plano atual; só implementar (OP-2 ou OP-6)
│  → NÃO → continuar
│
├─ É capacidade geral (vai servir pra mais tenants)?
│  → SIM → ADD-ON COBRÁVEL ou upgrade de plano
│  → NÃO → 1 tenant — avaliar caso a caso
│
├─ Esforço S/M/L?
│  → S → cobrável como hora avulsa OU absorvido como cortesia (lealdade do cliente)
│  → M/L → ADD-ON com escopo + valor + cronograma definidos antes de começar
│
└─ Capacidade nova requer arquitetura nova?
   → SIM → @architect avalia complexidade + impacto cross-tenant antes de cotar
```

### Ação — Caso real referência

**Ensinaja MultiGrow CRM** (memória `project_ensinaja.md`):

- Douglas pediu integração com MultiGrow (CRM dele) durante onboarding
- Decisão: **Cenário B — MultiGrow como backoffice paralelo, NÃO substituindo Chatwoot**
- Esforço: M (nova tool pattern como `escalarHumano` com flag opt-in)
- **Comercial:** add-on cobrável separado (não absorver no contrato base)
- Bloqueia até Douglas mandar doc API + API key + esclarecer plano MultiGrow

### Quem aciono

- `@pm` Morgan: avalia escopo de produto + decisão comercial
- `@architect` Aria: complexidade técnica + impacto cross-tenant
- `@analyst` Alex: research se for tecnologia desconhecida

### Critério de sucesso

- Escopo definido por escrito (e-mail/contrato)
- Valor acordado antes de começar
- Capacidade entregue dentro de prazo combinado
- Documentado como **add-on** no contrato/memória do tenant

### Anti-pattern

- ❌ "Faz uma coisinha rápida" sem definir escopo — vira retrabalho infinito
- ❌ Implementar antes de cobrar — cliente assume que é grátis pra sempre
- ❌ Aceitar capacidade que quebra invariant arquitetural (cicatriz Ensinaja: tentaram propor MultiGrow substituindo Chatwoot — recusado em favor de Cenário B paralelo)
- ❌ Cotar baseado em horas sem entender impacto cross-tenant

### Tempo esperado

- Decisão comercial: 30min-2h
- Implementação: depende escopo (1d - 4 semanas)

---

<a id="op-8"></a>
## OP-8 — Incidente em produção

### Gatilho

- Bot não responde (massa de clientes afetados)
- Bot vazou dado sensível
- VPS fora do ar
- Z-API caiu (cicatriz HL pós-cutover)
- Webhook errado (cicatriz Doceria 24h)
- Bloqueio Hostinger (cicatriz `reference_vps_block_incident.md` 2026-04-22)

### Severidade

```
├─ P0 — TODOS tenants afetados ou dado vazado
│  → DROP TUDO. Iniciar war room. ETA fix imediato.
│
├─ P1 — 1 tenant em produção crítica fora do ar (>30min)
│  → Investigar imediatamente. Comunicar cliente.
│
├─ P2 — Tenant não-crítico ou problema parcial
│  → Investigar em horário comercial. ETA <24h.
│
└─ P3 — Comportamento estranho mas não-bloqueante
   → Catalogar como dívida (OP-1 → bug).
```

### Ação por severidade

#### P0 — War room

1. **Validar** — `pm2 list`, `curl /zenya/health`, query queue stats
2. **Comunicar imediatamente** os tenants afetados (todos clientes do core)
3. **Estancar** — pode envolver `pm2 stop zenya-webhook` + investigar causa
4. **Rollback** se causa for deploy recente: `git revert HEAD && npm run build && pm2 reload`
5. **Validar fix** + smoke
6. **Post-mortem** — documentar em memória `reference_*` ou `feedback_*` cross-núcleo (cicatriz documenta regra — princípio P4 do canon)

#### P1 — 1 tenant crítico

1. Cap. 3 §10 (debugar "bot não respondeu")
2. Comunicar cliente (estimativa de retorno)
3. Implementar fix
4. Smoke + monitorar 4h pós-fix
5. Catalogar incidente em memória

#### P2/P3 — Catalogar e priorizar

- P2: abrir issue + documento de plano de fix
- P3: vai pro Tech Debt Draft (Cap. 4 do canon brownfield) ou backlog

### Cicatrizes históricas conhecidas

| Incidente | Memória | Padrão evitar |
|-----------|---------|---------------|
| Doceria 24h downtime (webhook errado) | `reference_webhook_url`, `feedback_verify_before_assume` | Sempre `api.sparkleai.tech/webhook/chatwoot` (não inventar URL) |
| HL Z-API instabilidade pós-cutover | `project_tenant_roster` | Z-API operacional ≠ core; monitorar separado |
| VPS bloqueado Hostinger 2026-04-22 | `reference_vps_block_incident`, `feedback_vps_no_burst` | Não bombardear SSH+HTTPS rapid-fire; agrupar comandos |
| Account 4 (Ensinaja) webhook drift 9 dias | TD-J | Validar tenant existe antes de webhook receber tráfego |

### Quem aciono

| Severidade | Agentes |
|------------|---------|
| P0 | `@devops` Gage (infra) + `@architect` Aria (cross-stack) + `@aiox-master` (coordena) |
| P1 | `@dev` Dex (debug) + `@devops` Gage (deploy) |
| P2 | `@dev` Dex |
| P3 | catalogar, sem ação imediata |

### Critério de sucesso

- Tenant afetado(s) voltou ao ar
- Smoke pós-fix passou
- Cliente comunicado (P0/P1)
- Post-mortem documentado em memória cross-núcleo

### Anti-pattern

- ❌ Reiniciar PM2 sem investigar causa — apaga estado, mascara problema
- ❌ Inventar URL ou config "que deveria ser" (princípio cross-núcleo `feedback_verify_before_assume`)
- ❌ Bombardear VPS Hostinger com SSH/HTTPS rápidos (cicatriz bloqueio)
- ❌ Ignorar cicatriz em vez de catalogar como memória

### Tempo esperado

- P0: 5-30min ETA fix; 1h post-mortem
- P1: 1-4h
- P2: <24h
- P3: vai pro backlog

---

<a id="op-9"></a>
## OP-9 — Pricing/escopo de novo cliente

### Gatilho

Lead chega ou cliente em onboarding precisa definir plano + escopo.

### Tabela de pricing (memória `project_pricing_tiers.md`)

| Plano | Valor | Escopo | COGS estimado |
|-------|-------|--------|---------------|
| **Essencial** | R$ 497/mês | Atendimento (FAQ) + 1 integração | ~R$ 80-120 (LLM + ElevenLabs + Z-API + infra) |
| **Premium** | R$ 697/mês | + agenda + lembretes proativos (TD-04 pendente) | ~R$ 130-180 |
| **Personalizado** | Cotação | Integrações custom, white-label, SLA | Caso a caso |

**Piso interno teórico:** R$ 297/mês (margem mínima).
**Caso real desconto:** Thainá pagará R$ 397/mês — Essencial menos R$ 100 (volume baixo + flexibilidade UX).

### Decisões discretas

```
├─ Volume estimado < 100 conversas/mês?
│  → Essencial é suficiente
│
├─ Volume 100-500/mês?
│  → Avaliar Essencial vs Premium pelo escopo
│
├─ Volume > 500/mês?
│  → Premium ou Personalizado
│
├─ Cliente pede integração custom (CRM, ERP, etc.)?
│  → ADD-ON cobrável (OP-7)
│
├─ Cliente quer SLA explícito?
│  → Personalizado (Essencial/Premium não têm SLA formal hoje — TD-29 wishlist)
│
└─ Cliente é estratégico (case study, referência)?
   → Avaliar desconto/concessão como invest em marketing
```

### Ação

1. **Briefing técnico** com cliente: nicho, volume, integrações desejadas, urgência, expectativas
2. **Mapear** capacidades do contrato vs core hoje (OP-2 — implementar gaps **antes** de fechar contrato se prometidos)
3. **Cotar** com base em tabela + add-ons
4. **Contrato** registra escopo explícito (cláusula 1 com features incluídas)
5. **Onboarding** segue Cap. 3 §3

### Quem aciono

- `@pm` Morgan: define pricing + comunica cliente
- `@analyst` Alex: research se nicho desconhecido
- `@architect` Aria: avalia complexidade técnica de integrações novas

### Critério de sucesso

- Cliente entendeu escopo
- Contrato registra features incluídas
- Não há promessa de capacidade que não existe (cicatriz Thainá cláusula 1.2 lembretes proativos — TD-04 aberta)

### Anti-pattern

- ❌ Prometer capacidade que não existe ainda (cicatriz Thainá)
- ❌ Cotar Essencial pra cliente com volume Premium (margem zero)
- ❌ Add-on sem documentação formal — vira retrabalho
- ❌ Aceitar nicho atípico como "fácil" sem `@architect` consultar

### Tempo esperado

- Briefing: 1h
- Cotação: 30min
- Contrato: 1-2h
- Total: 2-4h decisão; onboarding 4-24h depois

---

## §10 — Decisões de negócio recentes (referência rápida)

| Decisão Mauro | Data | Impacto |
|---------------|------|---------|
| Novos tenants direto no core (não n8n) | 2026-04-20 | Memória `project_new_tenants_direct_core` |
| Migration 008 retroativa aplicada | 2026-04-25 | TD-R1+R2 do Tech Debt Draft |
| Densidade ≤2 msgs/turno cross-tenant default | 2026-04-25 | Frontend Spec P1 + Cap. 8a |
| Emoji livre default + opt-out por SOP | 2026-04-25 | Frontend Spec §11 |
| Cleanup `agente-off` 72h cross-tenant | 2026-04-25 | Mantém regra atual |
| Cockpit (Epic 10) — cliente/dono primeiro, multi-tenant Mauro depois | 2026-04-25 | Brownfield Zenya é pré-requisito |
| Lembretes proativos = derivados de Calendar (não input manual) | 2026-04-25 | Princípio P9 cross-núcleo (`feedback_automation_over_input`) |
| Ensinaja não-prioritário (Douglas pgto pendente, info atrasada 2 sem) | 2026-04-25 | TD-I1 — webhook acumula pending; resolve quando Douglas voltar |
| HL pausado por pedido Hiago (ajustes pendentes) | 2026-04-25 | TD-I2 — cred ultracash mantida |
| PLAKA aguarda número novo Z-API | 2026-04-25 | TD-I3 — KB seedada mas sem tráfego |

---

*Capítulo 6 (Owner Playbook) — Brownfield Zenya Fase 8 — 2026-04-25.*
*Resolve Q-02 do QA Gate. 9 OPs canônicos do dono estruturados com gatilho · decisões · ação · agente · critério · anti-pattern · tempo.*
