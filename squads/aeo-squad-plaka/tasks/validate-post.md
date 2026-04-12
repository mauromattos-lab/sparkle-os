---
task: Validar Post AEO
responsavel: "@rex"
responsavel_type: agent
squad: aeo-squad-plaka
atomic_layer: task
elicit: false
Entrada: |
  - post: Output completo da Lyra (título, meta, corpo, faq, cta)
  - iteration_count: Número da tentativa atual (1 ou 2)
Saida: |
  - veredicto: APROVADO | APROVADO_COM_OBSERVACOES | REVISAO | ESCALADO
  - score_aeo: 0-10
  - score_marca: 0-10
  - feedback: Lista de itens específicos a corrigir (se REVISAO)
  - observacoes: Itens menores documentados (se APROVADO_COM_OBSERVACOES)
Checklist:
  - "[ ] Verificar iteration_count — se >= 3, escalar para Mauro imediatamente"
  - "[ ] Aplicar checklist AEO (10 critérios)"
  - "[ ] Aplicar checklist marca Plaka (5 critérios)"
  - "[ ] Calcular score_aeo e score_marca"
  - "[ ] Definir veredicto com base nos scores"
  - "[ ] Se REVISAO: gerar feedback específico e acionável"
  - "[ ] Se ESCALADO: gerar resumo completo das iterações"
---

# *validate-post

Rex aplica o checklist AEO e o checklist de marca Plaka em cada post.

## Regra de Escalação

```
SE iteration_count >= 3:
  → veredicto = ESCALADO
  → Notificar Mauro com resumo das iterações
  → Parar pipeline

SE iteration_count < 3:
  → Aplicar checklists e definir veredicto normalmente
```

## Checklist AEO (10 critérios — peso 1 ponto cada)

1. **Abertura direta:** A pergunta central é respondida nos primeiros 100 palavras?
2. **Título como pergunta:** O H1 é uma pergunta que alguém faria a uma IA?
3. **Meta description:** Presente, até 160 caracteres, com resposta condensada?
4. **FAQ presente:** Mínimo 3 perguntas em H3 com respostas diretas?
5. **Estrutura limpa:** H2/H3 usados corretamente? Listas onde há 3+ itens?
6. **Afirmações específicas:** Sem generalidades vagas? Dados quando disponíveis?
7. **Tom de especialista:** Linguagem de referência, não de vendedor?
8. **Definições citáveis:** Termos técnicos definidos claramente?
9. **Comprimento:** Entre 800-1200 palavras?
10. **Coerência temática:** O post responde ao tópico do briefing sem desviar?

**Score AEO:** soma dos critérios atendidos (0-10)

## Checklist Marca Plaka (5 critérios — peso 2 pontos cada)

1. **Voz compatível:** Linguagem alinhada ao DNA da Plaka (sofisticação acessível, carioca)?
2. **Sem linguagem de loja:** Ausência de "confira", "aproveite", "não perca"?
3. **CTA sutil:** CTA presente mas não invasivo?
4. **Sem contradições:** Nada conflita com os valores da marca?
5. **Identidade:** Post poderia ser da Plaka — não de qualquer loja genérica?

**Score Marca:** soma dos critérios × 2 (0-10)

## Tabela de Veredictos

| Score AEO | Score Marca | Veredicto |
|-----------|-------------|-----------|
| >= 8 | >= 8 | APROVADO |
| >= 7 | >= 6 | APROVADO_COM_OBSERVACOES |
| < 7 | qualquer | REVISAO |
| qualquer | < 6 | REVISAO |
| qualquer (iter >= 3) | qualquer | ESCALADO |

## Formato do Output

### Se APROVADO
```
VEREDICTO: APROVADO
Score AEO: X/10
Score Marca: X/10
Post pronto para publicar.
```

### Se APROVADO_COM_OBSERVACOES
```
VEREDICTO: APROVADO_COM_OBSERVACOES
Score AEO: X/10
Score Marca: X/10
Observações (não bloqueantes):
- [item 1]
- [item 2]
Post aprovado. Observações para próximas iterações.
```

### Se REVISAO
```
VEREDICTO: REVISAO
Score AEO: X/10 — Critérios não atendidos: [lista]
Score Marca: X/10 — Critérios não atendidos: [lista]
Iteração: X/2

Feedback para Lyra:
1. [problema específico] → [o que fazer]
2. [problema específico] → [o que fazer]
```

### Se ESCALADO
```
VEREDICTO: ESCALADO
Iterações realizadas: 3

Resumo para Mauro:
- Tópico: [tópico do briefing]
- Problema persistente: [descrição]
- Tentativas: [resumo das iterações]
- Recomendação: [o que Rex recomenda]
```
