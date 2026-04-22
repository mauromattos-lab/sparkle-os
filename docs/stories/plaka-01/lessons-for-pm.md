# Brief para o PM — lições da sessão de onboarding PLAKA (2026-04-21)

> **Status:** rascunho efêmero pra Mauro levar ao @pm numa sessão futura.
> NÃO é documento permanente. Se virar, move pra `docs/zenya/TENANT-REFINEMENT-PLAYBOOK.md`.

---

## Contexto

Sessão de onboarding do tenant PLAKA (4º Zenya, migração do n8n). Durou ~1 dia.
Durante ela emergiu um método de "refinar antes de expor no WhatsApp do cliente"
que pareceu mais eficaz que o padrão anterior (colocar bot em produção e ajustar
reactive aos feedbacks do cliente).

Dor recorrente que o método ataca: bot respondendo erroneamente na cara do
cliente (padrão FUN — "não encontrei produto X", escalações à toa, promessa
de coisas que não pode cumprir).

---

## Método que emergiu

```
 1. Seed do tenant no core (tenant row + credenciais + KB)
 2. Abrir chat-REPL local (node scripts/chat-*.mjs)   ← NOVO — sem WhatsApp
 3. Smoke rigoroso DERIVADO DA FONTE, não adivinhado     ← NOVO
    ├── ler TODAS as entries da KB/prompt/schema
    └── gerar N variações naturais por entry (LLM)
         └── rodar cada uma → classificar hit-certo / hit-outra-entry /
             sem-match / no-kb-call / erro
 4. Corrigir pelo ROI: prompt, fuzzy, triggers da KB
 5. Re-rodar smoke → delta mensurável
 6. Só depois de N iterações: conectar WhatsApp real
 7. Primeira fase em produção usa `allowed_phones` como whitelist
    de teste (bot só responde pros admins — Mauro + cliente-proprietário)
```

### Dados reais de cobertura medidos nesta sessão (benchmark)

| Versão | Hit-certo | Sem-match-sem-escalar | No-kb-call | Observação |
|---|:-:|:-:|:-:|---|
| v1 (smoke superficial de 29 perguntas adivinhadas) | 39.4% | 19.4% (mascarado por 404) | 9.7% | Ilusão de cobertura; não refletia a fonte |
| v1 (smoke rigoroso 165 testes, mesmo código) | 39.4% | 19.4% | 9.7% | Métrica real, mesma versão do código |
| v2 (prompt afrouxado KB-first condicional) | 39.3% | 21.3% | **30.3%** | Overshoot — prompt deu liberdade demais |
| v3 (prompt v2.1 apertado) | 41.8% | **31.5%** | 9.7% | Exposto novo gap: Roberta improvisava em vez de escalar |
| v3→v4 sem medir (prompt v2.3 + 260 triggers) | esperado ≥ 55% | esperado 0% | esperado ~9% | Decidido pular v4 — evidências manuais suficientes |

Principal insight: **cada iteração expôs um problema diferente que a anterior mascarava.** Não é "atingir N% de uma vez", é **ciclo de revelação**.

---

## Artefatos reutilizáveis

| Arquivo | Serve pra | Tenant-agnóstico? |
|---|---|---|
| `packages/zenya/scripts/chat-plaka.mjs` | REPL de teste local | 80% — copiar e trocar `chatwoot_account_id` |
| `packages/zenya/scripts/kb-coverage-plaka.mjs` | Medir cobertura real | Igual — copiar e parametrizar |
| Rule `.claude/rules/zenya-tenant-prompts.md` | Prompt canônico via ADR-001 | ✅ já genérico |
| Memory `feedback_test_from_source.md` | "Ler fonte antes de testar" | ✅ universal |
| Pattern "summary [ATENDIMENTO] público" na escalação | Handoff universal (sem Chatwoot) | ✅ universal — já no `escalation.ts` |

---

## Decisões de arquitetura que fizeram diferença

1. **Escalação universal**: removida dependência de Chatwoot private note. Summary
   vira mensagem pública na conversa começando com `[ATENDIMENTO]`. Funciona em
   qualquer canal (atendente vê na preview do WhatsApp Business App ou em qualquer
   back-office). Trade-off aceito: cliente vê a mensagem também.

2. **Fuzzy morfológico**: matcher `\b{kw}[a-záéíóúâêôãõç]{0,6}\b` captura flexões
   (demora→demorando, rastrear→rastreamento) sem dependência de stemming library.
   Aplica só a keywords ≥ 4 chars — evita falsos positivos em palavras curtas.

3. **KB-first condicional (não 100%)**: prompt afrouxado — perguntas genéricas
   consultam KB primeiro; perguntas sobre pedido específico podem ir direto pra
   tool de consulta. Preserva fluidez natural que o KB-first rígido matava.

4. **Multi-aba no kb-sync**: credencial aceita `ranges[]` além de `range`.
   spreadsheets.values.batchGet em 1 chamada.

5. **"Antes de escalar, peça número/CPF se for pedido"**: regra no prompt.
   Evita atendente humano ter que pedir de novo — Roberta já coleta.

---

## Perguntas em aberto pro PM avaliar

1. **Documentar como playbook formal?** (`docs/zenya/TENANT-REFINEMENT-PLAYBOOK.md`)
   Mauro leu essa pergunta, disse "não permanente agora". Adiar até Scar AI ou
   próximo tenant confirmar o padrão.

2. **Criar workflow AIOX formalizado?** (`.aiox-core/development/workflows/tenant-refinement-cycle.md`)
   Faz sentido quando o padrão for usado em 2-3 tenants. Hoje ainda é N=1.

3. **chat-REPL tenant-agnóstico?** Hoje existe `chat-plaka.mjs` específico. Se o
   padrão virar método, vale parametrizar num `chat-tenant.mjs` genérico que
   recebe `--tenant=<chatwoot_account_id>`.

4. **Smoke tenant-agnóstico?** Mesmo dilema do REPL.

5. **Condicionais na KB** (colunas "Tem Condicional? / Resposta SIM / Resposta NÃO"
   da planilha PLAKA): o código atual ignora essas colunas, só usa B+C.
   Refatorar pra honrar fluxos condicionais pode ser um epic próprio.

6. **Stemming português pra KB fuzzy**: solução mais robusta que o matcher morfológico
   atual. Avaliar no próximo tenant se o fuzzy atual cobre bem.

7. **Fase 1 com `allowed_phones` como padrão de onboarding**: formalizar que todo
   tenant novo nasce em modo teste (só admin recebe resposta) e só sai quando
   N smokes passam? Faz parte do método ou é opcional por tenant?

---

## Números reais da sessão (benchmark)

- **Spec Pipeline PLAKA** (fases 1-6): ~2h de trabalho orquestrado de Morgan + subagentes
- **Onboarding técnico** (seed + credenciais + adapter Nuvemshop + KB sync):
  3h (código + deploy VPS)
- **Smoke superficial (antes)**: 29 perguntas chutadas, coverage ilusório de 12 hits
- **Smoke rigoroso (depois)**: 165 perguntas derivadas, coverage real 39% → identifica
  gaps específicos por entry
- **Iteração de fixes** (fuzzy + prompt + escalation): ~1h
- **Tempo total até "pronto pra conectar Z-API com chip do Mauro"**: ~6h de trabalho efetivo

---

## Aprendizados críticos desta sessão (novos — incluir em memory)

### 1. LLM pode **simular** tool call sem executar

Descoberto em 2026-04-21 no teste manual do REPL. Roberta (gpt-4.1) com prompt v2.2 ("chame Escalar_humano") **escrevia** a mensagem "vou te encaminhar para um atendente" e parava — **sem invocar a tool**. Cliente em produção teria ficado abandonado: mensagem de handoff chega, mas `escalarHumano` nunca dispara, logo nenhum atendente é notificado e nenhum label é aplicado.

Fix que funcionou (v2.3): prompt com seção explícita **COMPORTAMENTO PROIBIDO** listando ❌/✅ e regra mental "se escreveu 'encaminhar/atendente/escalar/humano' → tem que invocar a ferramenta". Tom imperativo > instrucional. Se ainda não funcionar, próximo passo é `toolChoice` forçado via AI SDK no código.

Padrão universal: **qualquer instrução de tool que o prompt dá precisa ser dupla** — o que fazer + exemplo do que é errado escrever sem executar.

### 2. Afrouxar prompt pode piorar silenciosamente

Prompt v2 tentou afrouxar "KB-first rígido" pra preservar fluidez. Resultado: `no-kb-call` triplicou (9.7% → 30.3%). LLM interpreta regras soltas como licença ampla. Sempre testar depois de afrouxar; voltar ao rígido se medir regressão.

### 3. Smoke rigoroso derivado da fonte > smoke adivinhado

Primeiro smoke (29 perguntas inventadas por nome de aba) afirmou 12 hits — mas não testava o que existe na KB. Fez eu declarar "faltam entries" que JÁ EXISTIAM (L10 cancelamento, L08 rastreio). Smoke rigoroso (165 perguntas × 3 variações por entry real) expôs o problema verdadeiro: **keywords pobres demais pra linguagem natural**.

Regra: se vai testar cobertura de algo finito (KB, schema, prompt), enumera a fonte e deriva testes dela. Smoke adivinhado é pior que nenhum smoke — dá falsa segurança.

### 4. "Error" em smoke pode esconder comportamento ruim

Coverage v1 teve 21% errors — todos 404 Chatwoot (escalação no REPL sem conversationId real). Pareciam irrelevantes. Quando refatoramos escalação pra mensagem pública (v2/v3), esses 404 sumiram — e o verdadeiro comportamento apareceu: Roberta improvisando em vez de escalar. O "error" era na verdade um proxy de "Roberta tentou escalar mas falhou no transporte". Sem ele, Roberta inventava resposta.

Sempre investigar erros antes de ignorar. Error pode ser semáforo de segurança.

### 5. SA precisa de Editor pra batch-edit via API

Edição de planilha via browser célula-por-célula é propensa a erro de navegação (cai na linha errada). Com SA promovida de Leitor → Editor, um `spreadsheets.values.update` faz 18 edições em segundos, determinístico. **Padrão pra outros tenants**: no onboarding, já criar SA com permissão Editor no projeto da dona.

---

## Anexo A — Zenya Admin como produto (emergiu na sessão de 2026-04-21)

Durante a sessão, Mauro levantou extensão do canal admin (hoje `admin_phones` /
`admin_contacts` da tabela `zenya_tenants`). A discussão passou de "feature
técnica pra PLAKA" pra **"eixo de diferenciação de produto Zenya"**.

### Posicionamento proposto

| Plano | Diferencial |
|---|---|
| **Essencial** (R$ 497) | Roberta atende cliente. Admin básico (histórico, métricas simples). *"Atendente IA."* |
| **Completa / Superior** (preço maior) | Tudo do Essencial + **Admin com superpoderes**. *"CFO + gerente + analista, tudo no WhatsApp da dona."* Usa WhatsApp 24/7 como interface conversacional pros dados do negócio. |

### As 4 famílias de tools (proposta inicial)

Cada família ativada por integração que o tenant já tem. **Tool universal, mas
aparece só se faz sentido.**

1. **👥 Atendimento** (sempre) — `resumoConversas`, `escalacoesPendentes`, `clientesVips`, `gapsKB` (conecta com weekly-analysis)
2. **🛒 E-commerce** (Nuvemshop/Loja Integrada) — `resumoVendas`, `topProdutos`, `pedidosAtrasados`, `novosClientes`, `comparativoPeriodo`
3. **📅 Agenda** (Google Calendar) — `agendaDia`, `agendaSemana`, `horariosLivres`, `proximosClientes`
4. **💰 Financeiro** (Asaas/Ultracash) — `recebimentosSemana`, `inadimplencia`, `cobrancasVencendo`

### Decisão PLAKA (2026-04-21): catálogo NO ADMIN, não pro cliente

Durante testes, Roberta escalou em perguntas tipo "esse colar tá disponível?" / "quanto
custa o brinco X?" — porque o escopo SAC não prevê consultar catálogo ao vivo.
Mauro decidiu:

- **Roberta (canal cliente)** fica SAC puro. Perguntas sobre produto escalam.
  Vai validar com Isa/Luiza se isso incomoda antes de ampliar.
- **Zenya Admin (canal Isa/Luiza)** ganha tool `topProdutos` / `estoqueProduto` /
  `consultarCatalogo` como parte da família E-commerce. Admin pergunta "quanto
  vendi do produto X?" / "qual estoque de Y?" → Zenya responde pra gestão.

Princípio emergente: **tools de leitura agregada sempre entram primeiro no
admin, não no canal cliente**. Cliente final recebe menos risco de info errada,
dono do negócio ganha poder via WhatsApp sem expor dado sensível.

### Caso de uso principal (1 dono, 1 canal, tudo)

Perfil majoritário: Julia da FUN, Luiza da PLAKA — dona sozinha do negócio.
UX alvo: ela pergunta qualquer coisa pelo WhatsApp dela, Zenya sabe.

```
Dona:   quanto vendemos essa semana?
Zenya:  R$ 12.450 em 58 pedidos. Ticket médio R$ 214, +18% vs semana passada.
        Top: Caneca personalizada (22un). Quer detalhar algo?

Dona:   tem pedido atrasado?
Zenya:  Sim, 3 pedidos com +10 dias sem atualização:
        • #15384 (Ana Costa, 12 dias)
        • #15401 (Roberto Lima, 11 dias)
        • #15405 (Carla Melo, 10 dias)
```

### Exceção: múltiplos admins com role (padrão PLAKA)

Quando o cliente tem equipe separando atendimento e executivo:

```json
"admin_contacts": [
  { "phone": "+5521993458389", "name": "Isa",   "role": "operations" },
  { "phone": "+55XXXXXXXXX",   "name": "Luiza", "role": "executive"  }
]
```

Admin agent lê o `role` pelo telefone e filtra resposta. É opcional — o default
é "omniscente pra qualquer admin".

### Modos de interação

- **On-demand** (core) — admin pergunta, Zenya responde 24/7. É onde mora o valor.
- **Push proativo** (opcional) — digest semanal segunda 9h. Bônus pra quem ativar.

### Conexão com o método de refino (o que a gente vinha discutindo)

Weekly analysis (conversas reais como insumo) **não é destino final — vira
entrada do admin digest**. Mauro pergunta "como foi a semana?", admin agent
usa o relatório do weekly-analysis + tools de dados pra entregar resposta
humana e proativa. Os dois sistemas se reforçam.

### Implicações de pricing (proposta)

- Essencial: **feature** (canal admin existe, básico)
- Completa: **produto** (Admin Zenya com dashboards conversacionais)
- Valor percebido >>> custo de implementação. Infra já existe — é só estender
  admin_agent com N tools reusáveis entre tenants.
- **Gancho de upgrade natural**: "quer saber quanto vendeu? Zenya Completa."

### Perguntas abertas pro PM decidir (acumuladas)

11. Admin como tier de produto ou como feature opcional em qualquer plano?
12. Role-based response ou sempre omniscente?
13. Super-admin multi-tenant (Mauro vê digest de todos os clientes)?
14. Alerta reativo (pedido crítico, cliente exaltado) vs digest semanal — canais
    separados ou mesma feature com priority?
15. Qual integração de E-commerce é padrão (hoje cada tenant tem uma — Loja
    Integrada na FUN, Nuvemshop na PLAKA)? Abstração unificada?

### Roadmap incremental sugerido

Fase 1 (próximo tenant Zenya Completa): **Atendimento + E-commerce** (já tem
tool Nuvemshop/Loja Integrada pronta — reusa).

Fase 2: + **Agenda** (tenants de serviço — salão, clínica).

Fase 3: + **Financeiro** (tenants com Asaas/Ultracash).

Fase 4: multi-tenant super-admin pra SparkleAI (Mauro vê digest de todos).

---

## Recomendação do @pm Morgan (aquele que escreveu isto)

O método deu certo em N=1. **Não virar playbook formal ainda** — vale aplicar no
Scar AI (próximo tenant Zenya) e só depois formalizar. O risco de engessar o
processo em docs antes de N=2 é criar rigidez sem benefício real.

Artefatos concretos (scripts, rule, memory) já estão no código e servem de
referência sem precisar virar playbook.

Quando documentar: pedir que o @pm leia este brief + o `feedback_test_from_source.md`
memory + os 2 scripts (`chat-plaka.mjs` e `kb-coverage-plaka.mjs`) — esses 4
artefatos resumem o método.
