# ADR-007 — LLM Principal da Zenya: manter GPT-4.1 (incluindo Vision)

**Status:** Accepted  
**Data:** 2026-04-20  
**Autor:** @architect (Aria)  
**Insumo:** Research Memo — Atlas (@analyst), `docs/references/research-opus47-zenya-llm.md`  
**Epic relacionado:** Epic 11 — Capacidades Globais da Zenya

---

## Contexto

O Epic 11 (Story 11.1) planeja adicionar interpretação de imagens à Zenya via WhatsApp. O @analyst avaliou se era momento de migrar o agent loop de GPT-4.1 para Claude Opus 4.7, que foi lançado em 16/04/2026 com melhorias relevantes em Vision (3.75MP), tool use (−66% erros) e raciocínio multi-step (+14%).

Stack atual da Zenya:

| Componente | Provider | Modelo |
|---|---|---|
| Agent loop principal | OpenAI API | `gpt-4.1` |
| Transcrição de áudio (entrada) | OpenAI API | `whisper-1` |
| Síntese de voz (saída) | ElevenLabs | — |

---

## Decisão

**Manter GPT-4.1 como LLM principal da Zenya, incluindo Vision para o Epic 11.**

A Story 11.1 (interpretação de imagens) será implementada adicionando uma rota de imagem no fluxo n8n com chamada à Vision API do GPT-4.1 — sem novo provider.

---

## Alternativas avaliadas

| Opção | Descrição | Descartada por |
|---|---|---|
| **A** — Migrar tudo para Opus 4.7 | Agent loop + Vision via Anthropic API | Custo estrutural: Whisper permanece OpenAI de qualquer forma. Dois custos de API LLM sem necessidade. |
| **B** — GPT-4.1 no loop, Opus 4.7 só para Vision | Split de providers | Complexidade operacional de dois providers LLM ativos sem benefício proporcional. |
| **C** — Manter GPT-4.1 em tudo ✅ | Status quo + Vision API | Escolhida. |

---

## Racional

1. **Whisper não tem equivalente no Claude.** Transcrição de áudio de entrada permanece no OpenAI de qualquer forma. Adicionar Anthropic API não substitui OpenAI — cria um segundo custo de API.

2. **GPT-4.1 Vision é adequado para o use case.** Imagens de WhatsApp (~1–2MP) estão dentro do limite. A vantagem de 3.75MP do Opus 4.7 não se traduz em benefício real para fotos de produto, prints de pedidos ou documentos enviados via chat.

3. **Migrar provider sem dado que justifique é over-engineering.** O agent loop está em produção estável. Tool reliability (+66%) é atrativo, mas não há incidentes ativos que o justifiquem agora.

4. **Plano Claude ($550/mês) não cobre uso via API em código.** São produtos separados. Migrar exigiria abrir saldo na Anthropic API — novo custo, não substituição.

---

## Consequências

- Story 11.1 implementada com GPT-4.1 Vision — zero novo provider, zero nova conta de API.
- Stack da Zenya permanece: OpenAI (GPT-4.1 + Whisper) + ElevenLabs.

---

## Trigger de reavaliação

Reavaliar esta decisão quando **qualquer uma** das condições abaixo for verdadeira:

- [ ] Volume de tenants ≥ 10 com dados reais de custo/sessão
- [ ] Incidentes recorrentes de tool use no agent loop (> 5% de falha/mês)
- [ ] OpenAI aumentar preço do GPT-4.1 acima de $4/M input
- [ ] Claude lançar modelo com transcrição de áudio nativa (substitui Whisper)
