---
source: zenya_operation
nucleus: zenya
version: 1.0.0
knowledge_type: operational
tags: [atendimento, n8n, whatsapp, zenya, conhecimento-operacional, situacoes-comuns, comportamentos]
collected_at: 2026-04-11
collected_by: "@analyst (Atlas) — Story 2.8"
---

# Base de Conhecimento Operacional — Zenya

**Versão:** 1.0.0
**Data:** 2026-04-11
**Mantido por:** @analyst

> Este documento sintetiza o conhecimento operacional da Zenya — como ela atende, o que acontece em situações reais, o que tem comportamento diferente do esperado e como o sistema evolui. É o ponto de entrada para qualquer agente que precise entender a Zenya sem acessar o n8n diretamente.

---

## Como a Zenya Atende

### Fluxo fundamental (caminho de toda mensagem)

```
1. Cliente envia mensagem no WhatsApp
       ↓
2. Chatwoot recebe e dispara webhook para o n8n
   POST /webhook/zenya-prime
       ↓
3. 01. Secretária v3 — gerencia fila, filtra, identifica tipo
   (82% das execuções são descartadas aqui por filtros)
       ↓
4. AI Agent GPT-4.1 processa com memória de conversa
   (janela de 50 mensagens em Postgres)
       ↓
5. 07. Quebrar e enviar mensagens — divide a resposta,
   simula digitação, envia mensagem a mensagem
       ↓
6. Cliente recebe as mensagens no WhatsApp
```

### Quem é a Zenya

A Zenya é a atendente IA principal — responde clientes, agenda consultas, gera cobranças, envia arquivos e escala para Mauro quando necessário. Sua identidade, personalidade e instruções estão preservadas em `docs/zenya/ip/ZENYA-PROMPTS.md`.

Existe também a **Maria** (`08.`), assistente pessoal de Mauro — opera no canal privado dele, não interage com clientes.

---

## Situações Comuns

### SC-01 — Cliente envia mensagem de texto

**Trigger:** Webhook Chatwoot (`message_created`)
**Fluxos:** `01.` → AI Agent → `07.`
**O que acontece:**
1. `01.` recebe o payload, enfileira a mensagem e verifica anti-cavalgamento
2. O AI Agent processa com memória das últimas 50 mensagens
3. `07.` divide a resposta em partes, simula digitação e envia

**Tempo observado:** 0–123s (mediana ~0s para mensagens filtradas; ~30–60s para respostas AI completas)
**Fonte:** `BASELINE-PERFORMANCE.md` — distribuição de duração de `01.`

---

### SC-02 — Cliente envia áudio

**Trigger:** Webhook Chatwoot com `attachments[0].meta.is_recorded_audio = true`
**Fluxos:** `01.` → Whisper → AI Agent → `07.`
**O que acontece:**
1. `01.` detecta o tipo de mensagem como áudio
2. Faz download do arquivo e envia ao OpenAI Whisper para transcrição
3. O texto transcrito entra no AI Agent como se fosse texto normal
4. Se o contato tiver preferência de resposta em áudio, a Zenya responde em áudio (via TTS — verificar se implementado) ou em texto

**Comportamento especial:** A preferência `preferencia_audio_texto` do atributo do contato no Chatwoot determina o formato da resposta (ver CB-04).

---

### SC-03 — Cliente envia arquivo

**Trigger:** Webhook Chatwoot com `attachments[0].file_type` presente e não é áudio
**Fluxos:** `01.` → sinaliza arquivo → AI Agent (tool) → `02.` (se precisar enviar Drive)
**O que acontece:**
1. `01.` detecta o arquivo e adiciona contexto `<usuário enviou um arquivo do tipo '...'>` para o AI Agent
2. O AI Agent pode acionar `02.` para buscar e enviar arquivos do Google Drive em resposta

---

### SC-04 — Cliente solicita agendamento

**Trigger:** Mensagem de texto onde o AI Agent identifica intenção de agendar
**Fluxos:** `01.` → AI Agent (tool) → `03.` → `04.`
**O que acontece:**
1. AI Agent reconhece a intenção de agendamento
2. Aciona `03.` como tool para verificar janelas disponíveis no Google Calendar
3. Apresenta opções ao cliente
4. Após confirmação, aciona `04.` para criar o evento
5. `04.` confirma a criação ou retorna `"horário indisponível"` se o slot foi ocupado

**Detalhe:** `03.` gera janelas de tempo, filtra conflitos e aleatoriza a ordem — o cliente não vê sempre os mesmos horários.

---

### SC-05 — Cliente precisa reagendar ou atualizar agendamento

**Trigger:** Mensagem indicando necessidade de alteração em agendamento existente
**Fluxos:** `01.` → AI Agent (tool) → `04.1`
**O que acontece:**
1. AI Agent identifica a necessidade de atualizar um evento existente
2. Aciona `04.1 [EXTRA] Atualizar agendamento` — que usa a API REST do Calendar diretamente (workaround)
3. Confirma a atualização ao cliente

**Comportamento especial:** `04.1` existe por causa de um bug no node nativo do n8n para atualização de eventos (ver CB-02).

---

### SC-06 — Cliente solicita informação sobre cobrança / gera boleto

**Trigger:** Mensagem com intenção financeira identificada pelo AI Agent
**Fluxos:** `01.` → AI Agent (tool) → `06.`
**O que acontece:**
1. AI Agent aciona `06. Integração Asaas`
2. `06.` busca ou cria o cliente no Asaas pelo número de telefone
3. Verifica cobranças existentes ou cria nova cobrança
4. Sincroniza status da cobrança como atributo do contato no Chatwoot
5. Retorna informação ao AI Agent para comunicar ao cliente

**Nota:** Atualmente em modo sandbox (`url_asaas = https://api-sandbox.asaas.com`) — cobranças reais requerem mudança para produção.

---

### SC-07 — Situação não resolvida → escalação para humano

**Trigger:** AI Agent avalia que não consegue resolver e aciona a tool de escalação
**Fluxos:** `01.` → AI Agent (tool) → `05.`
**O que acontece:**
1. AI Agent aciona `05. Escalar humano`
2. `05.` aplica a etiqueta `agente-off` na conversa no Chatwoot (pausa a IA)
3. Envia alerta via Z-API para o WhatsApp de Mauro
4. A partir desse ponto, a conversa fica silenciosa para o AI — Mauro atende manualmente

**Taxa observada:** ~11% das respostas AI geradas no período de baseline (3 de 27)
**Para retomar o AI:** remover a etiqueta `agente-off` da conversa no Chatwoot

---

### SC-08 — Cliente envia várias mensagens rápidas seguidas

**Trigger:** Múltiplas mensagens em intervalo curto
**Fluxos:** `01.` (múltiplas execuções) — mecanismo anti-cavalgamento
**O que acontece:**
1. Cada mensagem dispara uma execução separada de `01.`
2. O node `Mensagem encavalada?` verifica se a mensagem atual é a mais recente na fila do Postgres
3. Execuções de mensagens "atropeladas" retornam array vazio e encerram imediatamente
4. Apenas a execução da mensagem mais recente segue para o AI Agent

**Efeito:** O cliente percebe que a Zenya processa apenas a última mensagem quando envia várias seguidas. **Isso é intencional** — evita responder mensagens desatualizadas.
**Dado:** 82% das 165 execuções de `01.` encerraram em < 5s — grande parte por este mecanismo.

---

### SC-09 — Lembrete proativo de agendamento

**Trigger:** Schedule automático (a cada 1 minuto)
**Fluxos:** `11.` → AI Agent → `10.` → Chatwoot
**O que acontece:**
1. `11.` busca eventos do Google Calendar sem lembrete enviado
2. Para cada evento com lembrete pendente, o AI Agent personaliza a mensagem
3. `10.` garante que o contato existe no Chatwoot (ou cria)
4. A mensagem é enviada via Chatwoot para o WhatsApp do cliente
5. O evento é marcado como "lembrete enviado" para não repetir

**Nota operacional:** O scheduler executa ~1.440 vezes/dia. Na fase atual (zero agendamentos), a maioria das execuções não encontra nada e encerra. O overhead é baixo (avg 1s/execução).

---

### SC-10 — Mauro envia comando via WhatsApp (assistente interno)

**Trigger:** Mensagem no canal privado de Mauro → webhook `b931de43-...`
**Fluxos:** `08.` → AI Agent (GPT-4.1) → tools diversas
**O que acontece:**
1. Mauro envia mensagem de texto ou áudio para o seu próprio canal
2. `08.` detecta o tipo, transcreve áudio se necessário
3. AI Agent "Maria" processa o comando com capacidades: ler emails, criar tarefas, criar/cancelar agendamentos, consultar cobranças
4. Responde diretamente no canal de Mauro

**Separação importante:** Este fluxo opera completamente independente dos clientes. A identidade "Maria" e a persona são distintas da Zenya — ver `docs/zenya/ip/ZENYA-PROMPTS.md § P2`.

---

### SC-11 — Chamada telefônica encerrada

**Trigger:** Webhook Chatwoot com evento de chamada (`call`)
**Fluxos:** `12.` → AI Agent → `04.` + `06.` + `10.`
**O que acontece:**
1. `12.` recebe o evento, verifica se é encerramento de chamada
2. Busca ou cria o contato no Chatwoot via `10.`
3. Cria evento no Calendar registrando a chamada
4. AI Agent gera mensagem de follow-up personalizada
5. Cria ou busca cobrança no Asaas se aplicável
6. Envia mensagem de follow-up ao cliente via Chatwoot

**Status atual:** Fluxo ativo mas sem execuções registradas — feature não acionada na fase de testes.

---

### SC-12 — Cliente inativo → reengajamento (INATIVO)

**Trigger:** Schedule (quando ativado) + contato com flag "aguardando follow-up"
**Fluxos:** `13.` → AI Agent → `10.`
**Status:** **Fluxo inativo** — não processa nenhuma mensagem atualmente.
**Quando ativar:** Após definir o pipeline comercial e critérios de reengajamento.

---

## Comportamentos Conhecidos

### CB-01 — Janela de memória limitada a 50 mensagens

**O que é:** O AI Agent da Zenya (`01.`) tem acesso às últimas 50 trocas de mensagens por conversa, armazenadas em `n8n_historico_mensagens` no Postgres.

**Efeito prático:** Em conversas muito longas (>50 mensagens), a Zenya "esquece" o início da conversa. Contexto estabelecido cedo pode se perder.

**Workaround atual:** Nenhum — o cliente precisa repetir informações se a conversa for muito longa.

**Risco:** G2 do inventário — a tabela acumula histórico sem limpeza visível. Pode causar lentidão em consultas à medida que cresce.

**Fonte:** `docs/zenya/FLOW-INVENTORY.md § 01.`

---

### CB-02 — Workaround de atualização de agendamento (`04.1`)

**O que é:** O node nativo do n8n para atualização de eventos Google Calendar tem um bug. O fluxo `04.1` contorna isso usando a API REST do Google Calendar diretamente.

**Efeito prático:** Funciona normalmente para o cliente — a atualização ocorre.

**Risco:** Se o bug for corrigido no n8n sem remover `04.1`, haverá duplicidade de lógica. Se o `04.1` for removido antes da correção do bug, atualizações vão falhar.

**Ação futura:** Remover `04.1` quando n8n corrigir o node nativo de update de eventos.

**Fonte:** `docs/zenya/FLOW-INVENTORY.md § 04.1`

---

### CB-03 — 82% dos webhooks são descartados antes do AI

**O que é:** De cada 100 webhooks que chegam ao `01.`, apenas ~18 chegam ao AI Agent. Os demais são filtrados por:
- Mecanismo anti-cavalgamento (`Mensagem encavalada?`)
- Conversa com etiqueta `agente-off`
- Tipo de mensagem não processável
- Mensagem de saída (enviada pela própria Zenya)

**Efeito prático:** O sistema é eficiente — a maioria dos disparos desnecessários é rejeitada cedo (< 5s). O AI só processa o que realmente precisa de processamento.

**Dado:** 165 execuções de `01.` → 27 execuções de `07.` (respostas enviadas) = 16,4% de conversão.

**Fonte:** `docs/zenya/BASELINE-PERFORMANCE.md`

---

### CB-04 — Resposta adaptativa: texto vs. áudio

**O que é:** A Zenya verifica o atributo `preferencia_audio_texto` do contato no Chatwoot antes de responder. Lógica:
1. Se `texto` → sempre responde em texto
2. Se `audio` → sempre responde em áudio
3. Se não definido → usa o mesmo formato da última mensagem do cliente

**Efeito prático:** Clientes que mandam áudio recebem áudio, clientes que mandam texto recebem texto — sem configuração explícita.

**Fonte:** `docs/zenya/ip/ZENYA-LOGIC.md § L2`

---

### CB-05 — Digitação simulada com cap de 25 segundos

**O que é:** O `07.` calcula o tempo de espera antes de enviar cada mensagem com base no comprimento estimado da resposta (150 palavras/minuto), com um limite máximo de 25 segundos por mensagem.

**Efeito prático:** Respostas muito longas não fazem o cliente esperar mais de 25s entre mensagens. Para respostas curtas (~100 chars), a espera é de ~10s.

**Dado baseline:** `07.` tem duração média de 40,4s, que inclui múltiplas mensagens com delays.

**Fonte:** `docs/zenya/ip/ZENYA-LOGIC.md § L3`

---

### CB-06 — Tempo de resposta pode chegar a 123 segundos

**O que é:** Em casos complexos (múltiplas tool calls, contexto longo), o `01.` pode levar até 123s para concluir o processamento.

**Efeito prático:** O cliente vê o indicador "digitando..." ativado durante esse tempo (o `07.` ativa o typing status antes de enviar). Casos acima de 60s foram observados em 9 das 165 execuções (~5%).

**Causa provável:** Múltiplas chamadas encadeadas (buscar Calendar + verificar disponibilidade + criar evento) ou resposta longa com divisão em muitas partes.

**Fonte:** `docs/zenya/BASELINE-PERFORMANCE.md § distribuição de duração`

---

### CB-07 — `10. Buscar ou criar contato` é o hub crítico

**O que é:** O fluxo `10.` é chamado por 5 outros fluxos (`09.`, `11.`, `12.` ×4, `13.`). É o sub-workflow mais reutilizado do sistema.

**Efeito prático:** Qualquer bug em `10.` afeta lembretes, gestão de ligações, cancelamentos e reengajamento simultaneamente.

**Risco:** Ponto único de falha para toda comunicação proativa. Manter monitorado.

**Fonte:** `docs/zenya/FLOW-INVENTORY.md § Mapa de Relacionamentos`

---

### CB-08 — Asaas em modo sandbox

**O que é:** A URL do Asaas está configurada como `https://api-sandbox.asaas.com` no node `Info` do `01.`.

**Efeito prático:** Cobranças criadas pela Zenya são cobranças de teste — não geram pagamentos reais.

**Ação necessária antes de ir a produção:** Trocar `url_asaas` para `https://api.asaas.com` no node `Info` após aprovação de Mauro.

**Fonte:** `docs/zenya/raw/live_r3C1FMc6NIi6eCGI.json` — node `Info`

---

## Limitações Atuais

| Limitação | Impacto | Resolução Prevista |
|-----------|---------|-------------------|
| Memória de 50 mensagens por conversa | Contexto se perde em conversas longas | Epic 3 — resumo automático de contexto |
| Sem contador de tokens OpenAI | Custo operacional não rastreável | Story futura — logging de AI usage |
| Asaas em sandbox | Sem cobranças reais | Ativar produção após validação |
| `13.` inativo | Sem reengajamento de leads | Ativar quando pipeline definido |
| Sem resolução de conversas | Taxa de resolução não medível | Implementar webhook de status no Chatwoot |
| Webhook `08.` com UUID | Path difícil de documentar | Renomear em story de manutenção |
| Sem TTL na tabela de memória | Crescimento ilimitado do Postgres | Implementar limpeza periódica |

---

## Como a Zenya Aprende

### Ciclo Atual (manual)

```
1. Mauro observa comportamento inadequado ou oportunidade de melhoria
       ↓
2. Mauro descreve a melhoria desejada
       ↓
3. Agente analista documenta proposta de alteração
       ↓
4. Gate obrigatório: aprovação de Mauro (SOP: docs/sops/sop-atualizar-ip-zenya.md)
       ↓
5. @architect implementa a alteração nos prompts ou fluxos
       ↓
6. Artefatos de IP atualizados em docs/zenya/ip/ com nova tag git
```

**Cadência:** Sob demanda — quando Mauro identifica algo.
**Rastreabilidade:** Cada alteração versionada no git com tag `zenya-ip-vX.Y.Z`.

### Ciclo Futuro (Collective Brain — Epic 3)

O Epic 3 introduzirá o Collective Brain, que automatizará parte deste ciclo:

```
1. Zenya opera normalmente → execuções e respostas são logadas
       ↓
2. Collective Brain analisa padrões:
   - Perguntas frequentes sem boa resposta
   - Alto número de escalações em determinado tema
   - Tempo de resposta alto em certas situações
       ↓
3. Collective Brain gera insight estruturado:
   { type: "prompt_improvement", area: "agendamento", evidence: [...] }
       ↓
4. Insight é apresentado a Mauro para aprovação
       ↓
5. Com aprovação, ciclo atual é acionado (steps 4–6 acima)
```

**Insumos necessários do Epic 3:**
- Tabela `zenya_execution_log` (recomendação G1 do baseline)
- Tabela `zenya_ai_usage` (recomendação G2 do baseline)
- Webhook de resolução do Chatwoot (recomendação G3 do baseline)

---

## Referências

| Documento | Conteúdo | Não duplicar |
|-----------|---------|-------------|
| `docs/zenya/FLOW-INVENTORY.md` | Lista completa dos 15 fluxos com IDs, inputs, outputs | Detalhes técnicos de cada fluxo |
| `docs/zenya/NUCLEUS-CONTRACT.md` | Contrato formal: inputs/outputs do Núcleo, API interna | Definição arquitetural |
| `docs/zenya/BASELINE-PERFORMANCE.md` | Métricas reais: volume, qualidade, serviços externos | Dados quantitativos |
| `docs/zenya/ip/ZENYA-PROMPTS.md` | Prompts e personalidade (P1, P2, P3) | Conteúdo dos prompts |
| `docs/zenya/ip/ZENYA-LOGIC.md` | Lógicas JS (L1, L2, L3) | Código proprietário |
| `docs/zenya/ZENYA-CONTEXT.md` | Stack e capacidades resumidas | Overview operacional |
| `docs/sops/sop-atualizar-ip-zenya.md` | Processo de aprovação de alterações | Processo de governança |

---

*Base de conhecimento criada por @analyst (Atlas) — Story 2.8 — 2026-04-11*
*v1.0.0 — baseada nas Stories 2.1, 2.2, 2.3 e 2.6*
