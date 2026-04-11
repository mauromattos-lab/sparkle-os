# SOP-1.3-A: Como Agentes Persistem e Recuperam Contexto entre Sessões

**SOP ID:** SOP-1.3-A  
**Criado por:** @dev (Dex) — Story 1.3  
**Atualizado:** 2026-04-11  
**ADR:** docs/adrs/adr-002-context-store.md

---

## Quando Salvar Contexto

Salve contexto sempre que:

1. **Fim de sessão** — antes de fechar o Claude Code
2. **Checkpoint de progresso** — após completar uma subtask significativa
3. **Decisão arquitetural** — ao tomar uma decisão que outro agente precisaria conhecer
4. **Blocker identificado** — ao encontrar um obstáculo que pode persistir entre sessões
5. **Mudança de story** — ao mudar de uma story para outra

## Como Salvar Contexto (POST)

```bash
curl -X POST http://localhost:3000/api/context/{agentId} \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-uuid",
    "storyId": "1.3",
    "workState": {
      "currentTask": "Implementando Context Store",
      "filesModified": ["packages/core/src/context/context-store.ts"],
      "nextAction": "Escrever testes Vitest",
      "blockers": []
    },
    "decisionLog": [
      {
        "decision": "Usar ioredis em vez de redis",
        "rationale": "Melhor suporte TypeScript e interface de Promise nativa",
        "timestamp": "2026-04-11T12:00:00Z"
      }
    ]
  }'
```

## Como Recuperar Contexto (GET)

```bash
curl http://localhost:3000/api/context/{agentId}
```

Retorna o contexto ativo do agente. Use isto no início de cada sessão para saber onde parou.

## Campos Obrigatórios vs Opcionais

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `sessionId` | ✅ SIM | Identificador único da sessão atual |
| `workState.currentTask` | ✅ SIM | O que estava sendo feito |
| `workState.nextAction` | ✅ SIM | O que fazer ao retomar |
| `storyId` | Recomendado | Story ativa (null se sem story) |
| `workState.filesModified` | Recomendado | Arquivos tocados (lista) |
| `workState.blockers` | Recomendado | Obstáculos ativos (lista vazia se nenhum) |
| `decisionLog` | Opcional | Decisões que outros agentes precisam saber |

## O Que Fazer Quando Contexto Expirou (TTL Redis 72h)

Se `GET /api/context/{agentId}` retornar 404:

1. O cache Redis expirou (normal após 72h sem atividade)
2. O sistema automaticamente fará fallback para Postgres na próxima chamada
3. **Acesse o histórico** via `GET /api/context/{agentId}/history` para ver sessões anteriores
4. Reconstrua o contexto a partir do histórico ou de commits recentes

```bash
# Ver histórico completo
curl http://localhost:3000/api/context/{agentId}/history
```

## Limpar Contexto

```bash
curl -X DELETE http://localhost:3000/api/context/{agentId}
```

Use ao iniciar uma nova story não relacionada à anterior.

## Notas de Segurança

- A API está configurada para aceitar token vazio em dev (`Authorization: Bearer dev-token`)
- Em produção, credenciais são gerenciadas conforme Story 1.5
- Nunca salvar senhas, tokens ou chaves no `workState` ou `decisionLog`
