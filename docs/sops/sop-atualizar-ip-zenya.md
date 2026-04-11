# SOP — Atualização do IP da Zenya

**Versão:** 1.0
**Criado por:** @analyst (Atlas) — Story 2.2
**Data:** 2026-04-11
**Requisito:** FR10 — IP da Zenya preservado e versionado dentro do SparkleOS

---

## Princípio Fundamental

> **Nenhuma alteração no IP da Zenya ocorre sem aprovação explícita de Mauro.**

IP da Zenya compreende:
- Prompts e personalidade (systemMessages dos AI Agents)
- Lógicas de negócio proprietárias (código JS nos fluxos)
- Assets visuais e documentos (fotos de profissionais, documentos enviados pela Zenya)

---

## Quando este SOP se aplica

Execute sempre que houver intenção de alterar qualquer um dos seguintes:

| O que | Onde |
|-------|------|
| Prompt da Secretária v3 | `01.` → AI Agent `Secretária v3` |
| Prompt da Maria (Assistente Interno) | `08.` → AI Agent `Agente Assistente Interno` |
| Prompt do divisor de mensagens | `07.` → AI Agent `Agente divisor de mensagens` |
| Lógica anti-cavalgamento | `01.` → node `Mensagem encavalada?` |
| Lógica tipo de resposta | `01.` → node `Calcular tipo da resposta` |
| Parâmetros de velocidade de digitação | `07.` → nodes `Velocidade digitação` + `Espera` |
| Fotos de profissionais | `docs/zenya/ip/ZENYA-ASSETS-REGISTRY.md` |
| Documento COBRANÇA.pdf | `docs/zenya/ip/ZENYA-ASSETS-REGISTRY.md` |

---

## Quem executa cada etapa

| Etapa | Responsável |
|-------|------------|
| Proposta de alteração | Qualquer agente ou Mauro |
| Aprovação | **Mauro** (obrigatório — não delegável) |
| Implementação no n8n | @dev ou agente designado por Mauro |
| Atualização dos artefatos de IP | @analyst |
| Commit, tag e push | @devops |

---

## Procedimento

### Etapa 1 — Proposta de Alteração

O agente (ou Mauro) que identificar a necessidade de alterar o IP documenta a proposta em um arquivo temporário:

```markdown
# Proposta de Alteração de IP — {data}

**Tipo:** prompt | lógica | asset
**Item afetado:** {descrição exata do que será alterado}
**Motivo:** {por que a alteração é necessária}
**Impacto esperado:** {o que muda no comportamento da Zenya}
**Agente proponente:** {quem propõe}
```

### Etapa 2 — Gate de Aprovação de Mauro

**A aprovação de Mauro é obrigatória antes de qualquer implementação.**

Apresentar a proposta a Mauro via:
- Fila de Decisões (se implementada) — método preferido
- Mensagem direta — para alterações urgentes

Mauro responde com:
- **APROVADO** — implementar conforme proposto
- **APROVADO COM MODIFICAÇÕES** — implementar com ajustes descritos por Mauro
- **REPROVADO** — não implementar; arquivar proposta com motivo

Se Mauro não responder em 48h, escalar novamente. **Nunca implementar sem resposta explícita.**

### Etapa 3 — Implementação

Após aprovação de Mauro:

1. Implementar a alteração no n8n (via dashboard ou API)
2. Verificar funcionamento (teste manual ou automatizado)
3. Acionar @analyst para atualizar os artefatos de IP

### Etapa 4 — Atualização dos Artefatos (@analyst)

O @analyst atualiza os arquivos afetados:

**Se a alteração for em prompt:**
1. Extrair o systemMessage atualizado via API n8n:
   ```bash
   curl -s "https://n8n.sparkleai.tech/api/v1/workflows/{ID}" \
     -H "X-N8N-API-KEY: {API_KEY}" | \
     python3 -c "import sys,json; wf=json.load(sys.stdin); [print(n['parameters']['options']['systemMessage']) for n in wf['nodes'] if n.get('type','').endswith('.agent') and n['parameters'].get('options',{}).get('systemMessage')]"
   ```
2. Atualizar `docs/zenya/ip/ZENYA-PROMPTS.md` — seção correspondente (P1, P2 ou P3)

**Se a alteração for em lógica JS:**
1. Extrair o código atualizado via API n8n ou JSON bruto
2. Atualizar `docs/zenya/ip/ZENYA-LOGIC.md` — seção correspondente (L1, L2 ou L3)

**Se a alteração for em asset:**
1. Calcular SHA-256 do novo arquivo:
   ```bash
   # PowerShell
   Get-FileHash "arquivo.png" -Algorithm SHA256
   ```
2. Fazer upload para Supabase Storage no próximo prefixo de versão (`v2/`, `v3/`, etc.)
3. Atualizar `docs/zenya/ip/ZENYA-ASSETS-REGISTRY.md` — adicionar nova linha, manter histórico

**Sempre:**
- Adicionar nova entrada em `docs/zenya/ip/CHANGELOG.md` com: versão, data, o que foi alterado, motivo aprovado

### Etapa 5 — Versionamento e Tag (@devops)

1. Commit dos artefatos atualizados:
   ```
   feat: update Zenya IP v{X.Y.Z} — {descrição breve} [Story X.Y]
   ```
2. Criar tag git:
   ```bash
   git tag zenya-ip-v{X.Y.Z}
   git push origin zenya-ip-v{X.Y.Z}
   ```

**Convenção de versão:**
- `v1.x.x` → alterações de lógica ou prompt (sem mudança estrutural)
- `v2.0.0` → reformulação significativa da personalidade ou estrutura dos prompts
- `vx.x.1` → adição ou atualização de assets

---

## Versionamento Semântico do IP

| Tipo de alteração | Incremento |
|-------------------|-----------|
| Novo asset ou atualização de asset | PATCH (x.y.**Z**) |
| Ajuste de prompt (tom, detalhe, regra) | MINOR (x.**Y**.0) |
| Ajuste de lógica JS | MINOR (x.**Y**.0) |
| Reformulação de identidade/personalidade | MAJOR (**X**.0.0) |
| Adição de novo prompt ou lógica | MINOR (x.**Y**.0) |

---

## O que NÃO é coberto por este SOP

- Configurações do n8n não relacionadas ao IP (credenciais, webhooks, integrações externas)
- Alterações em fluxos que não afetam prompts, lógica de negócio ou assets da Zenya
- Adição de novos fluxos n8n sem IP proprietário

Para esses casos, seguir o `docs/zenya/SOP-FLOW-INVENTORY-UPDATE.md`.

---

## Referências

- `docs/zenya/ip/ZENYA-PROMPTS.md` — prompts atuais
- `docs/zenya/ip/ZENYA-LOGIC.md` — lógicas atuais
- `docs/zenya/ip/ZENYA-ASSETS-REGISTRY.md` — assets atuais
- `docs/zenya/ip/CHANGELOG.md` — histórico de versões
- `docs/zenya/FLOW-INVENTORY.md` — inventário completo dos fluxos
- `docs/prd.md §Requirements` — FR10 (requisito original)

---

*SOP criado por @analyst (Atlas) — Story 2.2 — 2026-04-11*
