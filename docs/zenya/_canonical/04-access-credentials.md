# Capítulo 4 — Access & Credentials Map

**Versão:** 1.0 (Brownfield Discovery Fase 8)
**Autor:** `@architect` Aria
**Data:** 2026-04-25
**Pergunta-mãe:** *"O que precisa de credencial? Onde estão? Como seedo? Como roto? Qual o blast radius?"*

> **Consolida:** Cap. 2 §5 (encryption) + `.env.example` (atualizado pós-brownfield) + memórias `reference_*` (vps, supabase, vercel, webhook).

---

## §1 — Mapa global de credenciais

### Tier 1 — Globais (uma só, do servidor)

Vivem em `.env` da VPS (`/root/SparkleOS/packages/zenya/.env`) **e** `.env` raiz local pra desenvolvimento.

| Var | Função | Onde guardada hoje | Como rotar | Blast radius se vazada |
|-----|--------|---------------------|------------|------------------------|
| `SUPABASE_URL` | Endpoint Postgres | `.env` VPS + repo `.env` local | Não rotaciona — depende de migrar projeto Supabase | Baixo (pública por design) |
| `SUPABASE_SERVICE_KEY` | Bypassa RLS — service role | `.env` VPS + repo `.env` local | Supabase Studio → Settings → API → "Reset service_role key" → atualizar 2 lugares | **CRÍTICO** — leitura/escrita irrestrita do banco |
| `SUPABASE_PAT` | Management API (DDL) | `.env` VPS + repo `.env` local | Supabase Account → Tokens → revogar/criar novo | **CRÍTICO** — DDL irrestrito |
| `ZENYA_MASTER_KEY` | AES-256-GCM master key | `.env` VPS apenas | Plano formal abaixo §3 (rotação não implementada hoje — TD-29 wishlist) | **MÁXIMO** — descriptografa todas credenciais por tenant |
| `OPENAI_API_KEY` | LLM (gpt-4.1, gpt-4.1-mini, whisper) | `.env` VPS + repo `.env` local | Platform OpenAI → API keys → revogar/novo | Alto — consumo $$$ no nome do projeto |
| `CHATWOOT_BASE_URL` | URL do Chatwoot fork | `.env` | Estática — só muda se trocar provedor | Baixo (pública) |
| `CHATWOOT_API_TOKEN` | Token Chatwoot superadmin | `.env` VPS + repo `.env` local | Chatwoot UI → Profile Settings → Access Token → revogar/novo | Alto — leitura/escrita de TODAS conversas |
| `ELEVENLABS_API_KEY` | TTS | `.env` VPS + repo `.env` local | ElevenLabs Dashboard → Profile → API Keys | Médio — consumo $$$ |
| `ELEVENLABS_VOICE_ID` | ID da voz da Zenya | `.env` | Estática (selecionada por tenant ou global) | Nenhum |
| `GOOGLE_CLIENT_ID` | OAuth Google (Calendar, Drive) | `.env` VPS + repo `.env` local | GCP Console → Credentials → recriar OAuth client | Baixo (pública) |
| `GOOGLE_CLIENT_SECRET` | OAuth Google secret | `.env` VPS apenas | GCP Console → recriar | Alto |
| `ZENYA_PORT` | porta do core webhook | `.env` (default 3004) | Estática | Nenhum |
| `ZENYA_DEBOUNCE_MS` | debounce em ms | `.env` (default 2500) | Estática (configurável) | Nenhum |
| `ZENYA_LOCK_TTL_MS` | TTL pra detectar lock órfão (Story 18.1 / TD-06) | `.env` (default 300000 = 5min) | Estática (configurável) | Nenhum |
| (constante interna) `BOOT_GRACE_PERIOD_MS` | Janela pós-boot do admin agent pra filtrar burst Z-API (Story 18.3 / TD-08) | hardcoded 60000 ms em `admin-agent.ts` (futura env-driven se cicatriz aparecer) | Estática | Nenhum |

### Tier 2 — Por tenant (criptografadas)

Tabela `zenya_tenant_credentials` com AES-256-GCM. **Só são úteis combinadas com `ZENYA_MASTER_KEY`** (Tier 1).

| Service | Tenants com cred hoje | Bytes encrypted | Função |
|---------|----------------------|-----------------|--------|
| `zapi` | Zenya Prime | 191 | Z-API instance pra labels nativas WhatsApp |
| `loja-integrada` | Julia (Fun) | 122 | Loja Integrada — busca pedido + produto |
| `nuvemshop` | PLAKA | 166 | Nuvemshop — busca pedido |
| `sheets_kb` | PLAKA | 2664 | Google Service Account (KB sync) |
| `ultracash` | HL Importados | 107 | UltraCash — busca produto/estoque |
| `google_calendar` | (a seedar quando ativar tenants) | varia | OAuth refresh token pra Calendar |

**Wire format:** `IV(16 bytes) || authTag(16 bytes) || ciphertext` em coluna `BYTEA`.

**Padrão de seed novo:** ver §4.

### Tier 3 — Acessos externos (humanos)

Não em código — humanos guardam.

| Recurso | Como acessa | Quem tem hoje |
|---------|-------------|----------------|
| **VPS SSH** | `ssh -i ~/.ssh/sparkle_vps root@187.77.37.88` | Mauro |
| **Supabase Studio** | https://supabase.com/dashboard/project/uqpwmygaktkgbknhmknx | Mauro |
| **Chatwoot UI** | https://chatwoot.sparkleai.tech | Mauro + atendentes dos tenants (Julia, equipe Plaka, Ariane, Gustavo, Hiago) |
| **Painel Z-API** | https://app.z-api.io | Mauro (1 conta multi-instância) |
| **GCP Console** | https://console.cloud.google.com | Mauro (mauromattosnegocios@gmail.com) |
| **ElevenLabs** | https://elevenlabs.io | Mauro |
| **OpenAI Platform** | https://platform.openai.com | Mauro |
| **GitHub** | mauromattos-lab + sparkle-os-aiox-agents | Mauro + agentes |
| **Vercel** | https://vercel.com/mauro-mattos-projects-389957a6 | Mauro (zenya-cockpit, etc.) |

### Tier 4 — Cliente final (zero auth)

Cliente do tenant **não tem credencial nenhuma** — comunica via WhatsApp do tenant. Identidade = `phone_number`.

---

## §2 — Padrões canônicos

### 2.1 Pattern de seed de credencial nova

**Referência:** `packages/zenya/scripts/seed-hl-ultracash.mjs` (mas com TD-14 ressalva — duplica `encryptCredential`; refactor planejado em Wave 2 do Epic 18).

```javascript
#!/usr/bin/env node
// Seed da credencial X para o tenant Y.

import 'dotenv/config';
import { createCipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ZENYA_MASTER_KEY', '<X>_API_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

if (!process.env.<TENANT>_TENANT_ID && !process.env.<TENANT>_CHATWOOT_ACCOUNT_ID) {
  console.error('ERRO: defina <TENANT>_TENANT_ID ou <TENANT>_CHATWOOT_ACCOUNT_ID');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

function encryptCredential(plaintext, masterKeyHex) {
  // (mesma função do crypto.ts — TD-14: extrair pra seed-common.mjs em Wave 2)
  const keyBuf = Buffer.from(masterKeyHex, 'hex');
  if (keyBuf.length !== 32) throw new Error('ZENYA_MASTER_KEY deve ter 64 hex (32 bytes)');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

const credentialValue = {
  api_key: process.env.<X>_API_KEY,
  // ... outros campos da cred ...
};

const plaintext = JSON.stringify(credentialValue);
const encrypted = encryptCredential(plaintext, process.env.ZENYA_MASTER_KEY);

if (DRY_RUN) {
  console.log('🧪 DRY RUN — nada gravado');
  console.log(`   shape: { api_key: "<${process.env.<X>_API_KEY.length} chars>", ... }`);
  console.log(`   plaintext: ${plaintext.length} chars → ${encrypted.length} bytes encrypted`);
  process.exit(0);
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

let tenantId = process.env.<TENANT>_TENANT_ID;
if (!tenantId) {
  const { data, error } = await sb.from('zenya_tenants').select('id, name')
    .eq('chatwoot_account_id', process.env.<TENANT>_CHATWOOT_ACCOUNT_ID).single();
  if (error || !data) {
    console.error(`❌ Tenant não encontrado`);
    process.exit(1);
  }
  tenantId = data.id;
}

const encryptedHex = `\\x${encrypted.toString('hex')}`;

const { error } = await sb.from('zenya_tenant_credentials').upsert(
  { tenant_id: tenantId, service: '<x>', credentials_encrypted: encryptedHex, updated_at: new Date().toISOString() },
  { onConflict: 'tenant_id,service' },
);

if (error) {
  console.error(`❌ Falha: ${error.message}`);
  process.exit(1);
}

console.log(`✅ Credencial "<x>" upserted (${encrypted.length} bytes)`);
```

### 2.2 Pattern de leitura runtime

```typescript
// integrations/<x>.ts
import { getCredentialJson } from '../tenant/credentials.js';

interface XCredentials {
  api_key: string;
  // outros campos
}

export function createXTools(tenantId: string): ToolSet {
  return {
    minhaTool: tool({
      description: '...',
      parameters: z.object({ /* SEM tenantId — closure */ }),
      execute: async ({ /* params */ }) => {
        // LAZY load — dentro do execute, não no factory
        const creds = await getCredentialJson<XCredentials>(tenantId, 'x');
        // ... usar creds.api_key pra chamar API externa ...
      },
    }),
  };
}
```

### 2.3 Anti-patterns canônicos

| Anti-pattern | Por quê é ruim | Cicatriz/exemplo |
|--------------|----------------|------------------|
| Hardcode credencial em `.mjs` | Secret commitado no git | (preventivo — sem cicatriz, mas regra forte) |
| Commitar `.env` real | Secrets vazam | `.gitignore` cobre, mas nunca remover do `.gitignore` |
| Expor `tenantId` ao LLM em parameters Zod | Quebra isolamento (Cap. 1 §5.4 — security critical) | Pattern factory com closure resolve |
| Eager-load de creds no `createXTools()` | Carrega cred mesmo se tool não for usada | Sempre lazy dentro do `execute` |
| Vazar campos sensíveis pro LLM (ex: `custo_medio` UltraCash) | LLM compõe resposta com dados que não deveria | Sanitizar shape de retorno |

---

## §3 — Plano de rotação

### 3.1 `ZENYA_MASTER_KEY` (a credencial mais crítica)

**Hoje (TD-29 wishlist, sem implementação):**
- Master key trocada exigia re-encrypt de todas credenciais do banco
- Fluxo: decrypt com chave antiga → encrypt com nova → UPDATE row
- Zero-downtime: precisa de 2 keys ativas durante janela

**Proposta formal (Wave 4 do Epic 18):**

```sql
-- Migration futura
ALTER TABLE zenya_tenant_credentials
  ADD COLUMN IF NOT EXISTS key_version SMALLINT NOT NULL DEFAULT 1;
```

```typescript
// crypto.ts gain key_version handling
export function decryptCredential(encrypted: Buffer, masterKey: string, keyVersion: number) {
  const key = keyVersion === 1 ? masterKey : process.env.ZENYA_MASTER_KEY_PREV;
  // ... resto igual ...
}
```

**Fluxo de rotação:**
1. Definir `ZENYA_MASTER_KEY_PREV` = chave antiga
2. Definir `ZENYA_MASTER_KEY` = chave nova
3. Deploy: código aceita ambas durante leitura (pelo `key_version`)
4. Job batch: re-encrypta todas credenciais com nova; bumpar `key_version` pra 2
5. Após zero credenciais com `key_version=1`: remover `ZENYA_MASTER_KEY_PREV`

**Frequência sugerida:** 1× ao ano + **imediato** após qualquer suspeita de comprometimento.

### 3.2 Outras credenciais Tier 1

| Cred | Frequência sugerida | Procedimento |
|------|----------------------|--------------|
| `SUPABASE_SERVICE_KEY` | Semestral OU ao remover dev do time | Reset no Studio + atualizar `.env` VPS + repo + reload PM2 |
| `SUPABASE_PAT` | Semestral OU ao mudar Mauro account | Revogar + criar novo + atualizar `.env` |
| `OPENAI_API_KEY` | Anual OU ao detectar uso anômalo | Revogar + criar novo + reload |
| `CHATWOOT_API_TOKEN` | Anual | Reset no Profile + reload |
| `ELEVENLABS_API_KEY` | Anual | Dashboard → criar novo |
| `GOOGLE_CLIENT_SECRET` | Anual | GCP Console → recriar OAuth client |

### 3.3 Tier 2 (por tenant)

Rotação só em 2 casos:
1. **Fim do contrato** com cliente → re-encriptar credenciais ativas com chave nova SE houver comprometimento, ou DELETE row (Cap. 6 OP-3 offboarding)
2. **API externa do tenant rotacionou** (ex: cliente trocou chave do CRM dele) → cliente avisa, rerodar `seed-{slug}-{service}.mjs --dry-run` + real

---

## §4 — Operações práticas

### 4.1 Alterar `.env` da VPS

```bash
ssh sparkle-vps
cd /root/SparkleOS/packages/zenya
nano .env
# Editar var X
# Salvar e sair

pm2 reload zenya-webhook  # carrega novo .env
pm2 logs zenya-webhook --lines 20  # validar nada quebrou
```

### 4.2 Adicionar novo tenant ao SAC com cred X

```bash
# Pré-requisito: tenant já seedado em zenya_tenants (Cap. 3 §3)
# Pré-requisito: cliente forneceu credencial

ssh sparkle-vps
cd /root/SparkleOS/packages/zenya

# Dry-run
TENANT_ID=<uuid> X_API_KEY=<value> node scripts/seed-{slug}-{service}.mjs --dry-run

# Real
TENANT_ID=<uuid> X_API_KEY=<value> node scripts/seed-{slug}-{service}.mjs

# Ativar tool
psql ou Management API: UPDATE zenya_tenants SET active_tools = active_tools || '"<service>"'::jsonb WHERE id = '<uuid>';
```

### 4.3 Remover credencial (offboarding ou bug)

```sql
DELETE FROM zenya_tenant_credentials
WHERE tenant_id = '<uuid>' AND service = '<x>'
RETURNING tenant_id, service;
```

> Cuidado: se tool ainda está em `active_tools`, próxima invocação vai falhar com "no credential found". Sempre remover do `active_tools` **antes** de deletar a cred.

### 4.4 Auditar uso de credenciais

```sql
-- Quem tem cred de quê (não revela conteúdo)
SELECT t.name, kc.service, kc.created_at, kc.updated_at
FROM zenya_tenant_credentials kc
JOIN zenya_tenants t ON t.id = kc.tenant_id
ORDER BY t.name, kc.service;

-- Cred sem cliente (órfã — não deveria existir, mas validar)
SELECT * FROM zenya_tenant_credentials
WHERE tenant_id NOT IN (SELECT id FROM zenya_tenants);
```

---

## §5 — Catálogo `.env` completo (substitui `.env.example` desatualizado — TD-27)

> Esta seção alimenta a **atualização da `.env.example`** (Wave 4 Epic 18 — TD-27).

### Categoria CORE — obrigatórias pro webhook subir

```bash
# Porta do servidor
ZENYA_PORT=3004

# Supabase (projeto ATIVO, não legado removido)
SUPABASE_URL=https://uqpwmygaktkgbknhmknx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...                     # service role (bypassa RLS)
SUPABASE_PAT=sbp_...                            # Management API (DDL)
SUPABASE_PROJECT_REF=uqpwmygaktkgbknhmknx       # mesma referência (idempotente)

# Zenya
ZENYA_MASTER_KEY=                               # 64-hex (32 bytes); openssl rand -hex 32
ZENYA_DEBOUNCE_MS=2500                          # ms (default; configurável)

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Chatwoot
CHATWOOT_BASE_URL=https://chatwoot.sparkleai.tech
CHATWOOT_API_TOKEN=                             # superadmin token

# ElevenLabs (default voice; tenants podem override via DB)
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=

# Google OAuth (pra Calendar/Drive)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Categoria OPCIONAL — features extras

```bash
# Vercel (quando deploy frontend Cockpit)
VERCEL_TOKEN=

# GitHub (CI/CD futura)
GITHUB_TOKEN=

# Sentry (futuro — TD-22 observabilidade externa)
SENTRY_DSN=
```

### Categoria POR-TENANT-SEED — usadas por scripts de seed

> Estas só ficam no `.env` da VPS quando vai rodar seed específico de tenant. **Não devem ficar permanentes.**

```bash
# PLAKA (Roberta)
PLAKA_CHATWOOT_ACCOUNT_ID=2
PLAKA_ADMIN_PHONES=+55...
PLAKA_ADMIN_CONTACTS='[{"phone":"+55...","name":"Isa"}]'
PLAKA_ALLOWED_PHONES=+55...
PLAKA_KB_SPREADSHEET_ID=...
PLAKA_KB_RANGES='["Aba1!A:B","Aba2!A:B"]'
PLAKA_SHEETS_SA_PATH=/root/SparkleOS/secrets/plaka-sa.json   # ⚠ sensível — fora do repo

NUVEMSHOP_ACCESS_TOKEN=... # provê API token Nuvemshop
NUVEMSHOP_USER_ID=...

# (similar pra cada tenant: HL_*, FUN_*, DOCERIA_*, SCAR_*, ENSINAJA_*)
```

---

## §6 — Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação atual | Mitigação futura |
|-------|---------------|---------|------------------|-------------------|
| `ZENYA_MASTER_KEY` vazar | Baixa | **Máximo** (descriptografa todas creds) | Apenas `.env` VPS; sem rotação | TD-29 + plano §3.1 |
| `SUPABASE_SERVICE_KEY` vazar | Baixa | Crítico (R/W banco) | Apenas `.env`; .gitignore | Rotação semestral §3.2 |
| Backup `.env` esquecido publicamente | Baixa | Crítico | `.gitignore` cobre `.env*`; mas atenção em `.env.backup-*` que vimos no repo | Cleanup `.env.backup-*` antigos |
| Cliente vaza própria cred (Z-API, etc.) | Média | Médio (afeta só o tenant) | Padrão lazy + closure | Documentar pro cliente |
| `tenantId` exposto ao LLM | Baixa | Crítico (cross-tenant breach) | Pattern factory closure + Cap. 1 §5.4 + revisão de PR | Linter custom pra detectar (futuro) |
| Sniff de tráfego HTTP entre Chatwoot e core | Baixa | Médio | HTTPS via nginx; reverse proxy sparkle-runtime | — |

---

## §7 — Documentos relacionados

| Doc | Onde |
|-----|------|
| Cap. 2 §5 — Encryption AES-256-GCM detalhe técnico | `02-schema-data.md` |
| Cap. 1 §5.4-§5.5 — Padrão factory + crypto runtime | `01-system-architecture.md` |
| Cap. 3 §4 — Adicionar integração nova | `03-operational-manual.md` |
| Memória `reference_vps` — VPS SSH details | `~/.claude/projects/.../memory/reference_vps.md` |
| Memória `reference_supabase_vps` — Supabase Management API | `~/.claude/projects/.../memory/reference_supabase_vps.md` |
| Memória `reference_vercel` — Vercel CLI | `~/.claude/projects/.../memory/reference_vercel.md` |
| Memória `reference_webhook_url` — URL canônica do webhook | `~/.claude/projects/.../memory/reference_webhook_url.md` |

---

*Capítulo 4 (Access & Credentials Map) — Brownfield Zenya Fase 8 — 2026-04-25.*
*Resolve Q-03 parte 1 do QA Gate. Catálogo completo de credenciais por Tier + plano de rotação + padrões + riscos.*
