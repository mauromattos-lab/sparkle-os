# ZENYA-LOGIC.md — Lógicas de Negócio Proprietárias da Zenya

**Versão:** v1.0.0
**Extraído por:** @analyst (Atlas) — Story 2.2
**Data:** 2026-04-11
**Fonte:** API n8n `https://n8n.sparkleai.tech` + JSONs locais em `docs/zenya/raw/`
**Aprovação:** Mudanças requerem aprovação de Mauro (FR10 / SOP: `docs/sops/sop-atualizar-ip-zenya.md`)

---

> ⚠️ **AVISO:** Este arquivo contém lógicas de negócio proprietárias da Zenya. Nenhuma alteração deve ser feita sem seguir o processo descrito no SOP de aprovação.

---

## Sumário

| ID | Lógica | Fluxo | Node | Tipo |
|----|--------|-------|------|------|
| L1 | Anti-cavalgamento de mensagens | `01. Secretária v3` | `Mensagem encavalada?` | Code (JS) |
| L2 | Cálculo de tipo de resposta | `01. Secretária v3` | `Calcular tipo da resposta` | Code (JS) |
| L3 | Velocidade de digitação humanizada | `07. Quebrar e enviar mensagens` | `Velocidade digitação` + `Espera` | Set + Wait (expresssões JS) |

---

## L1 — Anti-cavalgamento de Mensagens

**Localização:** Fluxo `01. Secretária v3` (ID: `r3C1FMc6NIi6eCGI`) → node `Mensagem encavalada?`
**Tipo de node:** Code (JavaScript)

### O que faz

Impede que a Zenya processe uma mensagem que foi "encavalada" — ou seja, quando o cliente enviou uma mensagem mais recente enquanto a anterior ainda estava sendo processada. O node compara o ID da última mensagem na fila com o ID da mensagem que iniciou o workflow. Se forem diferentes, o workflow é interrompido silenciosamente (retorna array vazio). Se forem iguais, passa adiante.

### Por que é IP

Esta lógica resolve um problema específico de UX: sem ela, a Zenya responderia mensagens antigas mesmo depois do cliente ter enviado algo novo, causando respostas fora de ordem e confusão no atendimento. É o mecanismo central de fluidez da experiência de atendimento.

### Código

```javascript
const ultima_mensagem_da_fila = $input.last()
const mensagem_do_workflow = $('Info').first()

if (ultima_mensagem_da_fila.json.id_mensagem !== mensagem_do_workflow.json.id_mensagem) {
  // Mensagem encavalada, para o workflow
  return [];
}

// Pass-through da fila de mensagens
return $input.all();
```

### Dependências de contexto

- `$input.last()` — última mensagem na fila de processamento
- `$('Info').first()` — metadados da mensagem que iniciou este workflow (node `Info`)
- Campo comparado: `id_mensagem`

---

## L2 — Cálculo de Tipo de Resposta

**Localização:** Fluxo `01. Secretária v3` (ID: `r3C1FMc6NIi6eCGI`) → node `Calcular tipo da resposta`
**Tipo de node:** Code (JavaScript)

### O que faz

Determina se a Zenya deve responder com texto ou áudio, com base na preferência configurada do contato no Chatwoot. Lógica de prioridade:
1. Se preferência = `'texto'` → responder em texto
2. Se preferência = `'audio'` → responder em áudio
3. Se preferência não está setada → usar o mesmo formato da mensagem recebida (se o cliente mandou áudio, responder em áudio; se mandou texto, responder em texto)

### Por que é IP

Define o comportamento adaptativo da Zenya — ela "fala o idioma" do cliente. Essa lógica é o que torna o atendimento mais natural e personalizado, especialmente para clientes que preferem áudio.

### Código

```javascript
const { preferencia_audio_texto } = $('Buscar atributos do contato').first().json.payload.custom_attributes;
const { mensagem_de_audio } = $('Info').first().json;

if (preferencia_audio_texto === 'texto') {
  return { tipo_resposta: 'texto' };
}
if (preferencia_audio_texto === 'audio') {
  return { tipo_resposta: 'audio' };
}
// Preferência não setada, usar tipo da mensagem do usuário
return { tipo_resposta: mensagem_de_audio ? 'audio' : 'texto' };
```

### Dependências de contexto

- `$('Buscar atributos do contato').first()` — node anterior que busca atributos do contato no Chatwoot
- Campo: `payload.custom_attributes.preferencia_audio_texto`
- `$('Info').first()` — metadados da mensagem atual
- Campo: `mensagem_de_audio` (boolean)

---

## L3 — Velocidade de Digitação Humanizada

**Localização:** Fluxo `07. Quebrar e enviar mensagens` (ID: `4GWd6qHwbJr3qLUP`)
**Nodes envolvidos:**
- `Velocidade digitação` (Set node — calcula parâmetros)
- `Espera` (Wait node — aplica o delay)
- `Digitando...` (HTTP Request — ativa indicador de digitação no Chatwoot)

### O que faz

Simula o tempo de digitação humano antes de enviar cada mensagem. Para cada mensagem do array gerado pelo divisor:
1. Ativa o indicador "digitando..." no Chatwoot (via API)
2. Calcula quantas palavras tem a mensagem (comprimento em chars ÷ 4,5)
3. Calcula o tempo de espera baseado em 150 palavras por minuto
4. Aguarda esse tempo (máximo 25 segundos) antes de enviar
5. Após enviar, aguarda mais 1 segundo antes da próxima mensagem

### Por que é IP

Transforma a experiência de atendimento. Sem esse mecanismo, todas as mensagens chegam instantaneamente e o cliente percebe que está falando com um robô. Com ele, a Zenya "digita" na velocidade de um humano, tornando o atendimento natural e aumentando a taxa de engajamento.

### Expressões (Set node `Velocidade digitação`)

```javascript
// Campo: palavras_por_minuto
150

// Campo: tamanho_mensagem_palavras
{{ $('Para cada mensagem').item.json.mensagem.length / 4.5 }}
```

### Expressão (Wait node `Espera`)

```javascript
// amount (segundos de espera) — máximo 25s
{{ Math.min(60 * $('Velocidade digitação').item.json.tamanho_mensagem_palavras / $('Velocidade digitação').item.json.palavras_por_minuto, 25) }}
```

### Fórmula expandida

```
tempo_espera = min( (comprimento_mensagem / 4.5) / 150 * 60, 25 )
             = min( comprimento_mensagem / 10.125, 25 )
```

Exemplo: mensagem de 100 chars → ~9,9 segundos de espera. Mensagem de 300 chars → 25 segundos (cap máximo).

### Dependências de contexto

- `$('Para cada mensagem').item.json.mensagem` — cada mensagem do array, vinda do node `Split` após o AI Agent divisor
- Constante: 150 palavras/minuto, 4.5 chars/palavra (estimativa), cap de 25 segundos

---

## Referências Cruzadas

- Prompts que trabalham com estas lógicas: `docs/zenya/ip/ZENYA-PROMPTS.md`
- Inventário completo dos fluxos: `docs/zenya/FLOW-INVENTORY.md`
- Processo de aprovação para alterações: `docs/sops/sop-atualizar-ip-zenya.md`

---

*Preservado por @analyst (Atlas) — Story 2.2 — 2026-04-11*
