# Story HL-01 — Onboarding do tenant HL Importados no core Zenya

**Status:** Ready — cutover programado para 2026-04-22 à noite. Código 100% pronto (prompt.md canônico + seed refatorado pro padrão ADR-001 + UltraCash integration + 11 testes passando). Z-API do Hiago **já configurada no Chatwoot** (confirmado por Mauro 2026-04-22) — bloqueio anterior removido. HL segue atendendo via n8n até a janela de cutover; cliente (Hiago) ciente de que início pode precisar de ajustes.
**Owner:** @dev (Dex) — implementação | Mauro — cutover

## Contexto

A HL Importados está rodando em n8n (pasta "06 - HL Importados") desde 08/04/2026. Os fluxos foram analisados e mapeados em `docs/zenya/hl-import/INVENTARIO.md`. Este trabalho migra a HL do n8n para o core Zenya (TypeScript/Hono na VPS).

A única peça **nova** de integração é a consulta de estoque **UltraCash** (ERP/PDV da HL, em `apihl.ultracash.com.br`) — todas as outras capacidades já existem no core por reuso (chatwoot, escalation, chunker, whisper, elevenlabs, memória, etc.).

## Acceptance Criteria

1. ✅ Novo módulo `packages/zenya/src/integrations/ultracash.ts` expõe tool `Buscar_produto` com paridade ao node "Consultar estoque" do n8n.
2. ✅ Tool respeita peculiaridade `Accept-Encoding: gzip` (sem isso a API dava erro no n8n).
3. ✅ Tool sanitiza resposta: `custo_medio` e `preco_compra` NUNCA chegam ao LLM/cliente.
4. ✅ Filtro server-side por `descricao=` — sem scan client-side.
5. ✅ Registro condicional no `tool-factory.ts` via `active_tools: ['ultracash']`.
6. ✅ Suite de testes cobre sanitização, filtros, erros, limites — 11/11 passando.
7. ✅ Script `seed-hl-tenant.mjs` cria o tenant com prompt extraído do n8n.
8. ✅ Script `seed-hl-ultracash.mjs` criptografa e salva a `x-api-key` em `zenya_tenant_credentials`.
9. ⏳ Cutover à meia-noite: Mauro aplica scripts + configura Chatwoot.

## Arquivos modificados/criados

- `packages/zenya/src/integrations/ultracash.ts` — **novo**
- `packages/zenya/src/tenant/tool-factory.ts` — import + guard
- `packages/zenya/src/__tests__/ultracash.test.ts` — **novo** (11 testes)
- `packages/zenya/scripts/seed-hl-tenant.mjs` — **novo**
- `packages/zenya/scripts/seed-hl-ultracash.mjs` — **novo**
- `docs/stories/hl-onboarding-01/README.md` — este arquivo
- `docs/zenya/hl-import/INVENTARIO.md` — inventário do n8n (já commitado anteriormente)

## Checklist de cutover (Mauro — à meia-noite)

### 1. Preparar a VPS

```bash
ssh -i ~/.ssh/sparkle_vps root@187.77.37.88
cd /caminho/do/repo
git pull origin main
cd packages/zenya
npm install      # se houver novas deps (não deveria)
npm run build
```

### 2. Criar o tenant HL no Supabase

Exportar env vars **no shell da VPS** (onde `.env` já tem SUPABASE_URL e SUPABASE_SERVICE_KEY):

```bash
export HL_CHATWOOT_ACCOUNT_ID="<id da conta HL no Chatwoot>"
export HL_ADMIN_PHONES="+5512981303249"   # Mauro — ajustar conforme quiser
export HL_ADMIN_CONTACTS='[{"phone":"+5512981303249","name":"Mauro"}]'
# opcional: modo teste só pra whitelisted phones
# export HL_ALLOWED_PHONES="+5512981303249"

node scripts/seed-hl-tenant.mjs
# → anota o TENANT_ID impresso
```

### 3. Seedar credenciais UltraCash

```bash
export HL_TENANT_ID="<UUID impresso no passo 2>"
export ULTRACASH_API_KEY="7AF0057EF978FF6284EA146885EA2367ACD7296F97E22068A9"
# (chave extraída do JSON do n8n — substituir se rotacionada)

node scripts/seed-hl-ultracash.mjs
```

### 4. Configurar Chatwoot

- Conta HL existente (account_id do passo 2).
- Labels necessárias: `agente-off`, `follow-up`, `testando-agente` (script `setup-zapi-labels.mjs` pode ajudar — checar se precisa rodar).
- Webhook da conta HL deve apontar pra `https://zenya.sparkleai.tech/webhook/chatwoot` (ou o host da VPS).

### 5. Reload do processo Zenya

```bash
pm2 reload zenya-webhook
pm2 logs zenya-webhook --lines 50
```

### 6. Smoke test

Mandar mensagem de um número admin (ex: o seu) pro WhatsApp da HL. Esperar:

- [ ] Zenya responde
- [ ] `Buscar_produto` é chamada quando perguntar preço de iPhone
- [ ] Resposta inclui preço + estoque, **NÃO** inclui custo_medio ou preco_compra
- [ ] Escalação para humano funciona
- [ ] Log `[ultracash] tenant=<uuid> Buscar_produto termo="..."` aparece no pm2

### 7. Desligar fluxos n8n

Na pasta "06 - HL Importados" do n8n, desativar (toggle off):

- [ ] `01. [HL Importados] Secretária v3`
- [ ] `05. Escalar humano`
- [ ] `[HL Importados] Quebrar Mensagens`

Deixar ativo:
- Nada — o fluxo passa 100% pro core a partir daqui.

### 8. Monitoramento primeiros 30 minutos

- `pm2 logs zenya-webhook --lines 100 -f`
- Conferir que não aparecem erros `[ultracash]` nem `Chatwoot` 4xx/5xx.
- Se algo der errado: reativar workflows n8n e investigar.

## Plano de rollback

1. No Chatwoot, tirar webhook da VPS.
2. Reativar os 3 workflows n8n da HL.
3. Manter o tenant no Supabase (não precisa apagar — fica dormindo).

## Notas técnicas

- A chave UltraCash está **hardcoded no JSON n8n exportado** (linha 3521 de `01-secretaria-v3.json`). O JSON está gitignored. No core ela vai pra `zenya_tenant_credentials` encrypted com AES-256-GCM (mesma lógica do Z-API / Loja Integrada).
- O prompt do agente vem direto do nó "Secretária v3" do n8n (`systemMessage`), com uma única troca textual: "ferramenta de consulta de estoque" → `Buscar_produto` (nome real da tool no core).
- Após cutover, a HL vai usar o mesmo processo PM2 (`zenya-webhook`) e o mesmo Supabase que Zenya Prime e Fun Personalize. É multi-tenant nativo.

## Próximas stories (já mapeadas, não implementadas)

- **Story B** — `integrations/google-drive.ts` (envio de arquivos pelo agente). Não é bloqueador pro cutover da HL; pode ser adicionada on-demand.
- **Story C** — validar paridade Google Calendar + Asaas com uso real da HL (monitorar após cutover).
