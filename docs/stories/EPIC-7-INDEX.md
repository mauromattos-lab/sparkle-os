# Epic 7 — Zenya como Órgão Nativo do SparkleOS

**Status:** 🟡 InProgress — 7.1–7.7 e 7.9 em `Ready for Review` (aguardando QA gate); 7.8 `InProgress` (validação + cutover Zenya Prime); 7.10 `Done`. Próximo passo: destravar QA do bloco `Ready for Review`.
**Criado por:** Morgan (@pm) + River (@sm)
**Data:** 2026-04-14
**Fonte:** PRD `docs/zenya-orgao-sparkle-prd.md` — análise Atlas + arquitetura Aria + pesquisa externa Atlas
**Objetivo:** Migrar a Zenya de fluxos n8n (fazer.ai) para um Órgão TypeScript nativo do SparkleOS, mantendo continuidade de serviço para 4 clientes ativos e habilitando modelo multi-tenant escalável.

---

## Contexto

A Zenya opera hoje sobre ~15 fluxos n8n hospedados na plataforma fazer.ai. A análise dos 4 fluxos core revelou que toda a lógica é chamadas HTTP + lógica condicional + LLM calls — nada que exija o n8n. As limitações estruturais crescem proporcionalmente ao número de clientes: cada novo cliente multiplica a superfície de manutenção, cada integração customizada vira uma ilha.

O SparkleOS foi construído para ser o ambiente onde a Zenya cresce. Mantê-la fora desse ambiente é uma contradição arquitetural.

**Validação de risco:** O SparkleOS possui um número WhatsApp próprio (Zenya Prime) que serve como ambiente de teste — todos os fluxos serão validados sem expor nenhum cliente real.

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| [7.1](./7.1.story.md) | Fundação: pacote Zenya + Webhook Worker | ✅ Ready for Review | P1 — Blocker | — | @dev |
| [7.2](./7.2.story.md) | Tenant Config Loader + Isolamento Multi-tenant | ✅ Ready for Review | P1 | 7.1 | @dev + @data-engineer |
| [7.3](./7.3.story.md) | Agent Loop Core (Agente Principal) | ✅ Ready for Review | P1 | 7.2 | @dev |
| [7.4](./7.4.story.md) | Message Chunker + Typing Simulation | ✅ Ready for Review | P2 | 7.3 | @dev |
| [7.5](./7.5.story.md) | Ferramentas de Agendamento (Google Calendar) | ✅ Ready for Review | P2 | 7.3 | @dev |
| [7.6](./7.6.story.md) | Resposta em Áudio (ElevenLabs TTS) | ✅ Ready for Review | P2 | 7.3 | @dev |
| [7.7](./7.7.story.md) | Ferramentas de Integração Customizada | ✅ Ready for Review | P2 | 7.3 | @dev |
| [7.8](./7.8.story.md) | Validação com Zenya Prime e Cutover | 🟡 InProgress | P1 | 7.3, 7.4, 7.5, 7.6, 7.7 | @dev + @devops |
| [7.9](./7.9.story.md) | Debounce de Mensagens e Confirmação de Leitura | ✅ Ready for Review | P2 | 7.1, 7.3 | @dev |
| [7.10](./7.10.story.md) | Etiquetas Nativas WhatsApp Business na Escalação para Humano | ✅ Done | P2 | 7.1, 7.3, 7.7 | @dev |

---

## Sequência de Execução

```
Wave 1 — Fundação (blocker):
  7.1 — Webhook Worker + fila + lock
        → Zenya Prime começa a receber mensagens via SparkleOS
  7.2 — Multi-tenant + RLS
        → 4 clientes atuais configurados no banco

Wave 2 — Núcleo (após 7.1 + 7.2):
  7.3 — Agent Loop Core
        → Zenya responde mensagens com IA via SparkleOS
        → Teste real com Zenya Prime

Wave 3 — Funcionalidades (paralelas, após 7.3):
  7.4 — Message Chunker + Typing
  7.5 — Google Calendar
  7.6 — Áudio ElevenLabs
  7.7 — Integração Customizada (Asaas + pattern para Loja Integrada)
  7.9 — Debounce de Mensagens + Confirmação de Leitura (retroativa)

Wave 4 — Cutover (após todas):
  7.8 — Validação Zenya Prime (48h) → Cutover por cliente → Standby n8n
```

---

## Stack Definida

| Componente | Tecnologia |
|-----------|-----------|
| Agent loop | Vercel AI SDK 4 (`generateText` + `tool()`) |
| Webhook server | Hono (Node.js) |
| Fila + Lock | PostgreSQL INSERT ON CONFLICT (via Supabase JS) |
| Memória | PostgreSQL + Supabase |
| TTS | ElevenLabs API |
| Deploy | PM2 na VPS (187.77.37.88) |
| Testes | Vitest |

---

## Definition of Done do Epic 7

- [ ] Zenya Prime respondendo mensagens via SparkleOS por 48h sem incidentes
- [ ] 4 clientes ativos migrados — webhook do Chatwoot apontando para SparkleOS
- [ ] Tool-calling funcionando com ferramentas core (escalar, agendamento, áudio, mensagem separada)
- [ ] Novo cliente ativável via INSERT no banco — sem redeploy
- [ ] Nova integração criada para um cliente ativável para outro via UPDATE — sem código novo
- [ ] Cobertura de testes ≥ 80% nas ferramentas core
- [ ] n8n em standby por 7 dias pós-cutover sem incidentes críticos
- [ ] 0 incidentes críticos nos 7 dias pós-cutover

---

## Escopo FORA deste Epic

- Migração dos fluxos inativos (recuperação de leads, Retell AI, Google Drive) — demanda futura
- Interface visual de administração (Cockpit do Mauro) — epic futuro
- Integração com Cérebro Coletivo — próximo epic após Zenya estável
- Substituição do Chatwoot/Z-API como gateway WhatsApp
