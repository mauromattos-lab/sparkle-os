# EPICS OVERVIEW — Mapa-Mestre do SparkleOS

**Versão:** 1.0 — 2026-04-22
**Mantido por:** @pm (Morgan)
**Propósito:** Evitar crescimento desorganizado de epics. Todo epic novo **deve** encaixar em uma camada abaixo e declarar seu epic antecessor.

---

## Como usar

1. **Antes de criar epic novo:** identifique em qual camada ele entra. Se não couber em nenhuma, discuta com @pm antes de criar — pode ser sinal de que a camada precisa ser adicionada ao overview, não que o epic precisa ser criado.
2. **Antes de abrir story de trabalho informal:** verifique se existe epic aberto que cobre. Se não existir, crie o epic primeiro (mesmo que com uma única story) — rastreabilidade AIOX não admite dívida silenciosa.
3. **Ordem de fechamento respeita dependências entre camadas**, não ordem de criação dos epics.

---

## Camadas

### Camada 1 — Fundação
> Habitat AIOX + SparkleOS core + Zenya como produto.

| Epic | Título | Status |
|------|--------|--------|
| 1 | Fundação: Habitat, Processo e Arsenal | ✅ Done |
| 2 | Zenya Integrada | ✅ Done |
| 3 | Cérebro Coletivo v1 | ✅ Done |
| 4 | Interface de Pilotagem v1 | ✅ Done |

### Camada 2 — Migração (n8n → core)
> Trazer tenants legados do fazer.ai/n8n para o core TypeScript.
>
> 🔴 **Blocker do roadmap.** Enquanto tiver tenant em n8n, operação é dupla e refino é instável.

| Epic | Título | Status |
|------|--------|--------|
| 7 | Zenya como Órgão Nativo do SparkleOS | 🟡 InProgress (9/10) — Story **7.8** (cutover dos clientes) aberta |

### Camada 3 — Método de Refino
> Playbook + smoke-template + taxonomia. Meta-framework que o Brownfield (Camada 4) consome.

| Epic | Título | Status |
|------|--------|--------|
| 15 | Método de Refino e Onboarding de Tenants | ✅ Done (3/3) |

### Camada 4 — Refino Brownfield (aplicação do método)
> Cada tenant em produção passa por um ciclo formal de refino: baseline → smoke → fix → janela.

| Epic | Título | Status |
|------|--------|--------|
| 16 | Refino Brownfield — Fun Personalize (Julia) | ✅ Done — janela executada, Julia pediu remover resumo (prompt v3), rodando em produção. Pendente: formalização retroativa da 16.4 (story + gate) em `feature/scar-ai-onboarding-01`. |
| 17 | Refino Brownfield — demais tenants migrados (PLAKA, Scar AI, etc.) | ⚪ Draft — criado 2026-04-22 |

### Camada 5 — Produto Horizontal
> Capacidades que beneficiam qualquer tenant.

| Epic | Título | Status |
|------|--------|--------|
| 10 | Cockpit do Cliente Zenya | ⚪ Draft |
| 11 | Capacidades Globais da Zenya (Vision, assistente do gestor) | ⚪ Draft |

### Camada 6 — Produto Vertical
> Capacidades por nicho, via feature-flag por tenant.

| Epic | Título | Status |
|------|--------|--------|
| 13 | Capacidades de Nicho (imobiliária, personalizados, advocacia, clínicas) | ⚪ Draft |

### Camada 7 — Automação de Onboarding
> Eliminar Mauro do caminho crítico de novo cliente.

| Epic | Título | Status |
|------|--------|--------|
| 14 | Onboarding Automático da Zenya | ⚪ Draft (depende de Epic 10) |

### Camada 8 — Conteúdo AEO (blog Plaka)
> Motor editorial da Plaka Acessórios.

| Epic | Título | Status |
|------|--------|--------|
| 5 | Content Engine: Automação e Integração | 🟢 Ready (6/6 validadas, não implementadas) |
| 6 | Canal de Blog AEO (Ghost CMS) | 🔄 Em andamento (7/8 Done, 6.8 Draft) |
| 8 | AEO Squad Plaka — Correções Semana 1 | ✅ Done |
| 9 | AEO Squad Plaka — Automação Diária | ✅ Done |

### Camada 9 — Conteúdo gerado pela Zenya
> Zenya produzindo conteúdo para seus próprios clientes (diferente de AEO do blog Plaka).

| Epic | Título | Status |
|------|--------|--------|
| 12 | Produção de Conteúdo da Zenya | ⚪ Draft |

---

## Dependências entre camadas

```
Camada 1 (Fundação) ✅
  └── Camada 2 (Migração) 🟡 ← BLOCKER
        └── Camada 3 (Método) ✅
              └── Camada 4 (Refino Brownfield) 🟡 16, ⚪ 17
                    │
                    └── (clientes saneados, método maduro)
                          │
                          ├── Camada 5 (Produto Horizontal) ⚪
                          │     └── Camada 7 (Onboarding Auto) ⚪
                          │
                          ├── Camada 6 (Produto Vertical) ⚪
                          │
                          └── Camada 9 (Conteúdo Zenya) ⚪

Camada 8 (Conteúdo AEO Plaka) — independente, roda paralelo.
```

---

## Plano de execução (macro)

### Fase 1 — Destravar migração (FOCO ATUAL)
- Executar **Epic 7.8** (cutover dos clientes restantes do n8n) usando o playbook do Epic 15
- Formalizar retroativamente **Story 16.4** (janela da Fun já executada com sucesso — faltam artefatos AIOX)
- ✅ Saída: zero tenants em n8n

### Fase 2 — Saneamento brownfield
- **Epic 17** — rodar ciclo brownfield nos tenants migrados que ainda não passaram por refino formal (PLAKA, Scar AI, outros de cutover 7.8)
- Revisar Epic 15 (v2 do playbook com aprendizados)
- ✅ Saída: todos tenants com smoke + janela + gate PASS

### Fase 3 — Produto horizontal
- Epic 10 (Cockpit) → libera Epic 14 (Onboarding Auto)
- Epic 11 (Capacidades Globais) em paralelo

### Fase 4 — Verticalização & conteúdo
- Epic 13 (Nichos) sob demanda real
- Epic 12 (Conteúdo Zenya) quando houver bandwidth
- Fechar Epic 5 + 6.8 do AEO Plaka

---

## Regras de higiene

1. **Nenhum epic pula para "In Progress" sem ter antecessor de camada fechado** (exceto Camada 8 — paralela).
2. **Trabalho informal em tenant = débito AIOX.** Se for inevitável, registre como story dentro do Epic 17 **antes** de executar, não depois.
3. **Hotfixes** (como `plaka-scheduler-hotfix-01`) ficam fora do sistema de epics — vivem em `docs/stories/<slug>/`. São por natureza urgência operacional.
4. **Este overview é atualizado sempre que um epic fecha, um epic novo é criado, ou uma camada é revisada.**

---

## Changelog

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-04-22 | @pm Morgan | Criação do mapa-mestre. Baseline: 16 epics formais + plaka-scheduler-hotfix-01 (fora do sistema). Epic 17 proposto como Draft para absorver refino brownfield dos tenants pós-cutover. |
