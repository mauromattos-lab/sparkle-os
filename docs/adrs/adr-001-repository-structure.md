# ADR-001 — Estrutura de Repositório: Monorepo pnpm Workspaces

**Status:** Accepted  
**Data:** 2026-04-11  
**Autor:** @architect (Aria)  
**Story:** 1.1 — Estrutura do Repositório SparkleOS

---

## Contexto

SparkleOS é construído por múltiplos agentes AIOX que trabalham em diferentes domínios (Core, Brain, Zenya, Piloting Interface). Precisávamos de uma estrutura de repositório que:

- Suporte múltiplos packages TypeScript com dependências cruzadas
- Permita adicionar novos Núcleos (Organs) sem reorganização futura
- Seja simples o suficiente para agentes operarem via Claude Code
- Não introduza overhead desnecessário para o estágio atual (v0.1)

## Decisão

Monorepo único com **pnpm Workspaces**, estruturado em:

```
packages/   # Core, Brain, Shared — infra e lógica central
organs/     # Núcleos (Zenya e futuros) — integrações externas
apps/       # Interfaces de usuário (Piloting Interface)
```

## Rationale

- **pnpm vs npm workspaces:** pnpm é mais eficiente em disco (hard links), mais rápido em install, e tem melhor suporte a monorepos com hoisting seletivo
- **Sem Nx/Turborepo:** O overhead de ferramentas de build orchestration não é justificável no estágio atual (3 packages, 1 app, 1 organ). Pode ser adicionado quando o número de packages tornar o build serial um gargalo (>10 packages)
- **Monorepo vs Polyrepo:** Facilita compartilhamento de tipos via `@sparkle-os/shared`, simplifica CI/CD inicial, e permite que agentes visualizem o sistema completo em uma sessão

## Alternativas Descartadas

| Alternativa | Razão de Descarte |
|-------------|------------------|
| Polyrepo (repositório por package) | Overhead de coordenação entre repositórios desnecessário no estágio atual |
| Nx Monorepo | Cache de build e task orchestration complexos sem necessidade imediata |
| Turborepo | Similar ao Nx — valor real aparece com 10+ packages |
| npm Workspaces | pnpm é estritamente superior em eficiência e rigor de dependências |

## Consequências

**Positivo:**
- Tipos compartilhados via `@sparkle-os/shared` sem publicação
- `pnpm install` na raiz instala tudo — onboarding simples
- `git log` conta a história completa do sistema em um lugar

**Negativo / Riscos:**
- `node_modules` hoisting pode causar phantom dependencies — mitigado pelo rigor do pnpm
- `.aiox-core/` com muitos arquivos aumenta tamanho do repositório (observação da Story 1.1)

## Referências

- `pnpm-workspace.yaml` — configuração dos workspaces
- `docs/architecture.md` §2.3 — decisão técnica da arquitetura
- Story 1.1 — implementação da estrutura
