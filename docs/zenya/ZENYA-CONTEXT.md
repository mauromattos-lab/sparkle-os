# Zenya — Contexto Operacional

**Por:** @analyst (Atlas) — Story 2.1
**Data:** 2026-04-11
**Fonte:** Análise dos 15 fluxos n8n tag `Zenya Prime`

---

## O que é a Zenya

A Zenya é uma **atendente IA no WhatsApp**. Ela recebe mensagens de clientes, processa com um AI Agent e responde de forma humanizada. Roda inteiramente em n8n na VPS de Mauro.

---

## Como funciona

### Fluxo de uma mensagem

```
Cliente envia mensagem no WhatsApp
  ↓
Chatwoot recebe e dispara webhook para o n8n
  ↓
01. Secretária v3 — gerencia fila, identifica tipo (texto/áudio/arquivo)
  ↓
AI Agent (GPT-4.1) processa com memória de conversa
  ↓
07. Quebrar e enviar mensagens — divide a resposta, simula digitação
  ↓
Cliente recebe as mensagens no WhatsApp
```

### Stack

| Componente | Tecnologia |
|-----------|-----------|
| Automação | n8n — `https://n8n.sparkleai.tech` |
| CRM / inbox | Chatwoot fazer.ai |
| WhatsApp | Z-API (via Chatwoot) |
| AI principal | OpenAI GPT-4.1 |
| AI suporte | OpenAI GPT-4.1-mini |
| Transcrição de áudio | OpenAI Whisper |
| Memória de conversa | Postgres — tabela `n8n_historico_mensagens` |
| Agenda | Google Calendar |
| Arquivos | Google Drive |
| Financeiro | Asaas |
| Infraestrutura | VPS Hostinger KVM2 + Coolify |

---

## Capacidades atuais

O que a Zenya sabe fazer hoje, baseado nos fluxos ativos:

| Capacidade | Fluxo |
|-----------|-------|
| Receber e responder mensagens de texto | `01.` |
| Transcrever e responder áudios | `01.` |
| Receber e repassar arquivos do Drive | `02.` |
| Verificar disponibilidade na agenda | `03.` |
| Criar agendamentos no Calendar | `04.` |
| Atualizar agendamentos | `04.1` |
| Escalar para humano (com alerta WhatsApp) | `05.` |
| Criar e gerenciar cobranças no Asaas | `06.` |
| Enviar lembretes de agendamento | `11.` |
| Gerenciar ligações e follow-up pós-chamada | `12.` |
| Assistente interno de Mauro | `08.` |
| Reengajar leads inativos | `13.` *(inativo)* |

---

## Configurações do sistema

Criadas pelo `00. Configurações` (executado uma vez):

**Etiquetas Chatwoot:**
- `agente-off` — conversa com IA pausada, humano atendendo
- `testando-agente` — modo de teste
- `gestor` — contato identificado como gestor

**Atributos de contato:**
- `preferência áudio/texto`
- `Asaas ID cliente`
- `Asaas ID cobrança`
- `Asaas status cobrança`
- `permitir chamadas`

**Memória:** tabela `n8n_historico_mensagens` no Postgres — janela de 50 mensagens por conversa

---

## O que ainda não existe

- Clientes provisionados
- Modelo multi-tenant configurado
- Integração com SparkleOS Core
- Canal de voz (Retell — arquivo presente, não implementado)

Qualquer coisa além dos fluxos listados acima: **a construir**.

---

*Documento base para o Epic 2 — 2026-04-11*
