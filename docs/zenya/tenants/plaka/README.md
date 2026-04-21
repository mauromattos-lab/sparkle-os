# PLAKA — tenant Zenya (placeholder)

Diretório reservado para o tenant PLAKA Acessórios. Nascerá no padrão ADR-001 quando sair da fase de research.

## O que vai morar aqui

Quando a implementação do PLAKA começar (atualmente em Spec Pipeline, ver `docs/stories/plaka-01/spec/spec.md`):

- `prompt.md` — system prompt da agente Roberta com front-matter YAML no padrão ADR-001
- Outros artefatos de tenant se necessário (config, referências, etc.)

## Por que o stub existe

Criado em 2026-04-21 pela story `zenya-prompts-01-plaka-hl` como sinalização explícita de que o PLAKA deve seguir o padrão ADR-001 desde o primeiro commit de implementação. Evita que alguém comece o seed do PLAKA com `SYSTEM_PROMPT` hardcoded em `.mjs` por força do hábito.

## Referências

- Story de onboarding: `docs/stories/plaka-01/`
- Memória: `memory/project_plaka.md`
- Padrão: `docs/architecture/adr/ADR-001-zenya-prompt-storage.md`
- Exemplo do padrão: `docs/zenya/tenants/scar-ai/prompt.md` e `docs/zenya/tenants/hl-importados/prompt.md`
