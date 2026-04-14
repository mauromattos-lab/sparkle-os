# Zenya como Órgão do SparkleOS — PRD
**Versão:** 1.0  
**Data:** 2026-04-14  
**Autor:** Mauro + Morgan (@pm)  
**Status:** Draft — aguardando validação @po  
**Tipo:** Brownfield Enhancement  
**Derivado de:** Análise de fluxos n8n (Atlas) + Arquitetura (Aria) + Pesquisa externa (Atlas)

---

## 1. Análise do Projeto Atual

### Estado atual

Zenya é o primeiro Órgão ativo do SparkleOS — atendente IA no WhatsApp que serve como interface entre clientes PMEs e seus usuários finais. Hoje opera inteiramente sobre ~15 fluxos n8n hospedados na plataforma fazer.ai, com Chatwoot como gateway WhatsApp.

**Situação operacional:**
- 4 clientes ativos (2 entregues em produção, 2 em entrega pendente)
- 4–5 fluxos utilizados por cliente (de 15 disponíveis na base)
- Clientes eventualmente demandam integrações não cobertas pela base — exigindo criação ad-hoc no n8n

**Fluxos core em uso:**

| Fluxo | Função |
|-------|--------|
| 00. Configurações | Setup one-time: cria tabelas PostgreSQL + configs Chatwoot |
| 01. Secretária v3 | Agente principal: loop AI com 12 ferramentas, memória, locking por sessão |
| 05. Escalar humano | Handoff para atendente humano via etiqueta Chatwoot + alerta ao gestor |
| 07. Quebrar e enviar mensagens | Divide resposta longa em partes humanizadas com simulação de digitação |

**Fluxos com potencial mas sem uso ativo:**
- Google Calendar (03, 04, 04.1, 09, 11) — agendamento completo
- Asaas (06) — cobrança financeira
- Google Drive (02) — envio de arquivos
- Retell AI — chamadas de voz
- Recuperação de leads (13)

### Limitações estruturais identificadas

| Limitação | Impacto |
|-----------|---------|
| Sem testes nativos no n8n | Bugs em produção sem alerta — afeta clientes reais |
| Sem Git nativo (plano Community) | Mudanças vão a produção sem rastreabilidade |
| Debug requer execução real no n8n | 1h+ para validar integração simples (caso real: Loja Integrada) |
| Novo cliente = clonar fluxos | N clientes → N×15 fluxos para manter |
| Custom por cliente não reutilizável | Integração criada para Julia não aproveita Luiza |
| Licença comercial n8n (SUL) | Risco para produto multi-cliente em escala |

### Fonte de análise
- Análise interna dos 4 fluxos core (leitura direta dos JSONs n8n) — Atlas, 2026-04-14
- Pesquisa externa: padrões de migração n8n → TypeScript, Vercel AI SDK, multi-tenant — Atlas, 2026-04-14
- Arquitetura proposta — Aria, 2026-04-14

---

## 2. Escopo da Melhoria

### Tipo de enhancement
- ✅ Migração de stack (n8n → TypeScript/Node.js)
- ✅ Integração com novo sistema (SparkleOS como host)
- ✅ Melhoria de escalabilidade (multi-tenant via DB, não clonagem)
- ✅ Mudança arquitetural (Zenya passa a ser Órgão de primeira classe)

### Descrição
Zenya deixa de ser um conjunto de fluxos em plataforma terceira e passa a existir como Órgão nativo do SparkleOS: um processo Node.js rodando na VPS própria, com lógica em TypeScript, memória no Supabase/PostgreSQL, ferramentas extensíveis por cliente via configuração no banco, e o canal WhatsApp mantido via Chatwoot/Z-API.

### Impacto no sistema existente
**Impacto maior** — mudança arquitetural completa do runtime da Zenya. O sistema n8n é substituído, não modificado. A continuidade é garantida por operação paralela durante a migração.

### Goals

- Zenya operando como Órgão nativo do SparkleOS, sem dependência do n8n
- Qualquer agente AIOS pode melhorar a Zenya via código — não via interface visual
- Novo cliente ativado com inserção de row no banco — sem redeploy, sem clonagem de fluxo
- Integração customizada criada uma vez → reutilizável por qualquer cliente via config
- APIs externas (Loja Integrada, etc.) acessadas com a mesma confiabilidade do ambiente local
- Zenya testável, versionável e auditável como qualquer outro componente do sistema

### Background Context

A decisão de migrar é estratégica, não apenas técnica. O n8n foi útil como ponto de partida, mas impõe limitações que crescem proporcionalmente ao número de clientes: cada novo cliente multiplica a superfície de manutenção, cada integração customizada vira uma ilha, cada mudança no comportamento da Zenya vai a produção sem rastreabilidade.

O SparkleOS foi construído para ser o ambiente onde a Zenya cresce. Mantê-la fora desse ambiente é uma contradição arquitetural. A migração transforma Zenya no que ela sempre deveria ser: um Órgão com identidade, lore, ferramentas e memória — vivendo dentro do sistema que foi feito para hospedá-la.

---

## 3. Requisitos Funcionais

**FR1:** O sistema deve receber webhooks do Chatwoot e processar mensagens de WhatsApp sem dependência do n8n.

**FR2:** O agente Zenya deve executar um loop de tool-calling com no mínimo as 4 ferramentas do core atual: escalar humano, criar agendamento, buscar agendamentos, enviar mensagem separada.

**FR3:** O sistema deve manter histórico de conversa por sessão (telefone + tenant) persistido no PostgreSQL, com janela de 50 mensagens.

**FR4:** O sistema deve garantir que apenas uma execução processe cada sessão por vez (lock distribuído por telefone), evitando respostas duplicadas ou fora de ordem.

**FR5:** O sistema deve suportar múltiplos clientes (tenants) com configuração isolada: system prompt próprio, ferramentas ativas específicas, credenciais de integrações.

**FR6:** Adicionar um novo cliente deve ser possível via inserção de row no banco, sem redeploy ou alteração de código.

**FR7:** Uma ferramenta criada para um cliente deve poder ser ativada para outro cliente via configuração — sem duplicação de código.

**FR8:** O sistema deve simular digitação humana ao enviar respostas (typing indicator + timing proporcional ao tamanho da mensagem).

**FR9:** O sistema deve suportar respostas em texto e em áudio (TTS via ElevenLabs), com preferência por cliente e por conversa.

**FR10:** O fluxo de escalonamento deve adicionar etiqueta `agente-off` no Chatwoot e notificar o gestor configurado, desabilitando o bot para aquela conversa.

**FR11:** O sistema deve permitir que agentes AIOS melhorem ferramentas, prompts e comportamentos via código versionado em git.

---

## 4. Requisitos Não-Funcionais

**NFR1:** O sistema deve processar e responder mensagens em tempo equivalente ou inferior ao n8n atual (baseline: < 30s para resposta completa).

**NFR2:** O processo deve permanecer ativo 24/7 na VPS sem intervenção manual (gerenciado por PM2).

**NFR3:** Falha em uma ferramenta não deve derrubar o agente — erros de tool devem ser tratados graciosamente com fallback para resposta ao usuário.

**NFR4:** Contexto de conversa de um tenant nunca deve vazar para outro tenant (isolamento garantido por closure + RLS no PostgreSQL).

**NFR5:** O sistema deve ser testável unitariamente por ferramenta e por comportamento do agente, com cobertura mínima nas ferramentas core.

**NFR6:** Logs de conversa devem ser persistidos para auditoria e análise de qualidade de atendimento.

**NFR7:** Credenciais de integrações por cliente devem ser armazenadas criptografadas (AES-256) no banco — nunca em env vars por cliente.

---

## 5. Requisitos de Compatibilidade

**CR1:** O canal WhatsApp via Chatwoot/Z-API deve permanecer funcional durante toda a migração — zero downtime para clientes em produção.

**CR2:** O schema PostgreSQL existente (`n8n_historico_mensagens`, `n8n_fila_mensagens`, `n8n_status_atendimento`) deve ser compatível ou migrado com script versionado.

**CR3:** O comportamento e personalidade da Zenya (SOP, tom, regras de atendimento) devem ser preservados na migração — apenas o runtime muda.

**CR4:** O sistema deve operar em paralelo com o n8n durante a fase de validação, permitindo comparação de comportamento antes do cutover definitivo.

---

## 6. Restrições Técnicas

### Stack definida

| Componente | Tecnologia | Justificativa |
|-----------|-----------|---------------|
| Agent loop | Vercel AI SDK 5 (`generateText` + `tools`) | Tool-calling nativo, tipagem forte, multi-provider em 1 linha |
| Webhook server | Fastify (Node.js) | Leve, rápido, baixo overhead na VPS |
| Fila de mensagens | PostgreSQL (`zenya_queue`) | Sem nova infra — reutiliza o que existe |
| Lock distribuído | PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` | Garante 1 execução por sessão |
| Memória | PostgreSQL + Supabase | Continuidade com schema atual |
| TTS | ElevenLabs API | Mesmo provider atual |
| Deploy | PM2 na VPS (187.77.37.88) | Simples, já disponível |
| Testes | Vitest | Padrão TypeScript moderno |

### Canal WhatsApp
Chatwoot e/ou Z-API permanecem como gateway — não são substituídos. A Zenya consome o webhook e envia respostas via API REST do Chatwoot. Esta camada é infraestrutura de telecomunicação, não lógica de produto.

### Estrutura de código
```
packages/zenya/
├── agent/
│   ├── index.ts          # generateText() + tools loop
│   ├── tools/            # Uma função por ferramenta (factory pattern)
│   ├── memory.ts         # Leitura/escrita histórico PostgreSQL
│   └── prompt.ts         # System prompt + SOP (versionado no git)
├── worker/
│   ├── webhook.ts        # POST /webhook/chatwoot
│   ├── queue.ts          # Fila de mensagens por sessão
│   └── lock.ts           # Lock distribuído por telefone
├── integrations/
│   ├── chatwoot.ts       # Enviar msg, typing, etiquetas
│   ├── elevenlabs.ts     # TTS
│   └── message-chunker.ts # Quebra + timing humanizado
└── tenant/
    ├── config-loader.ts  # Carrega config do cliente do PostgreSQL
    └── tool-factory.ts   # Instancia tools com tenantId por closure
```

### Isolamento multi-tenant
- `tenantId` injetado por closure em todas as tools — nunca parâmetro LLM-controlável
- RLS no PostgreSQL como backstop: `WHERE tenant_id = current_setting('app.current_tenant_id')`
- Credenciais por cliente: criptografadas em tabela `zenya_tenant_credentials`

### Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Regressão de comportamento | Baixa | Validação completa via Zenya Prime (número próprio) antes de qualquer cutover de cliente |
| Race condition em mensagens simultâneas | Baixa | Lock PostgreSQL `FOR UPDATE SKIP LOCKED` (mesmo padrão atual) |
| Downtime durante migração | Baixa | n8n permanece ativo até validação completa |
| Context leak entre tenants | Baixa | Closure + RLS desde o dia 1 |
| Incompatibilidade de schema | Baixa | Migration script versionado + tabelas existentes preservadas |

---

## 7. Estrutura de Épico

**Decisão:** Epic único — a migração é um conjunto coeso de mudanças com dependências sequenciais claras. Não faz sentido dividir em múltiplos epics pois cada story depende das anteriores.

---

## Epic 1: Zenya como Órgão Nativo do SparkleOS

**Epic Goal:** Migrar a Zenya de fluxos n8n para um Órgão TypeScript nativo do SparkleOS, mantendo continuidade de serviço para os 4 clientes ativos e habilitando modelo multi-tenant escalável.

**Integration Requirements:** Chatwoot webhook permanece como trigger. PostgreSQL mantém tabelas existentes + novas para multi-tenant. Deploy na VPS via PM2.

---

### Story 1.1 — Fundação do pacote Zenya + Webhook Worker

**Como** sistema SparkleOS,  
**quero** receber webhooks do Chatwoot e enfileirar mensagens por sessão,  
**para que** a Zenya tenha uma fundação funcional independente do n8n.

**Acceptance Criteria:**
1. Pacote `packages/zenya/` criado com estrutura definida na arquitetura
2. Servidor Fastify recebe POST `/webhook/chatwoot` e valida payload
3. Mensagens `outgoing` (do próprio bot) são filtradas e ignoradas
4. Mensagens `incoming` são enfileiradas no PostgreSQL por `(tenant_id, phone_number)`
5. Lock distribuído por sessão funciona: segunda mensagem aguarda primeira terminar
6. Testes unitários cobrem: validação de payload, filtro outgoing, lógica de fila

**Integration Verification:**
- IV1: Webhook recebe mensagem real do Chatwoot sem erro 500
- IV2: Tabelas PostgreSQL de fila e lock criadas via migration versionada
- IV3: n8n continua operando em paralelo sem interferência

---

### Story 1.2 — Tenant Config Loader + Isolamento Multi-tenant

**Como** sistema multi-cliente,  
**quero** carregar configuração específica por cliente do banco de dados,  
**para que** cada cliente tenha SOP, ferramentas ativas e credenciais isoladas.

**Acceptance Criteria:**
1. Tabela `zenya_tenants` criada com: `id`, `name`, `system_prompt`, `active_tools JSONB`, `chatwoot_account_id`, `created_at`
2. Tabela `zenya_tenant_credentials` criada com credenciais criptografadas por serviço
3. `TenantConfigLoader` carrega config do banco com cache em memória (TTL 5 min)
4. RLS habilitado em todas as tabelas Zenya com policy por `tenant_id`
5. `createTenantTools(tenantId, config)` retorna objeto de tools com tenantId por closure — invisível ao LLM
6. Seed script popula os 4 clientes atuais com config equivalente ao n8n

**Integration Verification:**
- IV1: Query com tenant_id errado retorna zero rows (RLS funcionando)
- IV2: Config dos 4 clientes atuais carrega corretamente
- IV3: Credenciais armazenadas não aparecem em texto plano no banco

---

### Story 1.3 — Agent Loop Core (Agente Principal)

**Como** Zenya,  
**quero** processar mensagens do usuário com um LLM e executar ferramentas,  
**para que** eu possa responder de forma inteligente e tomar ações no sistema.

**Acceptance Criteria:**
1. `generateText()` do Vercel AI SDK configurado com `gpt-4.1` + `maxSteps: 15`
2. Histórico de conversa carregado do PostgreSQL (janela de 50 mensagens) e passado como `messages`
3. Histórico atualizado após cada execução (mensagem do usuário + resposta do agente)
4. System prompt carregado do `prompt.ts` (versionado no git) + config do tenant
5. As 4 ferramentas core implementadas: `escalarHumano`, `enviarTextoSeparado`, `reagirMensagem`, `refletir`
6. Resposta final enviada ao Chatwoot via API REST
7. Lock de sessão liberado após envio (em finally block — nunca fica preso)

**Integration Verification:**
- IV1: Conversa completa (usuário → agente → resposta) funciona end-to-end com cliente real
- IV2: Histórico persiste entre mensagens distintas da mesma sessão
- IV3: Ferramenta `escalarHumano` adiciona etiqueta `agente-off` no Chatwoot corretamente

---

### Story 1.4 — Message Chunker + Typing Simulation

**Como** usuário do WhatsApp,  
**quero** receber respostas da Zenya em partes naturais com indicador de digitação,  
**para que** a experiência pareça uma conversa humana, não um dump de texto.

**Acceptance Criteria:**
1. `message-chunker.ts` chama LLM (`gpt-4.1-mini`) com structured output para dividir texto em até 5 partes
2. Para cada parte: ativa typing indicator → aguarda tempo proporcional → envia → aguarda 1s
3. Tempo de digitação calculado: `min(60 * (chars / 4.5) / 150, 25)` segundos
4. Loop é serial (não paralelo) — partes enviadas em ordem garantida
5. Testes unitários cobrem: cálculo de timing, serialização do loop, output estruturado do LLM

**Integration Verification:**
- IV1: Resposta longa chega em múltiplas mensagens com intervalo visível no WhatsApp
- IV2: Typing indicator aparece antes de cada parte
- IV3: Comportamento equivalente ao fluxo 07 do n8n

---

### Story 1.5 — Ferramentas de Agendamento (Google Calendar)

**Como** Zenya,  
**quero** consultar, criar, atualizar e cancelar agendamentos no Google Calendar,  
**para que** clientes com integração de agenda possam ser atendidos sem o n8n.

**Acceptance Criteria:**
1. Tools implementadas: `buscarJanelasDisponiveis`, `criarAgendamento`, `buscarAgendamentosContato`, `cancelarAgendamento`, `atualizarAgendamento`
2. Credenciais Google Calendar por tenant carregadas do banco criptografado
3. Cada tool opera com `tenantId` por closure — não como parâmetro LLM
4. Tool ativada apenas para tenants com `google_calendar` em `active_tools`
5. Testes de integração com conta de calendário de teste

**Integration Verification:**
- IV1: Agendamento criado pela Zenya aparece no Google Calendar do cliente
- IV2: Tenant sem Google Calendar ativo não tem acesso à tool (não aparece no contexto do LLM)

---

### Story 1.6 — Resposta em Áudio (ElevenLabs TTS)

**Como** usuário do WhatsApp com preferência por áudio,  
**quero** receber respostas da Zenya como mensagens de voz,  
**para que** eu possa ouvir as respostas sem precisar ler.

**Acceptance Criteria:**
1. Preferência por áudio verificada via atributo do contato no Chatwoot (`preferencia_audio_texto`)
2. Texto formatado para SSML antes de enviar ao ElevenLabs
3. Áudio gerado em MP3 (modelo `eleven_flash_v2_5`) e enviado como arquivo no Chatwoot
4. Fallback para texto se ElevenLabs falhar (erro tratado graciosamente)
5. Tool `alterarPreferenciaAudioTexto` permite usuário mudar preferência durante conversa

**Integration Verification:**
- IV1: Mensagem de voz recebida no WhatsApp quando preferência = áudio
- IV2: Fallback para texto funciona quando ElevenLabs retorna erro

---

### Story 1.7 — Ferramentas de Integração Customizada (Extensão do Core)

**Como** sistema multi-cliente,  
**quero** que novas integrações sejam criadas uma vez e ativadas por config,  
**para que** Julia, Luiza e futuros clientes possam ter ferramentas específicas sem duplicação de código.

**Acceptance Criteria:**
1. Pattern `tool-factory.ts` documentado e validado com uma integração concreta (ex: Loja Integrada ou Asaas)
2. Nova integração = novo arquivo em `integrations/` + registro em `active_tools` do tenant
3. Tool ativada para cliente A pode ser ativada para cliente B via UPDATE no banco — sem código novo
4. Integração Asaas (`criarOuBuscarCobranca`) implementada como referência do padrão
5. Documentação do pattern para que `@dev` saiba como criar novas integrações

**Integration Verification:**
- IV1: Tool Asaas funciona para tenant com `asaas` em `active_tools`
- IV2: Tenant sem `asaas` em `active_tools` não vê a tool no contexto do LLM
- IV3: Adicionar nova tool para tenant existente não requer redeploy

---

### Story 1.8 — Validação com Zenya Prime e Cutover

**Como** operador do sistema,  
**quero** validar o comportamento da Zenya no SparkleOS usando o número próprio (Zenya Prime) antes de migrar os clientes reais,  
**para que** os 4 clientes em produção não sejam expostos a nenhum risco durante a validação.

**Contexto:** O SparkleOS possui um número WhatsApp próprio (Zenya Prime) conectado ao fluxo da Zenya para uso interno e testes. Este número é o ambiente de validação — permite testar o sistema completo com conversas reais sem nenhum impacto sobre clientes.

**Acceptance Criteria:**
1. Zenya Prime (número interno) configurada como primeiro tenant no SparkleOS com webhook apontando para o novo sistema
2. Checklist de comportamentos validados via conversas reais no número próprio: resposta básica, escalonamento, agendamento, áudio, ferramentas ativas
3. Período mínimo de 48h de operação estável na Zenya Prime antes de qualquer cutover de cliente
4. Plano de rollback documentado: como reverter webhook de cada cliente para n8n se necessário
5. Cutover por cliente: um cliente por vez, começando pelo de menor risco
6. n8n mantido em standby por 7 dias pós-cutover do último cliente antes de desativação

**Integration Verification:**
- IV1: Zenya Prime responde conversas completas via SparkleOS sem erros por 48h contínuas
- IV2: Primeiro cliente migrado operando normalmente por 24h antes de migrar o seguinte
- IV3: Rollback testado e documentado antes do primeiro cutover de cliente real

---

## 8. Critérios de Sucesso

| Métrica | Baseline (n8n) | Target (SparkleOS) |
|---------|---------------|-------------------|
| Tempo para validar integração de API | ~60 min | < 5 min |
| Custo de adicionar novo cliente | Clonar 15 fluxos + configurar | Inserir 1 row no banco |
| Custo de ativar integração existente para novo cliente | Criar/modificar fluxo | UPDATE em `active_tools` |
| Cobertura de testes | 0% (n8n não tem) | ≥ 80% ferramentas core |
| Rastreabilidade de mudanças | Nenhuma | 100% (git history) |
| Incidentes pós-cutover (7 dias) | — | 0 críticos |

---

## 9. Fora de Escopo

- Migração dos fluxos inativos (agendamento, recuperação de leads, Retell AI) — ficam no n8n até demanda real
- Interface visual de administração (Cockpit do Mauro) — escopo futuro
- Integração com Cérebro Coletivo — próximo epic após Zenya estável
- Substituição do Chatwoot/Z-API como gateway WhatsApp

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-04-14 | 1.0 | Versão inicial | Mauro + Morgan (@pm) |
