# Cutover Log — Fun Personalize prompt migration

## Tenant alvo

| Campo | Valor |
|-------|-------|
| `id` | `a1980ce7-4174-4cd0-8fe1-b22795589614` |
| `name` | `Julia - Fun Personalize` |
| `chatwoot_account_id` | `5` |
| `active_tools` | `["loja_integrad…"]` (confirmar string exata no momento do cutover) |
| `prompt_chars` (banco) | 15028 |
| `prompt_md5` (banco, pré-cutover) | `9cc363564a9f128e79fd334045b5e595` |

_Coletado via SQL Editor em 2026-04-21._

## Pré-cutover (zero risco, já executado)

- [x] **T2.** Query de identificação do tenant executada — dados acima
- [x] **T3.** Prompt extraído de `src/tenant/seed.ts` (sincronizado com banco via `scripts/update-funpersonalize-prompt.mjs`) e salvo em `docs/zenya/tenants/fun-personalize/prompt.md` com front-matter YAML
- [x] **T4.** Script `packages/zenya/scripts/seed-fun-personalize-tenant.mjs` criado
- [x] **T5.** md5 local (`.md` pós gray-matter) = `9cc363564a9f128e79fd334045b5e595` = md5 do banco. **Match confirmado** → upsert será byte-idêntico
- [~] **T6.** Backup SQL — não aplicável (md5 idêntico, upsert neutro). Se realmente mudar algo no futuro, rodar a query da Dev Notes
- [x] **T7.** `rollback-plan.md` escrito (template pra futuras migrações com mudança real de conteúdo)
- [~] **T8.** Janela de cutover — **não necessária** por decisão do @pm. md5 match garante upsert neutro. Rodar seed no próximo bloco operacional normal

## Janela de cutover

| Campo | Valor |
|-------|-------|
| Data e hora de início | _(preencher)_ |
| Duração estimada | 30 min (10 min de upsert + 20 min de monitoramento) |
| Quem opera | Mauro (executor); @dev/@qa acompanhando via logs |
| Quem valida smoke test | Mauro + Julia (via mensagem admin) |
| Critério de rollback | qualquer item de `rollback-plan.md` §"Gatilhos para acionamento" |

## Cutover (janela combinada)

- [ ] **T9.** `pm2 logs zenya-webhook -f` aberto em terminal separado
- [ ] **T10.** `--dry-run` executado imediatamente antes do upsert → md5 ainda `9cc363564a9f128e79fd334045b5e595`? Sim/Não:
- [ ] **T11.** Seed real executado. Timestamp: _(preencher)_
- [ ] **T12.** Smoke test executado pela Julia ou Mauro. Resposta OK? Sim/Não:
- [ ] **T13.** Se regressão: aplicar rollback usando `rollback-plan.md`. _(anotar aqui se acionado)_
- [ ] **T14.** Monitoramento de 30 min após T11. Comportamento estável? Sim/Não:

## Pós-cutover

- [ ] **T15.** Story marcada como Done, commit final com cutover-log preenchido

## Incidentes

_(Registrar aqui qualquer anomalia, mesmo que recuperada)_
