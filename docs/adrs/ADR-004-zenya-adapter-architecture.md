# ADR-004 — Zenya Adapter Architecture: Serviço Independente vs Integrado ao Core

**Status:** Accepted  
**Data:** 2026-04-11  
**Autor:** @architect (Aria)  
**Story:** 2.3 — Integração Formal da Zenya como Núcleo  

---

## Contexto

O SparkleOS precisa integrar a Zenya (atendente IA WhatsApp) como um Núcleo formal do sistema. A Zenya opera via n8n + Chatwoot + Z-API na VPS Hostinger. A questão central é: onde o Zenya Adapter deve viver dentro da arquitetura?

Duas opções foram avaliadas:

- **Opção A:** Zenya Adapter como serviço independente (`organs/zenya/`) com porta própria (3002), registrado no Core como Nucleus service
- **Opção B:** Rotas `/nucleus/zenya/*` montadas diretamente no `packages/core`, sem serviço separado

---

## Decisão

**Opção A — Serviço independente.**

O Zenya Adapter roda como processo Node.js independente na porta 3002, implementado em `organs/zenya/`. O Core não carrega código da Zenya diretamente.

---

## Justificativa

| Critério | Opção A (independente) | Opção B (integrado) |
|----------|----------------------|---------------------|
| Isolamento de falhas | ✅ Crash da Zenya não afeta o Core | ❌ Crash derruba serviço inteiro |
| Deploy independente | ✅ Coolify pode gerenciar separadamente | ❌ Deploy acoplado |
| Padrão para organs futuros | ✅ Cada organ = serviço próprio | ❌ Core vira monólito de organs |
| Complexidade inicial | ⚠️ Dois processos a rodar | ✅ Um processo só |
| Consistência com docs/architecture.md | ✅ "Stack: Node.js 22 + Hono — Coolify na VPS" | ❌ Contradiz a doc |
| Escalabilidade | ✅ Cada organ escala independente | ❌ Escala toda junto |

O padrão `organs/*` no monorepo já sinaliza a intenção de organs independentes. Integrar ao Core seria uma contradição estrutural que criaria dívida técnica ao adicionar organs futuros.

---

## Alternativas Descartadas

**Opção B — Integrado ao Core:**  
Descartada porque quebraria o padrão `organs/` do monorepo, acoplaria deploy da Zenya ao Core, e tornaria difícil adicionar organs futuros de forma limpa.

**Opção C — Monorepo com shared runtime:**  
Considerada brevemente — rodar todos os organs num único processo com rotas isoladas. Descartada porque requer orquestração complexa e anula o isolamento de falhas.

---

## Consequências

- `organs/zenya/` é um serviço Hono standalone — porta padrão `3002`, configurável via `PORT` env var
- Rotas internas: `GET /flows`, `GET /flows/:id` — sem prefixo `/nucleus/zenya/` no próprio serviço
- O prefixo `/nucleus/zenya/` é responsabilidade do gateway/Core ao proxiar (stories futuras)
- Cada organ futuro (`organs/outro/`) seguirá o mesmo padrão: serviço independente + porta própria
- Comunicação inter-organs via HTTP interno (mesma VPS = latência zero)

---

## Referências

- `docs/architecture.md` §6 — Zenya Adapter
- `pnpm-workspace.yaml` — declara `organs/*` como packages independentes
- Story 2.3 — Integração Formal da Zenya como Núcleo
