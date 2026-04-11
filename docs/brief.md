# Project Brief: SparkleOS
**Versão:** 1.0
**Data:** 2026-04-11
**Autor:** Mauro (fundador) + Orion (@aiox-master)
**Status:** Aprovado — pronto para PRD

> **Princípio central deste documento:**
> Todo o material histórico referenciado nas Appendices serve como **aprendizado**, não como base para construir. O sistema anterior foi construído com substância técnica real mas sem ordem arquitetural clara. SparkleOS começa do zero — com o AIOS construindo da forma certa, desde o primeiro passo.

---

## Executive Summary

SparkleOS é um sistema operacional AI-native — não um produto que clientes veem, mas a infraestrutura onde agentes de IA vivem, crescem e operam. É composto por quatro camadas: a **Infraestrutura** (esqueleto técnico), o **Cérebro Coletivo** (memória e inteligência acumulada), os **Órgãos** (grupos de agentes especialistas em cada área), e a **Interface de Pilotagem** (onde Mauro comanda com clareza total). O primeiro órgão operacional é a **Zenya** — atendente IA no WhatsApp com lore, personalidade e IP próprio, que funciona como interface entre clientes e empresas. SparkleOS não é agência nem SaaS convencional: é IA como serviço, construída no ritmo da IA, não do ser humano.

A direção inicial parte da visão de Mauro como fundador — mas um princípio central do sistema é que ele deve operar **além do viés humano**: executar no pleno potencial da IA, com processos, decisões e cadência que o AIOS habilita em capacidade máxima. O humano define o destino; o sistema encontra o melhor caminho.

---

## Problem Statement

Pequenas e médias empresas precisam de presença inteligente e atendimento ágil, mas não têm estrutura para montar operações de IA robustas. As soluções existentes são fragmentadas: um chatbot aqui, uma automação ali — sem integração, sem memória, sem coordenação.

Mas o problema **prioritário** é interno: hoje já é possível usar IA para implementar, entregar e gerar ideias com velocidade — o que falta é a **infraestrutura que sustenta isso com qualidade e consistência**. Sem SparkleOS, a Sparkle não é genuinamente AI-native: é uma operação manual com ferramentas de IA. O sistema precisa existir primeiro para que o conceito seja real — e para que cada serviço entregue (Zenya, tráfego pago, conteúdo) opere com o padrão que só uma infraestrutura coordenada consegue garantir.

---

## Proposed Solution

SparkleOS é um sistema operacional AI-native composto por quatro camadas integradas.

**Infraestrutura** — O esqueleto técnico que conecta ferramentas, fluxos (n8n), modelos de linguagem e sistemas externos. Sem restrições de stack: novas ferramentas, MCPs, skills Claude, agentes customizados, qualquer integração que o sistema exigir — o sistema é construído com o que for mais capaz, não com o que for mais familiar.

**Cérebro Coletivo** — Memória acumulada e inteligência compartilhada entre todos os agentes. O princípio central é o **loop de aprendizado contínuo**: o conhecimento gerado durante a operação (padrões identificados no atendimento, comportamentos de clientes, insights de performance) vira insumo automático para melhoria do próprio sistema. Ex: Zenya atende clientes de uma clínica odontológica e identifica que preço é sempre a primeira objeção para aparelho ortodôntico — esse insight alimenta o Cérebro e melhora scripts, segmentações e respostas futuras. Inspirado no conceito de Mega Brain, implementado progressivamente conforme o sistema amadurece.

**Órgãos** — Grupos de agentes especialistas por domínio (atendimento, tráfego pago, conteúdo, IP, etc.). Cada órgão opera com autonomia no seu escopo e se conecta aos demais via Cérebro e Infraestrutura. Zenya é o primeiro órgão ativo.

**Interface de Pilotagem** — O cockpit de Mauro: define direção, monitora o sistema, toma decisões estratégicas. O sistema executa; Mauro pilota.

O diferencial é a **orquestração entre camadas**, operando no ritmo e potencial máximo da IA.

---

## Target Users

SparkleOS tem dois perfis de usuário distintos com necessidades fundamentalmente diferentes.

**Usuário Primário: Mauro (Operador/Fundador)**
- Empreendedor AI-native construindo uma operação escalável baseada em IA
- Único humano pilotando o sistema — sem equipe operacional humana no curto prazo
- Precisa de visibilidade total do sistema, capacidade de definir direção estratégica e confiança de que o sistema executa sem supervisão constante
- Objetivo: pilotar com clareza, não operar com esforço
- Métrica de sucesso: tempo gasto em operação manual tende a zero; qualidade e volume de entrega crescem sem proporção com esforço humano

**Usuário Secundário: Clientes Finais (via Órgãos)**
- PMEs que contratam serviços Sparkle (atendimento via Zenya, tráfego pago, etc.)
- Interagem com os Órgãos, não com o SparkleOS diretamente — **o sistema é invisível para eles**
- Objetivo: resultado do serviço contratado (leads, atendimento, conversão)
- Métrica de sucesso: KPIs do serviço entregue (taxa de resposta, conversão, custo por lead)

SparkleOS é algo interno da Sparkle: onde soluções são desenvolvidas, pesquisadas, melhoradas e entregues. Não é um produto que se vende — é a infraestrutura que torna possível tudo que se vende.

---

## Goals & Success Metrics

**Objetivo Primário — O Playground dos Agentes:**
O primeiro objetivo do SparkleOS é ser o **ambiente onde os agentes AIOS vivem e criam tudo que vai existir no sistema** — de forma inteligente e o mais autônoma possível, seguindo o conceito de orquestração. O sistema não é construído por Mauro manualmente: é construído pelos agentes, dentro do próprio SparkleOS, usando o AIOS em plena capacidade. Como os funcionários de uma grande empresa estruturando seus próprios departamentos antes de começar a operar.

**Objetivos de Negócio:**
- Infraestrutura estável como habitat dos agentes AIOS (o sistema que constrói o sistema)
- Zenya operando com qualidade como primeiro Órgão ativo e prova de conceito
- Cérebro Coletivo com primeiro ciclo de loop de aprendizado funcional
- Base técnica que suporta novos Órgãos sem reengenharia

**Métricas de Sucesso:**
- Agentes AIOS conseguem pesquisar, implementar e entregar dentro do SparkleOS sem intervenção manual de Mauro
- Razão entregas/esforço humano cresce progressivamente (mais entrega, mesma ou menor pilotagem)
- Novo serviço/órgão pode ser adicionado sem reengenharia da base
- Zenya: taxa de resposta, volume de atendimentos autônomos, qualidade de atendimento
- Cérebro: insights gerados por ciclo → aplicados → melhoria mensurável

---

## MVP Scope

**Lição da Tentativa Anterior:**
Uma execução anterior tentou construir runtime + Cérebro + Órgãos + Interface simultaneamente, incluindo deploy em VPS, de forma não orquestrada. O resultado foi um sistema parcialmente construído, sem ordem clara, onde a necessidade do runtime em si nunca foi validada. Esta lição informa o MVP: **estrutura antes de deploy, ordem antes de velocidade.**

**Core Features — Must Have:**

- **Definição da estrutura pelos agentes** — Os agentes AIOS definem como serão as áreas onde vão trabalhar: processos, ferramentas, integrações, responsabilidades. O sistema começa pelos agentes estruturando o próprio ambiente
- **Infraestrutura base** — Ambiente técnico mínimo onde os agentes operam (a questão do runtime/VPS será avaliada pelos agentes, não assumida como requisito)
- **Zenya integrada** — Os 15 fluxos n8n organizados, documentados e formalmente dentro do SparkleOS
- **AIOS em operação** — Agentes capazes de criar, pesquisar e implementar dentro do sistema de forma autônoma
- **Primeiro ciclo de Cérebro** — Mecanismo básico de captura de insights da operação
- **Interface de Pilotagem v1** — Visibilidade mínima para Mauro acompanhar o sistema

**Fora do Escopo do MVP:**
- Novos Órgãos além de Zenya (tráfego pago, conteúdo, outros IPs)
- Cérebro em versão avançada
- Produção de conteúdo, IPs adicionais, personagens além de Zenya
- Decisões de infraestrutura de deploy (VPS, cloud) — avaliadas pelos agentes no processo
- Head Agents por Órgão (direção em exploração, não MVP)

**Critério de Sucesso do MVP:**
Os agentes AIOS conseguem estruturar e operar dentro do SparkleOS de forma autônoma, e Zenya funciona com qualidade dentro dessa estrutura — tudo ordenado, conectado e com visibilidade para Mauro.

---

## Post-MVP Vision

**Fase 2 — Órgãos em Expansão:**
- Órgão de Tráfego Pago operacional dentro do SparkleOS
- Órgão de Conteúdo — produção com Zenya como personagem/IP
- Desenvolvimento de novos IPs e personagens além de Zenya
- Cérebro Coletivo evoluindo para versão mais sofisticada

**Direção Arquitetural em Exploração — Head + Squad:**
Cada Órgão pode evoluir para um modelo de **Head Agent** orquestrando squads de agentes especialistas. O Head seria responsável por coordenar workflows, tasks e entregas do Órgão — com o output de um Órgão funcionando como input de outro. Ex: Head de Onboarding coordena um squad que entrega o cliente pronto para o Head de Atendimento. O AIOS já cobre grande parte dessa estrutura de orquestração — o design exato será definido pelos agentes durante a construção do sistema, não antecipado aqui.

**Visão de 1-2 Anos:**
SparkleOS com múltiplos Órgãos operando simultaneamente, cada um com sua estrutura de agentes, conectados via Cérebro e Infraestrutura. Mauro pilota no estratégico; o sistema cria, entrega e aprende de forma autônoma.

**Oportunidades de Expansão:**
- Soluções com narrativa, lore e storytelling como diferencial competitivo
- Especialistas em prompts como produto/serviço
- IPs com vida própria — personagens além do atendimento
- Licenciamento do modelo SparkleOS para outros operadores AI-native (exploratório)

---

## Technical Considerations

**Stack e Restrições:**
- **Sem restrições** para novas soluções — stack definida pelos agentes com base no que for mais capaz
- Para Zenya especificamente: manutenção via n8n no curto prazo — clone de workflows existentes como base, melhorias incrementais (node a node, fluxo a fluxo) quando necessário. Agentes têm acesso para operar isso
- Novas soluções (fora da Zenya) podem ser construídas diretamente em código desde o início
- Direção natural: reduzir dependência do n8n progressivamente. Zenya migra gradualmente conforme o sistema comprova que cobre os recursos que ela hoje usa no n8n

**Base Existente:**
- ~15 fluxos n8n compondo a Zenya — ponto de partida, não limitação
- Arquivos de referência visual, lore e personalidade da Zenya como IP a preservar e versionar

**Arquitetura:**
- Runtime/VPS: necessidade a ser avaliada pelos agentes (não assumida)
- AIOS como framework central de orquestração
- Integrações: WhatsApp, modelos de linguagem, ferramentas de memória/Cérebro
- Segurança: Zenya lida com dados de clientes de terceiros — privacidade e isolamento por cliente é requisito

**Ferramentas abertas:**
- Novas skills Claude, MCPs, n8n (base atual), agentes customizados — qualquer integração que o sistema exigir

---

## Constraints & Assumptions

**Restrições:**
- **Orçamento:** Principal custo atual é o plano Claude (~$550/mês) com limite generoso para o uso previsto. Modelo bootstrapped/lean — decisões de custo avaliadas pelos agentes com critério
- **Time:** Mauro como único humano pilotando — sistema construído para operar sem equipe humana adicional no curto prazo
- **Técnicas:** Zenya mantida em n8n no curto prazo; migração gradual conforme o sistema amadurece
- **Legado:** 15 fluxos n8n existentes preservados e integrados, não descartados

**Premissas-Chave:**
- O AIOS em plena capacidade constrói e evolui o SparkleOS de forma autônoma
- Os agentes, com ambiente correto, tomam decisões técnicas melhores que as tomadas manualmente
- Zenya como primeiro Órgão é suficiente para validar a arquitetura completa
- O Cérebro Coletivo, mesmo básico, gera valor mensurável no primeiro ciclo
- Ausência de restrição de stack é vantagem — agentes escolhem a melhor ferramenta para cada problema

---

## Risks & Open Questions

**Riscos Principais:**
- **Complexidade sem estrutura** — Repetir o erro da tentativa anterior: construir partes do sistema de forma desordenada sem arquitetura clara primeiro. *Mitigação: AIOS define estrutura antes de implementar*
- **Dependência de n8n além do planejado** — Zenya pode se provar mais difícil de migrar do que o esperado se fluxos estiverem muito acoplados. *Mitigação: mapeamento completo dos 15 fluxos como primeira tarefa*
- **Cérebro sem loop real** — Capturar insights sem mecanismo de aplicação vira acúmulo de dados sem valor. *Mitigação: definir ciclo mínimo de feedback antes de implementar coleta*
- **Autonomia dos agentes sem visibilidade** — Sistema operando de forma opaca para Mauro, sem clareza do que está sendo feito. *Mitigação: Interface de Pilotagem v1 como requisito do MVP, não opcional*
- **Escopo crescente** — Visão rica do sistema pode puxar implementação para além do MVP. *Mitigação: AIOS com autoridade para bloquear desvios de escopo*

**Perguntas em Aberto:**
- Runtime/VPS: necessário? Em que momento? Qual critério para decidir?
- Qual o mecanismo mínimo viável do Cérebro Coletivo para o MVP?
- Como o IP da Zenya (lore, personalidade, arquivos visuais) é preservado e versionado no sistema?
- Head Agents por Órgão: quando faz sentido implementar essa estrutura?
- Quais MCPs e ferramentas os agentes vão precisar no primeiro ciclo de operação?

**Áreas para Pesquisa:**
- Implementações de memória persistente para agentes com loop de aprendizado
- Estratégias de migração gradual de n8n para código
- Mecanismos de canonicalização de entidades e Narrative Synthesis (referência: Mega Brain)

---

## Appendices

### A. Research Summary — Referências Conceituais e Históricas

> *Usadas como aprendizado e inspiração. Não como regras ou base para construir.*

**Mega Brain (Tiago Finch) — Mecanismo de referência:**
Sistema de memória persistente e ativa construído sobre Claude Code. Mecanismos-chave que inspiram o Cérebro Coletivo do SparkleOS:
- **Canonicalização de entidades** — normaliza nomes e conceitos antes de indexar, evitando fragmentação do conhecimento
- **Narrative Synthesis** — constrói narrativas cronológicas por entidade em vez de armazenar chunks isolados
- **DNA Extraction** — classifica conhecimento em 6 camadas (Filosofia, Modelo Mental, Heurísticas, Frameworks, Metodologias, Dilemas) e transforma em skills acionáveis
- **Graph HAP** — conexões não-óbvias entre entidades além da busca vetorial semântica
- **Observer Pattern** — geração automática de agentes por threshold de menções
- **Conclave** — múltiplos agentes deliberando em paralelo com divergência rastreável

*Diferencial da Sparkle vs. Finch (aprendizado do sistema anterior): multi-tenancy nativo, runtime 24/7 em VPS, e Zenya como produto de entrega com receita real. O modelo Finch é pessoal e local — o modelo Sparkle é plataforma e cloud.*

**Sistema anterior (Sparkle AIOX) — O que foi construído e o que foi aprendido:**
Brownfield Audit de 2026-04-07 documenta o que existia antes do SparkleOS:
- Runtime FastAPI em VPS com 146 módulos Python, múltiplos crons e scheduler
- Brain com pgvector funcional, embeddings, busca semântica, multi-tenancy por cliente
- Personagem Friday como interface WhatsApp com briefings proativos
- Character state, Observer Pattern (Estágio 1), Conclave (design documentado)
- Portal operacional com 9 stories deployed

*Lição central: o sistema teve substância técnica real mas foi construído sem ordem arquitetural clara — peças construídas em paralelo sem estrutura unificando tudo. SparkleOS começa com este aprendizado como insumo, não como legado a carregar ou replicar.*

**Aria Synthesis + Conclave Final (2026-04-01):**
Análise arquitetural produzida pelos agentes identificando gaps críticos e recomendações. Disponíveis como referência durante o planejamento arquitetural do SparkleOS — não como spec a seguir.

### C. References

| Documento | Localização | Tipo |
|-----------|------------|------|
| Mega Brain — mecanismo documentado | `docs/brain/dna-finch-mechanism.md` (Sparkle AIOX) | Referência conceitual |
| Análise comparativa Sparkle vs. Finch | `docs/brain/aria-synthesis-plan.md` (Sparkle AIOX) | Análise arquitetural |
| Decisões arquiteturais Sprint 9 | `docs/brain/conclave-synthesis-final.md` (Sparkle AIOX) | Decisões técnicas anteriores |
| Inventário conformidade AIOS | `docs/analysis/aios-brownfield-audit-2026-04.md` (Sparkle AIOX) | Audit do sistema anterior |
| Transcrição live Mega Brain (Tiago Finch) | `transcript_chunk_00-28.txt` (Desktop) | Fonte primária do conceito |

---

## Next Steps

**Ações Imediatas:**
1. Iniciar criação do PRD derivado deste Brief (`*create-doc prd`)
2. @architect conduz discovery arquitetural: definição das 4 camadas do SparkleOS e como se conectam tecnicamente — do zero, guiado pelo AIOS
3. @analyst avalia mecanismo mínimo viável do Cérebro Coletivo com base nos aprendizados (não na implementação anterior)
4. Mapear os 15 fluxos n8n da Zenya — inventário completo como base para integração

**PM Handoff:**
Este Project Brief fornece o contexto fundacional do SparkleOS. O próximo passo é entrar em **PRD Generation Mode** — trabalhar seção por seção para traduzir esta visão em requisitos funcionais, não-funcionais e critérios de aceite que guiarão stories e épicos de desenvolvimento. O AIOS constrói; Mauro pilota.

---

*Produzido via processo AIOS — create-doc (project-brief-tmpl) — Interactive Mode*
*Sessão: 2026-04-11 | Agente: Orion (@aiox-master)*
