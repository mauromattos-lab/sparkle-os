# SOP — Melhoria Incremental de Fluxos Zenya

**Versão:** 1.0.0  
**Data:** 2026-04-11  
**Autor:** @architect (Aria)  
**Story:** 2.5 — Protocolo de Melhoria Incremental dos Fluxos  

---

## Objetivo

Garantir que qualquer melhoria nos fluxos n8n da Zenya seja proposta, aprovada, testada e aplicada de forma segura, rastreável e revertível — sem risco à operação atual de clientes.

---

## Estágios do Protocolo

```
PROPOSTA → CLASSIFICAÇÃO → APROVAÇÃO → IMPLEMENTAÇÃO (clone) → VALIDAÇÃO → PROMOÇÃO → CHANGELOG
```

---

## Estágio 1 — Proposta

1. Identificar a melhoria (gap, incidente, sugestão, requisito novo)
2. Copiar `docs/zenya/templates/FLOW-IMPROVEMENT-PROPOSAL.md` para `docs/zenya/proposals/PROP-{NNN}-{slug}.md`
3. Preencher todos os campos obrigatórios do template
4. Determinar a **classe da mudança** (ver Estágio 2)
5. Verificar se a mudança **toca IP** (ver seção "Detecção de IP")

---

## Estágio 2 — Classificação

### Classes de Mudança

| Classe | Exemplos | Gate de Aprovação |
|--------|----------|-------------------|
| **Menor** | Ajuste de texto em mensagem, mudança de parâmetro numérico, alteração de URL, adição de node de log, reordenação de nodes sem impacto em lógica | @architect (auto-aprovado) |
| **Moderada** | Nova lógica condicional, novo node com efeito colateral (ex: novo webhook), mudança em fluxo de dados entre nodes, integração com novo serviço externo | @pm (Morgan) |
| **Maior** | Novo fluxo completo, mudança estrutural em fluxo existente (reorganização de 50%+ dos nodes), substituição de serviço externo, alteração de trigger principal | Mauro |

**Regra de toque em IP — eleva gate automaticamente:**

Se a mudança tocar qualquer item abaixo, o gate passa obrigatoriamente para **Mauro**, independente da classe:

| Item de IP | Localização |
|-----------|-------------|
| `systemMessage` dos AI Agent nodes | Fluxos `01.` e `08.` |
| Código JS do nó `Mensagem encavalada?` | Fluxo `01.` |
| Código JS do nó `Velocidade digitação` | Fluxo `07.` |
| Qualquer alteração de tom, persona ou lore | Qualquer fluxo |

> Ver: `docs/zenya/ip/ZENYA-PROMPTS.md`, `docs/zenya/ip/ZENYA-LOGIC.md`  
> Processo de aprovação de IP: `docs/sops/sop-atualizar-ip-zenya.md`

---

## Estágio 3 — Aprovação

### Por Classe

**Menor (não toca IP):**
- @architect revisa a proposta
- Se aprovado: registra "Aprovada" no status da proposta e avança para Estágio 4
- Sem necessidade de aguardar outros aprovadores

**Moderada (não toca IP):**
- @architect revisa e encaminha para @pm
- @pm aprova ou solicita ajustes
- Prazo esperado: 1 ciclo de trabalho

**Maior ou qualquer mudança que toca IP:**
- @architect prepara proposta detalhada
- Apresentar a Mauro com: impacto, rollback e justificativa
- Aguardar aprovação explícita antes de qualquer implementação
- Registrar aprovação de Mauro no Change Log da proposta

---

## Estágio 4 — Implementação (Ambiente de Teste)

> **Nunca modificar fluxos de produção diretamente.**

1. **Clonar o fluxo:**
   ```
   POST /nucleus/zenya/flows/{id}/clone
   ```
   *(Disponível após Story 2.4 Done)*

2. **Configurar o clone para ambiente de teste:**
   - Apontar para inbox de teste no Chatwoot (não a inbox de produção)
   - Usar número de WhatsApp de teste (não o número real de clientes)
   - Desativar notificações externas se aplicável

3. **Aplicar a mudança no clone:**
   - Seguir exatamente o que está descrito na proposta (`PROP-{NNN}`)
   - Não fazer mudanças adicionais — apenas o que foi aprovado

4. **Documentar o estado antes e depois** no campo "Plano de Implementação" da proposta

---

## Estágio 5 — Validação

1. Testar o fluxo clonado com os cenários definidos na proposta
2. Verificar que o comportamento esperado foi atingido
3. Verificar que nenhum comportamento existente foi quebrado
4. Registrar resultado nos campos de status da proposta

**Critérios mínimos de validação por classe:**

| Classe | Mínimo de testes |
|--------|-----------------|
| Menor | 1 cenário happy path |
| Moderada | Happy path + 1 cenário de erro |
| Maior | Happy path + cenários de erro + teste de carga básico |

---

## Estágio 6 — Promoção para Produção

1. Confirmar que todos os testes passaram
2. Aplicar a mesma mudança no fluxo de produção no n8n
3. Monitorar o fluxo por pelo menos 1 ciclo de atendimento real
4. Deletar o clone de teste
5. Atualizar `docs/zenya/FLOW-INVENTORY.md` se o comportamento do fluxo mudou

---

## Estágio 7 — Changelog

1. Atualizar o status da proposta para "Aplicada em produção"
2. Registrar em `docs/zenya/ip/CHANGELOG.md` se o IP foi afetado (com bump de versão)
3. Registrar na seção de Change Log da proposta: data, quem aplicou, commit se houver
4. Notificar @pm do fechamento

---

## Rollback

Se algo der errado após promoção:

1. **Imediato:** Reverter o fluxo no n8n para o estado anterior (n8n mantém histórico de versões)
2. **Se histórico não disponível:** Aplicar o plano de rollback documentado na proposta
3. **Registrar o incidente** na proposta com: o que falhou, como foi revertido, lição aprendida
4. **Abrir nova proposta** se o problema identificado requer mudança adicional

---

## Referências

- `docs/zenya/templates/FLOW-IMPROVEMENT-PROPOSAL.md` — template de proposta
- `docs/zenya/proposals/` — propostas ativas e históricas
- `docs/zenya/ip/` — IP protegido da Zenya
- `docs/sops/sop-atualizar-ip-zenya.md` — gate de Mauro para mudanças de IP
- `docs/zenya/FLOW-INVENTORY.md` — inventário com gaps e riscos
- `docs/zenya/NUCLEUS-CONTRACT.md` — contrato do Núcleo Zenya
