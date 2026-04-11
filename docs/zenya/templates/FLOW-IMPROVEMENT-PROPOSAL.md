# Template — Proposta de Melhoria de Fluxo Zenya

> **Como usar:** Copie este arquivo para `docs/zenya/proposals/PROP-{NNN}-{slug}.md` e preencha todos os campos obrigatórios. Campos marcados com `*` são obrigatórios.

---

## Identificação

| Campo | Valor |
|-------|-------|
| **ID da Proposta*** | `PROP-{NNN}` |
| **Data*** | `YYYY-MM-DD` |
| **Proposto por*** | `@agente` |
| **Fluxo(s) afetado(s)*** | Nome + ID n8n |
| **Classe da mudança*** | `Menor` / `Moderada` / `Maior` |
| **Toca IP?*** | `Sim` / `Não` |

---

## Mudança Proposta *

> Descreva de forma clara e concisa o que será alterado. Seja específico sobre qual node, campo ou comportamento muda.

```
[Descrever aqui]
```

---

## Motivação *

> Por que esta melhoria é necessária? Referenciar o Gap da Story 2.1 se aplicável (ex: G2).

```
[Descrever aqui]
```

---

## Impacto Esperado *

> O que muda para o cliente ou para a operação após a melhoria?

```
[Descrever aqui]
```

---

## Plano de Implementação *

> Passos para implementar. Referenciar o SOP `sop-melhorar-fluxo-zenya.md`.

1. Clonar fluxo: `POST /nucleus/zenya/flows/{id}/clone`
2. Aplicar mudança no clone
3. Validar com número de teste
4. Promover para produção
5. Deletar clone

```
[Detalhar passos específicos desta proposta]
```

---

## Plano de Rollback *

> Como reverter se algo der errado após promoção para produção?

```
[Descrever aqui]
```

---

## Gate de Aprovação

> Preenchido automaticamente com base na classe e no campo "Toca IP?".

| Classe | Toca IP? | Aprovador |
|--------|----------|-----------|
| Menor | Não | @architect (auto-aprovado) |
| Menor | Sim | Mauro |
| Moderada | Não | @pm (Morgan) |
| Moderada | Sim | Mauro |
| Maior | Qualquer | Mauro |

**Aprovador desta proposta:** `[preencher com base na tabela]`

---

## Status da Proposta

- [ ] Rascunho
- [ ] Aguardando aprovação
- [ ] Aprovada
- [ ] Em implementação
- [ ] Aplicada em produção
- [ ] Rejeitada / Arquivada

---

## Histórico

| Data | Agente | Ação |
|------|--------|------|
| | | Proposta criada |
