# Zenya — Tenant Playbook

Guia de referência para configurar, operar e evoluir um tenant Zenya.
Baseado na experiência com a Fun Personalize (primeiro cliente no core).
**Princípio:** toda melhoria que funciona para um tenant deve servir para todos.

---

## 1. O que é um Tenant

Cada cliente da Zenya é um **tenant** — uma instância isolada com:
- Sua própria personalidade e SOP (via `system_prompt`)
- Suas próprias ferramentas ativas (`active_tools`)
- Seu próprio histórico de conversas
- Suas próprias credenciais de integrações (criptografadas)
- Vinculação a uma conta e inbox do Chatwoot
- Canal admin exclusivo para o proprietário

Todos os tenants compartilham o mesmo código e servidor. O isolamento é garantido por `tenant_id` injetado via closure em todas as ferramentas — o LLM nunca vê ou manipula esse ID.

---

## 2. Estrutura de Banco de Dados

### `zenya_tenants`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador interno do tenant |
| `name` | text | Nome do cliente (ex: "Julia - Fun Personalize") |
| `system_prompt` | text | SOP completo — personalidade + fluxos + regras |
| `active_tools` | text[] | Lista de integrações ativas (ex: `['loja_integrada']`) |
| `chatwoot_account_id` | text | ID da conta no Chatwoot |
| `allowed_phones` | text[] | Modo teste: lista de números permitidos. Vazio = todos |
| `admin_phones` | text[] | Números que ativam modo admin (canal proprietário) |
| `admin_contacts` | jsonb | Admins com nome: `[{"phone": "+55...", "name": "Julia"}]` |

### `zenya_tenant_credentials`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenant_id` | UUID | Referência ao tenant |
| `service` | text | Nome da integração (ex: `'loja_integrada'`, `'asaas'`) |
| `credentials_encrypted` | bytea | JSON de credenciais criptografado com AES-256-GCM |

Formato da chave composta: `(tenant_id, service)` — único por par.

### `zenya_conversation_history`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenant_id` | UUID | Tenant da conversa |
| `phone_number` | text | Telefone do usuário (formato `+5531...`) — admins usam `admin:{phone}` |
| `role` | text | `'user'` ou `'assistant'` |
| `content` | text | Conteúdo da mensagem |
| `created_at` | timestamptz | Timestamp (assistant sempre +1ms depois do user) |

Janela: últimas 50 mensagens por sessão de cliente / 20 para admin.

---

## 3. Fluxo Completo de uma Mensagem

```
WhatsApp → Chatwoot inbox → webhook POST /webhook/chatwoot
  → validar payload (account_id, conversation_id, phone)
  → filtrar: outgoing / activity / template → ignorar
  → filtrar: label 'agente-off' → ignorar (humano assumiu)
  → enfileirar mensagem (zenya_message_queue)
  → session lock por (account_id, phone)
  → debounce 2.5s (agrupa mensagens em burst)
  → buscar pendentes da fila
  → transcrever áudio se necessário (Whisper)
  → loadTenantByAccountId → config do tenant
  → phone em admin_phones? → runAdminAgent (métricas, canal proprietário)
  → verificar modo teste (allowed_phones)
  → verificar /reset (só modo teste)
  → buildSystemPrompt → injeta hora atual de Brasília + SOP
  → loadHistory → últimas 50 msgs
  → generateText (GPT-4.1, maxSteps 15) + ferramentas do tenant
  → saveHistory → salva user + assistant no banco
  → enviar resposta (texto ou áudio conforme preferência) → Chatwoot → WhatsApp
```

---

## 4. System Prompt — Estrutura Padrão

> **Padrão oficial (ADR-001):** o `system_prompt` de cada tenant vive em `docs/zenya/tenants/{slug}/prompt.md` com front-matter YAML, versionado no git, carregado em runtime pelo seed via `gray-matter`. **Não** hardcode `SYSTEM_PROMPT` como template literal em `.mjs`, **não** edite `zenya_tenants.system_prompt` direto no banco (exceto rollback emergencial).
>
> Referência: [`docs/architecture/adr/ADR-001-zenya-prompt-storage.md`](../architecture/adr/ADR-001-zenya-prompt-storage.md).
>
> Utilitário compartilhado: [`packages/zenya/scripts/lib/seed-common.mjs`](../../packages/zenya/scripts/lib/seed-common.mjs) expõe `applyTenantSeed`, `isDryRun` e `loadPromptFromMarkdown`. Todos os seeds de tenant usam esse módulo.

O `system_prompt` do tenant é o SOP completo. Estrutura recomendada:

```markdown
# PAPEL
<papel>Quem é a atendente, nome, empresa, canal</papel>

# PERSONALIDADE E TOM DE VOZ
<personalidade>Tom, vocabulário, público-alvo</personalidade>

# INFORMAÇÕES DA EMPRESA
<informacoes-empresa>Contato, produtos/serviços, links, políticas</informacoes-empresa>

## 1. FLUXO INICIAL
<fluxo-inicial>
  Como se apresentar, o que está dentro/fora do escopo
</fluxo-inicial>

## 2-N. FLUXOS ESPECÍFICOS
<fluxo-X>Passo a passo por situação</fluxo-X>

## N. REGRAS CRÍTICAS
<regras-criticas>
  Regras absolutas de comportamento
</regras-criticas>

## N+1. HORÁRIO DE ATENDIMENTO HUMANO
<horario-atendimento>
  Dias e horários + instrução de como avisar o cliente ao escalar
</horario-atendimento>
```

**Nota:** A data/hora atual de Brasília é injetada automaticamente pelo código no início do prompt — não precisa constar no SOP.

---

## 5. Ferramentas Disponíveis

Ativas via `active_tools` no banco. Todas são tenant-scoped.

### Ferramentas base (sempre disponíveis)
| Ferramenta | Descrição |
|-----------|-----------|
| `escalarHumano` | Adiciona label `agente-off` → desativa bot para a conversa |
| `enviarTextoSeparado` | Envia mensagem adicional separada |
| `refletir` | Chain-of-thought interno (não visível ao usuário) |
| `marcarFollowUp` | Adiciona label `follow-up` sem desativar o bot |
| `alterarPreferenciaAudioTexto` | Define se usuário prefere áudio ou texto |

### Ferramentas opcionais (ativar por tenant)
| Chave em `active_tools` | Integração | Ferramentas expostas |
|------------------------|-----------|---------------------|
| `loja_integrada` | Loja Integrada (e-commerce) | `Buscar_produto`, `Detalhar_pedido_por_numero`, `Buscar_pedidos_por_cliente` |
| `asaas` | Asaas (cobranças) | Consulta e geração de cobranças |
| `google_calendar` | Google Calendar | Agendamento e consulta de eventos |

---

## 6. Escalação Humana — Fluxo Completo

1. Bot chama `escalarHumano` → label `agente-off` adicionada no Chatwoot
2. Bot envia mensagem ao cliente (dentro ou fora do horário)
3. Webhook passa a ignorar todas as mensagens dessa conversa
4. Agente humano atende diretamente pelo WhatsApp (não precisa do Chatwoot)
5. Agente remove label `agente-off` no Chatwoot → bot volta a atender
6. **Auto-remoção:** se label ficar por 72h sem mensagem de agente → removida automaticamente

**Regra no SOP:** "Chamar `escalarHumano` ativa o atendimento humano — NÃO envie nenhum texto ANTES de chamar a ferramenta. Depois da chamada, envie UMA mensagem ao cliente informando horário se necessário."

---

## 7. Canal Admin — Proprietário via WhatsApp

O proprietário do negócio pode consultar métricas e gerenciar a Zenya pelo próprio WhatsApp pessoal, mensagendo o número da empresa.

### Como funciona
- Mensagens de números em `admin_phones` → `runAdminAgent` (não `runZenyaAgent`)
- Admin agent tem memória própria (últimas 20 msgs, key `admin:{phone}`)
- Responde por áudio ou texto conforme preferência/input
- Chama o admin pelo nome cadastrado em `admin_contacts`

### Ferramentas admin disponíveis
| Ferramenta | O que faz |
|-----------|-----------|
| `consultar_metricas` | Total de conversas abertas, resolvidas, escaladas para humano |
| `listar_conversas_abertas` | Lista conversas abertas com nome do cliente e tempo |
| `listar_escaladas` | Lista conversas com `agente-off` ativas |

### Configurar admin para um tenant
```sql
-- Adicionar admins
UPDATE zenya_tenants SET
  admin_phones = ARRAY['+5531999998888', '+5531999997777'],
  admin_contacts = '[
    {"phone": "+5531999998888", "name": "Maria"},
    {"phone": "+5531999997777", "name": "João"}
  ]'::jsonb
WHERE chatwoot_account_id = 'X';
```

---

## 8. Modo Teste

Ativo quando `allowed_phones` tem números cadastrados.
- Só os números listados recebem resposta
- Outros números são silenciosamente ignorados
- Comando `/reset` disponível apenas em modo teste → limpa histórico da sessão
- Para liberar produção: `UPDATE zenya_tenants SET allowed_phones = '{}' WHERE chatwoot_account_id = 'X'`

---

## 9. Criando um Novo Tenant

### 9.1 Pré-requisitos no Chatwoot
- Criar conta (ou usar conta existente)
- Criar inbox WhatsApp (Z-API recomendado)
- Configurar webhook: Settings → Integrations → Webhooks → `https://api.sparkleai.tech/webhook/chatwoot` → evento `message_created`
- Anotar: `account_id`

### 9.2 Criar o prompt canônico do tenant
Arquivo **obrigatório:** `docs/zenya/tenants/{slug}/prompt.md` com front-matter YAML.

```markdown
---
tenant: {slug}
version: 1
updated_at: YYYY-MM-DD
author: Mauro
sources:
  - briefing + 3 áudios do cliente em docs/mauro-sessao-{cliente}-YYYYMMDD.md
notes: |
  Observações livres — quem é o tenant, canais, restrições.
---

# PAPEL
...
```

Referência de estrutura do SOP: ver [§4](#4-system-prompt--estrutura-padrão).

### 9.3 Criar o script de seed do tenant
Copiar `packages/zenya/scripts/seed-scar-tenant.mjs` como template e trocar:
- Prefixo das env vars (ex: `NOVOCLIENTE_CHATWOOT_ACCOUNT_ID`)
- `name` no objeto `row`
- `PROMPT_PATH` default (apontar para o novo `.md`)

Todo seed DEVE usar `applyTenantSeed` de `./lib/seed-common.mjs` — sem duplicar lógica de upsert.

### 9.4 Validar com `--dry-run`
```bash
cd packages/zenya && \
NOVOCLIENTE_CHATWOOT_ACCOUNT_ID=X NOVOCLIENTE_ADMIN_PHONES="+55..." \
NOVOCLIENTE_ADMIN_CONTACTS='[{"phone":"+55...","name":"..."}]' \
node scripts/seed-novocliente-tenant.mjs --dry-run
```

Output esperado: JSON da row + md5 do `system_prompt`. **Se o tenant já existe no banco**, o md5 do `.md` TEM que bater com `SELECT md5(system_prompt) FROM zenya_tenants WHERE name='...'` antes de rodar sem `--dry-run`.

### 9.5 Executar o seed real
Remova `--dry-run` e rode — o `applyTenantSeed` faz UPSERT idempotente por `chatwoot_account_id`. Reexecutar é seguro.

### 9.6 Adicionar credenciais de integração (se necessário)
Usar script `packages/zenya/scripts/seed-zapi-credentials.mjs` como referência.
Credenciais são criptografadas com AES-256-GCM (`ZENYA_MASTER_KEY`).

### 9.7 Testar
- Mandar mensagem pelo número de teste
- Verificar logs: `pm2 logs zenya-webhook --lines 50`
- Validar resposta e ferramentas
- Testar canal admin pelo número pessoal do proprietário
- Liberar produção: `UPDATE zenya_tenants SET allowed_phones = '{}' WHERE chatwoot_account_id = 'X'`

### 9.8 Template de cutover com gates em produção
Para tenants comerciais em uso ativo (ex: Fun Personalize), use [`docs/stories/zenya-prompts-03-fun-personalize/README.md`](../stories/zenya-prompts-03-fun-personalize/README.md) como template — inclui backup textual, janela de manutenção, rollback e smoke test obrigatório.

---

## 10. Operação e Manutenção

### Rodar migrations no banco (VPS Supabase)
```bash
# Via Management API — funciona de qualquer lugar com o PAT
curl -s -X POST "https://api.supabase.com/v1/projects/uqpwmygaktkgbknhmknx/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "SEU SQL AQUI"}'
```
**CRÍTICO:** rodar migration ANTES do deploy — código que seleciona coluna inexistente derruba tudo.

### Deploy de atualização de código
```bash
# Na VPS
cd /root/SparkleOS && git pull
cd packages/zenya && npm run build
pm2 reload zenya-webhook
```

### Atualizar SOP de um tenant
Fluxo padrão (ADR-001):
1. Editar `docs/zenya/tenants/{slug}/prompt.md` (bump `version` no front-matter se mudança material)
2. Commit + push
3. Rodar `node packages/zenya/scripts/seed-{slug}-tenant.mjs --dry-run` — confirmar que o md5 mudou (senão, ninguém editou o texto de verdade)
4. Rodar sem `--dry-run` para fazer o upsert idempotente
5. Cache de 5 minutos expira automaticamente — próxima mensagem já pega o novo prompt

**Emergência:** edição direta no Supabase (`UPDATE zenya_tenants SET system_prompt = ...`) é permitida apenas como rollback/hotfix, seguida de sincronização do `.md` via PR em ≤24h. Fora disso, o `.md` é a única fonte de verdade.

### Adicionar ferramenta a um tenant
```sql
UPDATE zenya_tenants
SET active_tools = array_append(active_tools, 'nova_ferramenta')
WHERE chatwoot_account_id = 'X';
```

### Ver logs em tempo real
```bash
pm2 logs zenya-webhook --lines 100
```

---

## 11. Decisões de Arquitetura Registradas

| Decisão | Motivo |
|---------|--------|
| `tenant_id` nunca exposto ao LLM | Segurança — o modelo não pode mudar de tenant |
| Cache de 5min para config de tenant | Balanceia frescor com round-trips ao banco |
| Debounce de 2.5s + session lock | Agrupa bursts e evita respostas duplicadas |
| Histórico limitado a 50 msgs (cliente) / 20 (admin) | Custo de tokens vs. contexto útil |
| Credenciais criptografadas com AES-256-GCM | Segurança em repouso — master key só na VPS |
| `agente-off` como label Chatwoot | Visível e reversível por qualquer agente humano |
| Auto-remoção do `agente-off` após 72h | Evita conversas bloqueadas por esquecimento |
| Hora de Brasília injetada no prompt | LLM precisa saber o horário para decidir sobre escalação |
| Admin via número pessoal → mesmo WhatsApp do tenant | Proprietário não precisa de app separado |
| Admin session key `admin:{phone}` | Separa histórico admin do histórico de cliente |
| `admin_contacts` JSONB com `{phone, name}` | Permite saudação personalizada sem nova tabela |
| Migration ANTES do deploy | Coluna inexistente no SELECT derruba todos os tenants |
| Validação de URL de produto (HEAD request) | API da Loja Integrada retorna slugs internos que não existem na loja pública — URLs são validadas antes de chegar ao LLM, 404s são descartados silenciosamente |

---

## 12. Clientes Ativos

| Tenant | `chatwoot_account_id` | Status | Ferramentas | Admins | Prompt canônico |
|--------|----------------------|--------|-------------|--------|-----------------|
| Zenya Prime (SparkleOS) | `1` | Produção | base | Mauro | [`zenya-prime/prompt.md`](tenants/zenya-prime/prompt.md) |
| Julia - Fun Personalize | `5` | Produção | base + loja_integrada | Julia, Mauro | [`fun-personalize/prompt.md`](tenants/fun-personalize/prompt.md) |
| HL Importados | pendente cutover | Backlog | base + ultracash + google_calendar | Mauro, Hiago | [`hl-importados/prompt.md`](tenants/hl-importados/prompt.md) |
| PLAKA (Roberta) | aguardando número novo | Pré-onboarding | base + nuvemshop + google_sheets (planejado) | Admin a definir | [`plaka/prompt.md`](tenants/plaka/prompt.md) |
| Scar AI — GuDesignerPro | `7` | Aguardando Z-API | base | Mauro, Gustavo | [`scar-ai/prompt.md`](tenants/scar-ai/prompt.md) |

---

*Atualizar sempre que uma melhoria for validada em produção.*
