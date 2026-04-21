# Sessão — Briefing do Gustavo (Scar AI)

**Datas:** 2026-04-19 (primeiro contato + áudios) → 2026-04-20 (briefing final)
**Participantes:** Mauro (SparkleOS) ↔ Gustavo Gonçalves Oliveira (GuDesignerPro)
**Resultado:** briefing completo para onboarding do 4º tenant da Zenya
**Status:** ✅ fechado — pronto para abrir story de implementação

## 1. Cliente

- **Nome comercial:** GuDesignerPro
- **Contratante:** Gustavo Gonçalves Oliveira (CPF 103.418.885-24)
- **Localização:** Vila de Abrantes – Camaçari/BA
- **Contato:** WhatsApp +55 74 8144-6755 · e-mail `gudesignerpro@gmail.com` · Instagram `@gudesignerpro`
- **Única rede ativa:** Instagram (tráfego pago).
- **Experiência:** 5 anos como designer.
- **Dor declarada:** recebe 20–25 conversas/dia de tráfego pago, trabalha de madrugada, acorda tarde. Leads chegam pela manhã — janela em que ele está dormindo. Não consegue conciliar criatividade de design com atendimento.

## 2. Produto e persona

- **Produto:** pacotes de overlays e identidade visual para LiveStreamers (OBS Studio).
- **Público:** pessoas que querem identidade visual + overlays — maioria streamers, mas varia.
- **Nome do agente:** **Scar AI** (escolhido por ele).
- **Número WhatsApp:** usará o mesmo dele (+55 74 8144-6755) — nada de número novo.
- **Contrato draft:** `docs/zenya/contratos/Contrato_Zenya_Gustavo_DRAFT.md` (18/04, R$ 497/mês, 50%+50%, vencimento dia 18).

## 3. Tom e regras de conversa

- Informal mas não bagunçado. Próximo, como se fosse o próprio Gustavo respondendo.
- Seguro, sem parecer desesperado por venda.
- Exemplo de vibe: *"Fala mano, tranquilo? Vi que você chamou aqui… me conta, você já faz live ou tá começando agora?"*
- **Nunca** usa emojis.
- **Nunca** retorna JSON, markdown ou estruturas técnicas — só o texto da mensagem.
- Responde em português para clientes PT-BR e PT-PT, e em inglês para EN-US.

## 4. Roteiro de atendimento

1. Cumprimentar de forma leve e amigável.
2. Entender o cliente (já faz live, canal atual, estilo).
3. Mostrar valor — "nível profissional", "cada detalhe é estratégico", "você não está comprando um pacote, está investindo na sua imagem".
4. Apresentar o portfólio (link por idioma) e **deixar o cliente escolher sozinho** o estilo (Cenários/Personagens) e o nível. Não pergunta antes.
5. Contornar objeções sem pressionar.
6. Fechamento — escala para o Gustavo.

## 5. Catálogo consolidado

### Pacotes fechados (extraído dos PDFs de portfólio)

| Pacote | Inclui | BR | US |
|--------|--------|----|----|
| **Essencial** (Iniciante) | Logotipo, tipografia, personagem · Tela início/fim/pause + transição · Perfil + banner + até 3 painéis · Chatbox simples + instalação OBS | R$ 390 (10x R$ 39) | $100 (10x $10) |
| **Premium** (Experiência) | + cenário · + tela chat/cam, react, overlay facecam · + tela offline, até 6 painéis · + chatbox avançado | R$ 790 (10x R$ 79) | $400 (10x $40) |
| **Super VIP** (Nível Pro) | Tudo do Premium · até 10 painéis + 10 emojis ilustrados · **5 alertas de live** + chatbox avançado | R$ 1.890 (10x R$ 189) | $900 (10x $90) |

### Artes avulsas (áudio 21:42:39)

**Clientes brasileiros (BRL):**
- Ilustração personagem até cintura — R$ 150
- Ilustração cenário completo — R$ 400
- Tela animada — R$ 100
- Overlay facecam — R$ 150
- Transição de cena — R$ 100
- Banner canal — R$ 100
- Kit 5 painéis — R$ 100
- Kit 5 alertbox — R$ 200
- Chatbox — R$ 100
- Meta de like YouTube — R$ 300

**Clientes americanos (USD):**
- Character illustration waist up — $100
- Full scene illustration — $200
- Animated screen — $100
- Facecam overlay — $50
- Scene transition — $50
- Channel banner — $50
- 5-panels kit — $50
- 5-alertbox kit — $100
- Chatbox — $100

## 6. Prazos e entrega

- **Entrega:** 7 a 15 dias úteis após confirmação do pedido.
- **Formatos:** PNG, JPG, MP4, WEBM (+ editáveis quando necessário).
- **Customização:** 100% do zero — sem templates.
- **Revisões (fluxo de 3 etapas):**
  1. Esboço da ilustração
  2. Finalização da ilustração
  3. Prévia das artes estáticas
  4. Prévia da animação (para pacotes com elementos animados)

## 7. Pagamentos

| País | Método | Condições |
|------|--------|-----------|
| Brasil | Pix (com **7% de desconto**) ou cartão até 12x com juros | 50% contratar + 50% entrega |
| EUA | PayPal ou Higlobe | 50% contratar + 50% entrega |
| Portugal | (a definir por Gustavo — só sinalizou que quer atender) | — |

## 8. Objeções — respostas padrão

| Objeção | Resposta |
|---------|----------|
| "Tá caro" | Apresentar a tabela de artes avulsas como alternativa mais em conta |
| "Faz mais barato?" | Liberar **até 5%** de desconto para fechar o projeto. Nunca mais que isso |
| "Tem cupom / pode pagar depois?" | Não. Sempre 50% na contratação |
| "Canal cresce rápido com isso?" | Nunca prometer crescimento milagroso |

## 9. Regras críticas de escopo (o que a Scar NÃO faz)

1. **Não processa pagamento.** Áudio 21:27: Gustavo quer receber o caso qualificado e enviar PIX/link ele mesmo.
2. **Não cria grupos no WhatsApp.** Áudio 21:43:13: após fechamento, Gustavo + ilustrador criam grupo por projeto e enviam planilha de briefing (ideias do personagem, ideias do cenário, branding do canal, dados pessoais: idade, localização, experiência com live).
3. **Scar atua no 1:1 do número de WhatsApp**, nunca em grupo.

## 10. Decisões arquiteturais

- **Stack:** core SparkleOS direto (TypeScript/Hono na VPS) — **sem passar pelo n8n**. A Zenya já está migrando do n8n; criar Scar AI em n8n seria trabalho duplicado. Esta decisão vale como diretriz para todos os novos tenants daqui pra frente.
- **Tenant:** 4º tenant Zenya (após Zenya Prime, HL Importados, PLAKA).
- **Número WhatsApp:** mesmo de Gustavo (+55 74 8144-6755) — não é número novo dedicado (diferente da PLAKA).
- **Idioma:** detecção automática PT/EN na 1ª mensagem → define portfólio e moeda.

## 11. Material-fonte desta sessão

| Origem | Arquivo |
|--------|---------|
| Prompt base do Gustavo | Colado no chat 2026-04-20 19:xx |
| Áudio 1 (21:27, pagamento) | `WhatsApp Ptt 2026-04-19 at 21.27.32.ogg` |
| Áudio 2 (21:42:24, portfólio/idioma) | `WhatsApp Ptt 2026-04-19 at 21.42.24.ogg` |
| Áudio 3 (21:42:39, artes avulsas) | `WhatsApp Ptt 2026-04-19 at 21.42.39.ogg` |
| Áudio 4 (21:43:13, grupos de produção) | `WhatsApp Ptt 2026-04-19 at 21.43.13.ogg` |
| Portfólio BR | `docs/stories/scar-ai-onboarding-01/portfolios/portfolio-br.pdf` |
| Portfólio US | `docs/stories/scar-ai-onboarding-01/portfolios/portfolio-us.pdf` |
| Prints da conversa | `Captura de tela 2026-04-20 185446/185750/185759/185813.png` |

Os áudios foram transcritos via OpenAI Whisper. As transcrições estão consolidadas nas seções 3–9 deste documento.

## 12. Próximos passos

- [x] Briefing completo (este documento)
- [ ] Story `docs/stories/scar-ai-onboarding-01/` — esqueleto pronto; @sm refina em sub-stories quando necessário
- [ ] Prompt final da Scar AI aplicado no seed (`docs/stories/scar-ai-onboarding-01/prompt-scar-ai.md`)
- [ ] Contrato assinado + 50% pago (trigger do onboarding técnico)
- [ ] Tenant seedado no Supabase + Chatwoot configurado
- [ ] Z-API ligada ao número +55 74 8144-6755
- [ ] Smoke test com números de teste
- [ ] Go-live
