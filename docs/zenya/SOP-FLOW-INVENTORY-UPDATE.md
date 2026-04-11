# SOP — Atualização do Inventário de Fluxos Zenya

**Versão:** 1.0
**Criado por:** @analyst (Atlas) — Story 2.1
**Data:** 2026-04-11

---

## Quando executar este SOP

Execute sempre que ocorrer uma das situações abaixo:

- Novo fluxo criado no n8n com tag `Zenya Prime`
- Fluxo existente renomeado, ativado, desativado ou deletado
- Dependências de um fluxo mudaram (novo node, nova credencial, nova integração)
- Sub-workflow passou a ser chamado por um novo fluxo (ou deixou de ser)
- IP identificado em novo local (prompt, código JS, variável)

---

## Quem executa

`@analyst` — responsável pela manutenção deste inventário.

---

## Procedimento

### 1. Verificar o que mudou no n8n

```bash
# Listar todos os fluxos com tag Zenya Prime e seu status atual
curl -s "https://n8n.sparkleai.tech/api/v1/workflows?limit=250" \
  -H "X-N8N-API-KEY: {API_KEY}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
zenya = [w for w in data['data'] if any(t['name']=='Zenya Prime' for t in w.get('tags',[]))]
print(f'Total: {len(zenya)}')
for w in sorted(zenya, key=lambda x: x['name']):
    print(f\"{w['id']} | {w['name']} | ativo: {w['active']}\")
"
```

Comparar com a tabela de resumo no `FLOW-INVENTORY.md`. Identificar:
- Fluxos novos (não estão no inventário)
- Fluxos removidos (estão no inventário mas sumiram do n8n)
- Mudanças de status (ativo → inativo ou vice-versa)

### 2. Para cada fluxo novo ou alterado — buscar detalhes

```bash
curl -s "https://n8n.sparkleai.tech/api/v1/workflows/{ID}" \
  -H "X-N8N-API-KEY: {API_KEY}"
```

Extrair: trigger, nodes principais, dependências externas, sub-workflows chamados.

### 3. Atualizar `FLOW-INVENTORY.md`

**Fluxo novo:** adicionar entrada completa seguindo o formato dos demais — ID, trigger, status, classificação, propósito, inputs, outputs, nodes principais, dependências, sub-workflows chamados.

**Fluxo alterado:** atualizar apenas os campos que mudaram.

**Fluxo removido:** remover a entrada e atualizar a tabela de resumo.

Sempre atualizar:
- Tabela de resumo no topo (`## Resumo Executivo`)
- Seção `## Mapa de Relacionamentos` se chamadas entre fluxos mudaram
- Seção `## IP Protegido` se novo IP foi identificado
- Seção `## Gaps e Riscos` se novo risco foi identificado ou gap foi resolvido

### 4. Atualizar `ZENYA-CONTEXT.md`

Se a mudança afeta as capacidades da Zenya (nova funcionalidade ou remoção), atualizar a tabela `## Capacidades atuais`.

### 5. Registrar a atualização

No rodapé do `FLOW-INVENTORY.md`, atualizar a linha de data e fonte:

```
*Inventário atualizado por @analyst — {data} — motivo: {breve descrição}*
```

### 6. Solicitar commit ao @devops

Após atualizar os arquivos, acionar `@devops` para commitar e fazer push de `docs/zenya/`.

---

## Formato de entrada no inventário

```markdown
### {número}. {Nome do fluxo}
- **ID:** `{id_n8n}`
- **Trigger:** {webhook path | sub-workflow | schedule | manual}
- **Status:** ativo | inativo
- **Classificação:** {atendimento | handoff | notificação | agendamento | financeiro | utilitário | setup}
- **Propósito:** {uma frase clara}
- **Inputs:** {o que o fluxo recebe}
- **Outputs:** {o que o fluxo produz}
- **Nodes principais ({N}):** lista dos nodes relevantes
- **Dependências:** lista de serviços externos
- **Chama:** (se aplicável) `{número}. {Nome}` (`{id}`)
- **Observações:** (se aplicável)
```

---

## O que NÃO incluir

- Fluxos sem tag `Zenya Prime` — pertencem a outros contextos
- Conteúdo de prompts, system messages ou código JS interno — registrar apenas a localização em `## IP Protegido`
- Credenciais, tokens ou URLs com autenticação
- Contexto de clientes ou instâncias que ainda não existem

---

*SOP criado por @analyst (Atlas) — Story 2.1 — 2026-04-11*
