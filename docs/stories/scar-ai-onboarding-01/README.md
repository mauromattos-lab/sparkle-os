# Story Scar-AI-01 — Onboarding do tenant GuDesignerPro (Scar AI) no core Zenya

**Status:** Ready — refinada pelo @sm em 2026-04-21. Pronta para `@dev *develop-story`
**Owner:** @pm criou · @po validou · @sm refinou · @dev implementa
**Tenant:** #4 da Zenya (após Zenya Prime, HL Importados, PLAKA)

**Executor Assignment** (Projeto Bob):
- `executor: @dev`
- `quality_gate: @architect`
- `quality_gate_tools: [coderabbit, typescript-check, vitest]`

**Complexity:** M (Médio) — 5 story points. Reusa pattern HL-01 · adiciona detecção de idioma PT/EN e tabelas de preço duplas · zero integrações externas novas (`active_tools: []`).

## Contexto

Gustavo Gonçalves Oliveira — designer focado em overlays para streamers (5 anos de experiência) — fechou proposta de R$ 497/mês para usar a Zenya como atendente virtual dos seus leads de tráfego pago (Instagram `@gudesignerpro`, ~20–25 conversas/dia).

Briefing completo consolidado em `docs/mauro-sessao-gustavo-19abr2026.md` (prompt + 4 áudios + 2 PDFs de portfólio + respostas às 7 perguntas pendentes em 2026-04-20).

**Decisão arquitetural:** este tenant entra **direto no core SparkleOS** (TypeScript/Hono). **Não passa pelo n8n.** A Zenya está em migração do n8n e não faz sentido criar trabalho duplicado para um cliente novo.

## Acceptance Criteria

1. Script `packages/zenya/scripts/seed-scar-tenant.mjs` cria o tenant no Supabase ativo (`uqpwmygaktkgbknhmknx`) com:
   - `name: "Scar AI"` · `account/organization: "GuDesignerPro"`
   - Prompt final extraído de `docs/stories/scar-ai-onboarding-01/prompt-scar-ai.md`
   - `active_tools: []` (sem ferramentas externas — sem Loja Integrada, sem UltraCash, sem calendário por ora)
   - `admin_contacts` = Mauro + Gustavo
2. Detecção automática de idioma (PT/EN) na 1ª mensagem → roteia para portfólio correto (BR/US).
3. Portfólios hospedados em link público (Google Drive, URLs já definidas) — Scar não anexa arquivo, manda link.
4. Desconto Pix 7% e concessão 5% aplicados apenas se cliente pedir — não ofertar proativamente.
5. Scar **nunca** fecha pagamento nem cria grupos — escala para Gustavo com mensagem padrão.
6. Chatwoot: conta GuDesignerPro criada, webhook apontando para a VPS, labels padrão (`agente-off`, `follow-up`, `testando-agente`).
7. Z-API: instância ligada ao número +55 74 8144-6755 (do Gustavo).
8. Smoke test aprovado: simulação PT-BR → portfólio BR + Pix · simulação EN-US → portfólio US + PayPal.

## Dependências

- ~~**Bloqueante:** contrato assinado + 50% do 1º mês pagos.~~ ✅ resolvido 2026-04-20
- **Bloqueante:** Gustavo liberar acesso ao WhatsApp dele para pareamento da Z-API (pode exigir QR code via celular dele).
- **Não-bloqueante:** tabela de artes avulsas de Portugal (Gustavo só sinalizou querer atender — definir em v2).
- **Não-bloqueante:** conta PayPal / Higlobe — só relevante no momento do fechamento (e Scar escala nesse ponto).

## Escopo — IN

- Tenant único no Supabase com prompt completo do Scar AI.
- Integração Z-API com o WhatsApp do Gustavo.
- Configuração Chatwoot (conta, webhook, labels).
- Detecção de idioma + roteamento de portfólio e moeda.
- Escalação automática quando cliente aceita fechar ou quando pede conversa humana.
- Scripts de seed idempotentes.
- Smoke test documentado.

## Escopo — OUT (v1)

- Integração com CRM próprio do Gustavo (ele não tem).
- Cobrança automática (Asaas, Stripe) — Gustavo manda Pix/link manualmente.
- Criação automática de grupo de produção com ilustrador — feita manualmente por Gustavo.
- Planilha de briefing automática — Gustavo envia manualmente após fechamento.
- Tabela de artes avulsas para Portugal (PT-PT) — Scar responde em PT mas usa tabela BR até confirmação.
- Dashboard de métricas para o Gustavo — fora de escopo do onboarding.

## Arquivos esperados (a serem criados no momento da implementação)

- `packages/zenya/scripts/seed-scar-tenant.mjs` — **novo**
- `docs/stories/scar-ai-onboarding-01/prompt-scar-ai.md` — **novo** (prompt final)
- `docs/stories/scar-ai-onboarding-01/portfolios/portfolio-br.pdf` — ✅ já criado
- `docs/stories/scar-ai-onboarding-01/portfolios/portfolio-us.pdf` — ✅ já criado
- `docs/stories/scar-ai-onboarding-01/cutover-checklist.md` — **novo** (spin-off do padrão HL quando a story for refinada)

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Número de Gustavo já é usado por humanos — convivência humano/IA | Padrão Zenya já existente: label `agente-off` desativa bot por conversa. Alinhar comportamento com Gustavo antes do go-live |
| Z-API pode pedir revalidação de sessão (QR code) quando Gustavo trocar celular | Documentar procedimento de revalidação no cutover checklist |
| Detecção de idioma pode errar em mensagens curtas ("oi", "hi") | Default: português. Fallback: se 2ª mensagem em inglês, troca idioma e reenvia portfólio correto |
| Cliente gringo pode não entender Pix — 7% desconto só faz sentido no BR | Prompt já separa desconto Pix (BR) de métodos US (PayPal/Higlobe) |
| Gustavo autoriza 5% "pra fechar" — Scar pode virar dispensadora de desconto | Regra clara no prompt: só se cliente pedir explicitamente "faz mais barato?". Nunca ofertar proativamente |

## Definição de pronto

- [ ] Tenant seedado no Supabase com prompt validado
- [ ] Z-API pareada com +55 74 8144-6755
- [ ] Chatwoot conta + webhook + labels funcionando
- [ ] Smoke test PT-BR com fluxo completo até pré-fechamento
- [ ] Smoke test EN-US com fluxo completo até pré-fechamento
- [ ] Simulação de objeção "tá caro" → Scar apresenta artes avulsas
- [ ] Simulação de "faz mais barato?" → Scar libera 5%
- [ ] Simulação de aceite → Scar escala para Gustavo (sem fechar pagamento)
- [ ] Gustavo recebe treinamento de 15 min sobre `agente-off`, escalações e grupos
- [ ] Cutover documentado no mesmo padrão HL-01

## Tasks / Subtasks

Ordem de implementação. Cada task atômica, verificável. Checkbox preenchido pelo @dev ao concluir.

### Fase A — Setup de código (local, sem side effects)

- [x] **A1.** Validar `docs/stories/scar-ai-onboarding-01/prompt-scar-ai.md` (já criado pelo @pm) — confirmar que cobre tom, idioma, catálogo, objeções, regras críticas. Aponta para AC 1, 2, 4, 5.
- [x] **A2.** Criar `packages/zenya/scripts/seed-scar-tenant.mjs` espelhado em `seed-hl-tenant.mjs`. Diferenças:
  - Carrega prompt de `../../../docs/stories/scar-ai-onboarding-01/prompt-scar-ai.md` em runtime (não hardcode)
  - `active_tools: []` (sem ultracash, sem google_calendar, sem loja_integrada)
  - Nome do tenant: `"Scar AI — GuDesignerPro"`
  - Env vars: `SCAR_CHATWOOT_ACCOUNT_ID`, `SCAR_ADMIN_PHONES`, `SCAR_ADMIN_CONTACTS` (mesmo padrão HL)
  - Script **idempotente:** `upsert` por `chatwoot_account_id` (mesmo onConflict do HL — validado em produção).
  - Aponta para AC 1.
- [x] **A3.** Verificar que o core Zenya **já suporta** detecção PT/EN + roteamento pelo próprio prompt (não precisa de código). O prompt instrui o LLM a detectar idioma na 1ª mensagem e responder no mesmo. Se durante smoke o comportamento falhar, abrir follow-up story ao invés de scope creep. Aponta para AC 2, 3.

### Fase B — Setup de infra externa (Chatwoot + Z-API)

- [x] **B1.** Criar conta "GuDesignerPro" no Chatwoot da VPS (browser/UI). Anotar `account_id`. Aponta para AC 6. → `account_id = 7` (criado por Mauro 2026-04-21)
- [x] **B2.** Criar labels na conta: `agente-off`, `follow-up`, `testando-agente`. (Reusar script `setup-zapi-labels.mjs` se existir, ou criar manual.) → criados via Chatwoot API (ids 26, 27, 28)
- [x] **B3.** Configurar webhook da conta apontando para `https://api.sparkleai.tech/webhook/chatwoot` (mesmo endpoint multi-tenant usado pelas outras contas). → webhook id 29 criado, subscrito em `message_created`
- [ ] **B4.** Criar inbox Z-API na conta Chatwoot. **Precisa de QR code via celular do Gustavo** — agendar com ele. Número: +55 74 8144-6755. Aponta para AC 7.
- [ ] **B5.** Adicionar credencial Z-API no `zenya_tenant_credentials` (service=`zapi`, criptografada com AES-256-GCM). Reusar script `seed-zapi-credentials.mjs` como referência.

### Fase C — Seed do tenant

- [x] **C1.** Executar `seed-scar-tenant.mjs` no shell da VPS (ou local apontando para Supabase prod). Anotar `tenant_id` retornado. → executado 2026-04-21 na VPS · `tenant_id = ae522886-6b09-4876-8456-208ab49eb6ed` · `active_tools: []`
- [ ] **C2.** `pm2 reload zenya-webhook` e verificar logs (`pm2 logs zenya-webhook --lines 50`). Esperar zero erros. *(postergado para o cutover junto com B4-B5 — reload agora não é útil porque ainda não há inbox nem Z-API pareada)*

### Fase D — Smoke tests (antes de liberar pro Gustavo)

- [ ] **D1.** Mandar "Oi, tudo bem?" de um número admin → Scar cumprimenta, pergunta se já faz live. Aponta para AC 2 (PT detection).
- [ ] **D2.** Mandar "Hi there" de outro número admin → Scar responde em inglês e eventualmente manda link US. Aponta para AC 2 (EN detection).
- [ ] **D3.** Conduzir conversa PT até receber link BR + menção a Pix. Validar texto não contém valor direto de pacote antes do cliente pedir. Aponta para AC 3, 4.
- [ ] **D4.** Conduzir conversa EN até receber link US + menção a PayPal/Higlobe. Aponta para AC 3.
- [ ] **D5.** Objeção "tá caro" → Scar apresenta tabela de artes avulsas.
- [ ] **D6.** Objeção "faz mais barato?" → Scar libera até 5%.
- [ ] **D7.** "Fechado, quero o Premium" → Scar escala para Gustavo **sem** mandar chave PIX. Aponta para AC 5.
- [ ] **D8.** Aplicar label `agente-off` em uma conversa ativa → Scar para de responder. Remover label → volta a responder.

### Fase E — Go-live

- [ ] **E1.** Criar `docs/stories/scar-ai-onboarding-01/cutover-checklist.md` no padrão `hl-onboarding-01/README.md`.
- [ ] **E2.** Treinar Gustavo em call de 15 min: `agente-off`, processo de escalação, criação de grupo com ilustrador, planilha de briefing. Aponta para DoD.
- [ ] **E3.** Go-live: Gustavo começa a usar. Monitoramento ativo por 48h (`pm2 logs -f`).

### Fase F — Alinhar Scar AI ao ADR-001 (prompt storage)

Adicionado em 2026-04-21 após ADR-001 ser aprovado. Fase 0 do epic `zenya-prompts-refactor` absorvida aqui — Scar AI nasce no padrão novo em vez de virar dívida técnica.

- [x] **F1.** Adicionar dependência `gray-matter` em `packages/zenya/package.json`. → instalado versão `^4.0.3` local e na VPS.
- [x] **F2.** Criar pasta `docs/zenya/tenants/scar-ai/` e mover o prompt para `docs/zenya/tenants/scar-ai/prompt.md`, adicionando front-matter YAML no padrão ADR-001 D2. Remover `docs/stories/scar-ai-onboarding-01/prompt-scar-ai.md` (conteúdo migrado). → front-matter com `tenant`, `version: 1`, `updated_at`, `author`, `sources[]`, `notes`.
- [x] **F3.** Refatorar `packages/zenya/scripts/seed-scar-tenant.mjs` para usar `gray-matter` em vez de `split(/\n---\n/)`. Atualizar o path default para `../../docs/zenya/tenants/scar-ai/prompt.md`. → path default atualizado para `../../../docs/zenya/tenants/scar-ai/prompt.md`. Seed agora loga `prompt version` do front-matter.
- [x] **F4.** Atualizar `docs/zenya/TENANT-PLAYBOOK.md` referenciando ADR-001 e documentando o novo caminho canônico para prompts de tenants. → adicionada nota no início do §4 (atualização completa fica com story `zenya-prompts-04-governance`).
- [x] **F5.** Rodar o seed refatorado na VPS (idempotente — apenas atualiza o prompt do tenant Scar AI já existente) e validar via `SELECT system_prompt FROM zenya_tenants WHERE id='ae522886-6b09-4876-8456-208ab49eb6ed'` que o conteúdo bate com o `.md`. → seed rodado com sucesso, **md5 match validado**: `52c51ab7dd1fe7ade994135af4ce0338` (tanto do `.md` pós gray-matter quanto do banco).

## Dev Notes

### Reuso — padrão HL-01

Este tenant reusa **integralmente** a infraestrutura multi-tenant que a HL-01 inaugurou. Leituras obrigatórias antes de começar:

- `docs/zenya/TENANT-PLAYBOOK.md` — schema `zenya_tenants`, fluxo de mensagem, convenções
- `docs/stories/hl-onboarding-01/README.md` — cutover checklist que esta story deve espelhar
- `packages/zenya/scripts/seed-hl-tenant.mjs` — referência para `seed-scar-tenant.mjs` (copiar estrutura, trocar valores)
- `packages/zenya/scripts/seed-zapi-credentials.mjs` — referência para criptografia AES-256-GCM de credenciais

### Decisões já tomadas (não reabrir)

1. Zero integrações externas. `active_tools: []`. Gustavo não tem CRM, ERP, loja online. Só WhatsApp 1:1.
2. Detecção de idioma é **responsabilidade do LLM via prompt**, não via código. O prompt já instrui.
3. Scar nunca cria grupos WhatsApp. Gustavo + ilustrador criam manualmente pós-fechamento.
4. Scar nunca processa pagamento. Escala para Gustavo, que envia Pix/link manualmente.
5. Tabela de preços Portugal fica fora do v1. Scar responde em PT mas usa tabela BR até Gustavo confirmar tabela PT-PT própria.
6. Número WhatsApp é o do Gustavo (+55 74 8144-6755), não número dedicado.

### Supabase ativo (não legado)

- URL: `uqpwmygaktkgbknhmknx.supabase.co` (Supabase novo)
- **NÃO USAR** `gqhdspayjtiijcqklbys` (legado, bloqueado)
- Credenciais em `.env` da VPS

### Branch de desenvolvimento

Criar: `feature/scar-ai-onboarding-01` a partir de `main`.

### Testes unitários

- Não precisa cobrir detecção de idioma (não é código, é prompt).
- Único código novo é o seed script — validação suficiente: `node scripts/seed-scar-tenant.mjs` rodar idempotente 2x seguidas sem duplicar tenant e com `system_prompt` atualizado na 2ª execução.
- Se o @dev decidir adicionar helper compartilhado entre seeds, esse helper precisa de unit test.

### Testing Strategy

- **Unit:** só se surgir código reutilizável (helper). Seed scripts: smoke manual.
- **Integration:** D1–D8 são os testes de integração reais (ponta-a-ponta WhatsApp → Chatwoot → core → LLM → Chatwoot → WhatsApp).
- **Regression:** verificar que tenants Zenya Prime e HL continuam respondendo normalmente após reload do `zenya-webhook`.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.7 (claude-opus-4-7) via Claude Code, agent `@dev` (Dex).

### File List
- `packages/zenya/scripts/seed-scar-tenant.mjs` — **novo** (Fase A2), **refatorado** (Fase F3) para usar `gray-matter`
- `packages/zenya/package.json` — **modificado** (Fase F1): adicionada dep `gray-matter ^4.0.3`
- `packages/zenya/package-lock.json` — **modificado** (Fase F1)
- `docs/zenya/tenants/scar-ai/prompt.md` — **novo** (Fase F2): prompt canônico com front-matter YAML (ADR-001)
- `docs/stories/scar-ai-onboarding-01/prompt-scar-ai.md` — **deletado** (Fase F2): conteúdo migrado para `docs/zenya/tenants/scar-ai/prompt.md`
- `docs/zenya/TENANT-PLAYBOOK.md` — **modificado** (Fase F4): nota no §4 referenciando ADR-001 (atualização completa via story 4 do epic)
- `docs/stories/scar-ai-onboarding-01/cutover-checklist.md` — **novo** (Fase E1 adiantada)

### Completion Notes
- **Fase A concluída** em 2026-04-21 na branch `feature/scar-ai-onboarding-01`.
- A1: prompt `prompt-scar-ai.md` revisado e aprovado — cobre tom, idioma, catálogo (pacotes + avulsas), 4 objeções padrão, 5 regras críticas. 6848 caracteres após remover metadata do header.
- A2: seed script criado. Diferenças chave vs HL:
  - Prompt carregado de arquivo markdown em runtime via `readFile` + `path.resolve` relativo a `import.meta.url` (não hardcode).
  - Extração do prompt: `split(/\n---\n/).slice(1).join()` pra pular o header de metadata. Validado em smoke — extrai 6848 chars começando em "Você é o **Scar AI**..." e terminando em "...sem parecer script de venda.".
  - `active_tools` default `[]` (sem ultracash/google_calendar/loja_integrada).
  - Env prefix `SCAR_` + validação obrigatória de `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SCAR_CHATWOOT_ACCOUNT_ID`.
  - Upsert `onConflict: 'chatwoot_account_id'` (mesmo padrão HL — constraint já existe no schema `zenya_tenants`).
  - Smoke test com env vars inválidas passou pelas validações, carregou o prompt, e falhou só no fetch Supabase (comportamento esperado).
- A3: detecção PT/EN é inteiramente responsabilidade do prompt (não código). Confirmado que o prompt tem seção "Idioma — detectar na 1ª mensagem" com regras explícitas.
- **Fases B-E pendentes** — dependem de: (a) acesso à VPS, (b) conta Chatwoot nova, (c) QR code do WhatsApp do Gustavo agendado com Mauro. Fase A fica estável na branch aguardando.

### Debug Log References
Nenhum debug log gerado nesta fase — sem erros, sem retries.

### Change Log
- **2026-04-21 (dev)** — Fase A completa (3/19 tasks). Branch `feature/scar-ai-onboarding-01` criada a partir de `main`. Arquivo `seed-scar-tenant.mjs` criado e validado em smoke local.
- **2026-04-21 (dev)** — Fases B1-B3 + E1 completas (7/19 tasks). Conta Chatwoot #7 criada por Mauro. Labels (ids 26, 27, 28) e webhook (id 29 → `api.sparkleai.tech/webhook/chatwoot`, subscrição `message_created`) criados via API. `cutover-checklist.md` gerado antecipadamente e já alinhado com a URL real do webhook de produção.
- **2026-04-21 (dev)** — C1 completo (8/19 tasks). Seed rodado na VPS com `SCAR_CHATWOOT_ACCOUNT_ID=7` + admins Mauro e Gustavo. Tenant criado no Supabase ativo com `id = ae522886-6b09-4876-8456-208ab49eb6ed`. Observação: o `.env` local aponta para Supabase legado (bloqueado) — seed precisou rodar na VPS via SSH + scp dos arquivos da branch (ainda não pushada). Transferência temporária: `seed-scar-tenant.mjs` para `/root/SparkleOS/packages/zenya/scripts/` e `prompt-scar-ai.md` para `/root/SparkleOS/docs/stories/scar-ai-onboarding-01/`.
- **2026-04-21 (dev)** — Fase F completa (13/19 tasks). Scar AI migrado para o padrão ADR-001: gray-matter instalado, prompt em `docs/zenya/tenants/scar-ai/prompt.md` com front-matter YAML, seed refatorado, playbook com referência ao ADR, seed rodado na VPS com sucesso. md5 do prompt no banco idêntico ao md5 do `.md` (gray-matter parse): `52c51ab7dd1fe7ade994135af4ce0338`. Scar AI agora nasce no padrão canônico — destravando o epic `zenya-prompts-refactor`.

## Histórico

- **2026-04-18** — Contrato draft gerado (R$ 497/mês)
- **2026-04-19** — Primeiro contato via WhatsApp; Gustavo envia prompt base + 4 áudios
- **2026-04-20** — Briefing final com respostas às 7 perguntas pendentes; esta story criada
- **2026-04-20** — Contrato assinado + 50% (R$ 248,50) pago. Story destravada para validação do @po
- **2026-04-21** — @po valida. Score 8/10 no 10-point checklist → **GO conditional**. Status Draft → Ready. Observações listadas para @sm endereçar
- **2026-04-21** — @sm refina. Decisão: story única, não dividir em sub-stories. Adicionadas seções Executor Assignment, Complexity, Tasks/Subtasks (5 fases, 19 tasks) e Dev Notes. Pronta para `@dev *develop-story`
