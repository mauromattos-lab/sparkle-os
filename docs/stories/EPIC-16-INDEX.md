# Epic 16 — Refino Brownfield da Fun Personalize (Julia)

**Status:** 🟡 Em andamento — Fases 1-3 executadas informalmente na sessão 2026-04-22 (sem arquivos .story.md formais). Fase 4 pendente (aguarda janela com Julia + monitoramento 96h). **Dívida AIOX:** draftar retroativamente 16.1-16.3 se quiser rastreabilidade completa.
**Criado por:** Morgan (@pm) — 2026-04-22
**Depende de:** Epic 15 (Método de Refino e Onboarding) — **Done** ✅
**Destrava:** Aplicações futuras do playbook em outros tenants brownfield; dados reais pro Anexo A do brief PLAKA (Zenya Admin como tier)
**Objetivo:** Aplicar o método de refino recém-formalizado (Epic 15) no primeiro tenant brownfield — Fun Personalize (Julia). Objetivos paralelos: (1) descobrir bugs silenciosos que a Julia aprendeu a conviver; (2) igualar padrão de qualidade dela ao Scar AI e PLAKA; (3) validar o playbook em tenant com tráfego real — ajustes do próprio playbook podem surgir como subproduto.

---

## Contexto

A Fun Personalize foi migrada tecnicamente (Epic 7 Story `zenya-prompts-03-fun-personalize`) e está em produção atendendo clientes da Julia desde antes do método de refino existir. O prompt foi portado 1:1 do n8n, sem smokes derivados de fonte nem iteração baseada em métricas.

**Hipótese a validar:** há bugs silenciosos que a Julia aceitou como "comportamento do bot" e que um smoke rigoroso vai expor. Exemplos possíveis (a confirmar):
- Resposta em idioma errado em mensagem curta
- Não escalar quando KB/loja_integrada retorna vazio
- Ofertar desconto sem ser pedido
- Vazar preço antes do cliente pedir

**Perfil do tenant (brownfield, tipo 3 do playbook):**
- `chatwoot_account_id: 5`
- `tenant_id: a1980ce7-4174-4cd0-8fe1-b22795589614`
- `active_tools: [loja_integrada]`
- Admin: Julia (dona) + Mauro
- Tráfego: ativo

**Gatilho de priorização:** agora. Com playbook pronto (Epic 15) + 4 memórias persistidas + smoke-template — aplicar na Fun é o teste definitivo do método.

**Risco dominante:** regressão silenciosa em tenant ao vivo. Mitigações explícitas nas stories (backup, whitelist, janela combinada, rollback SQL pronto).

---

## Arquitetura (processo, não código)

```
Fase 1 (Story 16.1) — Baseline + backup
  │   Exportar prompt atual (md5 + dump), validar sync com .md,
  │   rollback plan escrito e testado antes de qualquer mudança
  │
Fase 2 (Story 16.2) — Smoke derivado da fonte real
  │   smoke-fun.mjs adaptado de smoke-template.mjs (variante B)
  │   + cenários derivados de conversas reais recentes (20-30)
  │   + catálogo de gaps identificados
  │
Fase 3 (Story 16.3) — Fix iterativo pelo ROI
  │   Pior gap primeiro. Cada fix = PR pequeno + diff review.
  │   Re-smoke após cada. Parar quando comportamento inaceitável = 0%.
  │
Fase 4 (Story 16.4) — Produção com whitelist + liberação + monitoramento
      Janela combinada com Julia, allowed_phones whitelist,
      liberação geral após smokes-em-produção OK,
      monitoramento 96h (2x brownfield)
```

Referências operacionais: [`TENANT-REFINEMENT-PLAYBOOK.md §3`](../zenya/TENANT-REFINEMENT-PLAYBOOK.md) (Greenfield vs Brownfield) + [`§4`](../zenya/TENANT-REFINEMENT-PLAYBOOK.md) (Tipo "Prompt + KB + integrações externas").

---

## Stories

| Story | Título | Status | Depende de | Commits |
|-------|--------|--------|-----------|---------|
| 16.1 | Baseline + backup do prompt Fun | ✅ Executada informal | — | `8f03b03` |
| 16.2 | Smoke derivado (9 conversas reais + 6 cenários REPL) | ✅ Executada informal | 16.1 | `8f03b03`, `ece6358` |
| 16.3 | Fix iterativo: v2 → v3 (Julia removeu resumo) → v4 (horário comercial) | ✅ Executada informal | 16.2 | `8f03b03`, `a39188d`, `9de2a3d` |
| 16.4 | Janela + whitelist + liberação + monitoramento 96h | ⏳ **Pendente** | 16.3 | — |

## Trabalho executado informalmente (2026-04-22 madrugada)

16.1-16.3 foram conduzidas em modo exploratório "com Mauro no meio", sem passar pelo fluxo `@sm *draft → @po *validate → @qa *gate`. Artefatos rastreáveis nos commits acima, além de:

- Backup v1: `docs/stories/16/backups/prompt-fun-v1-20260422-0354.md`
- Investigação pendente: `docs/stories/16/investigacoes-pendentes.md` (tool `Buscar_produto` retornando top-5 sem match real)

**Prompt Julia evoluiu:** v1 (base portado n8n) → v2 (4 fixes) → v3 (Julia removeu Fix #4) → v4 (+ seção de horário comercial seg-sex 8h-18h).

**Dívida AIOX:** pra rastreabilidade formal, amanhã dá pra retomar com `@sm *draft 16.1/16.2/16.3` refletindo o que já foi feito → `@po *validate` → `@qa *gate` (10-15min). Alternativamente, aceitar a execução informal como válida e fechar o epic quando 16.4 completar.

**Sequencial** — diferente do Epic 15, aqui as 4 stories são estritamente sequenciais. Cada uma depende da anterior concluída. Sem paralelismo.

---

## Escopo — IN

- Aplicação das Fases 1-4 do playbook §3 Brownfield na Fun Personalize
- Criação de `smoke-fun.mjs` (adaptação do `smoke-template.mjs`)
- Catalogação escrita de gaps encontrados (story 16.2)
- Fixes iterativos no prompt da Fun (story 16.3)
- Rollback plan SQL documentado e testado
- Monitoramento 96h pós-liberação (story 16.4)

## Escopo — OUT

- **Mudança de `active_tools` da Fun** (ex: adicionar Google Calendar) — é decisão de produto, não refino. Trilha separada.
- **Mudança estrutural do core** (ex: refactor da integração `loja_integrada`) — se smoke revelar bug de código, fix-story separada fora deste epic.
- **Refino de outros tenants** (HL, PLAKA) — focar na Fun. Outros tenants brownfield depois se padrão se confirmar.
- **Automação de smoke em CI** — mantém execução manual por enquanto.
- **Zenya Admin como tier de produto** (Anexo A do brief PLAKA) — trilha separada.

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:---:|:---:|-----------|
| Regressão silenciosa em conversa ativa da Julia | Média | Alto | Backup + whitelist + rollback SQL pronto antes de qualquer mudança (16.1) |
| Smoke expor dezenas de bugs, pressão pra fix em massa | Média | Médio | Story 16.3 aplica fix iterativo ROI — pior gap primeiro, um por vez, re-smoke entre cada |
| Julia não disponível pra janela acordada | Baixa | Médio | Janela combinada com antecedência (16.4); se precisar adiar, rollback imediato sem prejuízo |
| Playbook tem gaps que só aparecem em brownfield | Alta | Baixo | É esperado — toda sessão que identificar gap abre nota no playbook (próxima versão) |
| LLM do Whisper/ElevenLabs/OpenAI indisponível durante janela | Baixa | Alto | Checar saúde das APIs no início da janela; se cair, adiar 16.4 em 24h |

---

## Definição de pronto

- [ ] Story 16.1: backup do prompt Fun realizado + rollback plan SQL testado
- [ ] Story 16.2: `smoke-fun.mjs` criado e rodado; catálogo de gaps em `docs/stories/16/gaps.md`
- [ ] Story 16.3: fix iterativo executado até comportamento inaceitável = 0%
- [ ] Story 16.4: janela executada, produção liberada, 96h de monitoramento sem bugs críticos
- [ ] @qa aprovou as 4 stories (gate PASS ou CONCERNS)
- [ ] Julia validou informalmente que o bot está igual ou melhor
- [ ] Playbook revisado: se algum ajuste emergiu durante a execução, adicionar à versão 1.1

---

## Próximos movimentos após fechamento

- Avaliar se padrão se confirma: aplicar em HL Importados seguindo mesma receita?
- **Abrir discussão sobre Anexo A (Zenya Admin como tier)** — agora com N=3 tenants estáveis e dados de uso real.
- Publicar o playbook oficialmente (v1.1) se emergiram ajustes significativos.

---

## Histórico

- **2026-04-22** — Epic criado por @pm a partir de handoff do @po. Referência: `TENANT-REFINEMENT-PLAYBOOK.md` (entregue no Epic 15 fechado 3/3 hoje). Aguardando @sm refinar as 4 stories individuais via `*draft`.
