# Cutover Checklist — Scar AI (GuDesignerPro)

**Formato:** espelhado no `docs/stories/hl-onboarding-01/README.md` (seção Checklist de cutover).
**Quando executar:** dia do go-live, após todas as fases A-D estarem completas e Gustavo ter liberado o QR code da Z-API.
**Responsável:** Mauro (com acompanhamento do @dev).

---

## 1. Preparar a VPS

```bash
ssh -i ~/.ssh/sparkle_vps root@187.77.37.88
cd /caminho/do/repo
git fetch origin
git checkout feature/scar-ai-onboarding-01    # ou main, se já merged
git pull
cd packages/zenya
npm install           # se houver deps novas (não deve haver — zero integrações externas)
npm run build
```

## 2. Criar o tenant Scar AI no Supabase

> ⚠️ **Já executado em 2026-04-21 (Fase C1).** Tenant existe com `id = ae522886-6b09-4876-8456-208ab49eb6ed`.
> Reexecutar o seed no cutover apenas se o prompt tiver sido atualizado — o script é idempotente (upsert por `chatwoot_account_id`).

No shell da VPS, exportar env vars (o `.env` da VPS já tem `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`):

```bash
export SCAR_CHATWOOT_ACCOUNT_ID="<account_id criado na Fase B1>"
export SCAR_ADMIN_PHONES="+5512981303249,+5574814467555"
export SCAR_ADMIN_CONTACTS='[
  {"phone":"+5512981303249","name":"Mauro"},
  {"phone":"+5574814467555","name":"Gustavo"}
]'

# Opcional — modo teste (libera bot só pra whitelist inicial):
# export SCAR_ALLOWED_PHONES="+5512981303249"

node scripts/seed-scar-tenant.mjs
# → anota o TENANT_ID impresso no output
```

Verificação pós-seed:

```sql
-- Supabase SQL Editor
select id, name, chatwoot_account_id, active_tools, array_length(admin_phones, 1) as n_admins
from zenya_tenants
where name = 'Scar AI — GuDesignerPro';
```

Esperado: 1 linha · `active_tools: {}` · `n_admins: 2`.

## 3. Seedar credenciais Z-API

```bash
export SCAR_TENANT_ID="<UUID impresso no passo 2>"
export ZAPI_INSTANCE_ID="<id instância Z-API do Gustavo>"
export ZAPI_INSTANCE_TOKEN="<token>"
export ZAPI_CLIENT_TOKEN="<client-token>"

node scripts/seed-zapi-credentials.mjs
```

## 4. Chatwoot — confirmar configuração

Já feito na Fase B via browser automation. Reconferir:

- [ ] Conta "GuDesignerPro" existe e está ativa
- [ ] Labels presentes: `agente-off`, `follow-up`, `testando-agente`
- [ ] Webhook configurado apontando para `https://api.sparkleai.tech/webhook/chatwoot`
- [ ] Inbox Z-API criado e **conectado** (QR code pareado com o celular do Gustavo)

## 5. Reload do processo Zenya

```bash
pm2 reload zenya-webhook
pm2 logs zenya-webhook --lines 50
```

Esperado: zero erros, worker rodando.

## 6. Smoke test em produção

Replicar as validações D1-D8 da story, agora contra o número real do Gustavo:

- [ ] Mandar "Oi, tudo bem?" de um número admin → Scar responde em PT, pergunta sobre live
- [ ] Mandar "Hi there" de outro número admin → Scar responde em EN
- [ ] Conduzir PT até link BR + Pix — sem vazar preço antes da hora
- [ ] Conduzir EN até link US + PayPal/Higlobe
- [ ] Testar objeção "tá caro" → tabela de avulsas
- [ ] Testar objeção "faz mais barato?" → Scar libera 5%
- [ ] Testar aceite de fechamento → Scar escala (não envia Pix)
- [ ] Aplicar label `agente-off` numa conversa → bot para; remover → volta

## 7. Treinamento do Gustavo (15 min)

Call breve com o Gustavo cobrindo:

- [ ] Como usar `agente-off` para "assumir" uma conversa
- [ ] Fluxo esperado: Scar escala → Gustavo recebe ping admin → Gustavo entra na conversa
- [ ] Processo pós-pagamento: criar grupo com ilustrador + enviar planilha de briefing
- [ ] O que fazer se Scar errar: remover label, mandar feedback em canal admin

## 8. Monitoramento primeiros 48h

- [ ] `pm2 logs zenya-webhook -f` — conferir zero erros Chatwoot 4xx/5xx
- [ ] Acompanhar métricas de:
  - Taxa de conclusão de fluxo (chegou em "vou te passar pro Gu")
  - Falsos negativos de idioma (gringo respondido em PT ou vice-versa)
  - Objeções tratadas corretamente
- [ ] Se algo crítico: aplicar `agente-off` em massa via Chatwoot UI e me chamar

## Plano de rollback

Zero-impact rollback (o tenant é novo, não migra nada que já esteja em produção):

1. No Chatwoot, remover o webhook da conta GuDesignerPro.
2. Desativar o inbox Z-API (ou desconectar no celular do Gustavo).
3. Gustavo volta a atender manualmente no WhatsApp dele.
4. O tenant fica dormindo no Supabase — não precisa apagar. Pode ser reativado depois.

## Pós-go-live — follow-ups (v2)

- Tabela de preços em PT-PT quando Gustavo atender primeiro cliente de Portugal
- Dashboard de métricas para Gustavo (stories Zenya #5 ou squad de analytics)
- Integração com Asaas/Stripe se Gustavo quiser automatizar cobrança (ele hoje manda Pix manual)
