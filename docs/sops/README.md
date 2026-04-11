# SOPs — Standard Operating Procedures

Índice de todos os SOPs do SparkleOS. Cada SOP documenta um processo repetível executável pelos agentes AIOS.

**Template base:** [SOP-TEMPLATE.md](./SOP-TEMPLATE.md)  
**Como criar um novo SOP:** [sop-criar-sop.md](./sop-criar-sop.md)

---

## Índice

| SOP | Título | Story | Responsável |
|-----|--------|-------|-------------|
| [sop-aiox-health-check.md](./sop-aiox-health-check.md) | Health Check do AIOX no SparkleOS | 1.2 | @dev |
| [sop-context-store.md](./sop-context-store.md) | Context Store — Uso e Operação | 1.3 | @dev |
| [sop-criar-adr.md](./sop-criar-adr.md) | Criar um ADR no SparkleOS | 1.4 | @dev |
| [sop-credenciais.md](./sop-credenciais.md) | Gerenciamento de Credenciais e Ferramentas | 1.5 | @dev |
| [sop-pesquisa-agentes.md](./sop-pesquisa-agentes.md) | Pesquisa e Validação de Ferramentas por Agentes | 1.5 | @dev |
| [sop-escalacao-mauro.md](./sop-escalacao-mauro.md) | Protocolo de Escalação para Mauro | 1.6 | @dev |
| [sop-criar-sop.md](./sop-criar-sop.md) | Como Criar um SOP no SparkleOS | 1.7 | @dev |
| [sop-gestao-custos.md](./sop-gestao-custos.md) | Como Revisar e Otimizar Custos no SparkleOS | 1.8 | @dev / Mauro |
| [sop-atualizar-agent-map.md](./sop-atualizar-agent-map.md) | Como Atualizar o Mapa de Capacidades dos Agentes | 1.9 | @sm |
| [sop-onboarding-cliente-zenya.md](./sop-onboarding-cliente-zenya.md) | Onboarding de Novo Cliente Zenya (isolamento RLS) | 1.10 | @dev / Mauro |

---

## Regra: SOP Obrigatório

Toda story que implementa um **processo repetível** deve incluir um SOP no seu Definition of Done:

```markdown
- [ ] SOP criado em `docs/sops/sop-{slug}.md` e registrado no README
```

**Critério de processo repetível:** O processo será executado em mais de uma ocasião por qualquer agente, ou contém passos que podem falhar e precisam de guia de troubleshooting.

O @qa verifica a existência do SOP antes de dar PASS em stories com processos repetíveis.

---

## Estrutura dos SOPs

```
docs/sops/
├── README.md              # Este arquivo — índice geral
├── SOP-TEMPLATE.md        # Template base para novos SOPs
├── sop-criar-sop.md       # Meta-SOP: como criar SOPs
└── sop-gestao-custos.md
├── sop-aiox-health-check.md
├── sop-context-store.md
├── sop-criar-adr.md
├── sop-credenciais.md
├── sop-pesquisa-agentes.md
└── sop-escalacao-mauro.md
```

---

## Versionamento

Cada SOP tem campo `Versão` no cabeçalho e seção `Histórico de Revisões`. Ao atualizar um SOP existente:
1. Incrementar versão (1.0 → 1.1 para ajustes, 1.x → 2.0 para reescrita)
2. Adicionar linha no Histórico de Revisões
3. Atualizar data no cabeçalho
