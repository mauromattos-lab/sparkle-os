# Inventário n8n — Ensina Já Rede de Educação

**Data:** 2026-04-23
**Por:** @pm Morgan — via claude-in-chrome + pinia store (n8n v2.7.5)
**Fonte:** n8n `https://n8n.sparkleai.tech` — pasta **"[Douglas - Ensinaja]"** (folder ID `nJw2KGNFRoHzKVGy`)
**Tenant slug proposto:** `ensinaja`
**Chatwoot account_id:** ⚠️ **pendente Mauro confirmar**
**Stakeholder:** Douglas (papel a confirmar)
**Total fluxos n8n:** 4 (1 setup + 1 principal + 2 utilitários)

---

## Resumo Executivo

A Ensina Já é uma rede de educação. O bot Zenya (nome mantido como "Zenya", não renomeado como "Gê" da Doceria) atua como **assistente de pré-venda**: qualifica leads via WhatsApp, aquece o interesse e entrega prospects para a equipe humana fechar a matrícula.

Do ponto de vista técnico, o tenant é **estruturalmente idêntico à Doceria / Julia** — 100% reuso do core Zenya SparkleOS. Zero integração custom (contraste HL/UltraCash).

**Modo atual (2026-04-23):** Zenya da Ensinaja rodando em n8n **em modo teste**, whitelist de um único contato (Douglas). Pode permanecer assim até o cutover — o core é preparado em paralelo.

**Pendência Parte B:** Douglas ainda vai enviar instruções de **como quer conduzir o atendimento**. Quando chegarem, incorporam-se no prompt v2 core e fazemos cutover. Sem pressão de prazo.

---

## Tabela de Fluxos

| # | Nome | ID n8n | Nodes | Status | Tipo |
|---|------|--------|-------|--------|------|
| 00 | [Douglas - Ensinaja] Configuracoes | `IJh9ti7sfp4cWZBA` | 32 | inactive | setup run-once |
| 01 | [Douglas - Ensinaja] Secretaria Zenya ⭐ | `VexWkztoRE3Upccd` | **96** | **active** (whitelist Douglas) | atendimento principal |
| 05 | [Douglas - Ensinaja] Escalar Humano | `1sokEtHFxVp0RXS3` | 15 | active | sub-workflow (tool) |
| 07 | [Douglas - Ensinaja] Quebrar Mensagens | `neKUk5eGE5uMT4MA` | 23 | active | sub-workflow (utilitário) |

> Numeração lacunar (falta 02, 03, 04, 06) consistente com HL/Doceria/Prime.
> **Complexidade:** Ensinaja tem 96 nodes no principal — maior que Doceria (86) e HL (62). Não significa integração custom; é verbosity de sticky notes (35x `stickyNote`) e mais lógica de conversação.

---

## 01. Secretaria Zenya — workflow principal ⭐

### Webhook
- **Trigger:** webhook `POST /webhook/ensinaja`
- **Dispatcher:** Chatwoot da conta Ensinaja aponta pra esse path

### Agent (nó `Secretária v3`)
- **Tipo:** `@n8n/n8n-nodes-langchain.agent`
- **Nome do bot:** **Zenya** (mantém o nome padrão — não renomeado como "Gê" da Doceria)
- **Modelo principal:** `gpt-4.1` (via `@n8n/n8n-nodes-langchain.lmChatOpenAi`)
- **Modelos auxiliares:** `gpt-4.1-mini` (chains `Formatar texto` e `Formatar SSML`)
- **Memória:** `@n8n/n8n-nodes-langchain.memoryPostgresChat` — tabela Postgres, mesmo pattern Prime/Doceria/HL
- **Prompt snapshot (baseline n8n 2026-04-23):**
  - `length_chars`: **10.073** (menor que Doceria 13.5k — prompt mais enxuto)
  - `lines`: **247**
  - `md5`: `b9433ca5e2f4983ea6e8bd3bcc26e933`
  - Conteúdo preservado em `docs/zenya/tenants/ensinaja/prompt-v1-baseline-n8n.md` — **imutável**, fonte histórica

### Tools disponíveis ao agente (idênticas à Doceria)

| Tool | Tipo | Destino |
|------|------|---------|
| Refletir | `toolThink` | Reflexão interna do agente |
| Escalar humano | `toolWorkflow` | Sub-workflow 05 |
| Enviar texto separado | `httpRequestTool` | Chunking via executeWorkflow (07) |
| Preferencia audio texto | `httpRequestTool` | ElevenLabs + Chatwoot |
| Reagir mensagem | `httpRequestTool` | Chatwoot reaction |
| Enviar arquivo | `toolWorkflow` | Google Drive → Chatwoot |
| Enviar alerta de cancelamento | `httpRequestTool` | Chatwoot admin |
| Criar agendamento | `toolWorkflow` | Google Calendar |
| Cancelar agendamento | `googleCalendarTool` | Google Calendar direto |
| Buscar agendamentos do contato | `googleCalendarTool` | Google Calendar direto |
| Buscar janelas disponíveis | `toolWorkflow` | Google Calendar (sub-wf) |
| Atualizar agendamento | `toolWorkflow` | Google Calendar (sub-wf) |
| ~~Criar ou buscar cobrança~~ | ~~`toolWorkflow`~~ | ~~Asaas sandbox~~ — **OUT do escopo core** (decisão 2026-04-23) |
| Listar arquivos | `googleDriveTool` | Google Drive (catálogo/fotos) |

### Config declarativa (nó `Info`)

```yaml
url_chatwoot: https://chatwoot.sparkleai.tech
url_asaas: https://api-sandbox.asaas.com       # ⚠️ SANDBOX — não prod
id_conversa_alerta: "<inserir id da conversa de alerta>"  # ⚠️ PLACEHOLDER — Douglas ainda não configurou
```

**Extraídos do payload Chatwoot:** `id_mensagem, id_conta, id_conversa, id_contato, telefone, nome, mensagem, mensagem_de_audio, timestamp, tipo, etiquetas, email_usuario, atributos_contato, info_arquivo` (idêntico aos demais tenants)

### Delta vs Doceria / HL

| Dimensão | HL Importados | Doceria | **Ensinaja** |
|----------|---------------|---------|----------------|
| Integração custom | UltraCash (ERP) | Nenhuma | **Nenhuma** |
| Tipo de atendimento | Loja eletrônicos (SAC+venda) | Doceria (SAC+encomenda) | **Pré-venda / qualificação de leads** |
| Bot name | Zenya | Gê | **Zenya** |
| Prompt chars (v1) | ~? | 13.528 | **10.073** (mais enxuto) |
| Asaas no n8n | Não | Sandbox (OUT core) | **Sandbox (OUT core)** — decisão Mauro 2026-04-23, mesma lógica da Doceria |
| Agendamento (Calendar) | Não usa | Sim | Sim |
| Envio de arquivos (Drive) | Não usa | Sim (fotos) | Sim (material? folder? a validar) |
| Modo atual | n8n pausado | n8n pausado | **n8n ativo em whitelist (Douglas)** |

---

## 00. Configuracoes — setup run-once (32 nodes)

Prepara ambiente padrão: tabela `n8n_historico_mensagens`, etiquetas Chatwoot (`agente-off`, `testando-agente`, `gestor`), atributos de contato. Idêntico estrutural aos demais tenants.

## 05. Escalar Humano — sub-workflow (15 nodes)

Pattern padrão Zenya: recebe chamada do agent, aplica etiqueta `agente-off`, alerta admin. Equivalente à função `escalarHumano` já no core.

## 07. Quebrar Mensagens — sub-workflow (23 nodes)

Pattern padrão Zenya: chunking de texto longo com typing indicator. Já implementado no core.

---

## Taxonomia de produto — "pré-venda / qualificação"

Essa é a diferença-chave do Ensinaja comparado aos outros tenants no core:

- **Julia (Fun Personalize)**: SAC + venda de produtos personalizados
- **Prime (Zenya própria)**: demo/SAC
- **HL Importados**: SAC + consulta de estoque (tem ERP)
- **Doceria**: SAC + encomenda + vitrine
- **Ensinaja** ← **qualificação de leads, entrega pra humano fechar matrícula**

**Implicação pro prompt v2 core:** o fluxo de "passar pra humano" é FRENTE do atendimento, não exceção. O bot qualifica (coleta nome, interesse em qual curso, urgência, condições) e **escala ativamente** quando o lead está aquecido. Não há "venda autônoma" — escalação é parte do sucesso, não falha.

Isso inverte lógica do guard-rail da Doceria (que era "não feche venda de vitrine sem humano"). No Ensinaja, **a escalação é o resultado desejado do fluxo bem conduzido**, não um safeguard.

---

## Pendências pra destravar Fase 1 (story + dev)

### Fase 0 Parte A — concluída ✅

- [x] Extração dos 4 workflows n8n (raw/*.json)
- [x] Prompt v1 baseline imutável salvo (`docs/zenya/tenants/ensinaja/prompt-v1-baseline-n8n.md`)
- [x] INVENTARIO.md (este doc)
- [x] Classificação técnica: 100% reuso, zero integração custom

### Fase 0 Parte B — dependências operacionais

- [ ] **Chatwoot account_id do Ensinaja** — Mauro confirmar (ou eu busco via Chatwoot UI)
- [ ] **Telefone do Douglas** — pra configurar `DOCERIA-like admin_phones` no seed E pra manter whitelist em modo teste no core
- [x] ~~**Asaas — portar ou OUT?**~~ → **OUT** (decisão Mauro 2026-04-23)
- [ ] **Google Drive — tem folder específico?** — se sim, compartilhar ID; se não, Douglas envia materiais conforme precisar
- [ ] **id_conversa_alerta** — Douglas ainda não configurou no n8n (placeholder vazio). Precisa definir no seed core
- [ ] **Instruções do Douglas de condução de atendimento** ⭐ — gatilho pro v2 core + REPL + gate + cutover (Parte B propriamente dita)

### O que já dá pra adiantar sem Douglas

Quando for hora de Fase 1 (story creation) via @sm, o work:
- Seed script espelhando `seed-doceria-tenant.mjs` (~20min @dev)
- Ajustes no prompt v2 core com base no próprio prompt v1 (estrutura pré-venda — ~30min @pm/@dev pré-Douglas refinando depois com ele)
- Smoke com cenários de pré-venda (qualificação, agendamento, escalação ativa — ~45min @dev)

**Tempo total Ensinaja pós-Douglas-OK:** estimado **3-4h** (bem mais rápido que HL por ser reuso total; comparável à Doceria).

---

## Changelog

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-04-23 | @pm Morgan | Fase 0 Parte A concluída — 4 workflows extraídos, prompt v1 baseline fixado (md5 `b9433ca5e2f4983ea6e8bd3bcc26e933`), classificação: 100% reuso core (tenant-irmão Doceria/Julia). Modo atual n8n ativo com whitelist Douglas. Parte B bloqueada por instruções do Douglas. |
| 2026-04-23 | @pm Morgan + Mauro | Asaas OUT do escopo core — Ensinaja não terá cobrança automatizada. Mesma lógica da Doceria. Seed deve omitir `asaas` dos active_tools. Prompt v2 core precisa limpar menções. |
