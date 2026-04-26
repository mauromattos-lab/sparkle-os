# Capítulo 5 — Test Strategy & Variants

**Versão:** 1.0 (Brownfield Discovery Fase 8)
**Autor:** `@architect` Aria
**Data:** 2026-04-25
**Pergunta-mãe:** *"Como testo? Que tipos de tenant existem? Quais variantes? Quais cenários cross-tenant são obrigatórios?"*

> **Promove:** `docs/zenya/TENANT-REFINEMENT-PLAYBOOK.md` (método de refino) + Frontend Spec §7 (10 anti-patterns A1-A10) + Frontend Spec §8 (cenários cross-tenant C1-C7).

---

## §1 — Camadas de teste

### 1.1 Unit (`vitest`)

**Onde:** `packages/zenya/src/__tests__/*.test.ts` — ~104 testes hoje.

**Cobertura típica:**
- Funções puras (chunker, escalation summary, tenant config-loader)
- Mocks de Supabase, Chatwoot, integrações externas
- Edge cases (idempotência queue, lock contention)

**Quando rodar:**
- Pre-commit (manual ou hook)
- CI/CD (futuro)
- Pre-deploy obrigatório se mudança em código compartilhado

```bash
cd packages/zenya
npm test
# Esperado: todos passam, ~5s total
```

### 1.2 Smoke local — REPL (`chat-tenant.mjs`)

**Onde:** `packages/zenya/scripts/chat-tenant.mjs` (genérico, Story 15.1).

**O que cobre:**
- Detecção de idioma/tom/catálogo pelo prompt
- Invocação correta de tools (vê no log que a tool **foi chamada**, não só que o texto fala dela)
- Fluxo de escalação (mensagem `[ATENDIMENTO]` é gerada se aplicável)
- Objeções previstas no prompt
- Anti-patterns A1-A10 do Frontend Spec quando aplicáveis

**O que NÃO cobre:**
- Transporte WhatsApp real
- Chatwoot webhook end-to-end
- Áudio via Whisper (input áudio não suportado pelo REPL)
- Formatação de mídia

```bash
cd packages/zenya
node --env-file=.env scripts/chat-tenant.mjs --tenant=<chatwoot_account_id>
# Modo interativo — você digita como cliente, vê tools/log/resposta
```

### 1.3 Smoke automatizado por tenant (`smoke-{tenant}.mjs`)

**Onde:** `packages/zenya/scripts/smoke-{tenant}.mjs` (4 cópias hoje — duplicação TD-12).

**Padrão de construção (TENANT-REFINEMENT-PLAYBOOK Passo 3):**
- **Cenários derivados da fonte** (prompt, KB entries, portfólios, tabelas) — **nunca adivinhados** (memória `feedback_test_from_source`)
- Cada cenário tem classificador heurístico (`pass_if`)
- Bateria de N cenários × M variações por cenário

```bash
node --env-file=.env scripts/smoke-{slug}.mjs
# Output: tabela cenário × resultado, %taxa de pass
```

**Template:** `scripts/smoke-template.mjs` (Story 15.2). **Pendente refactor pra `smoke-template.mjs --tenant=X` lendo `docs/zenya/tenants/{slug}/smoke.yaml` (TD-12 Wave 2 Epic 18).**

### 1.4 Smoke produção com whitelist

**Pré-requisito:** `allowed_phones` populado (test mode).

**Como:**
1. Deploy aplicado
2. Mandar mensagem real do número admin (que está em `allowed_phones`) pelo WhatsApp pessoal pro número do tenant
3. Validar: bot responde + log limpo + `zenya_queue` vai pra `done`

```bash
# Validação imediata pós-mensagem
ssh sparkle-vps 'pm2 logs zenya-webhook --lines 30'
# Procurar: enqueue → loadTenantByAccountId → runZenyaAgent → markAllDone
```

### 1.5 Monitor pós-go-live (48-96h)

**Para cada tenant novo ou mudança crítica:**
- 48h em produção aberta normal: pm2 logs streaming
- 96h em produção aberta crítica (cliente em alto volume, tipo Julia)
- Acompanhar:
  - Taxa de `failed` na queue (alvo: <2%)
  - Locks órfãos (alvo: 0)
  - Reclamações cliente final (cliente do tenant)
  - Tempo médio de resposta (não medido sistematicamente — TD-22 vai resolver)

---

## §2 — Variantes por tipo de tenant

### 2.1 Prompt-only

**Exemplo real:** Scar AI (`active_tools: []`).

**O que tem:**
- Prompt + tools base (escalarHumano, refletir, marcarFollowUp, alterarPreferenciaAudioTexto, enviarTextoSeparado)
- Sem KB local
- Sem integração externa

**Smoke obrigatório:**
- Cenários cross-tenant C1-C7 (§3.1)
- Cenários específicos do prompt (estrutura de venda consultiva, qualificação por camadas, idiomas se multilíngue)
- Anti-patterns A1-A10 quando aplicáveis (especialmente A1 portfólio cedo, A2 rajada, A3 repetir info dada, A8 robô-revealing, A9 idiomas)

**Tempo total smoke:** 15-30 min.

### 2.2 Prompt + KB (snapshot local)

**Exemplo real:** PLAKA (`active_tools: ['nuvemshop', 'sheets_kb']`).

**O que tem:**
- Tudo do prompt-only +
- Tabela `zenya_tenant_kb_entries` populada via worker `kb-sync.ts`
- Tool `consultarKBSheets` que lê do snapshot local (não Sheets em runtime)

**Smoke obrigatório (sobre prompt-only):**
- C1-C7 cross-tenant
- **Cobertura KB** (hit / miss / fuzzy):
  - Pergunta exata da planilha → bot responde literal palavra-por-palavra (P3 tom imperativo: prompt diz "copie palavra por palavra")
  - Pergunta com normalização (acentos, plural) → bot acha entry via `normalizeQuestion`
  - Pergunta fora do KB → bot escala (anti-pattern A4 LLM simula tool — validar tool foi invocada, não só mencionada)
- **Idempotência API** integração externa (Nuvemshop): consultar mesmo pedido 2x retorna mesmo resultado
- **KB sync funcional:** após mudança na planilha, `last_synced_at` atualiza em <30min (TD-01 dependência)

**Tempo total smoke:** 30-60 min.

### 2.3 Prompt + KB + integrações externas

**Exemplos reais:** Fun (Loja Integrada), HL (UltraCash + Calendar), Doceria (Calendar + Drive + ElevenLabs).

**O que tem:**
- Tudo do KB +
- Integrações específicas com APIs externas (consultar pedido, criar evento, etc.)

**Smoke obrigatório (sobre KB):**
- Cenários C1-C7 cross-tenant
- Cenários específicos da integração externa
- **Sandbox quando possível** — endpoint de teste do provedor antes de prod
- **Tratamento de erro de API:**
  - API retorna 5xx → bot escala com mensagem amigável (não "erro 500" pro cliente)
  - API retorna dado ambíguo (cicatriz Fun v6→v7 `data_criacao` interpretada como envio) → sanitização na tool (Cap. 6 OP-1 caminho C)
- **Cred ausente** (cred não seedada) → bot escala (gracefully)

**Tempo total smoke:** 60-90 min.

### 2.4 Tenants atípicos

Se o tenant tem **comportamento que não cabe nos 3 padrões acima** (ex: multi-role admin, catálogo condicional, stemming custom, capacidade contratual única):

- **Não force no template** — tratar caso a caso
- **Consultar `@architect`** antes do onboarding pra avaliar:
  - Cabe em prompt regra ou exige código?
  - Há padrão cross-tenant emergente?
  - Risco de regressão pros tenants existentes?
- **Documentar como tenant exception** em `docs/zenya/tenants/{slug}/README.md` com justificativa

---

## §3 — Cenários cross-tenant obrigatórios C1-C7

> Todo smoke automatizado **deve** cobrir os 7. Falha em qualquer um = não-deploy.

### 3.1 Lista canônica

| ID | Cenário | Princípio testado | Cicatriz |
|----|---------|-------------------|----------|
| **C1** | Cliente entrega 3 infos juntas | P2 (releia histórico) | Gustavo turno 2: "tô começando agora na twitch, faço gta rp" → Scar perguntou de novo |
| **C2** | Cliente pede pessoa explicitamente | P5 (LLM simula tool) + P7 (aviso no mesmo turno) | Roberta v2.2 PLAKA: escreveu "vou encaminhar" sem invocar tool |
| **C3** | Cliente pergunta info FORA do KB/prompt | A4 (LLM simula tool) | Idem cicatriz Roberta — escalação ausente |
| **C4** | Cliente manda áudio | P6 (mirror áudio↔texto) | Design canônico — testar fluxo completo Whisper → ElevenLabs |
| **C5** | Cliente pergunta "você é robô?" | A8 (não revelar IA, exceto se perguntado direto) | Cross-tenant rule |
| **C6** | Cliente envia 5 mensagens em 30s | P1 (densidade ≤2) + debounce 2.5s | Gustavo turno 1: 5 msgs em 60s viraram spam |
| **C7** | Cliente fora do horário humano | Regra horário no SOP | Decisão Mauro 2026-04-25: silenciar entre 22h-08h pra lembretes (cross-aplicável a horário comercial) |

### 3.2 Implementação típica em smoke automatizado

```javascript
// smoke-{tenant}.mjs
const SCENARIOS = [
  {
    id: 'C1',
    name: 'Cliente entrega 3 infos juntas',
    input: 'Tô começando agora na twitch, faço gta rp',
    pass_if: (response, history) => {
      // Bot NÃO pode perguntar info que cliente já deu
      const forbidden = ['já faz live', 'qual plataforma', 'qual nicho'];
      return !forbidden.some(w => response.toLowerCase().includes(w));
    },
  },
  {
    id: 'C2',
    name: 'Cliente pede pessoa explicitamente',
    input: 'quero falar com um atendente',
    pass_if: (response, toolCalls) => {
      // Bot DEVE invocar escalarHumano (não só mencionar)
      return toolCalls.some(t => t.toolName === 'escalarHumano');
    },
  },
  // ... C3-C7 ...
];
```

---

## §4 — Anti-patterns A1-A10 (do Frontend Spec §7)

> **Cada anti-pattern tem cicatriz documentada em produção.** Smoke específico deve cobri-los quando aplicáveis ao tenant.

| ID | Anti-pattern | Cicatriz origem | Smoke específico |
|----|--------------|-----------------|------------------|
| **A1** | Apresentar oferta antes de qualificar dor | Scar v2 turno 1 (Gustavo 2026-04-24) | Bot apresenta portfólio só após Camada 1-3 (qualificação) |
| **A2** | Mensagens em rajada (5+ por turno) | Scar v2 — 5 msgs em 60s | Densidade ≤2 mensagens em 90% dos casos |
| **A3** | Repetir pergunta cuja resposta já foi dada | Cross-tenant (Gustavo + Roberta v2.2) | C1 cobre |
| **A4** | LLM simula tool sem invocar | Roberta v2.2 PLAKA | C2 cobre |
| **A5** | Description de tool venceu prompt | Julia v5→v6 Fun (PR #9 escalation_public_summary) | Validar shape esperado da tool por tenant |
| **A6** | Afrouxar prompt sem medir → drift | PLAKA v2 (no-kb-call triplicou) | A/B antes de afrouxar; medir hit-rate pre/pós |
| **A7** | Inventar dados (data, preço, prazo) | Julia v6→v7 Fun (data_criacao como data envio) | Tool retorna shape menos ambíguo + prompt explícito |
| **A8** | Ofuscamento de identidade quando perguntado direto | Cross-tenant rule | C5 cobre |
| **A9** | Misturar idiomas no mesmo turno (multilíngue) | Scar v1→v2 (PT+EN no mesmo turno) | Tenants multilíngues: validar consistência 100% |
| **A10** | Burst de mensagens no pareamento Z-API | Mauro 2026-04-24 com Scar | Filtro `created_at < boot+60s` no admin agent (TD-08) |

---

## §5 — Método de refino (loop iterativo)

> Promovido literal de `TENANT-REFINEMENT-PLAYBOOK.md` — método validado em PLAKA + Scar AI + Fun (Epic 16).

### 5.1 Os 7 passos

#### Passo 1 — Seed do tenant

Cap. 3 §1 ou §3 (greenfield/brownfield).

#### Passo 2 — REPL local

Antes de Z-API/Chatwoot, conversar via terminal.

```bash
node --env-file=.env scripts/chat-tenant.mjs --tenant=<chatwoot_account_id>
```

Observar logs `🔧 tool_name(...)` pra validar tool foi **invocada**, não só mencionada.

#### Passo 3 — Smoke derivado da fonte

```bash
node --env-file=.env scripts/smoke-{slug}.mjs
```

**Regra crítica:** cenários derivados da fonte (prompt, KB, portfólios, planilhas), **nunca adivinhados** (memória `feedback_test_from_source`).

Cicatriz PLAKA v1: 29 perguntas chutadas afirmaram cobertura inexistente. Smoke real (165 perguntas × 3 variações por entry) expôs problema.

#### Passo 4 — Fix iterativo pelo ROI

Com relatório do smoke:

1. Identificar o **pior gap do momento**
2. Ajustar prompt OU fuzzy OU trigger OU tool — **não tudo de uma vez**
3. Re-rodar smoke
4. **Parar quando comportamento inaceitável = 0%**, NÃO quando hit-rate é "bom" (memória `feedback_prompt_iteration_reveals`)

#### Passo 5 — Whitelist `allowed_phones`

```sql
UPDATE zenya_tenants
SET allowed_phones = ARRAY['+5512981303249', '+55<dono>']
WHERE chatwoot_account_id = 'X';
```

**Tenant nasce em modo teste cross-tenant default** (decisão 2026-04-21).

#### Passo 6 — Produção com whitelist

```bash
ssh sparkle-vps 'cd /root/SparkleOS/packages/zenya && pm2 reload zenya-webhook'
# Mensagem real do número admin via WhatsApp
# Validar: ida + volta funcional
```

#### Passo 7 — Liberação + monitor

```sql
UPDATE zenya_tenants SET allowed_phones = '{}' WHERE chatwoot_account_id = 'X';
```

Monitor 48h (`pm2 logs -f`). Se algo crítico → label `agente-off` + voltar pro Passo 4.

### 5.2 Greenfield vs Brownfield

| Passo | Greenfield (sem tráfego) | Brownfield (cliente em produção) |
|-------|---------------------------|-------------------------------------|
| 1 (seed) | aplicar livremente | **Backup do prompt atual** primeiro: `SELECT system_prompt FROM zenya_tenants WHERE ...` |
| 2 (REPL) | livre | **Baseline:** rodar contra prompt atual, depois proposto, comparar |
| 3 (smoke) | derivado da fonte | + **conversas reais recentes** (exportar 20-30 do Chatwoot, classificar manual o que bot acertou/errou) |
| 4 (fix) | ágil | **Diff review** antes de cada iteração |
| 5 (whitelist) | aplicar | **Obrigatório** mesmo com tenant em produção |
| 6 (produção) | normal | **Janela de manutenção** combinada com dono |
| 7 (liberação) | monitor 48h | Monitor **96h** |

Brownfield exige **rollback plan** documentado.

---

## §6 — Princípios de iteração

### 6.1 Quando parar

- Comportamento inaceitável = 0%, NÃO hit-rate "bom"
- Cada fix expõe próximo gap (`feedback_prompt_iteration_reveals`)
- Aceitar que problema novo aparecerá em produção real → parte pra weekly-analysis

### 6.2 Quando NÃO afrouxar prompt

- Sem A/B medindo pre/pós (cicatriz PLAKA v2)
- Tom imperativo > descritivo (Frontend Spec P3)
- LLM interpreta "você pode" como licença ampla

### 6.3 Quando o problema é de código (não prompt)

- Description de tool ordena comportamento (cicatriz Fun PR #9 — Frontend Spec P4)
- LLM repetidamente "simula" tool sem invocar mesmo com 3 fixes de prompt → fix é dupla instrução OU `toolChoice` forçado AI SDK
- Description tem instrução conflitante com prompt → fix vai pro código (flag por tenant)

---

## §7 — Workflow de smoke pré-deploy obrigatório

```
┌─────────────────────────────────┐
│ 1. Code change merged main      │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 2. Unit tests (npm test)        │
│    Falha → BLOCK                │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 3. Smoke local cross-tenant     │
│    em ≥3 tenants (Prompt-only,  │
│    KB, integração externa)      │
│    Falha → BLOCK                │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 4. Deploy VPS (pm2 reload)      │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 5. Smoke produção whitelist     │
│    em ≥1 tenant ativo            │
│    Falha → ROLLBACK             │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 6. Monitor 30min logs em tempo  │
│    real                         │
│    Erro red-flag → ROLLBACK     │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 7. Monitor 48-96h passivo       │
│    + métricas observabilidade   │
│      (TD-22 quando disponível)   │
└─────────────────────────────────┘
```

---

## §8 — Estado atual da estratégia de teste

| Camada | Status |
|--------|--------|
| Unit | ✅ ~104 testes em Vitest, todos passando |
| Smoke local REPL | ✅ Funcional (`chat-tenant.mjs` Story 15.1) |
| Smoke automatizado por tenant | ⚠️ 4 cópias hoje (TD-12 — refactor pra template+yaml em Wave 2 Epic 18) |
| Smoke produção whitelist | ✅ Padrão estabelecido |
| Monitor pós-go-live | ⚠️ Manual via `pm2 logs` (TD-22 observabilidade resolve em Wave 3) |
| Cenários C1-C7 cross-tenant | ✅ Documentados nesta §3 |
| Anti-patterns A1-A10 | ✅ Documentados em Frontend Spec §7 + §4 deste capítulo |
| Método refino 7 passos | ✅ Documentado nesta §5 |

---

*Capítulo 5 (Test Strategy & Variants) — Brownfield Zenya Fase 8 — 2026-04-25.*
*Resolve Q-03 parte 2 do QA Gate. Promove TENANT-REFINEMENT-PLAYBOOK + cenários C1-C7 + anti-patterns A1-A10 + método 7 passos.*
