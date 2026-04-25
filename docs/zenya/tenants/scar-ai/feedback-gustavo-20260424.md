---
tenant: scar-ai
source: teste real do Gustavo no WhatsApp pareado com Z-API (+557481446755)
date: 2026-04-24
tester_phone: +557488614688
prompt_version_tested: 2 (md5 55ef54540dc464b7ba9a49453f5abc84)
collected_by: Mauro Mattos
---

# Feedback Gustavo — Teste Scar AI v2 (2026-04-24)

Gustavo testou como **cliente fictício** durante aproximadamente 20 min (22:05-22:25 BRT) via seu número pessoal +557488614688 pareado ao Business +557481446755. Dois problemas identificados. Teste pausado com feedback "deve ser só isso pra ajustar por enquanto".

---

## Issue #1 — Direta demais ao portfólio + mensagens em excesso por turno

### Observação

No primeiro turno da conversa (print 22:05-22:06), a Scar enviou **5 mensagens em ~60s**:

1. "Fala mano, tranquilo? Que massa ver você por aqui! Me conta um pouco de você — já faz live ou tá começando agora?"
2. "Qual plataforma você usa e qual estilo de visual tá buscando pro seu canal?"
3. "Aqui a gente trabalha só com streamer, então cada projeto é feito do zero..."
4. **"Você não tá só comprando um pacote, tá investindo na sua imagem. Dá uma olhada no portfólio: {link}"** ← portfólio apresentado antes de qualificação
5. "Se quiser, me fala o que mais curtir lá ou se já tem uma ideia do que quer — pode ser cenário, personagem, ou até um pacote completo."

### Diagnóstico

**Venda consultiva mal calibrada.** O prompt v2 está apresentando oferta (portfólio) antes de qualificar a dor do cliente. O que Gustavo (dono do negócio) espera:
- Turno 1-2: qualificar dor (canal novo? Tá faltando o quê no visual?)
- Turno 2-3: espelhar dor + reforçar que é resolvível
- Turno 4+: portfólio ancorado na dor mapeada

Também: densidade de 5 mensagens por turno é excesso. Ideal: 1-2 mensagens curtas, aguarda resposta.

### Proposta de fix (prompt v3)

1. Seção "Qualificação" reescrita em 4 camadas condicionais:
   - Camada 1 (dor): "Antes de mostrar material, entenda o que o cliente sente que falta no canal dele hoje."
   - Camada 2 (contexto): plataforma + nicho — só perguntar se não dito.
   - Camada 3 (estilo): cartoon/realista/vibe — depois da dor.
   - Camada 4 (oferta): portfólio + pacote — **nunca** antes das camadas 1-3.
2. Regra imperativa nova:
   > "Responda com 1-2 mensagens curtas por turno. Nunca mais que 3."
3. Exemplo concreto no prompt de abertura consultiva (ancorar no nicho do cliente antes de oferta).

---

## Issue #2 — Pergunta informação já dada no histórico

### Observação

No segundo turno (print 22:08-22:09):

Cliente (Gustavo testando):
- "Tudo bem meu amigo! Gostei do trabalho"
- **"Estou começando agora, na twitch"**
- **"Faço gameplay de gta rp"**
- (depois) "Acho que quero começar com algo completo, gostei do pacote Supervip"

Scar:
- "Valeu demais pelo feedback, fico feliz que curtiu!"
- **"Pra eu te ajudar certinho, me fala: você já faz live ou tá começando agora? Usa Twitch, YouTube, Kick...?"** ← **informação JÁ ESTAVA no histórico**
- "E tem algum estilo ou referência que você já tem em mente..."
- "Assim consigo te indicar o pacote ou as artes que mais combinam..."

### Diagnóstico

**Uso de contexto falho + script linear.** O prompt v2 tem uma lista de informações de qualificação ("preciso saber plataforma + estilo + pacote desejado") e o LLM está tratando como **script sequencial obrigatório**, sem checar o histórico.

Mesmo padrão da **Fun Personalize** (memória `feedback_tool_description_beats_tenant_prompt`) e corrigido na **PLAKA** (Roberta) via "tom imperativo > instrucional".

**Agravante:** a Scar nem engajou com "**gta rp**" — nicho específico que um bom vendedor usaria como hook ("GTA RP tem uma estética forte, dá pra puxar visual cyberpunk/futurista…").

### Proposta de fix (prompt v3)

1. Regra imperativa nova (copiar padrão PLAKA):
   > "Sempre releia o histórico antes de perguntar. Se a informação já foi dada, **não repita** — use-a. Repetir pergunta é o erro mais grave do atendimento."
2. Exemplo concreto de conversa onde cliente dá várias infos em um turno e a Scar agrega:
   ```
   ❌ ERRADO:
   Cliente: "Tô começando agora na twitch, faço gta rp"
   Scar: "Massa! Você já faz live? Qual plataforma usa?"

   ✅ CERTO:
   Cliente: "Tô começando agora na twitch, faço gta rp"
   Scar: "Massa, twitch + GTA RP tem uma vibe própria. O que você sente
   que tá faltando no visual do teu canal hoje?"
   ```
3. Reforçar que **nichos específicos (GTA RP, Valorant, Minecraft)** devem virar hook, não ser ignorados.

---

## Template para feedbacks futuros

Se Gustavo mandar mais feedback, consolidar aqui usando o formato:

```markdown
## Issue #N — {título curto}

### Observação
{screenshot + transcrição literal}

### Diagnóstico
{causa raiz — prompt? tool? chunker? infra?}

### Proposta de fix
{mudança cirúrgica no prompt ou código}
```

Ou pedir pro `@pm` (Morgan) adicionar um nova issue quando o feedback vier.

---

## Próximo passo

- [ ] @dev aplica prompt v3 com os 2 fixes acima
- [ ] Roda `smoke-scar.mjs` — 4/5 mantido + novos cenários D5b (cliente dá 3 infos juntas) e D9 (turno curto)
- [ ] Deploy via @devops + Mauro pede Gustavo re-testar a mesma sequência
- [ ] Se passar, fechar story 17.2 (refino Scar) + marcar scar-ai-onboarding-01 como Done
