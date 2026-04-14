# Zenya — Guia de Cutover e Rollback

Este documento cobre o processo completo de cutover do n8n para o SparkleOS (story 7.8).

---

## Pré-requisitos

- [ ] Stories 7.1–7.7 implementadas e testadas
- [ ] Zenya Prime configurada no banco (seed executado)
- [ ] VPS com PM2 rodando `zenya-webhook`
- [ ] Variáveis de ambiente configuradas na VPS (`.env`)
- [ ] 48h de operação estável da Zenya Prime validadas

---

## 1. Deploy na VPS (SparkleOS — 187.77.37.88)

```bash
# Conectar na VPS
ssh -i ~/.ssh/sparkle_vps sparkle@187.77.37.88

# Navegar ao repositório
cd /var/www/sparkle

# Pull das últimas mudanças
git pull origin main

# Build do pacote zenya
cd packages/zenya
npm ci
npm run build

# Iniciar/reiniciar com PM2
pm2 start dist/worker/webhook.js --name zenya-webhook || pm2 restart zenya-webhook

# Garantir persistência após reboot
pm2 save
pm2 startup  # seguir as instruções exibidas

# Verificar que está rodando
pm2 status
pm2 logs zenya-webhook --lines 20
```

### Variáveis de ambiente obrigatórias (`/var/www/sparkle/packages/zenya/.env`)

```env
PORT=3004
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
ZENYA_MASTER_KEY=<32 bytes hex — gerar com: openssl rand -hex 32>
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
CHATWOOT_API_TOKEN=...
CHATWOOT_BASE_URL=https://app.chatwoot.com
```

---

## 2. Seed dos Tenants

Antes do cutover, preencher `packages/zenya/src/tenant/seed.ts` com os dados reais de cada cliente e executar:

```bash
cd packages/zenya
npx tsx src/tenant/seed.ts
```

Campos a preencher por cliente:
- `chatwoot_account_id` — Chatwoot > Settings > Account > ID
- `system_prompt` — copiar de n8n > nó "Configure a Zenya" > campo `sop_completo`
- `active_tools` — ferramentas ativas para este cliente
- `credentials` — credenciais a criptografar (Google Calendar refresh token, Asaas API key, etc.)

---

## 3. Checklist de Validação — Zenya Prime (AC2)

Executar via conversa real com o número da Zenya Prime:

| # | Cenário | Status |
|---|---------|--------|
| 1 | Resposta básica — mensagem simples → resposta coerente | [ ] |
| 2 | Múltiplas mensagens rápidas — sem duplicata na resposta | [ ] |
| 3 | Escalonamento — "quero falar com humano" → agente-off | [ ] |
| 4 | Message chunking — resposta longa → partes com typing | [ ] |
| 5 | Resposta em áudio — preferência audio → mensagem de voz | [ ] |
| 6 | Fallback de áudio — ElevenLabs indisponível → texto | [ ] |
| 7 | Memória — contexto mantido entre mensagens | [ ] |
| 8 | Follow-up — `marcarFollowUp` sem desativar bot | [ ] |
| 9 | Google Calendar (se ativo) — buscar horários | [ ] |
| 10 | Asaas (se ativo) — cobrança criada | [ ] |

Aguardar **48h de operação estável** antes de prosseguir para o cutover.

---

## 4. Planos de Rollback por Cliente

Para cada cliente, **salvar a URL do webhook atual** antes de alterar:

### Template de Rollback

```markdown
## Rollback — [NOME DO CLIENTE]

**URL n8n atual (salvar aqui antes de alterar):**
https://fazer.ai/webhook/[ID_N8N_DO_CLIENTE]

**Condição de trigger:** Incidente crítico nas primeiras 24h após cutover

**Passos de rollback:**
1. Acessar Chatwoot do cliente: [URL_CHATWOOT_CLIENTE]
2. Settings > Integrations > Webhooks
3. Substituir URL por: https://fazer.ai/webhook/[ID_N8N_DO_CLIENTE]
4. Salvar
5. Enviar mensagem de teste para verificar n8n respondendo
6. Verificar n8n dashboard que o fluxo processou
7. Notificar cliente sobre instabilidade (se necessário)

**Tempo estimado de rollback:** < 5 minutos
**Responsável:** Mauro
```

---

### Clientes — Preencher antes do cutover

#### Cliente 1 — [Nome] (menor risco — cutover primeiro)
- Chatwoot: [URL]
- URL n8n: `https://fazer.ai/webhook/[ID]`
- URL SparkleOS: `https://187.77.37.88:3004/webhook/chatwoot`
- Data planejada: ___

#### Cliente 2 — [Nome]
- Chatwoot: [URL]
- URL n8n: `https://fazer.ai/webhook/[ID]`
- Data planejada: ___

#### Cliente 3 — [Nome]
- Chatwoot: [URL]
- URL n8n: `https://fazer.ai/webhook/[ID]`
- Data planejada: ___

#### Cliente 4 — [Nome] (maior volume — cutover por último)
- Chatwoot: [URL]
- URL n8n: `https://fazer.ai/webhook/[ID]`
- Data planejada: ___

---

## 5. Processo de Cutover por Cliente

Para cada cliente (um por vez):

```
1. Confirmar que Zenya Prime está estável há 48h
2. Notificar cliente sobre janela de manutenção (1-2min)
3. Atualizar webhook no Chatwoot para SparkleOS:
   - Settings > Integrations > Webhooks
   - Alterar URL para: https://187.77.37.88:3004/webhook/chatwoot
4. Enviar mensagem de teste via WhatsApp
5. Confirmar resposta da Zenya via SparkleOS nos logs:
   pm2 logs zenya-webhook | grep [ACCOUNT_ID_DO_CLIENTE]
6. Aguardar 24h sem incidentes → prosseguir para próximo cliente
```

---

## 6. Monitoramento Pós-cutover (7 dias)

```bash
# Ver logs em tempo real
pm2 logs zenya-webhook

# Ver últimas 100 linhas
pm2 logs zenya-webhook --lines 100

# Verificar status
pm2 status zenya-webhook

# Reiniciar se necessário
pm2 restart zenya-webhook
```

**Critérios para desativar o n8n:**
- [ ] 7 dias de operação sem nenhum incidente crítico para todos os clientes
- [ ] Nenhum cliente solicitou rollback
- [ ] Logs sem erros 500+ acima de 1% das requisições

---

## 7. Desativação do n8n (após 7 dias estáveis)

Somente após os critérios acima estarem atendidos:

1. Notificar Mauro sobre proposta de desativação
2. Aguardar confirmação explícita
3. Manter fluxos n8n arquivados (não deletar) por 30 dias adicionais
4. Documentar data de desativação no Change Log da story 7.8
