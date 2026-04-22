# Runbook de Cutover — HL Importados (n8n → core)

**Janela:** 2026-04-22 às **23h BRT**
**Executor:** @devops (Gage) + Mauro (autoriza secrets)
**Pré-requisitos confirmados:** Z-API do Hiago já configurada no Chatwoot · Código na main (commit `1382286`) · Seed scripts prontos · UltraCash API testada (2026-04-20)
**Duração estimada:** 15-20 min fim a fim (cutover + smoke)

---

## 🔐 Decisões fechadas (2026-04-22)

- **Horário:** 23h BRT
- **Whitelist:** NÃO — liberar aberto direto. Hiago está ciente de que o início pode precisar de ajustes.
- **Env vars:** Mauro indica que já está tudo na `.env` da VPS (`HL_CHATWOOT_ACCOUNT_ID`, `HL_ADMIN_PHONES`, `ULTRACASH_API_KEY`). Pré-voo confirma. Se faltar algo, Mauro passa via shell na hora.

---

## 📋 Pré-voo (15 min antes da janela)

- [ ] `ssh -i ~/.ssh/sparkle_vps root@187.77.37.88` — conectar na VPS
- [ ] `cd /opt/sparkleos && git status` — confirmar working tree clean na main
- [ ] `git pull origin main` — sincronizar último commit (já deve estar sincronizado)
- [ ] `cd packages/zenya && npm run build` — compilar TypeScript
- [ ] Verificar `.env` da VPS tem:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (core)
  - `ZENYA_MASTER_KEY` (pra criptografar credenciais)
  - `ULTRACASH_API_KEY` (chave da API UltraCash HL)
- [ ] Confirmar que `pm2 status zenya-webhook` mostra online + tempo de uptime razoável

## 🟢 Execução — Passo 1: seed do tenant HL

```bash
# No shell da VPS, dentro de /opt/sparkleos/packages/zenya
# Se as vars já estão no .env, só rodar:
node scripts/seed-hl-tenant.mjs

# Caso precise passar via shell (pré-voo revelou que falta):
# export HL_CHATWOOT_ACCOUNT_ID="<ID da conta HL no Chatwoot>"
# export HL_ADMIN_PHONES="+55<mauro>,+55<hiago>"
# export HL_ADMIN_CONTACTS='[{"phone":"+55<mauro>","name":"Mauro"},{"phone":"+55<hiago>","name":"Hiago"}]'
# node scripts/seed-hl-tenant.mjs

# Whitelist NÃO é usada (decisão: aberto direto).
# HL_ALLOWED_PHONES deve ficar undefined → array vazio no banco → sem filtro.
```

**Saída esperada:** log com `tenant_id: <UUID>` criado/atualizado. **Guardar esse UUID** pro passo 2.

## 🟢 Execução — Passo 2: seed das credenciais UltraCash

```bash
export HL_TENANT_ID="<UUID retornado no passo 1>"
# ULTRACASH_API_KEY já deve estar no .env
node scripts/seed-hl-ultracash.mjs
```

**Saída esperada:** `credencial ultracash criptografada e salva para tenant <UUID>`.

## 🟢 Execução — Passo 3: apontar webhook do Chatwoot

No Chatwoot UI (conta HL):
- Settings → Integrations → Webhooks
- Alterar URL destino: `https://<vps-domain>/webhook/chatwoot`
- **Anotar URL antiga** (a que aponta pro n8n) — pra rollback rápido

## 🟢 Execução — Passo 4: reload do worker

```bash
pm2 reload zenya-webhook
pm2 logs zenya-webhook --lines 50  # acompanhar 30s
```

**Esperar:** `listening on port 3000` + nenhum erro de startup.

## 🧪 Smoke test (Mauro executa via WhatsApp)

1. Mauro envia pro número HL: `oi`
2. Esperar resposta da Zenya (5-10s). Deve cumprimentar e perguntar o que precisa.
3. Mauro envia: `você tem iPhone 12?`
4. Esperar: Zenya chama `Buscar_produto` → responde com produtos filtrados por "iphone 12" + estoque > 0.
5. Mauro envia: `quero falar com alguém aí`
6. Esperar: Zenya envia mensagem de repasse formatada (🔄 Passando para a equipe agora) → invoca `escalarHumano` → label `agente-off` aparece na conversa do Chatwoot.

**Critério de sucesso:** os 3 smokes passam sem erro aparente. Se falhar qualquer um, **pausar e investigar** antes de liberar geral.

## 🟢 Liberação geral

**Skipar** — nesta janela a decisão é abrir direto (sem whitelist). Após smoke PASS, a HL já está atendendo todos os clientes pelo core.

## 🧯 Rollback (executar se qualquer passo falhar)

1. **No Chatwoot UI:** Reverter webhook pra URL antiga do n8n (anotada no Passo 3).
2. **No n8n:** Reativar fluxos da pasta "06 - HL Importados" (se foram desativados).
3. Confirmar que próxima mensagem do Hiago cai de volta no n8n normalmente.
4. Abrir incident report em `docs/stories/hl-onboarding-01/incident-<timestamp>.md` com logs + diagnóstico.

## 🧹 Pós-cutover (24h depois)

- [ ] Checar logs `pm2 logs zenya-webhook` por erros recorrentes
- [ ] Confirmar com Hiago que atendimentos estão normais
- [ ] Se OK por 7 dias → **desativar** fluxos "06 - HL Importados" no n8n (não deletar, só desativar)
- [ ] Mover status da story hl-onboarding-01 pra **Done** + criar gate @qa

## 📅 Próximos passos pós-HL

Com HL migrado e n8n agora com 2 tenants (Ensinaja, Doceria Dona Geralda), atacar o cutover desses dois em stories separadas do Epic 7.8:
- Preparar inventário n8n de cada (como foi feito com HL)
- Replicar o playbook deste runbook ajustando por peculiaridade do tenant
