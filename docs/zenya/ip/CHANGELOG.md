# Changelog — IP da Zenya

**Mantido por:** @analyst
**Processo de aprovação:** `docs/sops/sop-atualizar-ip-zenya.md`

---

> Toda entrada neste changelog corresponde a uma versão tagueada no git e representa uma alteração aprovada por Mauro.

---

## v1.0.0 — 2026-04-11

**Tipo:** Snapshot inicial — preservação do estado em produção
**Tag git:** `zenya-ip-v1.0.0`
**Commit base:** `c9f9061`
**Executado por:** @analyst (Atlas) — Story 2.2

### O que foi preservado

**Prompts:**
- P1 — Prompt principal da Zenya (`01. Secretária v3` — `Secretária v3` AI Agent) — 10.957 chars
- P2 — Prompt assistente interno Maria (`08. Agente Assistente Interno`) — 12.824 chars
- P3 — Prompt divisor de mensagens (`07. Quebrar e enviar mensagens` — `Agente divisor de mensagens`) — 3.123 chars

**Lógicas JS:**
- L1 — Anti-cavalgamento de mensagens (`01.` → `Mensagem encavalada?`)
- L2 — Cálculo de tipo de resposta (`01.` → `Calcular tipo da resposta`)
- L3 — Velocidade de digitação humanizada (`07.` → `Velocidade digitação` + `Espera`)

**Assets visuais (9 arquivos):**
- 4 fotos de profissionais (DR. Ana Silva, DR. Carla Mendes, DR. João Paulo Ferreira, DR. Roberto Almeida)
- 1 foto geral de profissionais (PROFISSIONAIS.png)
- 3 imagens de procedimentos (Exame de Sangue, Teste Ergométrico, Ultrassom)
- 1 documento PDF (COBRANÇA.pdf)

**Storage Supabase:** `zenya-ip-assets/v1/` — 9 arquivos, ~19,5 MB
**Hashes SHA-256:** registrados em `ZENYA-ASSETS-REGISTRY.md`

### Artefatos criados

| Arquivo | Descrição |
|---------|-----------|
| `docs/zenya/ip/ZENYA-PROMPTS.md` | Prompts e systemMessages completos |
| `docs/zenya/ip/ZENYA-LOGIC.md` | Lógicas JS proprietárias |
| `docs/zenya/ip/ZENYA-ASSETS-REGISTRY.md` | Inventário com hashes SHA-256 e URLs Supabase |
| `docs/zenya/ip/CHANGELOG.md` | Este arquivo |
| `docs/sops/sop-atualizar-ip-zenya.md` | SOP de aprovação de alterações |

---

*Próxima entrada será `v1.1.0` ou `v2.0.0` dependendo da natureza da alteração aprovada.*
