# SOP-1.5-B: Como Agentes Realizam Pesquisa no Processo de Decisão

**SOP ID:** SOP-1.5-B  
**Criado por:** @dev (Dex) — Story 1.5  
**Atualizado:** 2026-04-11

---

## Quando Acionar Pesquisa

Acione pesquisa externa quando:
- Decisão técnica requer conhecimento de versões atuais de bibliotecas
- Não há evidência suficiente no contexto atual para decidir com confiança
- Existem trade-offs que dependem de dados externos (benchmarks, preços, limitações)
- Uma tecnologia ou API pode ter mudado desde o treinamento do modelo

**Não acione pesquisa para:**
- Decisões de implementação menores baseadas em padrões já estabelecidos no projeto
- Conhecimento presente em `docs/architecture.md` ou ADRs existentes
- Perguntas sobre o próprio código do repositório (usar `Read`/`Grep`)

## MCPs Disponíveis e Quando Usar

| MCP | Quando usar | Como acessar |
|-----|-------------|--------------|
| **EXA** | Web search: notícias, benchmarks, comparações, preços atuais | `mcp__docker-gateway__web_search_exa` |
| **Context7** | Documentação de bibliotecas: API reference, exemplos, breaking changes | `resolve-library-id` → `get-library-docs` |
| **Conhecimento interno** | Padrões do projeto, ADRs, arquitetura estabelecida | `Read`, `Grep`, docs/ |

**Regra de seleção:**
```
Decisão sobre biblioteca específica → Context7 primeiro
Decisão sobre mercado/tecnologia/preço → EXA
Decisão sobre padrão do projeto → docs/ internos
```

## Como Documentar Resultado de Pesquisa

Todo resultado de pesquisa relevante deve ser documentado como insumo:

1. **Em ADRs:** Na seção "Alternativas Descartadas" ou "Referências" — citar fonte e data
2. **No contexto da sessão:** Via `POST /api/context/:agentId` com o finding no `decisionLog`
3. **Em comentários de código:** Quando a pesquisa justifica uma implementação específica

Exemplo de entrada no `decisionLog`:
```json
{
  "decision": "Usar ioredis em vez de node-redis",
  "rationale": "Context7 (2026-04-11): ioredis tem melhor suporte a TypeScript e pipeline API",
  "alternatives": ["node-redis v4"],
  "timestamp": "2026-04-11T12:00:00Z"
}
```

## Custo de Operações de Pesquisa

| Operação | Custo estimado |
|----------|---------------|
| Query EXA | ~$0.005/query |
| Context7 | Gratuito (via Docker MCP) |
| Conhecimento interno | $0 |

Meta: pesquisas externas < $20/mês adicional (rastreado em Story 1.8).

**Use pesquisa com critério** — uma boa query bem formulada substitui 5 queries vagas.
