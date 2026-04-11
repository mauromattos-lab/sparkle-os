# SparkleOS Product Requirements Document (PRD)
**Versão:** 1.0
**Data:** 2026-04-11
**Autor:** Mauro + Morgan (@pm)
**Status:** Aprovado — pronto para @architect e @ux-design-expert
**Derivado de:** `docs/brief.md`

---

## Goals and Background Context

### Goals

- AIOS operando dentro do SparkleOS como agente construtor do próprio sistema
- Infraestrutura base definida e funcional como habitat dos agentes
- Zenya integrada formalmente ao SparkleOS como primeiro Núcleo (15 fluxos n8n inventariados, documentados e conectados)
- Primeiro ciclo do Cérebro Coletivo funcional (captura → validação → aplicação mensurável)
- Interface de Pilotagem v1 com visibilidade suficiente para Mauro pilotar com clareza
- Base técnica que suporta adição de novos Núcleos e Órgãos sem reengenharia

### Background Context

SparkleOS nasce da necessidade de uma infraestrutura real onde agentes de IA possam viver, criar e melhorar de forma coordenada. O ciclo anterior (Sparkle AIOX) demonstrou que substância técnica sem ordem arquitetural gera um sistema que não se sustenta — peças construídas em paralelo, sem estrutura unificando tudo. SparkleOS inverte esse processo: os agentes AIOS definem a estrutura primeiro, depois constroem dentro dela.

O sistema não é um produto visível para clientes — é a infraestrutura que torna possível tudo que a Sparkle entrega. A arquitetura é organizada em Órgãos (domínios especializados) compostos por Núcleos (produtos/serviços específicos com inputs, processo, outputs e SOP próprios). O primeiro Núcleo ativo é a Zenya (atendente IA no WhatsApp, ~15 fluxos n8n), que serve como prova de conceito da arquitetura completa e cujos outputs alimentam o Cérebro Coletivo.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-11 | 1.0 | Versão inicial derivada do Project Brief | Mauro + Morgan (@pm) |

---

## Requirements

### Functional Requirements

- **FR1:** O sistema deve prover um ambiente onde agentes AIOS possam operar, pesquisar, criar e entregar de forma autônoma dentro do SparkleOS
- **FR2:** O sistema deve suportar hospedagem e conexão de múltiplos agentes com escopos e responsabilidades definidos
- **FR3:** O sistema deve integrar formalmente os ~15 fluxos n8n da Zenya, com inventário completo, documentação e operação dentro da infraestrutura SparkleOS
- **FR4:** Agentes devem ter capacidade de clonar e modificar fluxos n8n da Zenya de forma incremental (node a node, fluxo a fluxo)
- **FR5:** O sistema deve capturar insights da operação da Zenya e disponibilizá-los como insumo para melhoria (Cérebro Coletivo — ciclo mínimo)
- **FR6:** O sistema deve aplicar insights do Cérebro Coletivo de forma mensurável — captura sem aplicação não conta como ciclo completo
- **FR7:** O sistema deve prover Interface de Pilotagem v1 com visibilidade do estado do sistema: atividade dos agentes, entregas realizadas, alertas e saúde das integrações
- **FR8:** O sistema deve suportar adição de novos Núcleos e Órgãos sem reengenharia da infraestrutura base
- **FR9:** O sistema deve suportar uso de qualquer ferramenta, MCP, skill Claude ou código — sem restrições de stack predefinidas
- **FR10:** O IP da Zenya (lore, personalidade, arquivos visuais) deve ser preservado e versionado dentro do SparkleOS — mudanças requerem aprovação de Mauro
- **FR11:** Agentes devem persistir contexto de trabalho entre sessões — decisões tomadas, trabalho em andamento, o que foi concluído — nenhuma sessão começa do zero
- **FR12:** Decisões arquiteturais tomadas pelos agentes devem ser registradas formalmente (ADR): o quê foi decidido, por quê, o que foi descartado
- **FR13:** O processo de provisionar a Zenya para um novo cliente deve ser executável pelos agentes de forma formal e documentada — não manual
- **FR14:** Cada implementação deve ser rastreável a uma story AIOS — sem código ou componente sem origem documentada
- **FR15:** O Cérebro Coletivo deve ser arquitetado para absorver múltiplas fontes de conhecimento: operacional (Zenya), pesquisa (agentes), e externo (Mauro traz) — desde o design inicial

### Non-Functional Requirements

- **NFR1:** O sistema deve operar sem intervenção manual constante de Mauro — razão entregas/esforço humano deve crescer progressivamente
- **NFR2:** Mauro deve ter visibilidade do estado do sistema em tempo real via Interface de Pilotagem
- **NFR3:** Dados de clientes atendidos pela Zenya devem ser isolados por cliente — sem cross-contamination
- **NFR4:** Custo por agente/operação deve ser visível e rastreável — operações viáveis dentro do orçamento atual (~$550/mês plano Claude)
- **NFR5:** A arquitetura deve ser extensível — novos Núcleos, Órgãos, ferramentas e agentes integráveis sem impacto nos existentes
- **NFR6:** Nenhuma decisão arquitetural deve ser constrangida pela implementação anterior — SparkleOS é construído do zero
- **NFR7:** O sistema deve ter critérios claros de escalação: quando age autonomamente vs. quando escala para Mauro — sem inundar com decisões operacionais
- **NFR8:** O sistema deve monitorar saúde dos agentes, ferramentas e integrações em tempo real
- **NFR9:** **Integridade de processo é inegociável** — cada agente executa seu processo completo. Shortcuts que pulam etapas definidas pelo AIOS são proibidos. Velocidade não justifica pular processo
- **NFR10:** Todo processo novo que puder ser repetido deve ter SOP documentado como parte do Definition of Done

---

## User Interface Design Goals

### Overall UX Vision
Cockpit interno de pilotagem — não um produto para usuário final. Mauro deve entender o estado do SparkleOS em segundos, sem interpretar logs técnicos. A interface serve à clareza operacional e à excelência — construída para dar ao operador visibilidade total com mínimo de fricção.

### Key Interaction Paradigms
Leitura passiva (o sistema informa proativamente) com ações pontuais de decisão (Mauro aprova/rejeita/direciona). Não é ferramenta de execução — é painel de controle estratégico.

### Core Screens and Views
1. Dashboard do Sistema — estado geral em tempo real
2. Atividade dos Agentes — o que cada agente está fazendo e concluiu
3. Fila de Decisões — apenas o que requer Mauro, com contexto pronto
4. Painel do Núcleo Zenya — estado operacional sem acessar o n8n
5. Painel do Cérebro Coletivo — ciclo de aprendizado, DNA ativo
6. Rastreamento de Custos — custo por agente/operação vs. orçamento
7. Progresso de Épicos e Stories — o sistema sendo construído
8. Resumo de Sessão — o que aconteceu desde a última sessão de Mauro

### Accessibility
Não aplicável — uso interno, único usuário.

### Branding
Interno — sem requisitos de branding no MVP.

### Target Device and Platforms
A ser definida pelos agentes — sem restrição prévia. Deve ser a mais capaz para o propósito. WhatsApp como interface do sistema e Friday como assistente pessoal fora do escopo atual.

---

## Technical Assumptions

### Repository Structure
A definir pelos agentes. Sem preferência prévia — a escolha deve ser a que melhor serve a um sistema AI-native com múltiplos Núcleos e Órgãos crescendo de forma independente.

### Service Architecture
A definir pelos agentes. A decisão deve partir do que o sistema precisa ser, não do que existia antes. O sistema anterior (FastAPI em VPS) não é referência obrigatória.

### Testing Requirements
Compromisso de qualidade máxima — estratégia de testes definida pelos agentes conforme arquitetura escolhida. Nenhuma implementação entregue sem cobertura de testes adequada.

### Additional Technical Assumptions and Requests

- **Stack conhecida (base atual da Zenya):** ~15 fluxos n8n (mantidos no curto prazo, migração gradual), WhatsApp como canal de atendimento da Zenya, API Claude como modelo de linguagem principal (~$550/mês)
- **Capacidade de pesquisa — premissa obrigatória:** Agentes devem ter acesso a ferramentas de pesquisa quando necessário (EXA para web search, Context7 para documentação). A pesquisa é parte do processo, não exceção — especialmente quando Mauro não tem o conhecimento disponível
- **Ferramentas abertas:** MCPs, skills Claude, agentes customizados, qualquer biblioteca ou serviço que os agentes avaliarem como melhor para cada necessidade
- **AIOS como framework central** de orquestração — já instalado no projeto
- **Contexto de agentes** deve ser persistido (FR11) — solução técnica escolhida pelos agentes com ADR
- **ADR registry** (FR12) acessível a todos os agentes em qualquer sessão
- **Conhecimento de Mauro** para o sistema: co-criado diretamente com Mauro em sessão — docs do sistema anterior podem estar desatualizados e não devem ser copiados automaticamente
- **Isolamento de dados** de clientes Zenya é requisito não-negociável (NFR3)

---

## Epic List

| # | Épico | Objetivo |
|---|-------|----------|
| Epic 1 | **Fundação: Habitat, Processo e Arsenal** | Tudo que os agentes precisam para existir, operar e criar dentro do SparkleOS com excelência e rastreabilidade |
| Epic 2 | **Zenya Integrada** | Zenya como primeiro Núcleo formal do SparkleOS — inventariada, documentada, integrada e com processo de provisionamento executável |
| Epic 3 | **Cérebro Coletivo v1** | Primeiro ciclo funcional de aprendizado: captura → validação → aplicação mensurável, com arquitetura multi-fonte |
| Epic 4 | **Interface de Pilotagem v1** | Cockpit de Mauro: visibilidade total do SparkleOS sem precisar mergulhar em logs técnicos |

---

## Epic 1 — Fundação: Habitat, Processo e Arsenal

Estabelecer tudo que os agentes AIOS precisam para operar dentro do SparkleOS com excelência: infraestrutura técnica, AIOS configurado, ecossistema de ferramentas e pesquisa, persistência de contexto entre sessões, ADR registry, story lifecycle, protocolo de escalação e framework de SOPs. Sem este épico, nenhum outro pode ser construído com qualidade.

### Story 1.1 — Estrutura do Repositório SparkleOS
Como agente AIOS, quero um repositório com estrutura clara e documentada, para que cada artefato que criarmos tenha um lugar definido e rastreável desde o primeiro commit.

**Acceptance Criteria:**
1. Repositório criado com estrutura de pastas definida pelos agentes (docs, src, infra, stories, adrs, etc.)
2. README raiz documenta o propósito de cada diretório
3. `.gitignore` configurado adequadamente
4. Primeiro commit com estrutura base e AIOS configurado dentro do repositório
5. Estrutura suporta múltiplos Núcleos e Órgãos sem reorganização futura

### Story 1.2 — AIOS Operacional no SparkleOS
Como agente AIOS, quero estar configurado e operacional dentro do SparkleOS, para que possa criar stories, executar tasks e seguir o processo correto desde o início.

**Acceptance Criteria:**
1. AIOS instalado e configurado no contexto SparkleOS
2. Agentes ativados e funcionais (@dev, @qa, @architect, @pm, @sm, @po, @analyst)
3. Distinção clara documentada: agentes AIOS = construtores / agents dos Órgãos = workers (produto da construção)
4. Story lifecycle configurado: Draft → Ready → InProgress → InReview → Done
5. QA gates ativos — nenhuma story marcada Done sem PASS formal

### Story 1.3 — Persistência de Contexto dos Agentes
Como agente AIOS, quero persistir contexto de trabalho entre sessões, para que nenhuma decisão, raciocínio ou progresso se perca quando uma sessão termina.

**Acceptance Criteria:**
1. Mecanismo de persistência implementado e acessível a todos os agentes
2. Agente consegue retomar trabalho de sessão anterior sem reconstrução manual de contexto
3. Decisões em andamento, arquivos modificados e próximos passos são preservados
4. Mauro não precisa explicar contexto técnico que o agente deveria conhecer
5. Solução técnica documentada como ADR

### Story 1.4 — ADR Registry
Como agente AIOS, quero registrar decisões arquiteturais formalmente, para que todo time de IA atual e futuro saiba o que foi decidido, por quê, e o que foi descartado.

**Acceptance Criteria:**
1. Template de ADR definido e documentado
2. Localização dos ADRs clara e acessível a todos os agentes
3. Primeira ADR criada documentando a decisão de estrutura do repositório (Story 1.1)
4. Processo de criação de ADR integrado ao fluxo dos agentes
5. ADRs consultáveis por agentes em sessões futuras

### Story 1.5 — Ecossistema de Ferramentas e Pesquisa
Como agente AIOS, quero acesso configurado às ferramentas de pesquisa e MCPs necessários, para que possa buscar informação e tomar decisões fundamentadas mesmo quando Mauro não tem o conhecimento disponível.

**Acceptance Criteria:**
1. MCPs de pesquisa configurados e validados (EXA para web search, Context7 para documentação)
2. Protocolo documentado: quando e como usar pesquisa no processo de decisão
3. Agente executa pesquisa real e incorpora resultado como insumo documentado
4. Custo de operações de pesquisa rastreável
5. Ferramentas adicionais identificadas pelos agentes documentadas para configuração futura

### Story 1.6 — Protocolo de Escalação para Mauro
Como sistema SparkleOS, quero critérios claros de quando agir autonomamente vs. escalar para Mauro, para que ele seja acionado apenas quando genuinamente necessário.

**Acceptance Criteria:**
1. Critérios de escalação documentados: tipos de decisão que requerem Mauro vs. autonomia total
2. Protocolo de como apresentar decisão a Mauro: contexto suficiente, opções claras, recomendação
3. Fila de decisões pendentes estruturada (integra com Epic 4)
4. Decisões autônomas documentadas explicitamente
5. Protocolo testado com pelo menos um caso real durante o Epic 1

### Story 1.7 — Framework de SOPs
Como agente AIOS, quero um template e processo para documentar SOPs, para que todo processo repetível criado no SparkleOS tenha instruções claras de como replicá-lo.

**Acceptance Criteria:**
1. Template de SOP definido (estrutura mínima: objetivo, pré-requisitos, passos, resultado esperado, responsável)
2. Localização dos SOPs no repositório definida
3. Primeiro SOP criado documentando o próprio processo de criação de SOPs
4. Regra formal: toda story que cria processo repetível inclui SOP como AC obrigatório
5. SOPs consultáveis por agentes em qualquer sessão

### Story 1.8 — Rastreamento de Custo por Operação
Como Mauro, quero visibilidade do custo de cada tipo de operação dos agentes, para que decisões de uso de ferramentas tenham fundamento financeiro real.

**Acceptance Criteria:**
1. Custo por tipo de operação (pesquisa, geração de texto, embeddings) rastreado
2. Custo por agente discriminado
3. Agregação por período (diário, semanal, mensal)
4. Dados disponíveis para a Interface de Pilotagem (Epic 4)
5. SOP: como revisar e otimizar custos quando necessário

### Story 1.9 — Mapa de Capacidades dos Agentes
Como agente AIOS, quero um documento vivo com o mapa completo do time — quem existe, o que cada um faz, quais ferramentas e MCPs cada um pode usar — para que qualquer agente novo entre no sistema com contexto completo.

**Acceptance Criteria:**
1. Todos os agentes AIOS documentados com escopo, responsabilidades e ferramentas
2. MCPs e ferramentas disponíveis mapeados por agente
3. Distinção clara entre agentes construtores (AIOS) e agentes workers (Órgãos)
4. Documento atualizado automaticamente quando novo agente ou ferramenta é adicionado
5. Consultável por qualquer agente em qualquer sessão

### Story 1.10 — Base de Segurança e Isolamento
Como sistema SparkleOS, quero princípios de segurança definidos e base de isolamento implementada, para que dados de clientes da Zenya sejam protegidos desde o início e não como remediação posterior.

**Acceptance Criteria:**
1. Princípios de segurança documentados (o que proteger, como, quem tem acesso a quê)
2. Modelo de isolamento de dados por cliente definido (como dados de cliente A não chegam ao cliente B)
3. Base de isolamento implementada e validada
4. ADR documentando decisões de segurança
5. SOP: como onboarding de novo cliente respeita o isolamento definido

### Story 1.11 — Validação End-to-End da Fundação
Como time AIOS, quero validar que a fundação funciona de ponta a ponta antes de avançar para o Epic 2, para que não descobrimos que algo está quebrado quando a Zenya já estiver sendo integrada.

**Acceptance Criteria:**
1. Agente cria story via processo AIOS completo dentro do SparkleOS
2. Story passa por todo o lifecycle: Draft → Ready → InProgress → InReview → Done com QA PASS
3. Contexto persiste entre sessões: agente retoma trabalho sem reconstrução
4. ADR criada e consultável por agente diferente do que a criou
5. Custo da sessão rastreado e visível

---

## Epic 2 — Zenya Integrada

Inventariar, documentar e integrar formalmente os ~15 fluxos n8n da Zenya dentro do SparkleOS como primeiro Núcleo do sistema — com IP preservado, rastreabilidade completa, processo de provisionamento executável pelos agentes, e outputs formais definidos para alimentar outros sistemas.

### Story 2.1 — Inventário dos Fluxos n8n da Zenya
Como agente AIOS, quero um inventário completo e documentado dos ~15 fluxos n8n da Zenya, para que qualquer agente entenda o que existe antes de qualquer modificação.

**Acceptance Criteria:**
1. Todos os fluxos n8n mapeados com nome, propósito e dependências
2. Diagrama ou mapa de como os fluxos se conectam entre si
3. Fluxos categorizados por criticidade (o que quebra a Zenya se falhar)
4. Pontos de melhoria identificados mas não implementados (escopo de inventário)
5. SOP: como atualizar o inventário quando fluxos mudarem

### Story 2.2 — Preservação e Versionamento do IP da Zenya
Como sistema SparkleOS, quero o IP da Zenya preservado e versionado formalmente, para que a identidade da Zenya seja protegida e nunca perdida em uma atualização.

**Acceptance Criteria:**
1. Lore, personalidade e arquivos visuais da Zenya inventariados e localizados
2. Estrutura de versionamento definida (onde vive, como versionar)
3. Regra formal: mudanças no IP da Zenya requerem aprovação de Mauro (escalação obrigatória)
4. IP atual importado para o repositório SparkleOS com versão inicial tagueada
5. SOP: como atualizar o IP respeitando o processo de aprovação

### Story 2.3 — Integração Formal da Zenya como Núcleo
Como agente AIOS, quero a Zenya formalmente definida como Núcleo dentro do SparkleOS, para que ela deixe de ser sistema solto e tenha escopo, inputs, outputs e responsabilidades documentados.

**Acceptance Criteria:**
1. Zenya documentada como Núcleo: escopo, dependências, responsabilidades
2. Inputs formais definidos: o que alimenta a Zenya
3. Outputs formais definidos: o que a Zenya produz e para quem (Cérebro Coletivo, outros futuros Núcleos)
4. Conexão com a infraestrutura base (Epic 1) estabelecida e documentada
5. ADR registrando decisões de integração

### Story 2.4 — Processo de Provisionamento de Novo Cliente Zenya
Como agente AIOS, quero um processo formal e executável de provisionamento de novos clientes na Zenya, para que clonar e configurar a Zenya para um novo cliente não dependa de Mauro.

**Acceptance Criteria:**
1. Processo de clonagem dos fluxos n8n documentado passo a passo
2. Checklist de configuração por cliente (variáveis, endpoints, personalização básica)
3. Processo testado com simulação de cliente existente
4. SOP completo: como provisionar novo cliente do zero
5. Executável por agente sem intervenção de Mauro (exceto aprovações de IP)

### Story 2.5 — Protocolo de Melhoria Incremental dos Fluxos
Como agente AIOS, quero um protocolo claro de como melhorar fluxos n8n da Zenya de forma incremental, para que modificações sejam seguras, rastreáveis e nunca quebrem clientes ativos.

**Acceptance Criteria:**
1. Protocolo documentado: como identificar, propor e executar melhoria em fluxo existente
2. Ambiente de teste definido — nenhuma mudança vai direto para produção
3. Rollback documentado: como reverter mudança se algo quebrar
4. Rastreabilidade: toda melhoria tem story AIOS correspondente
5. SOP: melhoria incremental de fluxo n8n — replicável para qualquer modificação futura

### Story 2.6 — Baseline de Performance da Zenya
Como sistema SparkleOS, quero métricas base da performance atual da Zenya estabelecidas, para que qualquer melhoria futura tenha referência mensurável de impacto.

**Acceptance Criteria:**
1. Métricas definidas: tempo de resposta, taxa de sucesso dos fluxos, volume de atendimentos, erros recorrentes
2. Baseline coletado a partir da operação real da Zenya
3. Dados disponíveis para o Cérebro Coletivo (Epic 3) como referência de melhoria
4. Dashboard de performance preparado para integração com Epic 4
5. SOP: como atualizar o baseline periodicamente

### Story 2.7 — Isolamento de Dados por Cliente na Zenya
Como sistema SparkleOS, quero o isolamento de dados por cliente implementado concretamente na Zenya, para que NFR3 seja realidade operacional e não só princípio documentado.

**Acceptance Criteria:**
1. Auditoria do estado atual: como dados de clientes estão separados hoje
2. Gaps de isolamento identificados e corrigidos
3. Validação: dados do cliente A não acessíveis no contexto do cliente B
4. ADR documentando modelo de isolamento implementado
5. SOP: como validar isolamento ao provisionar novo cliente

### Story 2.8 — Base de Conhecimento Operacional da Zenya
Como Cérebro Coletivo, quero o conhecimento operacional da Zenya inventariado e formalizado, para que a matéria-prima do aprendizado esteja estruturada antes do pipeline de captura ser ativado.

**Acceptance Criteria:**
1. Conhecimento operacional inventariado: FAQs, scripts, casos de uso, padrões de atendimento
2. Conhecimento categorizado por tipo e relevância
3. Estrutura compatível com o modelo de dados do Cérebro Coletivo (Epic 3)
4. Fontes de conhecimento contínuo identificadas (onde novos dados surgem)
5. SOP: como adicionar novo conhecimento operacional ao inventário

### Story 2.9 — Protocolo de Erro e Fallback da Zenya
Como sistema SparkleOS, quero um protocolo formal de tratamento de erros na Zenya, para que falhas de fluxo sejam detectadas, tratadas automaticamente quando possível, e escaladas para Mauro apenas quando necessário.

**Acceptance Criteria:**
1. Tipos de erro mapeados (fluxo travado, timeout, erro de integração, falha de autenticação)
2. Resposta automática definida para cada tipo: retry, fallback, notificação
3. Critério de escalação para Mauro definido (gravidade, impacto em cliente ativo)
4. Protocolo integrado ao sistema de monitoramento (Epic 4)
5. SOP: o que fazer em cada tipo de incidente

---

## Epic 3 — Cérebro Coletivo v1

Implementar o primeiro ciclo funcional do Cérebro Coletivo: captura de insights da operação → validação de qualidade → aplicação mensurável. Arquitetura projetada desde o início para múltiplas fontes de conhecimento (operacional, pesquisa dos agentes, externo trazido por Mauro).

### Story 3.1 — Arquitetura do Cérebro Coletivo
Como agente AIOS, quero a arquitetura do Cérebro definida e documentada antes de qualquer implementação, para que o que construirmos suporte múltiplas fontes e não precise ser refeito ao escalar.

**Acceptance Criteria:**
1. Modelo de dados definido: como insights são estruturados, indexados e recuperados
2. Arquitetura de fontes: operacional (Zenya), pesquisa (agentes), externo (Mauro) — todas suportadas desde o design
3. Mecanismo de canonicalização definido: mesmo conceito não cria múltiplas entradas fragmentadas
4. ADR documentando decisões arquiteturais do Cérebro
5. SOP: como adicionar nova fonte de dados ao Cérebro no futuro

### Story 3.2 — Captura de Insights da Zenya
Como Cérebro Coletivo, quero capturar automaticamente insights gerados pela operação da Zenya, para que o conhecimento acumulado no atendimento alimente o sistema sem intervenção manual.

**Acceptance Criteria:**
1. Pipeline de captura conectado aos outputs formais do Núcleo Zenya (Story 2.3)
2. Insights categorizados automaticamente (padrões de objeção, comportamento, falhas recorrentes)
3. Canonicalização aplicada — mesmo conceito não cria entradas duplicadas
4. Rastreabilidade: cada insight tem origem identificada (qual fluxo, qual cliente, qual período)
5. Volume mínimo validado: sistema captura insights reais da operação corrente

### Story 3.3 — Validação de Qualidade do Conhecimento
Como Cérebro Coletivo, quero um mecanismo de validação antes de qualquer aplicação de insight, para que o Cérebro não acumule ruído que contamina decisões futuras.

**Acceptance Criteria:**
1. Critérios de qualidade definidos: volume mínimo de evidências, consistência, relevância
2. Insights abaixo do threshold de qualidade marcados como "em observação", não descartados
3. Processo de promoção: insight em observação → validado → aplicável após evidência suficiente
4. Auditoria: qualidade média do Cérebro mensurável por período
5. SOP: como revisar e promover insights em observação

### Story 3.4 — Mecanismo de Aplicação de Insights
Como Cérebro Coletivo, quero aplicar insights validados de forma mensurável na operação da Zenya, para que o loop de aprendizado seja completo — captura sem aplicação não é Cérebro, é arquivo.

**Acceptance Criteria:**
1. Pelo menos um tipo de insight tem aplicação automática definida e implementada
2. Aplicação gera melhoria mensurável comparada ao baseline (Story 2.6)
3. Agentes podem consultar o Cérebro para fundamentar decisões com conhecimento acumulado
4. Auditoria: cada aplicação rastreável ao insight que a originou
5. SOP: como definir nova aplicação para novos tipos de insight

### Story 3.5 — Interface de Consulta do Cérebro para Agentes
Como agente AIOS, quero uma interface padronizada para consultar o Cérebro, para que qualquer agente recupere conhecimento relevante antes de decidir sem saber onde o dado está armazenado.

**Acceptance Criteria:**
1. Interface de consulta padronizada acessível a todos os agentes
2. Busca por relevância: agente descreve o que precisa, Cérebro retorna o mais relevante
3. Resultado de consulta inclui fonte e nível de confiança do conhecimento
4. Tempo de resposta adequado para uso em fluxo de trabalho dos agentes
5. SOP: como e quando agentes devem consultar o Cérebro antes de decidir

### Story 3.6 — Ingestão de Conhecimento Externo
Como agente AIOS ou Mauro, quero adicionar conhecimento externo ao Cérebro, para que o sistema aprenda além dos dados operacionais da Zenya.

**Acceptance Criteria:**
1. Agentes podem ingerir resultado de pesquisa diretamente no Cérebro após validação
2. Mauro pode adicionar conhecimento externo de forma simples (documentos, referências, contexto)
3. Conhecimento externo convive com conhecimento operacional sem conflito ou duplicação
4. Fonte de cada item identificada (operacional / pesquisa / Mauro)
5. SOP: como ingerir cada tipo de fonte externa

### Story 3.7 — Ciclo de Vida do Conhecimento
Como Cérebro Coletivo, quero um mecanismo para gerenciar o ciclo de vida do conhecimento armazenado, para que o Cérebro não cresça indefinidamente com dados obsoletos que degradam a qualidade.

**Acceptance Criteria:**
1. Estados de ciclo de vida definidos: ativo, em revisão, deprecado, arquivado
2. Critérios de transição entre estados documentados (por tempo, por contradição, por atualização)
3. Conhecimento deprecado não é deletado — arquivado com histórico preservado
4. Processo de revisão periódica automatizado ou semi-automatizado
5. SOP: como revisar e deprecar conhecimento desatualizado

### Story 3.8 — DNA de Mauro
Como agente AIOS, quero filtros de raciocínio baseados nos princípios de Mauro ativos no sistema, para que os agentes raciocinem *como* Mauro — não só saibam *sobre* ele.

**Acceptance Criteria:**
1. Sessão de co-criação com Mauro realizada para extrair princípios, heurísticas e filtros de raciocínio
2. DNA estruturado em camadas (filosofia, modelo mental, heurísticas, frameworks) — co-criado, não extraído de docs antigos
3. Filtros de raciocínio aplicáveis pelos agentes antes de decisões relevantes
4. DNA consultável e atualizado via novas sessões com Mauro (conhecimento vivo, não estático)
5. ADR documentando como o DNA é mantido e atualizado

### Story 3.9 — Dashboard do Cérebro (coordenado com Epic 4)
Como Mauro, quero visibilidade do estado do Cérebro na Interface de Pilotagem, para que eu saiba o que o sistema está aprendendo e se o ciclo de melhoria está funcionando.

**Acceptance Criteria:**
1. Volume de insights capturados por período e por fonte visível
2. Insights aplicados e impacto mensurável vs. baseline visível
3. Estado do ciclo: captura → validação → aplicação com status claro
4. DNA de Mauro: filtros ativos e última atualização visíveis
5. Saúde do Cérebro: capacidade, qualidade média, itens pendentes de revisão

---

## Epic 4 — Interface de Pilotagem v1

Construir o cockpit de Mauro: visibilidade total do SparkleOS sem precisar mergulhar em logs técnicos. Construído sobre dados reais produzidos pelos Epics 1, 2 e 3.

### Story 4.1 — Dashboard do Sistema
Como Mauro, quero uma visão geral do SparkleOS em tempo real, para que eu entenda o estado do sistema em segundos sem abrir logs ou perguntar para os agentes.

**Acceptance Criteria:**
1. Estado geral visível: agentes ativos, tarefas em andamento, entregas recentes
2. Saúde das integrações: n8n, MCPs, APIs — indicadores claros de status
3. Alertas ativos destacados com contexto suficiente para entender sem ser técnico
4. Atualização em tempo real ou próximo disso
5. SOP: o que Mauro faz quando vê cada tipo de alerta

### Story 4.2 — Atividade e Rastreabilidade dos Agentes
Como Mauro, quero ver o que cada agente está fazendo e o que concluiu, para que eu tenha confiança de que o sistema está operando sem precisar supervisionar cada passo.

**Acceptance Criteria:**
1. Atividade atual de cada agente visível (task em execução, story associada)
2. Histórico de entregas rastreável (story → implementação → resultado)
3. Decisões autônomas registradas e consultáveis
4. ADRs referenciados a partir das atividades relevantes
5. Nenhuma ação de agente é opaca — tudo rastreável

### Story 4.3 — Fila de Decisões de Mauro
Como Mauro, quero uma fila consolidada de tudo que requer minha decisão, para que eu processe o que é meu sem ser inundado por operacional.

**Acceptance Criteria:**
1. Apenas itens que genuinamente requerem Mauro aparecem (protocolo da Story 1.6)
2. Cada item tem contexto suficiente, opções claras e recomendação do sistema
3. Mauro consegue decidir em segundos sem reconstruir contexto
4. Itens resolvidos arquivados com decisão registrada
5. Alertas para itens críticos parados há mais de X horas

### Story 4.4 — Painel do Núcleo Zenya
Como Mauro, quero visibilidade do estado operacional da Zenya, para que eu saiba se o primeiro Órgão está saudável e entregando sem precisar acessar o n8n diretamente.

**Acceptance Criteria:**
1. Fluxos ativos e status de cada um visível
2. Volume de atendimentos por período e por cliente
3. Alertas de falha com contexto (o que falhou, impacto, protocolo ativado)
4. Performance vs. baseline (Story 2.6) visível
5. Acesso rápido ao protocolo de erro (Story 2.9) quando alerta ativo

### Story 4.5 — Painel do Cérebro Coletivo
Como Mauro, quero visibilidade do estado do Cérebro, para que eu saiba o que o sistema está aprendendo e se o ciclo de melhoria está funcionando.

**Acceptance Criteria:**
1. Volume de insights capturados por período e por fonte
2. Insights aplicados e impacto mensurável vs. baseline
3. Estado do ciclo: captura → validação → aplicação com status claro
4. DNA de Mauro: filtros ativos e última atualização
5. Saúde do Cérebro: capacidade, qualidade média, itens em ciclo de vida

### Story 4.6 — Rastreamento de Custos
Como Mauro, quero ver o custo operacional do sistema por período e por agente/operação, para que decisões de uso de ferramentas tenham visibilidade financeira real.

**Acceptance Criteria:**
1. Custo total por período visível (diário, semanal, mensal)
2. Custo por agente e por tipo de operação discriminado
3. Projeção vs. orçamento (~$550/mês) com alerta quando próximo do limite
4. Operações mais custosas identificadas para otimização
5. SOP: o que fazer quando custo está acima do esperado

### Story 4.7 — Progresso de Épicos e Stories
Como Mauro, quero ver o que está sendo construído no SparkleOS, para que eu acompanhe o crescimento do sistema — não só sua operação.

**Acceptance Criteria:**
1. Épicos ativos com progresso percentual visível
2. Stories por status (Draft, Ready, InProgress, InReview, Done) em cada épico
3. Bloqueios e dependências identificados visualmente
4. Histórico de épicos concluídos consultável
5. Ritmo de entrega mensurável (stories entregues por período)

### Story 4.8 — Resumo de Sessão para Mauro
Como Mauro, quero um resumo inteligente quando abro o sistema após um período ausente, para que eu retome o contexto rapidamente sem reconstruir o que aconteceu.

**Acceptance Criteria:**
1. Resumo gerado automaticamente ao início de sessão de Mauro
2. Conteúdo: o que aconteceu desde a última sessão, decisões autônomas tomadas, o que precisa de Mauro
3. Formato conciso — Mauro processa em menos de 2 minutos
4. Itens que requerem Mauro linkados diretamente à Fila de Decisões (Story 4.3)
5. SOP: como o sistema determina o que é relevante para incluir no resumo

---

## Checklist Results Report

| # | Critério | Status | Observação |
|---|---------|--------|------------|
| 1 | Goals claros e mensuráveis | ✅ | 6 goals definidos com métricas implícitas |
| 2 | Problema bem articulado | ✅ | Background Context com causa raiz clara |
| 3 | Usuários definidos com necessidades | ✅ | Mauro (primário) e clientes finais (secundário via Órgãos) |
| 4 | Requisitos funcionais completos | ✅ | FR1-FR15 cobrindo todos os aspectos do sistema |
| 5 | Requisitos não-funcionais definidos | ✅ | NFR1-NFR10 incluindo processo, segurança, custo e integridade |
| 6 | Épicos sequenciais e lógicos | ✅ | 1→2→3→4 com dependências respeitadas |
| 7 | Stories com critérios testáveis | ✅ | Cada story tem 5 ACs mensuráveis |
| 8 | SOPs previstos em stories relevantes | ✅ | Incluídos como AC obrigatório em stories que criam processos repetíveis |
| 9 | Restrições e premissas documentadas | ✅ | Technical Assumptions com stack aberta e premissas firmes |
| 10 | Sem escopo fantasma | ✅ | FR14 garante rastreabilidade story → código |
| 11 | Princípio AI-native preservado | ✅ | AIOS como construtor em todos os épicos |
| 12 | Lições do sistema anterior incorporadas | ✅ | Anti-Frankenstein explícito em Goals e NFR9 |
| 13 | Arquitetura de Núcleos documentada | ✅ | Padrão Órgão → Núcleo definido no Background e Epic 2 |
| 14 | DNA de Mauro co-criado, não extraído | ✅ | Story 3.8 especifica sessão direta com Mauro |

**Resultado: APPROVED**

---

## Next Steps

### UX Expert Prompt
`@ux-design-expert` — O SparkleOS tem uma Interface de Pilotagem interna (Epic 4) para um único usuário operacional (Mauro). Não é produto público. Revise o PRD em `docs/prd.md` e crie especificação UX para o cockpit: dashboard do sistema, atividade dos agentes, fila de decisões de Mauro, painéis de Zenya e Cérebro, rastreamento de custos, progresso de épicos e resumo de sessão. Priorize clareza operacional e mínima fricção. Plataforma sem restrição prévia — escolha a mais adequada ao propósito.

### Architect Prompt
`@architect` — O SparkleOS é um sistema operacional AI-native construído do zero. Revise o PRD em `docs/prd.md` e o Project Brief em `docs/brief.md`. Defina a arquitetura completa: stack, estrutura de repositório, mecanismo de persistência de contexto de agentes (FR11), ADR registry (FR12), modelo de isolamento de dados por cliente (NFR3), Cérebro Coletivo v1 com suporte a múltiplas fontes (FR15), e integração com n8n para a Zenya (FR3-FR4). Sem restrições de stack — pesquise e escolha o que for mais capaz para cada necessidade. Documente todas as decisões como ADRs.

---

*Produzido via processo AIOS — create-doc (prd-tmpl) — Interactive Mode*
*Sessão: 2026-04-11 | Agente: Morgan (@pm)*
