# Epic 13 — Capacidades de Nicho da Zenya

**Status:** Draft
**Criado por:** Morgan (@pm) — inputs arquiteturais: Aria (@architect) — 2026-04-20
**Depende de:** Epic 11 (Capacidades Globais — deve estar Done)
**Objetivo:** Ativar capacidades especializadas por nicho de mercado via configuração de tenant — transformando a Zenya em produto vertical para imobiliárias, personalizados/confeitaria, advocacia e clínicas.

---

## Contexto

A Zenya tem o mesmo motor para todos os clientes. As capacidades de nicho são ativadas por tenant via `metadata` — o schema já suporta isso. Cada nicho tem fluxos n8n específicos que são habilitados apenas quando o cliente tem o módulo ativo.

**Princípio arquitetural:** Capacidades de nicho = feature flags por tenant. Não são instâncias separadas — é o mesmo produto com módulos ligados/desligados por configuração.

**Gatilho de priorização:** Este epic avança conforme aparecer demanda real. Imobiliária é o nicho mais provável de ter demanda primeiro (mercado maior, processo mais repetitivo).

**Regra Sparkle-first:** Cada nicho é prototipado internamente antes de qualquer cliente.

---

## Arquitetura

```
zenya_clients.metadata: {
  "nicho": "imobiliaria",
  "modulos": ["scraping_portais", "matching_perfil"]
}
  └── Fluxo 01 (Secretária) lê metadata do tenant
        └── Rota condicional → Fluxo especializado do nicho
```

---

## Stories

| Story | Título | Status | Prioridade | Depende de | Executor |
|-------|--------|--------|------------|------------|----------|
| 13.1 | Sistema de feature flags por tenant (base de todos os nichos) | Draft | P1 — Blocker | — | @dev + @data-engineer |
| 13.2 | Nicho: Imobiliária — scraping de portais + matching de perfil | Draft | P2 | 13.1 | @dev |
| 13.3 | Nicho: Personalizados/Confeitaria — interpretação de pedidos por imagem | Draft | P2 | 13.1 | @dev |
| 13.4 | Nicho: Advocacia — pesquisa de processos e jurisprudência | Draft | P3 | 13.1 | @dev |
| 13.5 | Nicho: Clínicas — agenda, confirmação e follow-up de consultas | Draft | P3 | 13.1 | @dev |

> **Nota:** Stories 13.2-13.5 são condicionais a demanda real. Apenas 13.1 é obrigatória para habilitar o sistema. As demais avançam quando houver cliente com necessidade.

---

## Sequência de Execução

```
Wave 1 — Base (blocker para tudo):
  13.1 — Feature flags por tenant: ler metadata, rotear para módulo certo
        → Fundação que habilita qualquer nicho futuro

Wave 2 — Nicho mais provável (após demanda confirmada):
  13.2 — Imobiliária: scraping Zap/Vivareal + matching com perfil do lead
  13.3 — Personalizados: Vision API no pedido + parsing estruturado

Wave 3 — Nichos secundários (sob demanda):
  13.4 — Advocacia: integração com APIs de consulta de processos
  13.5 — Clínicas: integração com agenda (Google Calendar já existe no fluxo)
```

---

## Stack Afetada

| Componente | Mudança |
|-----------|---------|
| `zenya_clients.metadata` | Schema de `modulos` e `nicho` documentado |
| n8n — fluxo `01. Secretária v3` | Roteamento condicional por módulo ativo |
| Apify (Docker MCP) | Scraping de portais imobiliários (13.2) |
| OpenAI Vision | Parsing de pedidos por imagem (13.3) |

---

## Definition of Done do Epic 13

- [ ] Sistema de feature flags funcional: tenant com módulo ativo → fluxo certo é chamado
- [ ] Pelo menos 1 nicho implementado e validado na instância SparkleOS
- [ ] Documentação de como ativar cada módulo para um novo cliente
- [ ] Isolamento garantido: dados de um nicho não vazam para outro tenant

---

## Escopo FORA deste Epic

- UI para o cliente ativar módulos self-service — coberto pelo Epic 14
- Novos nichos além dos 4 listados — demanda futura
- Treinamento fine-tuned por nicho — escopo de ML futuro
