# QA Gate Report — Brownfield Zenya

**Versão:** 0.1 (Draft, Brownfield Discovery Fase 7)
**Reviewer:** `@qa` Quinn
**Data:** 2026-04-25
**Verdict:** ⚠️ **CONCERNS** (4 PASS + 2 CONCERNS, não-bloqueante)
**Gate file:** `docs/qa/gates/zenya-brownfield-discovery-20260425.yaml`
**Total score:** 49/60 (threshold: 36/60)

> Gate canônico aplicando os 6 critérios de sucesso §3 do briefing original (`docs/zenya/_brownfield/aria-discovery-input-20260425.md`) contra todos os artefatos publicados nas Fases 1-6. Direção do canon 100% correta. 2 capítulos críticos ainda em estado de input/planejamento — entregáveis da Fase 8 (Aria consolida).

---

## §1 — Sumário executivo

### Verdict: CONCERNS

Não é APPROVED puro porque 2 dos 6 critérios dependem de capítulos ainda não publicados (Cap. 3 Operational Manual e Cap. 6 Owner Playbook — entregáveis Fase 8). Não é FAIL porque:
1. Inputs pra Cap. 3 e Cap. 6 estão **todos disponíveis e consolidados**
2. Direção arquitetural e UX está **100% definida**
3. Aria, Dara e Uma deixaram **plano explícito** do que vai entrar em cada capítulo

### Recomendação

**Aria prossegue pra Fase 8 com 5 entregáveis pré-requisitos** (Cap. 3, 4, 5, 6, 8a + housekeeping físico). **Mini-gate ao final** re-valida critérios 1 e 2 antes de fechar Fase 8.

### Distribuição de issues

| Severidade | Count | Descrição |
|------------|-------|-----------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 2 | Q-01 (Cap. 3 falta), Q-02 (Cap. 6 falta) — bloqueiam mini-gate Fase 8 |
| LOW | 3 | Q-03 (Cap. 4+5), Q-04 (housekeeping físico), Q-05 (instrução de mini-gate) |

---

## §2 — Critério 1 — Teste do agente novo (15-30 min sabe operar)

### Cenário simulado

**Setup:** instância `@dev` nova, sem context prévio. Recebe a tarefa: *"Cliente do PLAKA reportou bug — bot tá inventando preço de produto. Investigue e proponha fix."*

**Caminho esperado:**
1. Lê canon (15-30min) → entende: o que é Zenya, stack, schema, fluxo agente, integrações PLAKA
2. Sabe rodar local pra reproduzir
3. Sabe debugar (logs PM2, queries SQL operacionais)
4. Sabe atualizar prompt do PLAKA (TENANT-PLAYBOOK §9.4-9.5)

### O que canon HOJE entrega vs falta

| Necessidade | Status canon | Onde encontra hoje |
|-------------|--------------|---------------------|
| O que é Zenya | ✅ Cap. 1 §1 (1 frase) + ZENYA-CANONICAL §1 | Canon |
| Stack ponta-a-ponta | ✅ Cap. 1 §2 (diagrama E2E) + §3 (stack) | Canon |
| Schema completo | ✅ Cap. 2 §1-§2 (DDL canônica + drift map) | Canon |
| Fluxo do agente | ✅ Cap. 1 §4-§5 (componentes + contratos internos) | Canon |
| Integrações disponíveis | ✅ Cap. 1 §4.5 (tool-factory + tabela) | Canon |
| Convenções do projeto | ✅ ZENYA-CANONICAL §convenções globais | Canon |
| **Como rodar local** | ❌ **NÃO no canon** | `package.json` scripts (sem doc canônico) |
| **Como atualizar prompt** | ⚠️ **Não no canon — em RUNBOOK.md §1** | Doc separado, ainda não promovido |
| **Como criar tenant** | ⚠️ **Não no canon — em TENANT-PLAYBOOK §9 + RUNBOOK §3** | Doc separado |
| **Como debugar** | ⚠️ **Parcial — em RUNBOOK §7** + queries em Cap. 2 §11.1 | Espalhado |
| **Catálogo de queries operacionais** | ✅ Cap. 2 §11 | Canon |

### Veredito: **CONCERNS** (6/10)

**Por quê não FAIL:** 50% do canon está publicado e a outra metade existe em docs reais (TENANT-PLAYBOOK, RUNBOOK, TENANT-REFINEMENT-PLAYBOOK), só falta promoção formal.

**Por quê não PASS:** agente novo HOJE encontra 2 layers (canon novo + docs antigos) e pode confundir. "Como rodar local primeira vez" não está em lugar nenhum claramente. Cap. 3 Operational Manual é o lugar — entregável Fase 8.

**Mitigação imediata (zero esforço Aria):** ZENYA-CANONICAL.md já aponta pros docs antigos (TENANT-PLAYBOOK, RUNBOOK) como referência ativa até Cap. 3 publicar. Agente que ler ZENYA-CANONICAL primeiro vai ser direcionado certo.

### Issue Q-01 — Severity MEDIUM

**Descrição:** Cap. 3 Operational Manual não publicado.
**Recomendação:** Aria materializa na Fase 8 promovendo + reescrevendo:
- TENANT-PLAYBOOK §9-10 → Capítulo 3 §1-§5
- RUNBOOK §1-7 → Capítulo 3 §6-§10
- Adicionar §0 "Setup local primeira vez" (clone repo + .env + npm install + npm run dev + verificar /zenya/health)
- Adicionar §11 "Cross-tenant operations" (ações que afetam múltiplos tenants — cuidados)

**Bloqueia mini-gate Fase 8:** sim.

---

## §3 — Critério 2 — Teste do dono (5-10 min identifica fluxo + ação)

### Cenário simulado

**Setup:** Mauro chega com caso real: *"Julia me mandou: 'o bot mandou data errada de envio do pedido pro cliente, deu confusão'. O que faço?"*

**Caminho esperado pelo briefing:**
1. Mauro abre Cap. 6 Owner Playbook
2. Identifica fluxo OP-1 (cliente reporta bug no comportamento do bot)
3. Vê em ≤5min: gatilho · decisões · ação · agente a invocar · critério de sucesso · anti-pattern · tempo esperado
4. Em ≤10min: já sabe se é caso de prompt adjustment, code fix, ou processo

### O que canon HOJE entrega vs falta

| Pergunta de Mauro | Status canon | Onde está |
|-------------------|--------------|-----------|
| "Cliente reportou bug — qual fluxo?" | ❌ **Cap. 6 não publicado** | Frontend Spec §9 mapeia OPs mas não é o playbook em si |
| "Quero implementar função nova — global ou específica?" | ⚠️ Frontend Spec P4 + UX Specialist Review §2.7 dão pattern | Espalhado |
| "Tirar um cliente — offboarding seguro?" | ❌ **Não existe doc** | Memória `project_doceria.md` tem caso real (cliente pausado) mas sem playbook |
| "Rodar teste — smoke/piloto/sandbox?" | ⚠️ TENANT-REFINEMENT-PLAYBOOK + Frontend Spec §8 cenários cross-tenant | Doc separado |
| "Capacidade global vs específica?" | ✅ UX Specialist Review §4 pattern DB-vs-SOP | Review (vai pro Cap. 8a) |
| "Cliente quer extra fora do contrato?" | ❌ Sem doc | Sem cicatriz documentada — preventivo |
| "Incidente em produção?" | ⚠️ Cicatrizes em memórias `project_*` mas sem playbook | Espalhado |
| "Pricing/escopo de novo cliente?" | ⚠️ Memória `project_pricing_tiers` + `project_lead_micropigmentacao` | Espalhado |

### Veredito: **CONCERNS** (5/10)

**Por quê não FAIL:** todos os inputs estão consolidados nas Fases 3-6. Frontend Spec §9 e UX Specialist Review §2 mapeiam diretamente os 9 OPs. Materialização é mecânica.

**Por quê não PASS:** sem o Cap. 6 publicado, Mauro chega com caso real e tem que **navegar por 5+ docs** pra montar a resposta. Zera o objetivo "5-10 min identifica fluxo + ação".

### Issue Q-02 — Severity MEDIUM

**Descrição:** Cap. 6 Owner Playbook não publicado.
**Recomendação:** Aria materializa na Fase 8 com os 9 fluxos OP-1 a OP-9 do briefing §12 estruturados:

```markdown
## OP-1 — Cliente reporta bug no comportamento do bot

**Gatilho:** dono mensageia/email com "cliente reclamou que bot fez X"
**Decisões:**
  - É bug de prompt? → Iteração v.X+1 (loop refino brownfield validado)
  - É bug de código (description vence prompt)? → fix vai pro código (TD-04 pattern)
  - É bug de dado externo (data ambígua)? → fix no prompt + sanitização tool
**Ação:**
  1. Documentar cicatriz textual em `docs/zenya/tenants/{slug}/feedback-{nome}-{data}.md`
  2. Smoke específico do cenário
  3. Iterar prompt OU abrir story de código
**Quem aciono:**
  - @pm Morgan (avalia escopo)
  - @dev Dex (implementa fix)
  - @qa Quinn (valida)
**Critério de sucesso:** comportamento inaceitável = 0% no smoke (não "hit-rate ok")
**Anti-pattern:** afrouxar prompt sem medir → drift silencioso (cicatriz PLAKA v2)
**Tempo esperado:** 1-3h pra fix de prompt simples; 1-2 dias pra fix de código
```

E assim os 9 OPs.

**Inputs disponíveis (zero invenção):**
- Frontend Spec §9 (mapeamento OPs → decisões UX)
- UX Specialist Review §2 (refinements por TD)
- Tech Debt Draft §4 (recomendações sobre Epics)
- Memórias `feedback_*` (anti-patterns por OP)

**Bloqueia mini-gate Fase 8:** sim.

---

## §4 — Critério 3 — Teste do dado (zero defasagem ativa)

### Validações realizadas

| Item | Validação | Resultado |
|------|-----------|-----------|
| Schema produção vs Cap. 2 | Management API vs DDL canônica | ✅ 100% match (incluindo Migration 008 aplicada) |
| Migrations 001-008 | Catalog vs realidade | ✅ Todas mapeadas; 008 aplicada com autorização Mauro |
| 7 tabelas zenya_* | Cap. 2 §2 vs `information_schema.columns` | ✅ Todas cobertas (incluindo `zenya_client_users` Cockpit) |
| Estados intencionais | Briefing vs respostas Mauro | ✅ HL pausado, PLAKA aguarda número, Ensinaja não-prioritário — todos clarificados |
| Polissemia tenant_id (TD-03) | Schema real vs proposta | ✅ Catalogada com plano zero-downtime |
| Queue leak (TD-02) | 875 pending → 4 causas distintas | ✅ Refinada na Fase 5 com evidência |
| Locks órfãos (TD-A) | Schema vs realidade | ✅ 2 locks ativos detectados (5d e 8d Julia) |
| Volume real | Queries DB-V2/V3/V8/V22/V23 | ✅ Documentado (Julia 738 msgs/7d, etc.) |
| organs/zenya correção | Cap. 1 v0.1 vs realidade VPS | ✅ v0.2 corrige (Cockpit Cliente Zenya parcial — não dead code) |
| Supabase legado | Sonda Q17 | ✅ Confirmado removed; sem escrita dupla |

### Veredito: **PASS** (10/10)

Cap. 1 v0.2 + Cap. 2 + Runtime Drift Audit refletem realidade auditada. Defasagens identificadas estão **catalogadas como dívidas no Tech Debt Draft**, não como verdades no canon. Rastreabilidade completa.

---

## §5 — Critério 4 — Teste da redundância (docs antigos classificados)

### Inventário cap. 1 §10

17 docs em `docs/zenya/` classificados:

| Categoria | Docs | Status no canon |
|-----------|------|-----------------|
| **Promovidos** | TENANT-PLAYBOOK, RUNBOOK, TENANT-REFINEMENT-PLAYBOOK | Doc original mantém; conteúdo migra pra Cap. 3-5 na Fase 8 |
| **Reescrita** | NUCLEUS-CONTRACT (v2 com realidade Cockpit), KNOWLEDGE-BASE, ERROR-FALLBACK-MAP, BASELINE-PERFORMANCE, FLOW-INVENTORY | Substituído por Cap. 1+5+6 na Fase 8 |
| **Deprecated** | ISOLATION-SPEC | `_appendix/C-deprecated.md` na Fase 8 |
| **Apêndice histórico** | ZENYA-CONTEXT, SOP-FLOW-INVENTORY-UPDATE, imports n8n, raw, proposals | `_appendix/B-historical-n8n-era.md` na Fase 8 |
| **Mantidos como estão** | tenants/{slug}/prompt.md (ADR-001), ip/, contratos/, templates/ | — |

### Veredito: **PASS** (9/10)

**Justificativa explícita** pra cada classificação. Ponto de atenção: **execução física** dos movimentos (mover arquivos, marcar deprecated headers) ainda não aconteceu. Issue Q-04 (LOW).

### Issue Q-04 — Severity LOW

**Descrição:** Movimentação física de docs antigos pra `_appendix/_deprecated/` não executada.
**Recomendação:** Aria faz na Fase 8 junto com publicação dos Cap. 3-6.
**Bloqueia mini-gate Fase 8:** não.

---

## §6 — Critério 5 — Teste do template (convenções extraíveis)

### Convenções catalogadas explicitamente no canon

| Convenção | Onde |
|-----------|------|
| Slug naming, branch, commits, env vars | ZENYA-CANONICAL §convenções globais |
| Webhook único, cache 5min, history 50/20, debounce 2.5s | ZENYA-CANONICAL + Cap. 1 §6 |
| Pattern factory tools (closure tenantId — security critical) | Cap. 1 §5.4 + §8.2 |
| Pattern AES-256-GCM credenciais | Cap. 1 §5.5 + Cap. 2 §5 |
| Pattern test-from-source smokes | Frontend Spec §8 |
| Pattern flag opt-in/opt-out por tenant (escalation_public_summary modelo) | Frontend Spec P4 |
| 9 princípios universais UX (P1-P9) | Frontend Spec §2 |
| 10 anti-patterns documentados (A1-A10) | Frontend Spec §7 |
| Atomic conversacional (atoms/molecules/organisms/templates/pages) | Frontend Spec §6 |
| Pattern DB-vs-SOP (quando flag de código vs regra de SOP) | UX Specialist Review §4 |
| Defaults inviolavéis cross-tenant (template canônico v1) | UX Specialist Review §4 |

### Veredito: **PASS** (9/10)

Convenções **explicitamente listadas, não inferidas**. Template canônico v1 detalhado em UX Specialist Review §4. Formalização final no Cap. 8a (Fase 8).

### Issue minor (já catalogada)

Template canônico v1 ainda em estado de **proposta na review**. Aria materializa no Cap. 8a (parte do entregável Fase 8). Não-bloqueante porque conteúdo já existe.

---

## §7 — Critério 6 — Teste da lacuna (dívidas catalogadas P0/P1/P2)

### Catálogo Tech Debt Draft (Aria) + reviews (Dara, Uma)

| Severidade | Antes da Fase 6 | Pós-revisões | Status |
|------------|------------------|--------------|--------|
| P0 (bloqueia operação) | 5 | 5 | TD-01, TD-02, TD-03, TD-04, TD-05 |
| P1 (sistêmico) | 11 | 11 | TD-06 a TD-16 |
| P2 (mantenabilidade) | 9 | 8 (TD-24 rebaixado P3) | TD-17 a TD-25 |
| P3 (cosmético/futuro) | 3 | 4 (+ TD-24) | TD-26 a TD-28 + TD-24 |
| Resolvidas durante brownfield | 4 | 4 | TD-R1 a TD-R4 |
| Estados intencionais | 3 | 3 | TD-I1 a TD-I3 (Ensinaja, HL, PLAKA) |
| Achados novos UX (Fase 6) | n/a | 5 | UX-1 a UX-5 (mapeados em TDs existentes ou catalogados) |
| Recomendações descarte (Fase 6) | n/a | 1 | D-Q (cicatriz fraca, custo alto) |

### Waves de remediation com critério de saída

| Wave | TDs | Critério de saída |
|------|-----|-------------------|
| Wave 0 (em curso) | Migration 008, correção Cap. 1, princípios cross-núcleo, drift audit | ✅ Fase 8 fecha (canon + housekeeping) |
| Wave 1 (pre-launch) | TD-01, TD-02, TD-06, TD-07, TD-08 | Smoke cross-tenant sem leak; KB sync ativo; lock count estável; reset funcional |
| Wave 2 (robustez) | TD-03, TD-09, TD-10, TD-11, TD-12, TD-13, TD-14, TD-15, TD-16 | Onboarding ≤30min sem cópia-cola; migration ledger funcional |
| Wave 3 (capacidades novas) | TD-04, TD-22, Frontend D-R, TD-17 a TD-21 | Lembretes proativos derivado funcional; observabilidade exposta no canal admin |
| Wave 4 (cosmético) | TD-23, TD-24, TD-25, TD-26, TD-27, TD-28 | Backlog cleanup conforme bandwidth |

### Decisões pendentes pra PM Morgan (Fase 10)

| Decisão | Recomendação Aria/Dara/Uma |
|---------|------------------------------|
| Materializar Epic 18 | PM Morgan owns; sub-stories owned por dev/data-engineer/ux conforme escopo |
| TD-13 boundary Plaka AEO | Mover pra `packages/aeo` + ADR-002 |
| TD-03 polissemia opção | **A (rename)** confirmada com plano Expand-Contract |
| TD-04 lembretes onde rodam | **Worker PM2 separado** (`zenya-reminders`) |
| Cockpit quem mantém | Story "auditoria Cockpit" Wave 3 (após core estável) |

### Veredito: **PASS** (10/10)

Catálogo completo, classificação rigorosa, waves com critérios de saída, esforço estimado, riscos mapeados. **Nenhuma dívida vira surpresa pra agente novo** — todas estão no Tech Debt Draft.

---

## §8 — Análise transversal — pontos fortes e fracos do brownfield

### Pontos fortes (justificam direção do APPROVED)

1. **Auditoria empírica vs especulativa.** 100% dos achados têm cicatriz factual ou query de validação. Article IV (No Invention) cumprido com folga.
2. **Princípios cross-núcleo extraídos como memória persistente.** `feedback_legacy_runtime_contamination` + `feedback_automation_over_input` viram lei pra futuros núcleos SparkleOS.
3. **Decisões pendentes documentadas, não escondidas.** 5 perguntas pra PM Morgan no Tech Debt Draft + 5+ decisões em handoffs. Próximo agente entra sabendo o que falta decidir.
4. **Migration 008 aplicada durante o próprio brownfield.** Demonstra que canon não fica só no papel — saneamento já começou.
5. **Reviews especializadas refinaram, não só carimbaram.** Dara descobriu 4 causas em TD-02 (não 2). Uma recomendou descarte de D-Q (com justificativa). Process integrity cumprido.

### Pontos fracos (justificam CONCERNS, não APPROVED)

1. **Capítulos 3 e 6 do canon não publicados.** Operational Manual e Owner Playbook são os capítulos que o **agente novo** e o **dono** consultam diretamente. Sem eles, canon entrega arquitetura mas não operação.
2. **Movimentação física de docs antigos não executada.** `_appendix/`, `_deprecated/` ainda não criados; arquivos antigos ainda em local original.
3. **Mini-gate Fase 8 ainda não rodado.** Não temos validação empírica de que critérios 1 e 2 vão passar quando Cap. 3 e Cap. 6 publicarem — só plano.

### Risco residual

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Aria publica Cap. 3 superficial | Baixa | Alto (Q-01 não resolve) | Mini-gate Fase 8 com simulação concreta de agente novo |
| Aria publica Cap. 6 sem todos 9 OPs | Baixa | Alto (Q-02 não resolve) | Mini-gate Fase 8 com simulação concreta de Mauro |
| Decisões pendentes PM Morgan ficam abertas indefinidamente | Média | Médio | Fase 10 (Master Plan) força resolução antes de materializar Epic 18 |
| TD-04 Lembretes proativos é capacidade nova com complexidade subestimada | Média | Médio | Wave 3 — dá folga; pode quebrar em sub-stories no Epic 18 |

---

## §9 — Recomendações pro Aria (Fase 8)

### Sequência recomendada de execução

1. **Cap. 3 — Operational Manual primeiro** (resolve Q-01)
   - Promove TENANT-PLAYBOOK §9-10 + RUNBOOK §1-7
   - Adiciona §0 "Setup local primeira vez"
   - Adiciona §11 "Cross-tenant operations"
   - Inclui catálogo de queries operacionais Cap. 2 §11 como apêndice
2. **Cap. 6 — Owner Playbook** (resolve Q-02)
   - Estrutura os 9 OPs do briefing §12 com formato canônico
   - Inputs: Frontend Spec §9 + UX Specialist Review §2 + Tech Debt Draft §4
   - Cada OP tem gatilho · decisões · ação · agente · critério · anti-pattern · tempo
3. **Cap. 4 — Access & Credentials Map** (resolve Q-03 parte 1)
   - Consolida .env vars + crypto pattern + memórias `reference_*`
   - Pattern de seed de credencial nova
4. **Cap. 5 — Test Strategy & Variants** (resolve Q-03 parte 2)
   - Promove TENANT-REFINEMENT-PLAYBOOK
   - Cenários cross-tenant C1-C7 do Frontend Spec §8 obrigatórios
5. **Cap. 8a — Template Canônico do Método SparkleOS**
   - Material em UX Specialist Review §4
   - Princípio fundamental: este template vai pros próximos núcleos
6. **Housekeeping físico** (resolve Q-04)
   - Cria `docs/zenya/_canonical/_appendix/B-historical-n8n-era.md`
   - Cria `docs/zenya/_canonical/_appendix/C-deprecated.md`
   - Move arquivos antigos com nota de deprecate no header
7. **Mini-gate antes de fechar Fase 8** (cumpre Q-05)
   - Roda simulação concreta dos critérios 1 e 2
   - Se passar → APPROVED final
   - Se não → ciclo de fix

### Esforço estimado pra Aria na Fase 8

| Entregável | Esforço |
|------------|---------|
| Cap. 3 Operational Manual | M-L (2-3 dias — promoção + gaps + setup local) |
| Cap. 6 Owner Playbook | M-L (2-3 dias — 9 OPs estruturados) |
| Cap. 4 Access & Credentials | M (1-2 dias — consolidação) |
| Cap. 5 Test Strategy | M (1-2 dias — promoção + cenários cross-tenant) |
| Cap. 8a Template Canônico | M (1 dia — formalização do material da Review UX) |
| Housekeeping físico | S (4h — moves + headers de deprecate) |
| Mini-gate validação | S (2-4h — simulação) |

**Total Fase 8: ~8-12 dias úteis** (1.5-2.5 sprints).

---

## §10 — Próximas fases

| Fase | Status pós-gate | Ação |
|------|-----------------|------|
| **8 — Final Assessment + Template Canônico (Aria)** | 🟢 Liberada com 5 entregáveis pré-requisitos + mini-gate | Aria executa |
| 9 — Executive Report (Alex) | ⏳ Espera Fase 8 fechar | Resumo executivo ≤2 páginas |
| 10 — Master Plan + Epic 18 (Morgan) | ⏳ Espera Fase 9 | Materializa Epic 18 com waves do Tech Debt Draft |

---

*QA Gate Report — Brownfield Zenya, Fase 7, 2026-04-25.*
*Verdict: CONCERNS (4 PASS + 2 CONCERNS, não-bloqueante). Direção 100% correta; Cap. 3 e Cap. 6 são entregáveis Fase 8 com mini-gate ao final.*
