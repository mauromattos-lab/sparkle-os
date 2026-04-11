# SOP-1.4-A: Como Criar uma ADR no SparkleOS

**SOP ID:** SOP-1.4-A  
**Criado por:** @dev (Dex) — Story 1.4  
**Atualizado:** 2026-04-11

---

## Quando Criar uma ADR

Crie uma ADR sempre que:

1. **Decisão de arquitetura** — escolha de tecnologia, padrão de design, estrutura de dados
2. **Decisão que afeta múltiplos agentes ou epics** — algo que outros precisarão entender no futuro
3. **Decisão que descarta alternativas** — quando havia opções válidas e uma foi escolhida
4. **Mudança de decisão anterior** — quando uma ADR existente precisa ser superseded

**Não é necessário ADR para:**
- Decisões de implementação menores (escolha de nome de variável, formatação)
- Bugs fixes sem impacto arquitetural
- Decisões temporárias claramente marcadas como tal

## Quem Cria ADRs

- **@architect** — decisões de arquitetura de sistema e tecnologia (padrão)
- **@data-engineer** — decisões de schema e estratégia de banco de dados
- **@dev** — pode criar ADR quando toma decisão arquitetural durante implementação
- Qualquer agente pode propor uma ADR para revisão do @architect

## Como Numerar: Obter o Próximo Número via API

A numeração é **sequencial e gerenciada pela API** — nunca calcule manualmente:

```bash
# Obter próximo número disponível (fonte de verdade)
curl http://localhost:3000/api/adrs/next-number
# Resposta: { "nextNumber": 3, "paddedNumber": "003" }
```

Sempre use o número retornado por esta API antes de criar a ADR.

## Como Criar uma ADR

### Passo 1 — Copiar o template

```bash
# Template disponível em:
cat docs/adrs/ADR-TEMPLATE.md
```

### Passo 2 — Obter o número

```bash
curl http://localhost:3000/api/adrs/next-number
```

### Passo 3 — Criar o arquivo

Salvar em: `docs/adrs/adr-NNN-titulo-kebab-case.md`

Exemplo: `docs/adrs/adr-003-cache-strategy.md`

### Passo 4 — Registrar no Postgres via API

```bash
curl -X POST http://localhost:3000/api/adrs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cache Strategy",
    "status": "accepted",
    "context": "Precisávamos de cache para...",
    "decision": "Usar Redis com TTL...",
    "rationale": "Por que Redis...",
    "alternatives": ["Memcached: ...", "In-memory: ..."],
    "consequences": "Dependência de Redis...",
    "createdBy": "architect",
    "storyId": "1.5"
  }'
```

## Como Atualizar Status de ADR Existente

ADRs são **write-once** quanto ao conteúdo — nunca modifique a decisão original. Para mudanças:

1. **Deprecate:** Quando a decisão não se aplica mais mas não foi substituída
   - Atualizar campo `status: deprecated` no arquivo `.md`
   
2. **Supersede:** Quando uma nova ADR substitui a antiga
   - Na nova ADR: referenciar a antiga em "Referências"
   - Na ADR antiga: atualizar status para `superseded` e referenciar a nova

**ADRs nunca são deletadas** — o histórico de decisões é permanente.

## Consultar ADRs Existentes

```bash
# Listar todas
curl http://localhost:3000/api/adrs

# ADR específica
curl http://localhost:3000/api/adrs/1
```

## Nomenclatura de Arquivos

```
docs/adrs/adr-NNN-titulo-kebab-case.md
```

- `NNN` = número de 3 dígitos com zero-padding (001, 002, ..., 042, ..., 100)
- `titulo-kebab-case` = título em minúsculas, espaços substituídos por `-`
- Exemplos: `adr-001-repository-structure.md`, `adr-042-context-store.md`
