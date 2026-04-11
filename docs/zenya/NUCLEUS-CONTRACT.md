# Nucleus Contract — Zenya

**Versão:** 1.0.0  
**Data:** 2026-04-11  
**Autor:** @architect (Aria)  
**Story:** 2.3 — Integração Formal da Zenya como Núcleo  

---

## O que é o Núcleo Zenya

O Núcleo Zenya é o encapsulamento formal da Zenya dentro do SparkleOS. A Zenya é uma atendente IA que opera no WhatsApp via n8n + Chatwoot + Z-API, atendendo clientes de Mauro com agendamentos, cobranças e suporte.

O Zenya Adapter (`organs/zenya/`) é a camada que abstrai toda essa complexidade: nenhuma outra parte do SparkleOS precisa conhecer o n8n, o Chatwoot ou o Z-API diretamente.

---

## Inputs

| Input | Origem | Descrição |
|-------|--------|-----------|
| Mensagens WhatsApp | Chatwoot → n8n webhook | Mensagens dos clientes chegam via webhook do Chatwoot ao fluxo `01. Secretária v3` |
| Comandos de agentes AIOS | API interna (`POST /flows/:id/run`) | Agentes podem disparar fluxos programaticamente (Story 2.4) |
| Consultas ao inventário | API interna (`GET /flows`) | Qualquer agente pode consultar os fluxos disponíveis |

---

## Outputs

| Output | Destino | Descrição |
|--------|---------|-----------|
| Respostas ao cliente | Chatwoot → WhatsApp | Mensagens enviadas pela Zenya via Z-API |
| Inventário de fluxos | Agentes AIOS | Lista estruturada dos 15 fluxos Zenya Prime via API |
| Detalhes de fluxo | Agentes AIOS | Metadata de um fluxo específico: nome, categoria, status, dependências |
| Insights operacionais | Collective Brain (Epic 3) | Métricas de atendimento, padrões, aprendizados (futuro) |
| Eventos de provisionamento | Core SparkleOS | Notificação quando novo cliente é provisionado (Story 2.4) |

---

## Fluxos Registrados (v1.0.0)

15 fluxos Zenya Prime — inventário completo em `docs/zenya/FLOW-INVENTORY.md`.

| Categoria | Quantidade |
|-----------|-----------|
| atendimento | 4 |
| utilitário | 6 |
| notificação | 2 |
| handoff | 1 |
| admin | 1 |
| setup | 1 |

---

## IP Protegido

O IP da Zenya (prompts de personalidade, lógicas JS proprietárias, assets visuais) está preservado em `docs/zenya/ip/`.

**Qualquer alteração ao IP requer aprovação de Mauro** — processo documentado em `docs/sops/sop-atualizar-ip-zenya.md`.

---

## API Interna (v1.0.0)

Base URL: `http://localhost:3002` (interno VPS) ou via gateway `/nucleus/zenya` (externo)

| Método | Rota | Descrição | Story |
|--------|------|-----------|-------|
| `GET` | `/flows` | Lista os 15 fluxos Zenya Prime | 2.3 ✅ |
| `GET` | `/flows/:id` | Detalhes de um fluxo por ID n8n | 2.3 ✅ |
| `POST` | `/flows/:id/clone` | Clona fluxo para novo cliente | 2.4 |
| `POST` | `/clients` | Provisiona novo cliente Zenya | 2.4 |
| `GET` | `/health` | Health check do adapter | 2.3 ✅ |

---

## SOP de Operação

### Consultar inventário de fluxos
```
GET /flows → retorna array FlowInventory[]
GET /flows/{id} → retorna ZenyaFlow ou 404
```

### Provisionar novo cliente
> Story 2.4 — não implementado nesta versão

### Atualizar IP da Zenya
> Requer aprovação de Mauro — ver `docs/sops/sop-atualizar-ip-zenya.md`

### Adicionar novo fluxo ao inventário
1. Criar fluxo no n8n com tag `Zenya Prime`
2. Executar `docs/zenya/SOP-FLOW-INVENTORY-UPDATE.md`
3. Atualizar `organs/zenya/src/data/flows-seed.ts`
4. Bump de versão no CHANGELOG

---

## Decisões Arquiteturais

- **ADR-004:** Zenya Adapter como serviço independente (porta 3002) — não integrado ao Core
- **ADR-001:** Monorepo SparkleOS — `organs/zenya/` como package independente

---

## Referências

- `docs/zenya/FLOW-INVENTORY.md` — inventário completo (Story 2.1)
- `docs/zenya/ip/` — IP preservado (Story 2.2)
- `docs/architecture.md` §6 — Zenya Adapter
- `organs/zenya/src/` — implementação
