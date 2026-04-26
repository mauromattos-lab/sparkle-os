# Apêndice B — Era Histórica n8n (2026-04-08 a 2026-04-22)

**Tipo:** Apêndice histórico
**Status:** Read-only — preserva documentação da era n8n da Zenya antes da migração pro core TypeScript
**Data:** 2026-04-25 (Brownfield Discovery Fase 8)

> **Por que existe:** durante 14 dias a Zenya rodou primariamente em n8n. Vários docs descrevem essa era. Movê-los pra apêndice **preserva a história** sem confundir agente novo lendo o canon atual.
>
> **Como usar:** consultar **só** quando:
> - Investigando padrão observado no core que herda de design n8n
> - Migrando tenant legado que ainda tem workflow n8n original (caso Ensinaja)
> - Fazendo arqueologia de decisão histórica

---

## Docs nesta era (movidos pra cá ou referenciados aqui)

### `docs/zenya/ZENYA-CONTEXT.md` (mantido em local original com header de deprecate)

**Versão original:** descreve Zenya 100% n8n + tabela `n8n_historico_mensagens`.

**Realidade hoje (2026-04-25):** 6/7 tenants no core TS; apenas Ensinaja resta em n8n (pausado por cliente). Tabela `n8n_historico_mensagens` não existe mais no Supabase ativo.

**Substituído por:** Cap. 1 — System Architecture do canon brownfield.

### `docs/zenya/SOP-FLOW-INVENTORY-UPDATE.md` (mantido em local original com header de deprecate)

**Versão original:** SOP pra atualizar inventário de fluxos n8n.

**Realidade hoje:** sem inventário de fluxos n8n; capacidades do core são código TS, não fluxos n8n.

**Substituído por:** Cap. 3 §4 (adicionar integração nova ao core).

### `docs/zenya/raw/` e `docs/zenya/{tenant}-import/`

**O que são:** workflows n8n exportados (JSON) durante migração de cada tenant.

**Status:** preservados como **arqueologia** — útil pra reconstruir prompt baseline ou padrão de fluxo se necessário.

**Não usar como referência ativa.**

### `docs/zenya/proposals/` (avaliar caso a caso)

**O que são:** propostas técnicas de era n8n (ex: PROP-001 TTL Postgres).

**Status:** algumas viraram dívida ativa (catalogada no Tech Debt Draft); outras viraram apêndice.

---

## Era timeline

| Data | Marco |
|------|-------|
| 2026-04-08 | Início da Zenya em n8n (Mauro + workflows fazer.ai) |
| 2026-04-11 | Story 2.1 — Atlas documentou 15 fluxos `Zenya Prime` em FLOW-INVENTORY |
| 2026-04-11 | NUCLEUS-CONTRACT.md v1.0 desenhada (porta 3002 — depois evoluiu pra 3005) |
| 2026-04-11 | ISOLATION-SPEC.md v1.0 desenhada com `data_isolation_key` (nunca implementada) |
| 2026-04-22 | Cutover HL Importados pro core (primeiro tenant 100% no core; gate PASS w/concerns) |
| 2026-04-23 | Cutover Doceria pro core |
| 2026-04-23 | Epic 16 Done — refino brownfield Fun Personalize |
| 2026-04-24 | Scar AI go-live (primeiro tenant greenfield no core, sem n8n histórico) |
| 2026-04-25 | Brownfield Discovery (este projeto) — saneamento completo |

---

## Lições da era

### O que funcionou bem em n8n e foi PORTADO pro core

- Estrutura de prompt em XML/markdown (PAPEL, PERSONALIDADE, SOP, REGRAS CRÍTICAS) — virou template canônico
- Pattern de escalação via label `agente-off` no Chatwoot
- Fluxo: webhook Chatwoot → agent → Chatwoot → Z-API → WhatsApp
- Padrão de tools nomeadas em PT (Buscar_pedido, Escalar_humano)

### O que foi DESCARTADO

- Engine n8n como executor principal — substituído por TypeScript/Hono
- Tabela `n8n_historico_mensagens` — substituída por `zenya_conversation_history`
- Interpolações `{{ $now }}`, `{{ $('Info') }}` — substituídas por injeção via `buildSystemPrompt`
- 15 fluxos numerados — viraram código modular (workers, integrations, agents)

### O que foi REDESENHADO

- Multi-tenant: era 1 fluxo por cliente em n8n; virou 1 código compartilhado + tabela `zenya_tenants`
- Credenciais: era hardcoded em workflow JSON; virou AES-256-GCM em `zenya_tenant_credentials`
- Agent: era nó único com `systemMessage` longo; virou `runZenyaAgent` modular com tool-factory closure

---

*Apêndice B — Brownfield Zenya Fase 8 — 2026-04-25.*
