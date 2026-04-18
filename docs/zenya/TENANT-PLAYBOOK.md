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
| `phone_number` | text | Telefone do usuário (formato `+5531...`) |
| `role` | text | `'user'` ou `'assistant'` |
| `content` | text | Conteúdo da mensagem |
| `created_at` | timestamptz | Timestamp (assistant sempre +1ms depois do user) |

Janela: últimas 50 mensagens por sessão (tenant + phone).

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
  → verificar modo teste (allowed_phones)
  → verificar /reset (só modo teste)
  → loadTenantByAccountId → config do tenant
  → buildSystemPrompt → injeta hora atual de Brasília + SOP
  → loadHistory → últimas 50 msgs
  → generateText (GPT-4.1, maxSteps 15) + ferramentas do tenant
  → saveHistory → salva user + assistant no banco
  → enviar resposta → Chatwoot → WhatsApp
```

---

## 4. System Prompt — Estrutura Padrão

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
4. Agente humano atende pelo Chatwoot normalmente
5. Agente remove label `agente-off` → bot volta a atender
6. **Auto-remoção:** se label ficar por 72h sem mensagem de agente → removida automaticamente

**Regra no SOP:** "Chamar `escalarHumano` ativa o atendimento humano — NÃO envie nenhum texto ANTES de chamar a ferramenta. Depois da chamada, envie UMA mensagem ao cliente informando horário se necessário."

---

## 7. Modo Teste

Ativo quando `allowed_phones` tem números cadastrados.
- Só os números listados recebem resposta
- Outros números são silenciosamente ignorados
- Comando `/reset` disponível apenas em modo teste → limpa histórico da sessão
- Para liberar produção: `UPDATE zenya_tenants SET allowed_phones = '{}' WHERE chatwoot_account_id = 'X'`

---

## 8. Adicionando um Novo Cliente

### 8.1 Pré-requisitos no Chatwoot
- Criar conta ou usar conta existente
- Criar inbox WhatsApp (nativo via Baileys, Z-API, ou outro provider)
- Anotar: `account_id` e `inbox_id`

### 8.2 Inserir tenant no banco (VPS Supabase)
```sql
INSERT INTO zenya_tenants (name, system_prompt, active_tools, chatwoot_account_id, allowed_phones)
VALUES (
  'Nome do Cliente',
  '-- SOP aqui --',
  ARRAY['loja_integrada'],  -- ferramentas ativas
  '10',                      -- chatwoot account_id
  ARRAY['+5531999998888']   -- modo teste: só este número
);
```

### 8.3 Adicionar credenciais de integração (se necessário)
Usar script `packages/zenya/scripts/seed-zapi-credentials.mjs` como referência.
Credenciais são criptografadas com AES-256-GCM (ZENYA_MASTER_KEY).

### 8.4 Configurar webhook no Chatwoot
- Settings → Integrations → Webhooks
- URL: `https://<vps-ip>:3004/webhook/chatwoot`
- Eventos: `message_created`

### 8.5 Testar
- Mandar mensagem pelo número de teste
- Verificar logs: `pm2 logs zenya-webhook`
- Validar resposta e ferramentas
- Liberar: `UPDATE zenya_tenants SET allowed_phones = '{}' WHERE ...`

---

## 9. Operação e Manutenção

### Atualizar SOP de um tenant
Editar `system_prompt` diretamente no Supabase (painel ou REST API).
Cache de 5 minutos — próxima mensagem já pega o novo prompt.

### Adicionar ferramenta a um tenant
```sql
UPDATE zenya_tenants
SET active_tools = array_append(active_tools, 'nova_ferramenta')
WHERE chatwoot_account_id = 'X';
```

### Deploy de atualização de código (sem downtime)
```bash
cd /root/SparkleOS/packages/zenya
npm run build
pm2 reload zenya-webhook
```

### Ver logs em tempo real
```bash
pm2 logs zenya-webhook --lines 100
```

---

## 10. Decisões de Arquitetura Registradas

| Decisão | Motivo |
|---------|--------|
| `tenant_id` nunca exposto ao LLM | Segurança — o modelo não pode mudar de tenant |
| Cache de 5min para config de tenant | Balanceia frescor com round-trips ao banco |
| Debounce de 2.5s + session lock | Agrupa bursts e evita respostas duplicadas |
| Histórico limitado a 50 mensagens | Custo de tokens vs. contexto útil |
| Credenciais criptografadas com AES-256-GCM | Segurança em repouso — master key só na VPS |
| `agente-off` como label Chatwoot | Visível e reversível por qualquer agente humano |
| Auto-remoção do `agente-off` após 72h | Evita conversas bloqueadas por esquecimento |
| Hora de Brasília injetada no prompt | LLM precisa saber o horário para decidir sobre escalação |

---

*Atualizar sempre que uma melhoria for validada em produção.*
