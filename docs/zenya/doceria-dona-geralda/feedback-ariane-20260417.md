# Feedback da Ariane — 2026-04-17 (gatilho da pausa)

**Fonte:** 3 áudios WhatsApp Ariane → Mauro em 2026-04-17, transcritos via Whisper em 2026-04-22.
**Contexto:** feedback que levou Ariane a pedir pausa do fluxo Zenya da Doceria no mesmo sábado (pausa documentada em `memory/project_doceria.md`).
**Motivo de estar aqui:** é a **fonte de verdade** pros ajustes que entram no onboarding core. Derivados: INVENTARIO §Constraints, story `doceria-onboarding-01` AC.

---

## Áudio 1 — 17:40 (117KB) — o incidente da coxinha

> "Então, Mauro, é que ela tá mandando muita, muita informação, sabe, uma em cima da outra. É muita mensagem em textão, assim, tipo, pra pessoa responder. E, tipo, hoje, por exemplo, tá um pouco mais tarde, né. Ela confirma, por exemplo, 'Ah, tem salgados franca Tupiri, não sei o quê'. Hoje uma cliente pediu coxinha de franca Tupiri grande e coxinha de frango grande. Aí não tinha mais salgados grande, só tem médio. Aí ela confirmou, a cliente pagou e quando ela veio retirar, eu não... não tava prestando atenção em algumas mensagens que a robô tava respondendo. E eu não tinha visto que ela tinha mandado pics, elas já te apagam. Só que não tinha o salgado que ela pediu, entendeu? Aí eu queria ver com você pra arrumar isso. Tipo, tudo que ela for confirmar, que seja no mesmo dia, pra ela sempre passar pra mim confirmar, entendeu?"

**Extração objetiva:**
- **Problema 1:** bot manda textão em cima de textão, sobrecarrega cliente.
- **Problema 2:** bot confirmou venda de salgado perecível (coxinha de frango grande) que já tinha esgotado. Cliente pagou. Quando veio retirar, produto não existia mais → dor real, perda de confiança.
- **Regra derivada (hard constraint):** para **qualquer produto que seja "da vitrine" / do dia / perecível / estoque variável** — bot **NÃO pode fechar venda sozinho**. Deve sempre fazer **resumo do pedido e passar para humano confirmar** disponibilidade.

---

## Áudio 2 — 18:24 (32KB) — validação do approach

> "Não, assim tá perfeito. Só fazer o resumo e esperar que eu responda, tá ótimo. Aí é bom, ao invés de você mandar esse link do aplicativo, você mandar o link do cardápio que tá no nosso WhatsApp aqui. O que você acha?"

**Extração objetiva:**
- **Approach aprovado:** bot faz **resumo do pedido** → espera Ariane responder/confirmar → só aí procede. Ela diz "tá perfeito".
- **Trocar link:** fora o link `delivery.yooga.app/doceria-dona-geralda` (aplicativo). Usar o **link do cardápio que fica no WhatsApp deles** (link interno que Ariane/Dona Geralda mantêm). Qual URL exata — **pendente Mauro confirmar**.

---

## Áudio 3 — 18:59 (70KB) — decisão de pausar

> "Eu vou confirmar com a Alex, por enquanto deixa ela assim desativada, porque eu vou conversar com a Alex, né, pra ver o que é melhor. Porque, igual você podia, ela manda muita informação, tipo, é um textão imenso pro cliente, tipo, de apresentação, ou manda dois vídeos seguidos, enfim. Aí eu vou conversar com a Alex certinho pra ver como é que é melhor. Pra mim, na minha concepção, seria melhor mandar o cardápio, se for só bolo, né, esse que fica no nosso WhatsApp, mas eu vou ver certinho com a Alex."

**Extração objetiva:**
- **Decisão operacional:** Ariane pediu pra **desativar** o fluxo até alinhamento interno — o que levou à pausa no n8n desde 2026-04-18.
- **Novo stakeholder:** **Alex** — sócia/gestora da Doceria (papel exato a confirmar). Ariane valida decisões com ela.
- **Reforço problema de estilo:** "textão imenso", "dois vídeos seguidos" — bot está sendo verborrágico, intrusivo.
- **Concepção da Ariane (preliminar):** **se for só bolo**, mandar só o cardápio do WhatsApp — ou seja, fluxos diferentes para **produto planejável (bolo por encomenda)** vs **produto de vitrine (salgados do dia)**.

---

## Consolidação — 4 constraints pro prompt/produto

1. **HARD — venda de vitrine exige confirmação humana:** bot gera resumo + escalará pra Ariane/Alex confirmar disponibilidade. Nunca fecha venda autonomamente em SKU perecível.
2. **SOFT — estilo:** mensagens curtas, sem textão, sem múltiplas mídias em sequência.
3. **SOFT — cardápio:** substituir link Yooga pelo link interno de WhatsApp (URL pendente).
4. **META — stakeholders:** decisões de produto passam por Ariane **e** Alex. Nunca só Ariane.

---

## Bolo vs vitrine — diferença de classe de produto

A Ariane sinalizou (áudio 3) que **bolo** e **vitrine** têm fluxos diferentes na cabeça dela:

| Classe | Exemplo | Fluxo atual (n8n) | Fluxo desejado (core) |
|--------|---------|-------------------|----------------------|
| Planejável | Bolo por encomenda | bot fecha | bot **pode** fechar (bolo tem prazo, não é perecível imediato) |
| Vitrine | Coxinha / doces / salgados do dia | bot fechou (causou incidente) | bot **só faz resumo**, humano confirma |

Essa taxonomia é **requisito de produto** — precisa estar no prompt e possivelmente em lógica programática (guardrail). Relacionável à story `engine-hardening-01` (guard em software) — aqui o gatilho seria detecção de "confirmação de pedido de vitrine" sem invocação de escalação.

---

## Pendências pra destravar a story `doceria-onboarding-01`

- [ ] Mauro obtém **URL do cardápio WhatsApp** da Doceria (substitui Yooga no prompt)
- [ ] Mauro/Ariane confirmam **papel e telefone da Alex** (segundo admin do tenant)
- [ ] Ariane + Alex alinham se há **outras regras** além das 4 consolidadas acima
- [ ] Refazer prompt da Gê incorporando as 4 constraints — **novo baseline md5** antes do seed

---

## Changelog

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-04-22 | @pm Morgan | Transcrição Whisper dos 3 áudios Ariane de 2026-04-17. Consolidação das 4 constraints. |
