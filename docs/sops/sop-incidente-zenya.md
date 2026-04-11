# SOP — Resposta a Incidentes Zenya

**Story:** 2.9 — Protocolo de Erro e Fallback da Zenya
**Responsável:** Mauro (operador)
**Data:** 2026-04-11
**Revisão:** @dev (Dex)

---

## 1. Objetivo

Este SOP define o processo de detecção, triagem e resposta a incidentes na plataforma Zenya. O objetivo é garantir que falhas sejam identificadas rapidamente, tratadas com a severidade correta, e que Mauro seja notificado somente quando a intervenção humana for necessária.

---

## 2. Detecção de Incidentes

### 2.1 Verificação Manual de Saúde

```bash
# Verificar status de todos os serviços
curl https://{zenya-adapter-url}/health

# Resposta esperada (sistema saudável):
{
  "status": "healthy",
  "services": {
    "n8n": { "status": "up", "latencyMs": 45 },
    "chatwoot": { "status": "up", "latencyMs": 120 },
    "postgres": { "status": "up", "latencyMs": 8 }
  },
  "checkedAt": "2026-04-11T10:00:00.000Z"
}
```

**Interpretação:**
- `"status": "healthy"` → todos os serviços operacionais
- `"status": "degraded"` → Postgres down, mas n8n e Chatwoot ainda funcionam
- `"status": "down"` → n8n ou Chatwoot down — Zenya está parada

### 2.2 Sinais de Alerta

| Sinal | Possível Causa |
|-------|---------------|
| Clientes sem resposta via WhatsApp | n8n down, Chatwoot down, ou Z-API down |
| Agendamentos não funcionando | Google Calendar API falhou |
| Cobranças não sendo geradas | Asaas API falhou |
| `GET /health` retorna `degraded` | Postgres indisponível |
| `GET /health` retorna `down` | n8n ou Chatwoot críticos |
| Erro 502 na API do Adapter | Serviço externo recusou conexão |
| Erro 503 na API do Adapter | Banco de dados indisponível |

---

## 3. Classificação de Severidade (P1/P2/P3)

### P1 — Crítico: Zenya Parada

**Definição:** Nenhum cliente consegue ser atendido. Toda operação da Zenya está impossível.

**Exemplos:**
- n8n completamente down (todos os 15 fluxos parados)
- Chatwoot indisponível (mensagens WhatsApp não chegam)
- Z-API down (camada WhatsApp comprometida)
- OpenAI down por mais de 5 minutos

**Tempo de Resposta:** Imediato (< 15 min)
**Notificar Mauro:** **Sempre**

### P2 — Degradado: Funcionalidade Parcial

**Definição:** Alguns clientes ou funcionalidades estão comprometidos. Operação básica possível.

**Exemplos:**
- Google Calendar API falhando (agendamentos não funcionam, mas chat continua)
- Asaas API falhando (cobranças não geradas, mas atendimento continua)
- Postgres com latência alta (> 2s por query)
- Falha de provisionamento de novo cliente (POST /clients erro)

**Tempo de Resposta:** < 1 hora
**Notificar Mauro:** Após 3 tentativas de retry sem sucesso

### P3 — Baixo Impacto: Auxiliar Comprometido

**Definição:** Funcionalidade não-crítica afetada. Atendimento principal operacional.

**Exemplos:**
- Timeout de uma ferramenta do AI Agent (ex: consulta de calendário lenta)
- Erro de parsing de resposta de API externa (1 request isolado)
- Compensação parcial de saga falhou (recursos órfãos no n8n ou Chatwoot)

**Tempo de Resposta:** Próximo ciclo de manutenção
**Notificar Mauro:** Não (registrar no log para revisão)

---

## 4. Critérios de Notificação Automática vs. Retry

### Tenta Antes de Escalar (retry automático)

| Condição | Comportamento |
|----------|--------------|
| Timeout de serviço externo (Google Calendar, Asaas) | Retry 3x com backoff exponencial (1s, 2s, 4s) |
| Erro de parsing de resposta de API | Log do erro + resposta genérica ao cliente |
| Latência alta do Postgres (> 2s) | Retry 1x após 500ms |

### Notificar Mauro Imediatamente (sem retry)

| Condição | Motivo |
|----------|--------|
| Postgres completamente down | Dados de memória e cobranças em risco |
| n8n down por > 5 minutos | Zenya completamente parada |
| Chatwoot down | Nenhuma mensagem sendo processada |
| Compensação de saga falhou | Recursos órfãos requerem limpeza manual |
| Erro P1 sem recuperação automática | Intervenção humana necessária |

---

## 5. Resposta por Severidade

### P1 — Resposta Imediata

```
1. Confirmar falha: GET /health
2. Identificar serviço(s) down em "services"
3. Notificar Mauro com: serviço afetado, horário, impacto estimado
4. Executar triagem (ver Seção 6)
5. Após resolução: verificar GET /health retorna "healthy"
6. Preencher post-mortem (ver Seção 7)
```

### P2 — Resposta em 1 Hora

```
1. Confirmar falha via logs ou GET /health
2. Avaliar impacto: quantos clientes afetados?
3. Tentar resolução (ver troubleshooting por serviço abaixo)
4. Se não resolvido em 3 tentativas: notificar Mauro
5. Documentar incidente no Change Log do SOP
```

### P3 — Resposta Assíncrona

```
1. Registrar incidente nos logs
2. Incluir na próxima revisão de manutenção
3. Se acumular > 3 ocorrências do mesmo tipo: elevar para P2
```

---

## 6. Triagem por Serviço

### n8n Indisponível

**Diagnóstico:**
```bash
# Verificar diretamente
curl https://{n8n-url}/api/v1/healthz

# Verificar via Adapter
curl https://{adapter-url}/health | jq '.services.n8n'
```

**Resolução:**
1. Verificar painel do Railway/Render (onde n8n está hospedado)
2. Reiniciar instância n8n se possível
3. Verificar credenciais (N8N_API_KEY) — podem ter expirado
4. Se n8n está up mas fluxos estão inativos: reativar manualmente no painel

### Chatwoot Indisponível

**Diagnóstico:**
```bash
curl https://{chatwoot-url}/auth/sign_in
```

**Resolução:**
1. Verificar painel do provedor (fazer.ai ou self-hosted)
2. Checar CHATWOOT_USER_TOKEN — tokens podem expirar
3. Verificar integração Z-API no painel Chatwoot

### Postgres Indisponível

**Diagnóstico:**
```bash
# Via Adapter
curl https://{adapter-url}/health | jq '.services.postgres'
```

**Resolução:**
1. Verificar painel do Supabase — projeto pausado?
2. Supabase free tier pode pausar após inatividade — reativar no painel
3. Verificar DATABASE_URL — string de conexão válida?
4. Verificar se está usando Session Mode ou Transaction Mode no pooler

### Google Calendar Auth Expirada

**Diagnóstico:** Fluxos 03, 04, 11, 12 retornam erro de autenticação

**Resolução:**
1. Acessar credenciais OAuth no n8n
2. Reconectar conta Google Calendar
3. Reativar fluxos afetados

### Asaas API Falhando

**Diagnóstico:** Fluxo 06 retorna erro de cobrança

**Resolução:**
1. Verificar status da API Asaas: https://status.asaas.com
2. Verificar API key do Asaas nas credenciais n8n
3. Se API Asaas está down: notificar Mauro, aguardar recuperação

---

## 7. Post-Mortem (Incidentes P1)

Para cada incidente P1, registrar:

```
Data: ____________________
Duração: ____________________
Serviço afetado: ____________________
Causa raiz: ____________________
Impacto (clientes afetados): ____________________
Ação tomada: ____________________
Prevenção futura: ____________________
```

---

## 8. Change Log do SOP

| Data | Incidente | Resolução | Observações |
|------|-----------|-----------|-------------|
| 2026-04-11 | SOP criado | — | Story 2.9 |

---

## 9. Referências

- Health check: `GET /nucleus/zenya/health` (produção) ou `GET /health` (local)
- Mapeamento de falhas: `docs/zenya/ERROR-FALLBACK-MAP.md`
- Classes de erro: `organs/zenya/src/errors/`
- Isolamento de dados: `docs/zenya/ISOLATION-SPEC.md`
- Provisionamento: `docs/sops/sop-provisionar-cliente-zenya.md`
