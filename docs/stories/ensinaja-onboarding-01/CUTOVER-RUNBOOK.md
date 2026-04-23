# CUTOVER RUNBOOK — Ensina Já Rede de Educação

**Story:** `ensinaja-onboarding-01`
**Autor:** @dev Dex · @pm Morgan — 2026-04-23
**Executor do cutover:** Mauro + @devops Gage (push)
**Pré-condições:** Story ACs 1-11 Done · Gate @qa PASS/PASS w/concerns · Alinhamento Douglas concluído (AC 12)
**Duração estimada:** ~15min (muito mais curto que HL por não ter ERP)

---

## Pré-voo (T-15min)

- [ ] Confirmar horário do cutover com **Douglas** (avisa clientela se necessário)
- [ ] Conferir VPS acessível: `ssh sparkle-vps 'uptime'`
- [ ] Conferir Supabase reachable: `node scripts/seed-ensinaja-tenant.mjs --dry-run` local (deve imprimir md5 do prompt)
- [ ] Confirmar md5 atual do prompt bate com baseline: `ea8b01e31460e0be983f3a23ef2a86da` (v2.1)
- [ ] Branch principal com merge do commit que contém `prompt.md` v2.1 + scripts
- [ ] Cliente (Douglas) sabe que pode fazer teste após cutover? Sim/Não
- [ ] Plano B preparado: rollback para n8n (ver §Rollback)

---

## 1. Preparar a VPS

```bash
ssh -i ~/.ssh/sparkle_vps root@187.77.37.88
cd /var/www/sparkle       # ajustar se path diferente
git pull origin main
cd packages/zenya
npm install               # se houver novas deps (não deveria — Ensinaja não adiciona libs)
npm run build
```

---

## 2. Seedar tenant Ensinaja no Supabase

Exportar envs no shell da VPS (SUPABASE_URL / SERVICE_KEY já estão no `.env` da VPS):

```bash
export ENSINAJA_CHATWOOT_ACCOUNT_ID="3"
export ENSINAJA_ADMIN_PHONES="+5511976908238,+55XXXXXXXXXXX"   # Mauro + Douglas (ajustar)
export ENSINAJA_ADMIN_CONTACTS='[{"phone":"+5511976908238","name":"Mauro"},{"phone":"+55XXXXXXXXXXX","name":"Douglas"}]'
# opcional: whitelist pra modo teste (comentar em produção aberta)
# export ENSINAJA_ALLOWED_PHONES="+55..."

# Dry-run obrigatório primeiro (validar md5 antes de escrever):
node scripts/seed-ensinaja-tenant.mjs --dry-run

# Se md5 bateu com ea8b01e31460e0be983f3a23ef2a86da → executar real:
node scripts/seed-ensinaja-tenant.mjs
# → anota TENANT_ID impresso
```

**Checkpoint:** validar via SQL direto no Supabase:
```sql
SELECT id, name, active_tools, chatwoot_account_id, md5(system_prompt) AS prompt_md5
FROM zenya_tenants
WHERE chatwoot_account_id = '4';
```

O `prompt_md5` DEVE ser `ea8b01e31460e0be983f3a23ef2a86da`. Se divergir, PARAR e investigar.

---

## 3. Configurar Chatwoot (account_id=4)

- **Settings > Integrations > Webhooks** da conta Ensinaja
  - URL atual (n8n): `https://n8n.sparkleai.tech/webhook/ensinaja` ← **salvar pra rollback**
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

**Mauro (ou whitelist admin)** manda mensagem WhatsApp pro número da Ensinaja:

- [ ] "oi" → Zenya responde com saudação (apresentando Ensina Já)
- [ ] "quero me matricular no curso de auxiliar administrativo, nome Roberto, (11) 9..." → bot deve escalar (AC crítico EN2 — **se ainda não passou, é esperado até v2.1 pós-Douglas**)
- [ ] "quanto custa o curso X?" → bot responde com valor do prompt ou admite que não tem
- [ ] `pm2 logs zenya-webhook | grep -i ensinaja` — sem erros

Se qualquer item falhar → rollback.

---

## 6. Desligar fluxos n8n do Ensinaja

⚠️ **Atenção especial:** diferente de Doceria/HL (que tinham n8n já pausado antes do cutover), o Ensinaja está **ativo em modo teste com whitelist do Douglas**. Desativar o n8n **ANTES** de trocar o webhook do Chatwoot (passo 3) pra evitar double-processing durante a janela de cutover.

Na pasta "[Douglas - Ensinaja]" do n8n, desativar os 3 workflows ativos:

- [ ] `[Douglas - Ensinaja] Secretaria Zenya` (principal — desativar PRIMEIRO)
- [ ] `[Douglas - Ensinaja] Escalar Humano`
- [ ] `[Douglas - Ensinaja] Quebrar Mensagens`
- [ ] `[Douglas - Ensinaja] Configuracoes` (run-once, manter inativo)

---

## 7. Monitoramento (primeiras 2h)

- [ ] `pm2 logs zenya-webhook --lines 100 -f` em um terminal
- [ ] Chatwoot UI aberta na conta Ensinaja
- [ ] Douglas ciente pra avisar se algo estranho
- [ ] Coletar casos de flakiness em tempo real pra alimentar Epic 11.3 (`engine-hardening-01`)

---

## 8. Monitoramento 96h (pós-cutover)

Mesmo pattern HL: primeiras 24h sinal fraco = OK; 72h estabilidade confirmada = gate @qa pós-cutover PASS; 96h = story marcada Done.

---

## Rollback (qualquer momento)

Tempo estimado: **< 3 minutos**.

1. **Chatwoot** (account_id=4) → Settings > Integrations > Webhooks → trocar URL de volta pra `https://n8n.sparkleai.tech/webhook/ensinaja`
2. **n8n** → reativar toggle ON dos fluxos `01`, `05`, `07` da pasta "[Douglas - Ensinaja]"
3. **Notificar Douglas:** "voltamos pro fluxo antigo por X minutos, tudo bem"
4. **Tenant no Supabase permanece** — não precisa apagar, fica dormente. Diagnóstico post-mortem com logs.

**Plano B:** se o n8n estiver inoperante (ex: pasta "[Douglas - Ensinaja]" corrompida), pausa completa do atendimento automatizado — Douglas assume manualmente até investigar. Diferença vs Doceria: Ensinaja estava em modo teste, então impacto é pequeno (apenas whitelist, não clientes finais).

---

## Checklist final Done

- [ ] Passos 1-6 executados
- [ ] Smoke pós-cutover 100% (AC 8 caso 1 crítico)
- [ ] Monitoramento 2h sem incidente crítico
- [ ] Sem reclamação de Douglas/cliente final
- [ ] Story atualizada com cutover confirmado em File List + Change Log
- [ ] Gate @qa pós-cutover PASS após 96h (story → Done)
