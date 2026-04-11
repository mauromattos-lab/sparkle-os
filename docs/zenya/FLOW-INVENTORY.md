# Inventário de Fluxos n8n — Zenya

**Data:** 2026-04-11
**Por:** @analyst (Atlas) — Story 2.1
**Fonte:** n8n `https://n8n.sparkleai.tech` — tag `Zenya Prime`
**Total:** 15 fluxos

---

## Resumo Executivo

O sistema Zenya é composto por **15 fluxos n8n**, todos com a tag `Zenya Prime`. O atendimento entra pelo `01. Secretária v3` via webhook do Chatwoot, é processado por um AI Agent (GPT-4.1 com memória em Postgres) e sai pelo `07. Quebrar e enviar mensagens`. Os demais fluxos são utilitários acionados pelo agente conforme necessidade ou por triggers próprios (schedule, webhook interno).

**Stack:** n8n · Chatwoot · Z-API · OpenAI (GPT-4.1 / GPT-4.1-mini / Whisper) · Google Calendar · Google Drive · Asaas · Postgres

| # | Nome | ID n8n | Status |
|---|------|--------|--------|
| 00 | Configurações | `G0ormrjMIPrTEnVH` | inativo (run-once) |
| 01 | Secretária v3 | `r3C1FMc6NIi6eCGI` | **ativo** |
| 02 | Baixar e enviar arquivo do Google Drive | `zq8qPZtQL2Q7Tzeq` | **ativo** |
| 03 | Buscar janelas disponíveis Google Calendar | `m38f7b7y48GP5auB` | **ativo** |
| 04 | Criar evento Google Calendar | `FVo76xNYRmjevsqu` | **ativo** |
| 04.1 | [EXTRA] Atualizar agendamento | `51kVwiW28a6orNRy` | **ativo** |
| 05 | Escalar humano | `ttMFxQ2UsIpW1HKt` | **ativo** |
| 06 | Integração Asaas | `inc8gUNWJXDv3O3i` | **ativo** |
| 07 | Quebrar e enviar mensagens | `4GWd6qHwbJr3qLUP` | **ativo** |
| 08 | Agente Assistente Interno | `SJi5jJ6dQgxcq1fX` | **ativo** |
| 09 | Desmarcar e enviar alerta | `YlXyQ785worYXwOk` | **ativo** |
| 10 | Buscar ou criar contato + conversa | `rFkbWlj1xUJ1rzAb` | **ativo** |
| 11 | Agente de Lembretes de Agendamento | `HLRubTvQRsV2GNJc` | **ativo** |
| 12 | Gestão de ligações | `Be8SBYrcZcydYD1f` | **ativo** |
| 13 | Agente de Recuperação de Leads | `lOBBe477Rvb0zCCs` | inativo |

---

## Inventário Completo

---

### 00. Configurações
- **ID:** `G0ormrjMIPrTEnVH`
- **Trigger:** manual (executado uma vez, na configuração inicial da instância)
- **Status:** inativo — run-once
- **Classificação:** setup
- **Propósito:** Prepara o ambiente para a Zenya funcionar. Cria a tabela de memória no Postgres, as etiquetas no Chatwoot e os atributos de contato necessários.
- **Inputs:** Nenhum — tudo configurado no nó `Info`
- **Outputs:** Tabela `n8n_historico_mensagens` criada no Postgres; etiquetas `agente-off`, `testando-agente`, `gestor` criadas no Chatwoot; atributos de contato criados (`preferência áudio/texto`, `Asaas ID cliente`, `Asaas ID cobrança`, `Asaas status cobrança`, `permitir chamadas`); template de ligações criado
- **Dependências:** Chatwoot, Asaas, Postgres
- **Observações:** Deve ser executado antes de ativar o `01.`. Credenciais e URLs ficam no nó `Info`.

---

### 01. Secretária v3 ⭐
- **ID:** `r3C1FMc6NIi6eCGI`
- **Trigger:** webhook — `POST /webhook/zenya-prime` (Chatwoot dispara ao receber mensagem)
- **Status:** ativo
- **Classificação:** atendimento
- **Propósito:** Fluxo principal. Recebe mensagens do WhatsApp via Chatwoot, gerencia uma fila anti-cavalgamento (evita respostas duplicadas quando o cliente envia várias mensagens seguidas), transcreve áudios, processa com AI Agent (GPT-4.1 com memória Postgres) e delega o envio ao `07.`
- **Inputs:** Payload Chatwoot — texto, áudio ou arquivo
- **Outputs:** Resposta do AI Agent enviada ao contato via `07.`
- **Nodes principais (62):**
  - `Mensagem recebida` — webhook `/zenya-prime`
  - `Enfileirar mensagem` / `Buscar mensagens` / `Limpar fila` — Postgres (fila anti-overlap)
  - `Mensagem encavalada?` — JS
  - `Tipo de mensagem` — switch texto / áudio / arquivo
  - `Download Áudio` → `Transcrever audio` — OpenAI Whisper
  - `Secretária v3` — AI Agent GPT-4.1 com tools: Calendar, Drive, Asaas, escalação
  - `Memory` — `n8n_historico_mensagens`, janela 50 mensagens
- **Dependências:** Chatwoot, OpenAI (GPT-4.1 + Whisper), Google Calendar, Google Drive, Postgres
- **Chama:** `07. Quebrar e enviar mensagens` (`4GWd6qHwbJr3qLUP`)
- **Observações:** Prompt e personalidade da Zenya ficam no nó AI Agent — ver `## IP Protegido`.

---

### 02. Baixar e enviar arquivo do Google Drive
- **ID:** `zq8qPZtQL2Q7Tzeq`
- **Trigger:** sub-workflow (tool do AI Agent de `01.`)
- **Status:** ativo
- **Classificação:** utilitário
- **Propósito:** Baixa um arquivo do Google Drive e envia como anexo na conversa do Chatwoot.
- **Inputs:** ID do arquivo no Drive, ID da conversa Chatwoot
- **Outputs:** Arquivo enviado ao contato
- **Nodes principais (4):** `Baixar arquivo`, `Enviar arquivo`, `Output`
- **Dependências:** Google Drive, Chatwoot

---

### 03. Buscar janelas disponíveis Google Calendar
- **ID:** `m38f7b7y48GP5auB`
- **Trigger:** sub-workflow
- **Status:** ativo
- **Classificação:** agendamento (utilitário)
- **Propósito:** Consulta o Google Calendar e retorna slots de horário disponíveis. Gera janelas de tempo, filtra conflitos com eventos existentes, aleatoriza a ordem e devolve uma amostra.
- **Inputs:** Configurações de disponibilidade (horários permitidos, duração do slot)
- **Outputs:** Lista de janelas disponíveis com data e hora
- **Nodes principais (16):** `Gerar janelas de tempo`, `Filtrar disponibilidade`, `Aleatoriza a ordem`, `Selecionar amostras`, `Verificar eventos na agenda`, `Consulta eventos no período`, `Retorna vazio`
- **Dependências:** Google Calendar
- **Código JS:** `Gerar janelas de tempo`, `Filtrar disponibilidade`, `Selecionar amostras`, `Verificar eventos na agenda`

---

### 04. Criar evento Google Calendar
- **ID:** `FVo76xNYRmjevsqu`
- **Trigger:** sub-workflow (tool do AI Agent de `01.`, chamado também por `12.`)
- **Status:** ativo
- **Classificação:** agendamento (utilitário)
- **Propósito:** Verifica disponibilidade e cria um evento no Google Calendar. Retorna o evento criado ou erro de horário indisponível.
- **Inputs:** Título, horário desejado e duração do evento
- **Outputs:** Evento criado (com ID) ou `"horário indisponível"`
- **Nodes principais (7):** `Buscar janelas disponíveis`, `Janela disponível?`, `Calcula fim do evento`, `Cria o evento`, `Retorna evento criado`, `Retorna "horário indisponível"`
- **Dependências:** Google Calendar
- **Chama:** `03. Buscar janelas disponíveis` (`m38f7b7y48GP5auB`)

---

### 04.1 [EXTRA] Atualizar agendamento
- **ID:** `51kVwiW28a6orNRy`
- **Trigger:** sub-workflow
- **Status:** ativo
- **Classificação:** agendamento (utilitário)
- **Propósito:** Atualiza título e descrição de um evento existente no Google Calendar. Existe como workaround para um bug do n8n no node nativo de atualização.
- **Inputs:** ID do evento, novo título, nova descrição
- **Outputs:** Evento atualizado
- **Nodes principais (2):** `Atualizar agendamento`
- **Dependências:** Google Calendar
- **Observações:** Pode ser removido quando o bug do n8n for corrigido.

---

### 05. Escalar humano
- **ID:** `ttMFxQ2UsIpW1HKt`
- **Trigger:** sub-workflow (tool do AI Agent de `01.`)
- **Status:** ativo
- **Classificação:** handoff
- **Propósito:** Transfere o atendimento para um humano. Aplica a etiqueta `agente-off` na conversa do Chatwoot (pausando a IA) e envia alerta via Z-API para o WhatsApp de Mauro.
- **Inputs:** ID da conversa Chatwoot
- **Outputs:** Etiqueta `agente-off` aplicada; mensagem de alerta enviada
- **Nodes principais (7):** `Listar etiquetas da conversa`, `Conversa de alerta configurada?`, `Colocar etiqueta agente-off`, `Alertar Mauro WhatsApp`, `Alerta não configurado`
- **Dependências:** Chatwoot, Z-API

---

### 06. Integração Asaas
- **ID:** `inc8gUNWJXDv3O3i`
- **Trigger:** sub-workflow (tool do AI Agent de `01.`, chamado por `08.` e `12.`)
- **Status:** ativo
- **Classificação:** financeiro
- **Propósito:** Integração completa com Asaas (cobranças). Cria ou busca clientes e cobranças; processa webhooks de pagamento; sincroniza o status da cobrança como atributo do contato no Chatwoot.
- **Inputs:** Dados do contato Chatwoot + operação (criar cobrança, processar webhook de pagamento)
- **Outputs:** Cliente e cobrança criados/atualizados no Asaas; atributos `Asaas ID` e `status cobrança` atualizados no Chatwoot
- **Nodes principais (31):** `Cliente já existe?`, `Criar cliente`, `Atualizar ID cliente`, `Cobrança já existe?`, `Criar cobrança`, `Atualizar cobrança`, `Mapeamento status`, `Atualizar status cobrança`, `Evento ignorado`, `Usuário não cadastrado`
- **Dependências:** Asaas, Chatwoot, OpenAI, Google Calendar, Postgres

---

### 07. Quebrar e enviar mensagens
- **ID:** `4GWd6qHwbJr3qLUP`
- **Trigger:** sub-workflow (chamado por `01.`)
- **Status:** ativo
- **Classificação:** notificação
- **Propósito:** Recebe a resposta completa do AI Agent, divide em múltiplas mensagens com delays que simulam digitação humana. Usa um AI Agent secundário (GPT-4.1-mini com Structured Output) para decidir os pontos de quebra naturais do texto.
- **Inputs:** Texto da resposta, ID da conversa Chatwoot
- **Outputs:** Mensagens enviadas ao contato via Chatwoot com delays de digitação
- **Nodes principais (12):** `Agente divisor de mensagens` (AI), `Structured Output Parser`, `Para cada mensagem`, `Velocidade digitação` (JS), `Digitando...`, `Espera`, `Enviar texto`
- **Dependências:** Chatwoot, OpenAI (GPT-4.1-mini)

---

### 08. Agente Assistente Interno
- **ID:** `SJi5jJ6dQgxcq1fX`
- **Trigger:** webhook — `POST /webhook/b931de43-7941-445b-98da-6be541a0f067` (canal pessoal de Mauro)
- **Status:** ativo
- **Classificação:** atendimento (canal interno)
- **Propósito:** Assistente pessoal de Mauro. Recebe mensagens de texto ou áudio pelo WhatsApp de Mauro e executa operações: ler emails, criar tarefas, criar/cancelar agendamentos, consultar cobranças no Asaas.
- **Inputs:** Mensagem de Mauro — texto ou áudio
- **Outputs:** Resposta do agente + ações executadas (evento criado, tarefa criada, etc.)
- **Nodes principais (21):** `Mensagem chegando?`, `Tipo de mensagem`, `Download Áudio`, `Transcrever Áudio`, `Agente Assistente Interno` (AI GPT-4.1), `Memoria` (Postgres), `Ler emails`, `Criar tarefa`, `Desmarcar agendamento e enviar alerta`, `Responder`
- **Dependências:** Chatwoot, OpenAI (GPT-4.1 + Whisper), Google Calendar, Asaas, Postgres

---

### 09. Desmarcar e enviar alerta
- **ID:** `YlXyQ785worYXwOk`
- **Trigger:** sub-workflow (tool de `08.`)
- **Status:** ativo
- **Classificação:** agendamento (utilitário)
- **Propósito:** Cancela um agendamento no Google Calendar e envia aviso ao contato via Chatwoot. Também salva memória na tabela da Secretária.
- **Inputs:** ID do evento no Calendar, dados do contato
- **Outputs:** Evento cancelado; mensagem de cancelamento enviada; memória atualizada
- **Nodes principais (6):** `Desmarcar agendamento`, `Buscar contato`, `Enviar alerta`, `Salvar memória Secretária`, `Resultado`
- **Dependências:** Chatwoot, Google Calendar, Postgres
- **Chama:** `10. Buscar ou criar contato + conversa` (`rFkbWlj1xUJ1rzAb`)

---

### 10. Buscar ou criar contato + conversa
- **ID:** `rFkbWlj1xUJ1rzAb`
- **Trigger:** sub-workflow
- **Status:** ativo
- **Classificação:** utilitário
- **Propósito:** Sub-workflow central de lookup de contatos. A partir de um número de telefone, busca ou cria o contato e uma conversa ativa no Chatwoot. Trata variações do número (com/sem dígito 9) e verifica se está no WhatsApp antes de criar.
- **Inputs:** Número de telefone
- **Outputs:** ID do contato + ID da conversa no Chatwoot
- **Nodes principais (13):** `Buscar contato`, `Buscar contato (sem 9)`, `Contato existe?`, `Verificar WhatsApp`, `Número no WhatsApp?`, `Criar contato`, `Criar conversa`, `Resultado`, `Telefone não está no WhatsApp`
- **Dependências:** Chatwoot
- **Observações:** Fluxo mais reutilizado do sistema — chamado por `09.`, `11.`, `12.` (×4) e `13.`

---

### 11. Agente de Lembretes de Agendamento
- **ID:** `HLRubTvQRsV2GNJc`
- **Trigger:** schedule (recorrente)
- **Status:** ativo
- **Classificação:** notificação
- **Propósito:** Roda periodicamente, busca eventos do Google Calendar que ainda não receberam lembrete e envia mensagem personalizada via AI para os contatos pelo WhatsApp.
- **Inputs:** Eventos do Google Calendar sem lembrete enviado (flag por evento)
- **Outputs:** Mensagem de lembrete enviada; evento marcado como lembrete enviado
- **Nodes principais (16):** `Buscar eventos`, `Eventos com lembrete pendente`, `Algum lembrete pendente?` (JS), `Agente de Lembretes` (AI), `Extrair informações`, `Telefone encontrado?`, `Buscar ou criar contato`, `Enviar mensagem`, `Marcar lembrete enviado`
- **Dependências:** Google Calendar, Chatwoot, OpenAI (GPT-4.1-mini), Postgres
- **Chama:** `10. Buscar ou criar contato + conversa` (`rFkbWlj1xUJ1rzAb`)

---

### 12. Gestão de ligações
- **ID:** `Be8SBYrcZcydYD1f`
- **Trigger:** webhook (Chatwoot — evento de chamada telefônica)
- **Status:** ativo
- **Classificação:** atendimento (ligações)
- **Propósito:** Gerencia o ciclo completo de uma chamada: ao receber evento de encerramento, cria registro no Calendar, envia follow-up personalizado via AI e cria/busca cobrança no Asaas.
- **Inputs:** Evento de chamada do Chatwoot (início/encerramento)
- **Outputs:** Evento criado no Calendar; follow-up enviado ao contato; cobrança criada/atualizada
- **Nodes principais (41):** `Chamada encerrada?`, `Ignorar outros eventos de chamada`, `Buscar ou criar contato`, `Criar evento`, `Follow-up no WhatsApp após chamada` (AI), `Nova cobrança?`, `Criar ou buscar cobrança`, `Montar histórico` (JS), `Enviar mensagem follow-up chamada`
- **Dependências:** Chatwoot, OpenAI, Google Calendar, Postgres
- **Chama:** `04.` (criar evento), `10.` (buscar contato) ×4, `06.` (Asaas), `03.` (janelas)

---

### 13. Agente de Recuperação de Leads
- **ID:** `lOBBe477Rvb0zCCs`
- **Trigger:** schedule (recorrente)
- **Status:** inativo
- **Classificação:** atendimento (reengajamento)
- **Propósito:** Detecta contatos com follow-up pendente no Chatwoot e envia mensagem de reengajamento via AI. Controla o número de tentativas e desliga o follow-up quando o limite é atingido.
- **Inputs:** Contatos com atributo "aguardando follow-up" ativo no Chatwoot
- **Outputs:** Mensagem de follow-up enviada; contagem atualizada; follow-up desligado após limite
- **Nodes principais (25):** `Buscar aguardando follow-up`, `Follow-up ativo?`, `Agente de Recuperação de Leads` (AI), `Enviar mensagem`, `Atualizar contagem follow-up`, `Follow-ups excedidos`, `Desligar follow-up`, `Contato já permitiu ligações?`
- **Dependências:** Chatwoot, OpenAI (GPT-4.1-mini), Postgres
- **Chama:** `10. Buscar ou criar contato + conversa` (`rFkbWlj1xUJ1rzAb`)
- **Observações:** Inativo — ativar quando o pipeline de reengajamento estiver definido.

---

## Mapa de Relacionamentos

### Entradas (triggers externos)

```
WhatsApp (cliente) → Chatwoot → POST /webhook/zenya-prime
  └─► 01. Secretária v3

WhatsApp (Mauro) → Chatwoot → POST /webhook/b931de43-...
  └─► 08. Agente Assistente Interno

Chatwoot (evento chamada)
  └─► 12. Gestão de ligações

Schedule (recorrente)
  └─► 11. Agente de Lembretes de Agendamento
  └─► 13. Agente de Recuperação de Leads  [inativo]
```

### Grafo de chamadas

```
01. Secretária v3
  └─► 07. Quebrar e enviar mensagens
  └─► 02. Baixar arquivo Drive        (AI Agent tool)
  └─► 03. Buscar janelas Calendar     (AI Agent tool)
  └─► 04. Criar evento Calendar       (AI Agent tool)
  └─► 05. Escalar humano              (AI Agent tool)
  └─► 06. Integração Asaas            (AI Agent tool)

04. Criar evento Calendar
  └─► 03. Buscar janelas disponíveis

08. Agente Assistente Interno
  └─► 09. Desmarcar e enviar alerta

09. Desmarcar e enviar alerta
  └─► 10. Buscar ou criar contato

11. Agente de Lembretes
  └─► 10. Buscar ou criar contato

12. Gestão de ligações
  └─► 03. Buscar janelas disponíveis
  └─► 04. Criar evento Calendar
  └─► 06. Integração Asaas
  └─► 10. Buscar ou criar contato  (×4)

13. Agente de Recuperação de Leads  [inativo]
  └─► 10. Buscar ou criar contato
```

### Recursos compartilhados

| Recurso | Usado por |
|---------|-----------|
| Postgres `n8n_historico_mensagens` | `01.`, `06.`, `08.`, `09.`, `11.`, `12.`, `13.` |
| Chatwoot etiqueta `agente-off` | `05.` |
| Google Calendar credential | `03.`, `04.`, `04.1`, `09.`, `11.`, `12.` |
| OpenAI credential | `01.`, `06.`, `07.`, `08.`, `11.`, `12.`, `13.` |
| Sub-workflow `10.` | `09.`, `11.`, `12.` (×4), `13.` |

---

## IP Protegido

Localização do IP — sem transcrever conteúdo.

| Artefato | Onde fica | Tipo |
|---------|-----------|------|
| Prompt / personalidade da Zenya | Nó AI Agent `Secretária v3` dentro de `01.` (campo `systemMessage`) | Lore + personalidade |
| Prompt do Agente Assistente de Mauro | Nó AI Agent `Agente Assistente Interno` dentro de `08.` | Personalidade / instruções pessoais |
| Lógica anti-cavalgamento | Nó JS `Mensagem encavalada?` em `01.` | Lógica de negócio |
| Lógica de divisão humanizada | Nó JS `Velocidade digitação` em `07.` | Lógica de negócio |
| Assets visuais (fotos, procedimentos) | `Material Secretária v3\Arquivos da Secretária v3\` — local, sem versionamento | Assets visuais |
| Documento de cobrança | `Material Secretária v3\Arquivos da Secretária v3\COBRANÇA.pdf` | Modelo comercial |

---

## Gaps e Riscos

### G1 — `13. Agente de Recuperação de Leads` inativo
- **Risco:** baixo / oportunidade
- **Detalhe:** Fluxo completo mas desligado. Leads sem resposta não estão sendo reengajados.
- **Recomendação:** Ativar quando o pipeline comercial estiver definido.

### G2 — Memória Postgres sem limpeza visível
- **Risco:** médio
- **Detalhe:** A tabela `n8n_historico_mensagens` acumula histórico sem rotina de TTL ou limpeza nos fluxos analisados.
- **Recomendação:** Criar rotina de limpeza periódica.

### G3 — `04.1 Atualizar agendamento` é workaround de bug
- **Risco:** baixo (controlado)
- **Detalhe:** Existe para contornar um bug do n8n no node nativo de atualização de eventos do Google Calendar.
- **Recomendação:** Remover quando o bug for corrigido upstream.

### G4 — Assets visuais sem gestão centralizada
- **Risco:** médio (IP exposto localmente)
- **Detalhe:** Fotos de profissionais e PDF de cobrança estão apenas na máquina de Mauro, sem versionamento.
- **Recomendação:** Definir estratégia de armazenamento (Drive ou S3) antes da integração formal.

### G5 — Webhook do `08.` usa UUID sem nome descritivo
- **Risco:** baixo (operacional)
- **Detalhe:** O `08. Agente Assistente Interno` usa path UUID (`/b931de43-...`) em vez de um path legível. Dificulta identificação e documentação.
- **Recomendação:** Considerar renomear o path na Story de manutenção.

---

*Inventário gerado por @analyst (Atlas) — Story 2.1 — 2026-04-11*
*Fonte: n8n `https://n8n.sparkleai.tech` — tag `Zenya Prime` — 15 workflows*
