# Story 16 — Investigações pendentes

## 1. Tool `Buscar_produto` retorna top-5 mesmo sem match real

**Observado:** 2026-04-22 durante smoke exploratório Fun.

**Evidência:**
- `Buscar_produto("toalha infantil personalizada")` → 5 resultados: Boné, Toalha, Ecobag, Óculos, Body. Só 1 relevante.
- `Buscar_produto("taça de champagne")` → 5 resultados todos de "taça de gin". **Zero** champagne.

**Impacto:**
- Zenya acaba sugerindo produto "parecido" quando cliente pede algo que Julia realmente não tem no catálogo (ou tem mas com nome diferente).
- Cliente pode se sentir enrolado ("Pedi champagne, me mandaram gin").
- O Fix #2 do prompt v2 mitiga NO LADO DO BOT (escalar sem sugerir), mas a causa raiz é a tool.

**Hipóteses (por probabilidade):**

| # | Hipótese | Como confirmar |
|---|---|---|
| 1 | Loja Integrada retorna top-N por relevância sem threshold mínimo. Mesmo 0% match dá resultados. | Chamar API direto com query impossível ("xpto123") — se retornar produtos, confirma. |
| 2 | Catálogo incompleto/mal taggeado na Loja Integrada — produtos existem mas com nomes diferentes do que cliente pergunta. | Auditar catálogo direto na dashboard da Julia. |
| 3 | Credencial API com escopo limitado (só produtos "ativos"/"em estoque") | `SELECT` em `zenya_tenant_credentials` da Fun + inspecionar permissões da API key. |

**Ação proposta pra próxima sessão:**
1. Chamar tool direto localmente com query bobinha pra confirmar (1).
2. Se confirmado: adicionar pós-filtro no wrapper da tool `Buscar_produto` — validar se termo do query aparece no nome/tags do produto, senão retornar vazio.
3. Se catálogo defasado (2): conversar com Julia pra alinhar nomes/tags.

**Registrado em:** 2026-04-22 04:00 BRT
**Relatado por:** Mauro (observação sobre conversas reais no Chatwoot onde cliente pede produto não achado)
