# PROP-001 — TTL para Memória Postgres (n8n_historico_mensagens)

## Identificação

| Campo | Valor |
|-------|-------|
| **ID da Proposta** | `PROP-001` |
| **Data** | `2026-04-11` |
| **Proposto por** | `@architect (Aria)` |
| **Fluxo(s) afetado(s)** | `01. Secretária v3` (ID: `r3C1FMc6NIi6eCGI`) — escrita na tabela `n8n_historico_mensagens` |
| **Classe da mudança** | `Moderada` |
| **Toca IP?** | `Não` — lógica de infraestrutura, não toca prompts nem JS de personalidade |

---

## Mudança Proposta

Criar uma rotina periódica de limpeza da tabela `n8n_historico_mensagens` no Postgres, removendo registros com mais de N dias (sugestão inicial: 90 dias). A rotina pode ser implementada como:

- **Opção A:** Novo fluxo n8n com trigger Schedule (ex: diário às 03h) executando `DELETE FROM n8n_historico_mensagens WHERE created_at < NOW() - INTERVAL '90 days'`
- **Opção B:** pg_cron no Supabase (se disponível no plano atual)

A decisão entre Opção A e B deve ser tomada no momento de implementação, conforme disponibilidade do pg_cron no plano Supabase.

---

## Motivação

**Gap G2** identificado na Story 2.1 (`docs/zenya/FLOW-INVENTORY.md`):

> "A tabela `n8n_historico_mensagens` acumula histórico sem rotina de TTL ou limpeza nos fluxos analisados."

Sem limpeza, a tabela cresce indefinidamente. Riscos:
- Degradação de performance nas queries de histórico (usadas pelo fluxo `01.` para contexto de conversa)
- Custo crescente de storage no Postgres
- Sem valor operacional em dados com mais de 90 dias para o atendimento da Zenya

---

## Impacto Esperado

- Tabela `n8n_historico_mensagens` mantida com tamanho controlado
- Performance das queries de histórico estabilizada
- Sem impacto para o cliente — histórico recente (últimos 90 dias) preservado integralmente
- Custo de storage estabilizado

---

## Plano de Implementação

1. Clonar fluxo `01.` para ambiente de teste: `POST /nucleus/zenya/flows/r3C1FMc6NIi6eCGI/clone`
2. Criar novo fluxo de limpeza (Schedule trigger) no n8n de teste
3. Validar SQL de limpeza em tabela de teste com dados fictícios
4. Confirmar que `01.` não é afetado (queries de histórico continuam funcionando)
5. Após aprovação de @pm: criar fluxo de limpeza em produção
6. Monitorar por 1 semana

---

## Plano de Rollback

- Rotina de limpeza pode ser desativada imediatamente no n8n (toggle ativo/inativo)
- Dados já deletados não são recuperáveis — por isso o período de 90 dias é conservador
- Se necessário reduzir o período: proposta de ajuste via nova PROP

---

## Gate de Aprovação

**Classe:** Moderada | **Toca IP:** Não → **Aprovador: @pm (Morgan)**

---

## Status da Proposta

- [x] Rascunho
- [ ] Aguardando aprovação
- [ ] Aprovada
- [ ] Em implementação
- [ ] Aplicada em produção
- [ ] Rejeitada / Arquivada

**Status atual:** Rascunho — aguarda Quality Gate da Story 2.5 para entrar em fila de aprovação

---

## Histórico

| Data | Agente | Ação |
|------|--------|------|
| 2026-04-11 | @architect (Aria) | Proposta criada — Story 2.5, primeira aplicação do protocolo |
