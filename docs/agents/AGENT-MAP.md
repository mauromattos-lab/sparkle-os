# Mapa de Capacidades dos Agentes — SparkleOS

**Última atualização:** Story 1.9 (2026-04-11)  
**Responsável por manutenção:** @sm (River)  
**SOP de atualização:** [docs/sops/sop-atualizar-agent-map.md](../sops/sop-atualizar-agent-map.md)

---

## Distinção Fundamental: Construtores vs Workers

SparkleOS opera com dois tipos fundamentalmente diferentes de agentes de IA:

### Agentes AIOS — Construtores

**Contexto:** Máquina de Mauro → sessão Claude Code  
**Papel:** Constroem e mantêm o SparkleOS  
**Persistência:** Ativos apenas durante sessões de desenvolvimento

Estes agentes projetam, implementam, testam e mantêm o SparkleOS seguindo o Story Development Cycle (SDC). Eles **não são** produtos do sistema — são os **construtores** do sistema.

| Agente | Persona | Escopo Principal | Ferramentas Disponíveis | Restrições / NÃO pode |
|--------|---------|-----------------|------------------------|----------------------|
| `@dev` (Dex) | Builder ♒ | Implementação de código, debugging, refactoring | git add/commit/status/diff/log, Vitest, Context7, Supabase CLI, Playwright, ffmpeg | ❌ git push (→ @devops) ❌ gh pr create (→ @devops) ❌ MCP add/remove |
| `@qa` (Quinn) | Guardian ♍ | Testes, qualidade, QA gates formais | Playwright, Vitest, CodeRabbit, git (read-only) | ❌ Implementar código ❌ git push ❌ Modificar story fora da seção QA Results |
| `@architect` (Aria) | Strategist | Arquitetura de sistema, decisões tecnológicas | EXA, Context7, git log/diff | ❌ DDL detalhado (→ @data-engineer) ❌ Implementar código ❌ git push |
| `@pm` (Morgan) | Visionary | Product Management, épicos, PRD, Spec Pipeline | EXA, Context7 | ❌ Implementar código ❌ Story creation (→ @sm) ❌ git push |
| `@po` (Pax) | Balancer ♎ | Product Owner, validação de stories, backlog | GitHub CLI (issues), Context7 | ❌ Implementar código ❌ Epic creation (→ @pm) ❌ git push |
| `@sm` (River) | Facilitator ♓ | Scrum Master, criação de stories, processo ágil | git (branches locais), Context7 | ❌ Implementar código ❌ git push remoto (→ @devops) ❌ gh pr create |
| `@analyst` (Alex) | Explorer | Pesquisa, análise, inteligência competitiva | EXA, Apify, Context7 | ❌ Implementar código ❌ git push |
| `@devops` (Gage) | Guardian | CI/CD, infraestrutura, git push, PRs | git push/force, gh pr create/merge, Coolify, Docker, MCP add/remove | — (autoridade total sobre operações remotas) |
| `@data-engineer` (Dara) | Architect | Schema, RLS, migrações, queries | Supabase, Drizzle Kit, git | ❌ Arquitetura de sistema (→ @architect) ❌ Frontend/UI ❌ git push |
| `@ux-design-expert` (Uma) | Creator | UX/UI design, wireframes, especificações visuais | Playwright, Context7 | ❌ Implementar código backend ❌ git push |

**Ativação:** Via `/AIOX:agents:{agent-id}` no Claude Code  
**Regras de autoridade:** Ver `.claude/rules/agent-authority.md`

---

## Agentes Workers dos Órgãos — Produtos

**Contexto:** Infraestrutura de produção (Coolify VPS + plataformas de automação)  
**Papel:** Operar os Núcleos autonomamente depois de construídos  
**Persistência:** Sempre ativos, execução autônoma

Os workers dos Órgãos são o **output** do SparkleOS, não os construtores. São agentes de IA embutidos nos Núcleos (ex: Zenya) que servem usuários finais e clientes autonomamente.

| Worker | Núcleo | Status | Épico de Criação |
|--------|--------|--------|-----------------|
| Zenya AI | `organs/zenya/` | Planejado | Epic 2 |
| Workers de Pilotagem | `organs/piloting/` | Planejado | Epic 4 |

> Workers são construídos PELOS agentes AIOX — não são os mesmos que agentes AIOX.

---

## Workflow: Story Development Cycle

```
@sm *draft → @po *validate → @dev *develop → @qa *qa-gate → @devops *push
```

Todo desenvolvimento começa com uma story. Sem story, sem código.

---

## Autoridade Exclusiva dos Agentes

| Operação | Agente Exclusivo | Consequência de Violação |
|----------|-----------------|--------------------------|
| `git push` / `git push --force` | @devops (Gage) | Bloqueado pelos demais agentes |
| `gh pr create` / `gh pr merge` | @devops (Gage) | Bloqueado pelos demais agentes |
| Adicionar/remover MCPs | @devops (Gage) | Requer aprovação |
| Veredicto de QA gate (PASS/FAIL/WAIVED) | @qa (Quinn) | Outros agentes não podem declarar gate |
| Transição `Draft → Ready` de story | @po (Pax) | @sm não pode dar GO sem @po |
| Criação de épicos | @pm (Morgan) | @sm só cria stories, não épicos |

**Matriz completa:** `.claude/rules/agent-authority.md`

---

## Delegação e Handoffs

```
@pm *create-epic
    └→ @sm *draft (por story)
           └→ @po *validate
                  └→ @dev *develop
                         └→ @qa *qa-gate
                                └→ @devops *push + *create-pr
```

| Solicitação | Delegar Para | Comando |
|-------------|-------------|---------|
| Push para remoto | @devops | `*push` |
| Criar PR | @devops | `*create-pr` |
| Criar épico | @pm | `*create-epic` |
| Criar story | @sm | `*draft` |
| Validar story | @po | `*validate-story-draft` |
| Gate de QA | @qa | `*gate {story}` |
| Pesquisa técnica | @analyst | `*research` |
| Schema DDL | @data-engineer | `*design-schema` |

---

## Ferramentas por Agente (Mapa de Arsenal)

Para detalhes sobre credenciais e configuração de ferramentas, ver:
- `docs/sops/sop-credenciais.md` — gerenciamento de credenciais
- `docs/sops/sop-pesquisa-agentes.md` — como agentes realizam pesquisa
- `.claude/rules/mcp-usage.md` — regras de uso de MCPs

| Ferramenta / MCP | Agentes que Podem Usar |
|-----------------|----------------------|
| EXA (web search) | @pm, @architect, @analyst, @sm |
| Context7 (library docs) | @dev, @qa, @architect, @sm, @data-engineer, @ux-design-expert |
| Apify (web scraping) | @analyst |
| Supabase | @dev, @data-engineer, @qa |
| CodeRabbit | @dev, @qa |
| Playwright (browser) | @dev, @qa, @ux-design-expert |
| GitHub CLI (gh) | @devops (push/PR exclusivo), @po (issues) |
| git (local) | @dev, @qa (read-only), @sm (branches), @data-engineer |
| git push/remoto | @devops EXCLUSIVO |

---

## Manutenção deste Documento

- **Quando atualizar:** Novo agente adicionado, nova ferramenta/MCP habilitado, restrição criada
- **Quem atualiza:** @sm (River) é o dono do documento
- **Como atualizar:** Ver `docs/sops/sop-atualizar-agent-map.md`
- **Consistência:** Cruzar com `.claude/rules/agent-authority.md` ao adicionar restrições
