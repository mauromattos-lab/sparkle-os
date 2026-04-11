# SOP-1.5-A: Como Gerenciar Credenciais no SparkleOS

**SOP ID:** SOP-1.5-A  
**Criado por:** @dev (Dex) — Story 1.5  
**Atualizado:** 2026-04-11

---

## Objetivo

Garantir que credenciais de serviços do SparkleOS sejam gerenciadas com segurança — disponíveis para desenvolvimento sem risco de vazamento no repositório.

## Credenciais do SparkleOS

| Serviço | Variáveis | Responsável | Onde fica |
|---------|-----------|-------------|-----------|
| Supabase | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY` | Mauro fornece | `.env` local |
| Redis (Coolify) | `REDIS_URL` | @devops configura | `.env` local + Coolify |
| Claude API | `ANTHROPIC_API_KEY` | Mauro fornece | `.env` local |
| API interna | `INTERNAL_API_TOKEN` | Gerar localmente | `.env` local + Coolify |
| VPS SSH | chave privada, `VPS_HOST`, `VPS_USER` | @devops configura | CI/CD secrets |
| GitHub | `GITHUB_TOKEN` | @devops configura | CI/CD secrets |

## Desenvolvimento Local

1. **Copiar o template:**
   ```bash
   cp packages/core/.env.example packages/core/.env
   cp apps/piloting/.env.example apps/piloting/.env.local
   ```

2. **Preencher com valores reais** (Mauro fornece via canal seguro — nunca por chat):
   - Supabase: `https://app.supabase.com` → Project Settings → API
   - Redis: painel Coolify → serviço Redis → connection string
   - Anthropic: `https://console.anthropic.com` → API keys

3. **Verificar que `.env` está no `.gitignore`:**
   ```bash
   git check-ignore -v packages/core/.env
   ```
   Esperado: `.gitignore:.env` (confirmado ignorado)

4. **Gerar `INTERNAL_API_TOKEN`:**
   ```bash
   openssl rand -hex 32
   ```

## Produção (Coolify)

Credenciais em produção são configuradas nas variáveis de ambiente do Coolify:
- Painel Coolify → Serviço → Environment Variables
- Nunca editar arquivos `.env` diretamente no servidor
- @devops tem autoridade exclusiva sobre configuração de produção

## Adicionando Nova Credencial

1. Adicionar a variável ao `.env.example` com placeholder e comentário explicativo
2. Documentar na tabela desta SOP (serviço, variáveis, responsável, onde fica)
3. Comunicar a @devops para configurar no Coolify
4. Atualizar `docs/agents/AGENT-MAP.md` se o mapa de acesso por agente mudar

## Regras de Segurança

- **NEVER** commitar `.env` — `.gitignore` bloqueia, mas verificar manualmente antes de `git add`
- **NEVER** passar credenciais por chat, email ou qualquer canal não criptografado
- `SUPABASE_SERVICE_KEY` **NUNCA** vai para o frontend (`apps/piloting`) — usar apenas `SUPABASE_ANON_KEY`
- Rotação de credenciais: quando suspeitar de vazamento, revogar imediatamente no painel do serviço

## Mapa de Acesso por Agente

| Agente | Credenciais acessíveis | Ferramentas MCP |
|--------|----------------------|-----------------|
| @dev | Todas (durante construção) | EXA, Context7, Playwright |
| @architect | Todas (leitura) | EXA, Context7 |
| @qa | Supabase (read), Redis (read) | Playwright, EXA |
| @devops | Todas (write) | Todas |
| @analyst | Nenhuma de serviço | EXA, Apify |
| @sm | Nenhuma de serviço | Context7 |
| @pm | Nenhuma de serviço | EXA |
