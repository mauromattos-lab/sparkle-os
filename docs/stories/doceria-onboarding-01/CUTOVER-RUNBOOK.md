# CUTOVER RUNBOOK — Doceria & Padaria Dona Geralda

**Story:** `doceria-onboarding-01`
**Autor:** @dev Dex · @pm Morgan — 2026-04-23
**Executor do cutover:** Mauro + @devops Gage (push)
**Pré-condições:** Story ACs 1-11 Done · Gate @qa PASS/PASS w/concerns · Alinhamento Ariane+Alex concluído (AC 12)
**Duração estimada:** ~15min (muito mais curto que HL por não ter ERP)

---

## Pré-voo (T-15min)

- [ ] Confirmar horário do cutover com **Ariane + Alex** (eles avisam clientela se necessário)
- [ ] Conferir VPS acessível: `ssh sparkle-vps 'uptime'`
- [ ] Conferir Supabase reachable: `node scripts/seed-doceria-tenant.mjs --dry-run` local (deve imprimir md5 do prompt)
- [ ] Confirmar md5 atual do prompt bate com baseline: `1955c70db91d0823fc79be2bcc05f9b7` (v2.1)
- [ ] Branch principal com merge do commit que contém `prompt.md` v2.1 + scripts
- [ ] Cliente (Ariane) sabe que pode fazer teste após cutover? Sim/Não
- [ ] Plano B preparado: rollback para n8n (ver §Rollback)

---

## 1. Preparar a VPS

```bash
ssh -i ~/.ssh/sparkle_vps root@187.77.37.88
cd /var/www/sparkle       # ajustar se path diferente
git pull origin main
cd packages/zenya
npm install               # se houver novas deps (não deveria — Doceria não adiciona libs)
npm run build
```

---

## 2. Seedar tenant Doceria no Supabase

Exportar envs no shell da VPS (SUPABASE_URL / SERVICE_KEY já estão no `.env` da VPS):

```bash
export DOCERIA_CHATWOOT_ACCOUNT_ID="3"
export DOCERIA_ADMIN_PHONES="+5511976908238,+55XXXXXXXXXXX"   # Mauro + Ariane (ajustar)
export DOCERIA_ADMIN_CONTACTS='[{"phone":"+5511976908238","name":"Mauro"},{"phone":"+55XXXXXXXXXXX","name":"Ariane"}]'
# opcional: whitelist pra modo teste (comentar em produção aberta)
# export DOCERIA_ALLOWED_PHONES="+55..."

# Dry-run obrigatório primeiro (validar md5 antes de escrever):
node scripts/seed-doceria-tenant.mjs --dry-run

# Se md5 bateu com 1955c70db91d0823fc79be2bcc05f9b7 → executar real:
node scripts/seed-doceria-tenant.mjs
# → anota TENANT_ID impresso
```

**Checkpoint:** validar via SQL direto no Supabase:
```sql
SELECT id, name, active_tools, chatwoot_account_id, md5(system_prompt) AS prompt_md5
FROM zenya_tenants
WHERE chatwoot_account_id = '3';
```

O `prompt_md5` DEVE ser `1955c70db91d0823fc79be2bcc05f9b7`. Se divergir, PARAR e investigar.

---

## 3. Configurar Chatwoot (account_id=3)

- **Settings > Integrations > Webhooks** da conta Doceria
  - URL atual (n8n): `https://n8n.sparkleai.tech/webhook/doceria-dona-geralda` ← **salvar pra rollback**
  - URL nova: `https://zenya.sparkleai.tech/webhook/chatwoot` (multi-tenant padrão do core)
- **Labels necessárias:** `agente-off`, `testando-agente`, `gestor` (rodar `setup-zapi-labels.mjs` se ainda não criadas — pattern Prime)

---

## 4. Reload Zenya

```bash
pm2 reload zenya-webhook
pm2 logs zenya-webhook --lines 50
```

Esperar sinal `[zenya] webhook ready` sem erros. Se houver, PARAR e investigar antes de liberar tráfego.

---

## 5. Smoke pós-cutover

**Mauro (ou whitelist admin)** manda mensagem WhatsApp pro número da Doceria:

- [ ] "oi" → Zenya responde com saudação (Gê)
- [ ] "quero uma coxinha de frango grande" → bot responde com handoff curto E label `agente-off` aparece no Chatwoot (checkpoint crítico — AC 8 caso 1)
- [ ] "me manda o cardápio dos bolos" → bot envia link `wa.me/p/31793244436940904/...`
- [ ] `pm2 logs zenya-webhook | grep -i doceria` — sem erros

Se qualquer item falhar → rollback.

---

## 6. Desligar fluxos n8n da Confeitaria (Doceria)

Na pasta "03 - Confeitaria" do n8n, confirmar toggle OFF (já está inativo desde 2026-04-18):

- [ ] `01. Confeitaria Dona Geralda - Secretaria v3` (já inativo)
- [ ] `05. Confeitaria - Escalar humano` (estava ativo — desativar agora)
- [ ] `07. Confeitaria - Quebrar e enviar mensagens` (estava ativo — desativar agora)
- [ ] `00. Confeitaria - Configuracoes` (run-once, manter inativo)

---

## 7. Monitoramento (primeiras 2h)

- [ ] `pm2 logs zenya-webhook --lines 100 -f` em um terminal
- [ ] Chatwoot UI aberta na conta Doceria
- [ ] Ariane + Alex cientes pra avisar se algo estranho
- [ ] Coletar casos de flakiness em tempo real pra alimentar Epic 11.3 (`engine-hardening-01`)

---

## 8. Monitoramento 96h (pós-cutover)

Mesmo pattern HL: primeiras 24h sinal fraco = OK; 72h estabilidade confirmada = gate @qa pós-cutover PASS; 96h = story marcada Done.

---

## Rollback (qualquer momento)

Tempo estimado: **< 3 minutos**.

1. **Chatwoot** (account_id=3) → Settings > Integrations > Webhooks → trocar URL de volta pra `https://n8n.sparkleai.tech/webhook/doceria-dona-geralda`
2. **n8n** → reativar toggle ON dos fluxos `01`, `05`, `07` da pasta "03 - Confeitaria"
3. **Notificar Ariane+Alex:** "voltamos pro fluxo antigo por X minutos, tudo bem"
4. **Tenant no Supabase permanece** — não precisa apagar, fica dormente. Diagnóstico post-mortem com logs.

**Plano B:** se o n8n estiver inoperante (ex: pasta "03 - Confeitaria" corrompida), pausa completa do atendimento automatizado — Ariane/Alex assumem manualmente até investigar. Mesmo estado pré-cutover (fluxo já estava pausado voluntariamente).

---

## Checklist final Done

- [ ] Passos 1-6 executados
- [ ] Smoke pós-cutover 100% (AC 8 caso 1 crítico)
- [ ] Monitoramento 2h sem incidente crítico
- [ ] Sem reclamação de Ariane/Alex/cliente final
- [ ] Story atualizada com cutover confirmado em File List + Change Log
- [ ] Gate @qa pós-cutover PASS após 96h (story → Done)
