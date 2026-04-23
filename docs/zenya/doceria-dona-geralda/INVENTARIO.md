# Inventário n8n — Doceria & Padaria Dona Geralda (tenant "Confeitaria")

**Data:** 2026-04-22
**Por:** @pm Morgan — via claude-in-chrome + pinia store (n8n v2.7.5)
**Fonte:** n8n `https://n8n.sparkleai.tech` — pasta **"03 - Confeitaria"** (folder ID `tonpUaF25ZePQbQw`)
**Tenant slug proposto:** `doceria-dona-geralda`
**Chatwoot account_id:** 3
**Total fluxos n8n:** 4 (1 setup + 1 principal + 2 utilitários)

---

## Resumo Executivo

A Doceria Dona Geralda roda no n8n espelhando 1:1 o pattern **Julia / Fun Personalize** (tenant já migrado pro core Zenya). Diferença do HL Importados: **zero integração custom**. Tudo o que a Doceria usa já existe no core SparkleOS — Google Calendar, Google Drive, ElevenLabs, Chatwoot, OpenAI, Postgres memory, escalação.

O único "diferencial" de produto é o **link do cardápio Yooga** (`https://delivery.yooga.app/doceria-dona-geralda`) — mas é **apenas um link estático dentro do prompt**, não integração de API. Também há envio de fotos de produtos via Google Drive (já suportado).

**Asaas (cobrança):** presente no n8n atual apontando pra sandbox. **Mauro decidiu não portar** essa capacidade para o core — a Doceria não vai usar cobrança automatizada. Tool `Criar ou buscar cobranca` **não entra** no seed do tenant no core.

**Estado operacional:** fluxo principal (`01. Secretaria v3`) está **inativo desde ~2026-04-18 (sábado)** após incidente de venda de produto de vitrine (coxinha) e série de queixas sobre estilo do bot. Ariane pediu pausa em 2026-04-17 pra alinhar com **Alex** (sócia/gestora). Mauro decidiu não reativar em n8n — vai diretamente pro core no onboarding. Sem janela de cutover apertada.

> **Fonte detalhada:** 3 áudios Ariane → Mauro de 2026-04-17 transcritos em `feedback-ariane-20260417.md`. Leitura obrigatória antes do onboarding core.

**Consequência pro onboarding:** não requer módulo novo no core, mas **não é só seed** — o prompt precisa **reescrita parcial** pra atender 4 constraints da Ariane (ver §Constraints abaixo).

Resumo do onboarding:
1. Seed tenant (chatwoot account_id=3, webhook, credenciais)
2. **Refazer prompt da Gê** incorporando as 4 constraints (não só snapshot do n8n) — novo md5 baseline
3. Ativar tools existentes: Drive, Calendar, ElevenLabs (Asaas **off**)
4. Substituir link Yooga por link do cardápio WhatsApp (URL pendente Mauro)
5. Configurar **Alex** como segundo admin (telefone pendente)

---

## Constraints de negócio — feedback Ariane 2026-04-17

Derivadas de `feedback-ariane-20260417.md` (leitura obrigatória).

1. **HARD — venda de vitrine exige confirmação humana:** bot **NÃO pode fechar venda** de produtos perecíveis / do dia (salgados, doces de vitrine). Deve gerar **resumo do pedido** e escalar pra humano confirmar disponibilidade. Gatilho do incidente: bot confirmou coxinha grande, cliente pagou, produto não existia mais na retirada.
2. **SOFT — estilo:** mensagens curtas, sem textão, sem múltiplas mídias em sequência. Ariane reclamou explicitamente de "textão imenso" e "dois vídeos seguidos".
3. **SOFT — cardápio:** trocar link Yooga por **link do cardápio que fica no WhatsApp da Doceria** (URL pendente Mauro obter).
4. **META — stakeholders:** decisões operacionais passam por **Ariane + Alex** (sócia). Não só Ariane.

**Taxonomia de produto implícita** (a esclarecer com cliente):

| Classe | Exemplo | Bot pode fechar? |
|--------|---------|------------------|
| Planejável | Bolo por encomenda | Sim (tem prazo, não é imediato) |
| Vitrine | Coxinha, salgados, doces do dia | **Não — só resumo + humano** |

Essa separação precisa estar no prompt **e** idealmente como guardrail programático (cross-tenant, relacionável à story `engine-hardening-01`).

---

## Tabela de Fluxos

| # | Nome | ID n8n | Nodes | Status | Tipo |
|---|------|--------|-------|--------|------|
| 00 | Confeitaria - Configuracoes | `be7t91uaUBdi3G5d` | 32 | inactive | setup run-once |
| 01 | Confeitaria Dona Geralda - Secretaria v3 ⭐ | `u7BDmAvPE4Sm6NXd` | **86** | **inactive** ⚠️ | atendimento principal |
| 05 | Confeitaria - Escalar humano | `N9vF50amwJuULpY9` | 15 | active | sub-workflow (tool) |
| 07 | Confeitaria - Quebrar e enviar mensagens | `lotiyKm62Bd3KbS0` | 23 | active | sub-workflow (utilitário) |

> Numeração lacunar (falta 02, 03, 04, 06) — consistente com padrão observado em outros tenants; workflows auxiliares foram consolidados ou reaproveitados de Prime.

---

## 01. Secretaria v3 — workflow principal ⭐

### Webhook
- **Trigger:** webhook `POST /webhook/doceria-dona-geralda`
- **Dispatcher:** Chatwoot da conta `account_id=3` aponta pra esse path

### Agent (nó `Secretária v3`)
- **Tipo:** `@n8n/n8n-nodes-langchain.agent` v2.2
- **Nome do bot:** **Gê** (apelido de "Geralda")
- **Modelo principal:** `gpt-4.1` (via `@n8n/n8n-nodes-langchain.lmChatOpenAi`, OpenAI node legacy mantido)
- **Modelos auxiliares:** `gpt-4.1-mini` (usados em chains `Formatar texto` e `Formatar SSML`)
- **Memória:** `@n8n/n8n-nodes-langchain.memoryPostgresChat` — tabela Postgres, mesmo pattern Prime
- **Prompt versionamento:**
  - **v1 baseline (n8n):** 13.528 chars / 256 linhas / md5 `a28a57cccdd77a0a3e9ed4bf11b8a12b` — preservado em `docs/zenya/tenants/doceria-dona-geralda/prompt-v1-baseline-n8n.md` (imutável, fonte histórica)
  - **v2 core (AIOX, 2026-04-22):** 18.576 chars (trimmed) / 314 linhas / md5 `83adb5148f2ffb2e4308255b15e63505` (v2.3 — +Coleta de item específico antes de escalar vitrine, após REPL Mauro 2026-04-23 observar que escalação com resumo genérico força equipe a re-perguntar ao cliente. Desambiguação de intenção [v2.2] + coleta de especificidade [v2.3] completam fluxo pré-escalação) — em `docs/zenya/tenants/doceria-dona-geralda/prompt.md` com frontmatter canônico (ADR-001). Acréscimos sobre v1: regra 8 reforçada (vitrine ≠ cardápio), regra 9 bifurcada (bolo → WhatsApp; geral → Yooga), 2 novas REGRAS CRÍTICAS (9: vitrine sempre humano, 10: resposta concisa sem textão), 1 linha nova em §Informações da loja. **Link cardápio bolos preenchido:** https://wa.me/p/31793244436940904/5511976908238 (WhatsApp Business catalog).

### Tools disponíveis ao agente

| Tool | Tipo | Destino |
|------|------|---------|
| Refletir | `toolThink` | Reflexão interna do agente |
| Escalar humano | `toolWorkflow` | Sub-workflow 05 |
| Enviar texto separado | `httpRequestTool` | Chunking por `executeWorkflow` (07) |
| Enviar áudio (Preferencia audio texto) | `httpRequestTool` | ElevenLabs + Chatwoot |
| Reagir mensagem | `httpRequestTool` | Chatwoot reaction |
| Enviar arquivo | `toolWorkflow` | Google Drive → Chatwoot |
| Enviar alerta de cancelamento | `httpRequestTool` | Chatwoot (conversa admin `id_conversa_alerta=3`) |
| Criar agendamento | `toolWorkflow` | Google Calendar |
| Cancelar agendamento | `googleCalendarTool` | Google Calendar direto |
| Buscar agendamentos do contato | `googleCalendarTool` | Google Calendar direto |
| Buscar janelas disponíveis | `toolWorkflow` | Google Calendar (sub-wf) |
| Atualizar agendamento | `toolWorkflow` | Google Calendar (sub-wf) |
| ~~Criar ou buscar cobrança~~ | ~~`toolWorkflow`~~ | ~~Asaas sandbox~~ — **OUT do escopo core** (decisão 2026-04-22) |
| Listar arquivos | `googleDriveTool` | Google Drive (catálogo de fotos) |

> **Delta vs HL:** HL tinha `Buscar_produto` (UltraCash ERP). Doceria **não tem** tool equivalente — catálogo é link Yooga no prompt + fotos via Drive (Listar arquivos / Enviar arquivo).

### Config declarativa (nó `Info`)

```yaml
url_chatwoot: https://chatwoot.sparkleai.tech/
url_asaas: https://api-sandbox.asaas.com       # ⚠️ SANDBOX — não prod
agendamento_duracao_minutos: 30
cobranca_valor: 500                              # R$ 5,00 (centavos) — default
id_conversa_alerta: 3                            # conversa interna de alertas
```

**Extraídos do payload Chatwoot:** `id_mensagem, id_conta, id_conversa, id_contato, telefone, nome, mensagem, mensagem_de_audio, timestamp, tipo, etiquetas, email_usuario, atributos_contato, info_arquivo`

### Capacidades observadas no flow

- Fila anti-cavalgamento de mensagens (Postgres — mesmo pattern Prime)
- Switch de tipo (texto/áudio/arquivo)
- Transcrição de áudio (OpenAI Whisper via `@n8n/n8n-nodes-langchain.openAi`)
- Geração de áudio (ElevenLabs) — com SSML formatter próprio (`Formatar SSML`)
- Validação de output do agente (`Output válido?` → `Output inválido` com stopAndError)
- Reset/teste via etiquetas Chatwoot (`testando-agente`) — pattern Prime
- Agente-off check em tempo real (etiquetas Chatwoot)
- Status de atendimento lockable (tabela Postgres `n8n_status_atendimento`)

---

## 00. Configuracoes — setup run-once

32 nodes. Prepara ambiente: tabela `n8n_historico_mensagens`, etiquetas Chatwoot (`agente-off`, `testando-agente`, `gestor`), atributos de contato (preferência áudio/texto, Asaas ID cliente, Asaas ID cobrança, status cobrança, permitir chamadas). **Idêntico em estrutura ao `00. Configurações` da Prime / HL — não requer mudança no onboarding core.**

---

## 05. Escalar humano — sub-workflow

15 nodes. Recebe chamada do agent, aplica etiqueta `agente-off`, alerta contato admin (configurado por atributos de contato). Pattern idêntico ao core Zenya (função `escalarHumano` já implementada).

---

## 07. Quebrar e enviar mensagens — sub-workflow

23 nodes. Pega texto longo, divide por parágrafos/ritmo e envia em chunks via Chatwoot com `typing` indicator. Pattern idêntico ao core Zenya (chunker já implementado).

---

## Delta vs HL Importados

| Dimensão | HL Importados | Doceria Dona Geralda |
|----------|---------------|---------------------|
| Integração custom | **UltraCash** (ERP próprio, API REST, módulo `ultracash.ts`) | **Nenhuma** — Yooga é link no prompt |
| Tool nova exigida | `Buscar_produto` | — |
| Arquivos pro cliente | Não aplicável | **Google Drive** (fotos de produtos) — tool já existe |
| Agendamento | Não | **Sim** (Google Calendar) — tool já existe |
| Cobrança | Não | **Não** (Asaas estava no n8n mas sai do escopo core) |
| Complexidade n8n | 62 nodes principal | 86 nodes principal |
| Esforço core | Módulo novo + 11 testes + 2 seeds | Apenas seed tenant + prompt + config |

---

## Equivalência com Julia / Fun Personalize

A Doceria é praticamente **um tenant-gêmeo da Julia** em termos de capacidades usadas:

- ✅ Atendimento WhatsApp via Chatwoot
- ✅ Agente GPT-4.1 com memória Postgres
- ✅ Áudio ElevenLabs
- ✅ Transcrição Whisper
- ✅ Agendamento Google Calendar
- ✅ Envio de arquivo Google Drive
- ✅ Escalação humana + chunking
- ❌ Cobrança Asaas (estava no n8n, **sai do escopo core** por decisão 2026-04-22)

**Diferença efetiva:** prompt da Gê (persona doceria) vs prompt da Julia (persona personalizados). Zero código novo.

---

## Próximos passos AIOX (propostos)

1. **@sm `*draft`** story `doceria-onboarding-01` (pattern `hl-onboarding-01`) — AC focados em:
   - Seed tenant (chatwoot account_id=3, webhook path, active tools)
   - **Reescrita do prompt** da Gê incorporando as 4 constraints + remover Asaas + trocar link Yooga → novo md5 baseline
   - Ativação de Drive/Calendar/ElevenLabs existentes por tenant (Asaas off)
   - Smoke derivado deste inventário + casos de teste obrigatórios:
     * cenário "pedido de vitrine" → bot faz resumo + escala (NÃO fecha)
     * cenário "pedido de bolo" → bot pode fechar (fluxo normal)
     * cenário "cliente pede textão" → bot responde curto
2. **@po `*validate-story-draft`** — 10-point checklist
3. **@dev `*develop-story`** — estimativa **M (medium)** — subiu de S por causa da reescrita de prompt + casos de teste específicos
4. **Webhook path no core:** `/webhook/chatwoot` (padrão multi-tenant) substitui `/webhook/doceria-dona-geralda` do n8n

**Pendências operacionais (Mauro desbloqueia):**
- [x] ~~URL do cardápio WhatsApp da Doceria~~ → `https://wa.me/p/31793244436940904/5511976908238` (resolvido 2026-04-22)
- [ ] Papel e telefone da **Alex** (segundo admin)
- [ ] Alinhamento Ariane + Alex sobre outras regras possíveis

---

## Changelog

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-04-22 | @pm Morgan | Inventário inicial a partir dos 4 JSONs extraídos. Prompt md5=a28a57cc... baseline. Estado n8n: 01 inativo por decisão Ariane/Mauro. |
| 2026-04-22 | @pm Morgan + Mauro | Asaas removido do escopo core — Doceria não terá cobrança automatizada. Prompt precisa limpeza antes do seed. |
| 2026-04-22 | @pm Morgan | Transcrição Whisper de 3 áudios Ariane (2026-04-17). 4 constraints de negócio consolidadas. Estimativa de onboarding subiu de S para M. Novo stakeholder identificado: **Alex**. |
| 2026-04-22 | @pm Morgan + Mauro | Estratégia definida: **acrescentar** sobre baseline n8n (não reescrever). v2 gerado em `tenants/doceria-dona-geralda/prompt.md` (md5 `d475efe5...`, +1312 chars). Placeholder `{{LINK_CARDAPIO_BOLOS_WHATSAPP}}` pendente Mauro preencher. |
| 2026-04-22 | Mauro | Link cardápio bolos resolvido: `wa.me/p/31793244436940904/5511976908238` (catalog WhatsApp Business). Prompt v2 fechado, novo md5 `50efd700...`. |
