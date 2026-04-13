# Ghost CMS PoC — Story 6.1

Script de validação da integração Ghost Admin API para o Content Engine da Plaka Acessórios.

## O que este script valida

| AC | Descrição | Como valida |
|----|-----------|-------------|
| AC1 | Ghost acessível via HTTP | `GET /ghost/api/admin/site/` — 401 = Ghost online |
| AC2 | Autenticação com Staff API Key | JWT HS256 gerado localmente com `node:crypto` |
| AC3 | Post criado via API em status draft | `POST /ghost/api/admin/posts/` |
| AC4 | JSON-LD Schema BlogPosting no post | `codeinjection_head` populado |

---

## 1. Instalação do Ghost na VPS

### Opção A — Ghost CLI (recomendado)

```bash
# Pré-requisitos na VPS:
#   Node.js 18+ (LTS)
#   nginx instalado
#   MySQL 8 ou SQLite (PoC usa SQLite)

npm install -g ghost-cli@latest

mkdir -p /var/www/ghost
cd /var/www/ghost

# Instalação com SQLite (sem necessidade de MySQL para PoC)
ghost install --db sqlite3 --no-prompt --no-stack --port 2368

ghost start
ghost status  # deve mostrar: Ghost is running
```

**Versão testada:** Ghost 5.x (ghost-cli >= 1.25.0)

### Opção B — Docker (alternativa)

```bash
docker run -d \
  --name ghost-plaka \
  -e url=http://localhost:2368 \
  -p 2368:2368 \
  -v ghost-content:/var/lib/ghost/content \
  ghost:5-alpine

# Verificar:
docker logs ghost-plaka
```

---

## 2. Gerar Staff API Key no painel Ghost

1. Acesse `http://seu-ip:2368/ghost`
2. Crie conta admin (primeiro acesso)
3. Vá em **Settings → Integrations → Add custom integration**
4. Nome: `SparkleOS Content Engine`
5. Copie o **Admin API Key** (formato: `{id}:{secret}`)

---

## 3. Configurar variáveis de ambiente

No arquivo `.env` do pacote `brain` (ou raiz do projeto):

```env
GHOST_API_URL=http://seu-ip-da-vps:2368
GHOST_ADMIN_API_KEY=id_aqui:secret_aqui
```

---

## 4. Executar o script

```bash
# Na raiz do pacote brain:
cd packages/brain

node --env-file=.env --import tsx/esm scripts/ghost-poc.ts
```

### Saída esperada (sucesso)

```
============================================================
Ghost CMS PoC — Story 6.1
============================================================

✅ Config OK — Ghost URL: http://seu-ip:2368

[AC1] Verificando conectividade com Ghost...
✅ AC1 PASS — Ghost acessível em http://seu-ip:2368

[AC2] Gerando token JWT para Admin API...
✅ AC2 PASS — JWT gerado com sucesso
   Token (primeiros 40 chars): eyJhbGciOiJIUzI1NiIsImtpZCI6Ii...

[AC3+AC4] Criando post de teste com JSON-LD Schema...
✅ AC3 PASS — Post criado com sucesso
   ID: 64f1a2b3c4d5e6f7a8b9c0d1
   Título: [PoC] Ghost CMS + AEO — Teste 2026-04-13 10:30:00
   Status: draft
✅ AC4 PASS — codeinjection_head com JSON-LD incluído

============================================================
RESULTADO: ✅ GO — Todos os ACs validados
============================================================
```

---

## 5. Verificação manual no painel

Após executar o script com sucesso:

1. Acesse `http://seu-ip:2368/ghost`
2. Vá em **Posts** → **Drafts**
3. Verifique o post criado: `[PoC] Ghost CMS + AEO — Teste ...`
4. Abra o post → **Settings** → **Code injection**
5. Confirme que o `<script type="application/ld+json">` está presente em **Post Header**

---

## 6. Critérios de GO/NO-GO

| Resultado | Decisão |
|-----------|---------|
| Todos os ACs passando | **GO** → implementar Story 6.2 |
| `AC1 FAIL` — Ghost não acessível | Verificar instalação e porta 2368 no firewall |
| `AC2/AC3 FAIL` — erro 401/403 | Verificar API Key no painel Ghost |
| `AC2 FAIL` — Buffer hex error | Secret da API Key está correto? |

---

## 7. Troubleshooting

### "Ghost não acessível"
```bash
# Na VPS:
ghost status
# Se parado:
ghost start

# Verificar porta:
ss -tlnp | grep 2368

# Firewall (Ubuntu):
ufw allow 2368
```

### "Token inválido" (401 na criação do post)
- O script usa `node:crypto` para gerar JWT sem dependências externas
- Confirme que `GHOST_ADMIN_API_KEY` está no formato `{id}:{secret}` (com `:` separando)
- O secret deve ter comprimento par (é hexadecimal)

### "Ghost CLI não instala"
```bash
# Verificar Node.js:
node --version  # deve ser 18+

# Ghost CLI requer usuário não-root com sudo:
# Não rode como root — crie usuário específico:
adduser ghost-user
usermod -aG sudo ghost-user
su - ghost-user
```

---

## Informações da PoC

| Item | Valor |
|------|-------|
| Story | 6.1 — PoC: Ghost CMS na VPS |
| Epic | 6 — Canal de Blog AEO |
| Data | 2026-04-13 |
| Executor | Dex (@dev) |
| Ghost versão testada | 5.x |
| Autenticação | JWT HS256 (node:crypto, sem deps externas) |
| Banco de dados PoC | SQLite |
| Banco de dados produção | MySQL 8 (recomendado para Story 6.2) |
