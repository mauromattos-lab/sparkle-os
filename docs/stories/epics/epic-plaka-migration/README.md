# Epic: plaka-migration

**Status:** 📝 Draft — Spec Pipeline concluída (APPROVED 4.4/5, plano arquitetural em `docs/stories/plaka-01/spec/implementation.yaml`). Aguarda @sm criar stories a partir das waves.
**Owner:** @pm (Morgan)
**Origem:** Spec Pipeline PLAKA — `docs/stories/plaka-01/spec/spec.md`
**Data de abertura:** 2026-04-21

---

## Objetivo

Migrar o tenant **PLAKA Acessórios (Roberta)** dos 8 fluxos n8n para o core Zenya (TypeScript multi-tenant, VPS 187.77.37.88), habilitando 1.000–5.000 conversas/mês de SAC exclusivo com integração Nuvemshop + Google Sheets como KB.

## Por que existe

- **Bloqueio operacional:** conta WhatsApp Business original da PLAKA foi bloqueada administrativamente (não falha técnica) — o cliente está **parado** aguardando solução
- **Dívida técnica:** fluxos n8n (fazer.ai) têm limite estrutural de manutenção — cada integração vira ilha
- **Decisão arquitetural:** SparkleOS é o habitat natural da Zenya (ver Epic 7); novos clientes não devem nascer em n8n
- **Reuso validado:** Z-API, tenant-loader, tool-factory, padrão ADR-001 de prompts — tudo já rodando em produção com outros tenants

## Entrada (spec pipeline concluída)

| Artefato | Localização |
|----------|-------------|
| Requirements | `docs/stories/plaka-01/spec/requirements.json` |
| Complexity (COMPLEX 17/25) | `docs/stories/plaka-01/spec/complexity.json` |
| Research | `docs/stories/plaka-01/spec/research.json` |
| Spec (APPROVED 4.4/5) | `docs/stories/plaka-01/spec/spec.md` |
| Critique @qa | `docs/stories/plaka-01/spec/critique.json` |
| Implementation plan (@architect) | `docs/stories/plaka-01/spec/implementation.yaml` |
| Prompt canônico (já no padrão ADR-001) | `docs/zenya/tenants/plaka/prompt.md` |

## Waves de execução (resumo do `implementation.yaml`)

| Wave | Nome | Paralelo | Depende de | Foco |
|------|------|:---:|------------|------|
| W1 | Preflight & Infraestrutura de Dados | ✅ | — | DDL `zenya_tenant_kb_entries`; adquirir número Salvy; credenciais Nuvemshop; Service Account Google Sheets; inbox Chatwoot |
| W2 | Implementação das tools novas + seeds | Parcial | W1.T1.1 | `nuvemshop.ts` (tool + testes); KB snapshot worker + tabela; `seed-plaka-tenant.mjs`; `seed-plaka-credentials.mjs` |
| W3 | Cutover + Smoke | ❌ | W1.T1.2 + W2 | Parear Z-API com número novo; smoke test real (5 mensagens); 48h de watch |
| W4 | Pós-Cutover | — | W3 | Monitorar 72h; transicionar fluxos n8n pra standby; docs |

**Estimativa total:** 34h de dev + validação.

## Decisões arquiteturais (AD-1..AD-4, do `implementation.yaml`)

- **AD-1:** Nova **inbox** em conta Chatwoot existente (não nova conta)
- **AD-2:** Google Sheets KB como **snapshot** em Postgres (`zenya_tenant_kb_entries`, sync 15min) — elimina quota risk + latência externa
- **AD-3:** Provider adapter pattern DEFERRED — epic separado após PLAKA estabilizar (Meta direto como plano B se re-bloquear)
- **AD-4:** Credenciais Nuvemshop OAuth2 reusam `zenya_tenant_credentials` sem alteração (access_token de longa duração)

## Critérios de sucesso do epic

- [ ] PLAKA respondendo mensagens reais via SparkleOS por 48h sem incidentes
- [ ] Nuvemshop tool consulta pedidos (AC-2: < 10s)
- [ ] Google Sheets KB sincronizado periodicamente e respondendo < 30s p95 (AC-3/AC-4)
- [ ] Prompt canônico `docs/zenya/tenants/plaka/prompt.md` alinhado com o banco (md5 match)
- [ ] Fluxos n8n em standby por 7 dias sem incidentes críticos
- [ ] Stories do epic todas Done, @qa PASS

## Não escopo

- Adapter pattern genérico de providers WhatsApp (AD-3 — epic separado)
- Migração de outros tenants ainda em n8n (HL já tem story própria: `hl-onboarding-01`)
- Automação proativa / campanhas — PLAKA é SAC exclusivo (CON-1)
- Interface de admin do KB (Sheets é a fonte)

## Dependências externas bloqueadoras

1. **Número novo Salvy** (T1.2) — compra depende do Mauro
2. **Credenciais Nuvemshop OAuth2** (T1.3) — autorização no painel da PLAKA, depende do Mauro
3. **Compartilhamento da planilha Google** com Service Account (T1.4) — depende do Mauro

Tudo o mais (tool Nuvemshop, worker KB, seed, migration DDL) é **trabalho puro de código** e pode ser feito em paralelo enquanto os desbloqueios externos andam.

## Referências

- Story de entrada: `docs/stories/plaka-01/`
- Prompt canônico (pronto no padrão ADR-001): `docs/zenya/tenants/plaka/prompt.md`
- Runbook operacional: `docs/zenya/RUNBOOK.md`
- Playbook arquitetural: `docs/zenya/TENANT-PLAYBOOK.md`
- Memória: `memory/project_plaka.md`

## Próximos passos

1. **@sm:** criar stories a partir das waves W1-W4 do `implementation.yaml` (estimado 4-6 stories)
2. **@devops:** executar T1.2 (número Salvy) e T1.3/T1.4 (credenciais) em paralelo com @dev
3. **@dev:** começar trabalho de código puro (Nuvemshop tool + KB snapshot worker) independente dos desbloqueios
