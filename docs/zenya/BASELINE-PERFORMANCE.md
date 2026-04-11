# Baseline de Performance — Zenya

## Metadados

```yaml
source: zenya_operation
collected_at: 2026-04-11
collected_by: "@analyst (Atlas) — Story 2.6"

period_n8n:
  start: "2026-04-08"
  end: "2026-04-11"
  duration_days: 4
  note: "Limitado pela retenção de execuções do n8n — dados anteriores não disponíveis via API"

period_chatwoot:
  start: "2026-03-26"
  end: "2026-04-11"
  duration_days: 16
  note: "6 conversas totais — sistema em fase de testes/operação inicial"

system_phase: "testing_and_early_operation"

metrics_available:
  - execucoes_por_fluxo
  - taxa_sucesso_erro
  - duracao_media_execucao
  - distribuicao_duracao
  - volume_conversas_chatwoot
  - contagem_mensagens
  - taxa_escalacao_humano
  - etiquetas_aplicadas
  - intervalo_scheduler_lembretes

gaps:
  - tokens_openai_nao_rastreados
  - conversas_nao_resolvidas_sem_historico
  - google_calendar_sem_execucoes
  - asaas_sem_execucoes
  - google_drive_sem_execucoes
  - ligacoes_nao_configuradas
  - retencao_n8n_limitada
```

---

## Contexto Operacional

O sistema está em **fase de testes e operação inicial**. Apenas 6 conversas foram processadas desde 2026-03-26, indicando que a Zenya não está em produção plena — está sendo validada. Os dados de execução do n8n cobrem os últimos 4 dias visíveis pela API (retenção limitada).

---

## Volume

### Conversas (Chatwoot)

| Métrica | Valor |
|---------|-------|
| Total de conversas | 6 |
| Status | 6 abertas, 0 resolvidas |
| Período | 2026-03-26 → 2026-04-11 (16 dias) |
| Média de conversas/dia | ~0,4 |
| Total de mensagens | 73 |
| Mensagens recebidas (cliente) | 14 |
| Mensagens enviadas (Zenya) | 53 |
| Mensagens de atividade/sistema | 6 |
| Ratio enviadas/recebidas | ~3,8 mensagens da Zenya por mensagem do cliente |

**Distribuição por etiqueta:**
| Etiqueta | Conversas |
|---------|-----------|
| *(nenhuma)* | 3 |
| `agente-off` | 2 |
| `testando-agente` | 1 |

**Com assignee humano:** 2 de 6 conversas (Mauro Mattos)

### Execuções n8n (2026-04-08 → 2026-04-11)

| Fluxo | Execuções | Sucesso | Erro | Duração Média |
|-------|-----------|---------|------|---------------|
| `01. Secretária v3` | 165 | 165 (100%) | 0 | 10,7s |
| `07. Quebrar e enviar mensagens` | 27 | 27 (100%) | 0 | 40,4s |
| `05. Escalar humano` | 3 | 3 (100%) | 0 | 0,5s |
| `11. Agente de Lembretes` | 2.500+ | 2.500+ (100%) | 0 | 1,0s |
| `12. Gestão de ligações` | 0 | — | — | — |
| `04. Criar evento Calendar` | 0 | — | — | — |
| `03. Buscar janelas Calendar` | 0 | — | — | — |
| `06. Integração Asaas` | 0 | — | — | — |
| `02. Baixar arquivo Drive` | 0 | — | — | — |

> **Nota:** `11. Agente de Lembretes` retornou o limite de 2.500 registros da API — volume real pode ser maior. Executa a cada 1 minuto (scheduler) verificando agendamentos próximos — a maioria retorna sem ação (sem agendamentos cadastrados).

---

## Qualidade

### Taxa de Escalação

| Métrica | Valor |
|---------|-------|
| Execuções de `05. Escalar humano` | 3 |
| Execuções de `07.` (respostas AI enviadas) | 27 |
| **Taxa de escalação** | **~11%** (3/27) |
| Erros de execução (todos os fluxos) | **0** |

### Distribuição de Duração — `01. Secretária v3`

| Faixa | Execuções | Interpretação |
|-------|-----------|---------------|
| < 5s | 136 (82%) | Filtro precoce — anti-cavalgamento ou `agente-off` |
| 15–30s | 6 (4%) | Resposta AI rápida |
| 30–60s | 14 (8%) | Resposta AI padrão |
| > 60s | 9 (5%) | Resposta AI longa (máx: 123s) |

**Interpretação:** 165 webhooks recebidos, mas apenas ~29 (18%) chegaram ao processamento completo pelo AI Agent. Os 82% restantes foram interceptados cedo — principalmente pelo mecanismo de anti-cavalgamento (`Mensagem encavalada?`) ou porque a conversa estava com `agente-off`.

### Respostas AI (estimativa de tempo de resposta real)

Os 27 ciclos completos (`01.` → AI → `07.`) têm duração total:
- `01.` (processamento): ~10-120s dependendo da complexidade
- `07.` (envio com digitação simulada): média de 40,4s

**Tempo total percebido pelo cliente** (desde recebimento até última mensagem): estimado em **50–160 segundos** para respostas que passam pelo AI completo.

---

## Serviços Externos (estimativas)

| Serviço | Execuções | Estimativa de Uso |
|---------|-----------|------------------|
| **OpenAI GPT-4.1** (Secretária) | ~27 chamadas AI | ~54.000 tokens (~2.000 tokens/resposta × 27) |
| **OpenAI GPT-4.1-mini** (Divisor) | ~27 chamadas | ~3.000 tokens (~110 tokens/chamada) |
| **OpenAI Whisper** (transcrição áudio) | Não observado | 0 transcrições no período |
| **Google Calendar** | 0 | Sem agendamentos solicitados |
| **Google Drive** | 0 | Sem arquivos solicitados |
| **Asaas** | 0 | Sem cobranças criadas (sandbox configurado) |
| **Chatwoot API** | ~165 × N calls | Chamadas por execução de `01.` (sem contador direto) |

> **Nota:** Estimativas de tokens baseadas em média observada de conversas similares. OpenAI não expõe contador de tokens diretamente no n8n — monitoramento real requer instrumentação adicional (ver Gaps).

---

## Gaps de Observabilidade

### G1 — Retenção limitada do n8n
**O que não foi possível medir:** Volume histórico além de ~4 dias. A API de execuções do n8n não retorna dados anteriores à janela de retenção configurada.
**Impacto:** Impossível calcular tendências mensais, picos de uso ou sazonalidade.
**Recomendação para Epic 3:** Implementar exportação periódica das execuções para o Postgres do SparkleOS (tabela `zenya_execution_log`). Scheduler diário via `11.` ou cron separado.

### G2 — Tokens OpenAI não rastreados
**O que não foi possível medir:** Custo real de tokens por conversa, por fluxo, por período.
**Impacto:** Impossível calcular custo operacional da Zenya.
**Recomendação para Epic 3:** Adicionar node de logging após cada chamada AI Agent que registre `prompt_tokens`, `completion_tokens` e `total_tokens` no Postgres. Estrutura sugerida: tabela `zenya_ai_usage`.

### G3 — Conversas sem resolução registrada
**O que não foi possível medir:** Taxa de resolução (todas as 6 conversas estão em `open`). Tempo médio de resolução. Satisfação do cliente.
**Impacto:** Sem benchmark de qualidade de atendimento.
**Recomendação para Epic 3:** Implementar webhook de `conversation_status_changed` no Chatwoot para registrar resoluções no SparkleOS.

### G4 — Serviços externos com zero execuções
**O que não foi possível medir:** Performance do Calendar, Asaas, Drive e Gestão de Ligações.
**Motivo:** Sistema em fase de testes — nenhuma conversa real accionou esses fluxos.
**Recomendação:** Baseline será possível após primeiro mês de operação real. Reavaliação prevista na Sprint de operação inicial.

### G5 — `11. Agente de Lembretes` sem dados reais
**O que não foi possível medir:** Quantos lembretes foram efetivamente enviados (vs. execuções que não encontraram nada).
**Motivo:** Sem agendamentos cadastrados, o fluxo executa mas não envia nada — impossível distinguir na API de execuções.
**Recomendação para Epic 3:** Adicionar log de ações do Agente de Lembretes — separar execuções "encontrou agendamento" de "não encontrou nada".

### G6 — Tempo de resposta percebido pelo cliente não medido diretamente
**O que não foi possível medir:** Delay exato entre cliente enviar mensagem e receber primeira resposta, do ponto de vista do Chatwoot.
**Motivo:** `first_reply_created_at` do Chatwoot não retornou dados utilizáveis na amostra atual.
**Recomendação:** Com volume maior, usar `first_reply_created_at` vs `created_at` para calcular tempo de primeira resposta real.

---

## Referência de Comparação Futura

Este baseline serve como ponto zero para comparação. Usar estas métricas como base ao avaliar melhorias:

| KPI | Valor Baseline (abr/2026) | Período | Notas |
|-----|--------------------------|---------|-------|
| Volume de conversas | 6 | 16 dias | Sistema em testes |
| Mensagens enviadas/recebidas | 53/14 | 16 dias | Ratio 3,8x |
| Taxa de erro n8n | 0% | 4 dias | Zero erros |
| Taxa de escalação | ~11% | 4 dias | 3 de 27 respostas |
| Duração média `01.` | 10,7s | 4 dias | 82% < 5s (filtros) |
| Duração média `07.` | 40,4s | 4 dias | Inclui digitação simulada |
| Tokens OpenAI estimados | ~57.000 | 4 dias | Estimativa |

---

*Baseline coletado por @analyst (Atlas) — Story 2.6 — 2026-04-11*
*Fontes: n8n Executions API + Chatwoot API — `docs/zenya/raw/baseline_executions.json`, `baseline_convs_summary.json`*
