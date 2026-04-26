---
tenant: scar-ai
source: 2 áudios WhatsApp Gustavo → Mauro (2026-04-25 22:33-22:34 BRT) após teste do prompt v4 em produção
date: 2026-04-25
tester_phone: +557488614688
prompt_version_tested: 4 (md5 d0f353cb411e7566692547851677d917, deploy 16h)
collected_by: Mauro Mattos
transcribed_by: '@pm (Morgan) via Whisper API direta'
audio_files:
  - C:\Users\Mauro\Downloads\WhatsApp Ptt 2026-04-25 at 22.33.56.ogg
  - C:\Users\Mauro\Downloads\WhatsApp Ptt 2026-04-25 at 22.34.09.ogg
---

# Feedback Gustavo — Teste Scar AI v4 (2026-04-25 noite)

Após o deploy do prompt v4 às 16h (story `scar-payment-links-01`), Gustavo testou o fluxo de fechamento direto via link Cakto e enviou 2 áudios identificando 2 issues novos. Não é regressão — é refino do fluxo de fechamento que apareceu na primeira validação real do v4.

Continuação natural do refino brownfield (memórias `feedback_prompt_iteration_reveals` — "cada fix expõe novo gap que o anterior mascarava").

---

## Issue #3 — Scar escala cedo demais após mandar link

### Transcrição literal (áudio 22:33:56)

> "Não, a gente tem que fazer com que ela continue na conversa até o cliente mandar o comprovante, sabe? Após o cliente mandar o comprovante, ela agradecer e falar que o Gu agora vai fazer o grupinho certo, entendeu?"

### Diagnóstico

**Comportamento atual (v4):** Regra Crítica §1 BR passo 4 instrui Scar a **escalar imediatamente após mandar o link Cakto** (`escalarHumano`). Resultado: Scar sai da conversa, label `agente-off` é aplicada, e qualquer mensagem subsequente do cliente fica sem resposta automatizada.

**Problema observado pelo Gustavo:** cliente humano não paga instantaneamente. Pode:
- Ficar pensando alguns minutos antes de pagar
- Ter dúvidas finais (forma de pagamento, prazo, parcelamento)
- Mandar o comprovante ("paguei!", "comprovante anexo") esperando confirmação
- Mudar de ideia (ver Issue #4)

Com Scar fora, todas essas interações ficam silenciosas — o que parece quebra de fluxo na ótica do cliente.

### Proposta de fix (prompt v5)

Reescrever Regra Crítica §1 BR — **separar 2 momentos de escalação:**

**Cenário A — Cliente confirma pagamento (texto):**
- Scar continua na conversa após mandar link
- Detecta confirmação de pagamento via palavras-chave: `"paguei"`, `"fechei"`, `"transferi"`, `"comprovante"`, `"acabei de pagar"`, `"feito"`, `"pix enviado"` (case-insensitive)
- Cliente mandou screenshot do comprovante? Sem multimodal vision, Scar **não vê a imagem** — só registra como mensagem com attachment. Confiar na confirmação verbal: se cliente diz "paguei" e/ou manda imagem, considerar pago.
- **Mensagem padrão pós-confirmação:** *"Show, valeu! Agora o Gu vai te puxar pro grupo de produção pra começar o projeto."* → chama `escalarHumano`.

**Cenário B — Cliente fica em silêncio depois do link:**
- Scar **não escala** sozinha. Aguarda mensagem subsequente do cliente.
- Se cliente perguntar dúvida sobre pagamento (ex: "consigo parcelar mais?"), Scar responde dentro do escopo (Cakto até 12x).
- Se cliente sumir, comportamento normal de cliente — Gustavo monitora Cakto manualmente.

**Cenário C — Cliente diz que vai pagar mais tarde:**
- "Vou pagar amanhã" / "Pago hoje à noite" / "Quando chegar em casa pago"
- Scar acolhe, **não escala**, deixa portas abertas: *"Tranquilo! Quando pagar me avisa aqui que aí o Gu já dá o pontapé inicial no projeto."*

### Risco se não corrigir
Cliente paga mas Scar já saiu → comprovante chega numa conversa silenciosa → Gustavo precisa monitorar Cakto + voltar ao Chatwoot → fricção operacional + impressão de "atendimento que abandonou".

---

## Issue #4 — Cliente pode mudar de pacote depois do link

### Transcrição literal (áudio 22:34:09)

> "Porque, às vezes, o cliente pode mudar o projeto, por exemplo. 'Ah, eu quero Essencial.' Aí mudou: 'Ah, não, não, não. Vou querer o Super VIP ou o Premium.'"

### Diagnóstico

**Comportamento atual (v4):** prompt não tem instrução explícita pra **mudança de pacote depois do link já enviado**. LLM pode interpretar como confusão/erro do cliente, pedir confirmação várias vezes, ou pior — escalar pro Gustavo "porque cliente está indeciso".

**Problema observado pelo Gustavo:** comportamento humano natural de venda — cliente compara, hesita, aumenta ticket conforme entende valor. Vendedor experiente acolhe sem fricção.

### Proposta de fix (prompt v5)

Adicionar **sub-regra na Regra Crítica §1 BR — "Cliente muda de pacote":**

> Se o cliente, depois de receber um link, indicar que prefere outro pacote (ex: *"pensei melhor, quero o Premium"*, *"acho que vou pegar o Super VIP"*, *"e se eu pegar o Essencial?"*), você **aceita sem julgar e sem cobrar o pacote anterior** (cliente ainda não pagou). Manda o link Cakto correto do novo pacote + opção de pagamento mantida (ou pergunta de novo se necessário).
>
> Pode até reforçar a escolha alta sutilmente: *"Boa escolha, o Premium tem [diferencial chave]. Te mando o link aqui."* — mas **nunca pressionar a escolher o mais caro**.

### Risco se não corrigir
LLM pode entender mudança como "cliente está confuso", chamar `escalarHumano` prematuramente, ou ficar em loop pedindo confirmação ("tem certeza?"). Cliente vai embora.

---

## Edge cases adicionais (cobertos pelo v5)

| Caso | Comportamento esperado |
|------|------------------------|
| Cliente manda imagem de comprovante sem texto | Scar não vê imagem (sem multimodal vision). Pode responder genérico tipo "recebi! deixa eu confirmar com o Gu", ou se houver attachment + ausência de texto, agradecer condicionalmente: *"Show, recebi aqui — vou conferir e o Gu já te chama no grupo se tiver tudo certo."* + escala (Gustavo verifica no Cakto) |
| Cliente muda de opção de pagamento (completo ↔ 50/50) | Mesmo padrão — manda novo link sem julgar |
| Cliente pede desconto depois de receber link | Aplicar Regra §3 (Sem desconto automático) — sugerir avulsas OU escalar pro Gustavo |
| Cliente pergunta sobre prazo de entrega | Scar responde dentro da seção "Prazos e entrega" (preservada do v3) sem escalar |

---

## Próximo passo

- [x] **2026-04-25 22:35** — @pm consolidou feedback e cria story `scar-payment-links-02` (v5)
- [ ] @dev aplica prompt v5 com Issues #3 e #4
- [ ] Estende `smoke-scar.mjs` com D7c (cliente muda pacote), D7d (cliente confirma pagamento por texto)
- [ ] Deploy via @devops + Mauro pede Gustavo re-testar fluxo completo
- [ ] Se passar, fechar **scar-payment-links-02** (Done) → **scar-payment-links-01** (Done) → **17.2** (Done) → **scar-ai-onboarding-01** parent (Done) → atualizar **EPIC-17-INDEX**

## Histórico de iterações Scar AI

| Versão | Data | Trigger | Resultado |
|--------|------|---------|-----------|
| v2 | 2026-04-22 | Smoke D2 detectou mistura PT/EN | Deploy via PR sem story formal (pré-Epic 17) |
| v3 | 2026-04-25 ~15h | Feedback Gustavo 24/04 (2 issues: portfólio cedo + repete pergunta) | Deploy via story 17.2 (PR #11, commit 33cc889) |
| v4 | 2026-04-25 ~16h | Decisão Mauro de fechar via link Cakto | Deploy via story scar-payment-links-01 (PR #12, commit ed02d6d) |
| **v5** | **2026-04-25 ~22:35** | **Feedback Gustavo 25/04 noite (2 issues: escala cedo + cliente muda pacote)** | **Story scar-payment-links-02 — Draft → InProgress** |
