# Rollback Plan — Fun Personalize prompt migration

## Objetivo
Reverter o `system_prompt` do tenant Fun Personalize (`id=a1980ce7-4174-4cd0-8fe1-b22795589614`) para o estado anterior à migração ADR-001, caso regressão seja detectada pós-cutover.

## Gatilhos para acionamento

Acionar rollback **imediatamente** se qualquer um ocorrer nos primeiros 30 min pós-cutover:

1. Smoke test T12 falha: resposta vazia, tom visivelmente alterado, ou ferramenta não responde
2. Erros em `pm2 logs zenya-webhook` correlacionados ao Fun Personalize
3. Cliente final reporta comportamento anormal
4. Tempo de resposta fora do padrão (>2x normal) por >3 mensagens consecutivas
5. Julia (dona do Fun Personalize) pede rollback

## Artefatos

- **Backup SQL:** `.ai/backups/fun-personalize-system_prompt-YYYYMMDD-HHMM.sql`
  - Gerado em T6 da story (pré-cutover)
  - Formato: `UPDATE zenya_tenants SET system_prompt = $backup$...$backup$ WHERE id = '<uuid>';`
  - Usa dollar quoting para preservar quebras de linha e caracteres especiais

- **md5 de referência (pré-migração):** `9cc363564a9f128e79fd334045b5e595`
  - Após rollback, confirmar: `SELECT md5(system_prompt) FROM zenya_tenants WHERE id = 'a1980ce7-4174-4cd0-8fe1-b22795589614';` deve retornar esse valor

## Procedimento

### 1. Executar rollback via Management API (preferido — funciona de qualquer lugar)

```bash
# Na VPS ou localmente, tendo SUPABASE_PAT no ambiente
SQL=$(cat .ai/backups/fun-personalize-system_prompt-YYYYMMDD-HHMM.sql)

curl -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$SQL" '{query:$q}')"
```

### 2. Alternativa — Supabase Studio
- Abrir SQL Editor (projeto `uqpwmygaktkgbknhmknx`)
- Colar o conteúdo do arquivo `.sql`
- Run

### 3. Validar o rollback

```sql
SELECT md5(system_prompt) AS hash, length(system_prompt) AS chars
FROM zenya_tenants WHERE id = 'a1980ce7-4174-4cd0-8fe1-b22795589614';
```

Hash esperado: `9cc363564a9f128e79fd334045b5e595` (7100 chars conforme query T2).

### 4. Aguardar propagação

- Cache de tenant do core expira em até 5 min
- **Não** é necessário `pm2 reload zenya-webhook` — cache automático
- Mensagem de teste após 5 min valida que o prompt antigo voltou

## Pós-rollback

1. Registrar em `cutover-log.md` o motivo do rollback + timestamp
2. Abrir story de correção identificando a causa da regressão (não reusar esta story)
3. Não tentar nova migração antes de resolver a causa-raiz
