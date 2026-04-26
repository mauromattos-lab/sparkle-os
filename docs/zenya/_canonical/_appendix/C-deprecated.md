# Apêndice C — Docs Deprecated

**Tipo:** Apêndice de docs deprecated com justificativa
**Status:** Read-only — preserva docs que descrevem designs **que nunca existiram em produção**
**Data:** 2026-04-25 (Brownfield Discovery Fase 8)

> **Diferença de B (histórico) e C (deprecated):**
> - **Apêndice B** preserva docs de uma era que **realmente existiu** (n8n)
> - **Apêndice C** preserva docs de designs que **nunca foram implementados** — design intencional abandonado em favor de outro

---

## §1 — `docs/zenya/ISOLATION-SPEC.md` — DEPRECATED

**Por quê deprecated:** descreve mecanismo de isolamento que **nunca existiu em produção**:
- Tabelas `zenya_clients` e `zenya_conversations` com `data_isolation_key` UUID
- Policy RLS usando `current_setting('app.current_client_key')`
- Helper `set_config('app.current_client_key', key, TRUE)` chamado por `listConversations`

**Realidade que prevaleceu:**
- Tabelas reais: `zenya_tenants` + `zenya_conversation_history` (com `tenant_id`, não `data_isolation_key`)
- Mecanismo real de isolamento: **closure JavaScript de `tenantId` no `tool-factory`** (Cap. 1 §5.4)
- RLS está **habilitada nas migrations 002+003** mas **dormant** (service key bypassa)

**Substituído por:** Cap. 2 §4 (Schema & Data — mecanismo de isolamento real vs intencional vs deprecated).

**Cicatriz:** docs de 2026-04-11 descreveram um design que foi **abandonado durante implementação** (Story 2.7 → 7.x). Mas o doc não foi atualizado. Brownfield Fase 1+2 (2026-04-25) detectou e corrigiu.

---

## §2 — `docs/zenya/NUCLEUS-CONTRACT.md` — REESCRITA v2 (não deprecated puro)

**Status:** **NÃO é deprecate puro** — descreve API que **evoluiu organicamente**, não foi abandonada.

**Versão original (2026-04-11):**
- API REST `organs/zenya/` na **porta 3002**
- Endpoints `/flows`, `/clients`, `/flows/:id/run`, `/flows/:id/clone`
- Sucessor n8n adapter

**Realidade hoje (2026-04-25):**
- `organs/zenya/dist/server.js` rodando como PM2 process `zenya-api` na **porta 3005** (não 3002)
- Nginx site `zenya-api` aponta `zenya.sparkleai.tech` → 127.0.0.1:3005
- Endpoints atuais:
  - `GET /health` ✅ funciona
  - `GET /flows` ✅ funciona (depende n8n vivo na VPS)
  - `POST /clients` ⚠️ provavelmente broken (faz query em `zenya_clients` que não existe no DB)
  - `GET /cockpit/conversations` ✅ — Cockpit Cliente Zenya (Epic 10 parcial)
  - `GET /cockpit/metrics` ✅ — idem
- Front-end Vercel ativo: `vercel.com/mauro-mattos-projects-389957a6/zenya-cockpit`

**Substituído por:**
- Cap. 1 §3, §9.3 (System Architecture v0.2 corrige descrição)
- **NUCLEUS-CONTRACT.md v2** (a escrever quando Cockpit Epic 10 evoluir — Wave 3 Epic 18)

**Decisão Mauro 2026-04-25:** Cockpit é **InProgress (parcial)** — pré-requisito é brownfield Zenya core estabilizar. NUCLEUS-CONTRACT v2 fica em backlog até Cockpit voltar como prioridade.

---

## §3 — Outros candidatos a deprecate (avaliar caso a caso na Fase 10)

| Doc | Status proposto | Por quê |
|-----|-----------------|---------|
| `docs/zenya/ERROR-FALLBACK-MAP.md` | Reescrita (não deprecate) | Erros reais vivem em `worker/webhook.ts` + agentes; classes `ZenyaXxxError` não existem mas pattern de fallback existe |
| `docs/zenya/KNOWLEDGE-BASE.md` | Reescrita | Algumas SCs valem (SC-01, SC-02), outras não migraram (SC-09 lembrete = TD-04) |
| `docs/zenya/BASELINE-PERFORMANCE.md` | Reescrita | Métricas n8n abril/8-11 obsoletas; precisa baseline core (TD-22) |
| `docs/zenya/FLOW-INVENTORY.md` | Reescrita | 15 fluxos n8n viraram código modular — sem mapa 1:1 |

> **Quando reescrever:** quando algum agente/dev precisar de cada um. Hoje Cap. 1+3+5 do canon cobrem ~80% do conteúdo útil; o restante tem ROI baixo de migrar.

---

## §4 — Anti-pattern de "design abandonado sem deprecate"

**Lição cross-núcleo (vai pra `feedback_legacy_runtime_contamination`):**

Quando design intencional é abandonado durante implementação, **doc original deve receber header de deprecate explícito** apontando pro substituto. Sem isso, agente novo lê e fica perdido (cicatriz: ISOLATION-SPEC enganou agente novo até Brownfield Fase 1+2 detectar).

**Pattern proposto pra próximos núcleos:**

```markdown
# {Doc Title}

**⚠️ DEPRECATED — 2026-04-25**

Este documento descrevia o design intencional original. **Não foi implementado.**

**Realidade implementada:** ver {Cap. X do canon}.

**Por que não foi implementado:** {breve justificativa, 1-2 frases}.

---

[conteúdo original preservado abaixo pra referência histórica]
```

---

*Apêndice C (Deprecated) — Brownfield Zenya Fase 8 — 2026-04-25.*
