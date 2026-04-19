#!/usr/bin/env node
// Cria (ou reutiliza) uma etiqueta no WhatsApp Business via Z-API e salva o ID
// nas credenciais do tenant no Supabase.
//
// Uso: node setup-zapi-labels.mjs <tenantId> <nomeDaEtiqueta>
// Exemplo: node setup-zapi-labels.mjs abc-123-def humano
//
// Requer: SUPABASE_URL, SUPABASE_SERVICE_KEY, ZENYA_MASTER_KEY no ambiente (ou .env)

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// --- Crypto helpers (same as seed-zapi-credentials.mjs) ---

const IV_BYTES = 16;
const AUTH_TAG_BYTES = 16;

function encryptCredential(value, masterKeyHex) {
  const keyBuf = Buffer.from(masterKeyHex, 'hex');
  if (keyBuf.length !== 32) throw new Error('ZENYA_MASTER_KEY deve ter 64 caracteres hex');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptCredential(encryptedBuf, masterKeyHex) {
  const keyBuf = Buffer.from(masterKeyHex, 'hex');
  const iv = encryptedBuf.subarray(0, IV_BYTES);
  const authTag = encryptedBuf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = encryptedBuf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

// --- Z-API helpers ---

async function zapiGet(instanceId, token, clientToken, path) {
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', 'client-token': clientToken },
  });
  if (!res.ok) throw new Error(`Z-API GET ${path} falhou (${res.status}): ${await res.text()}`);
  return res.json();
}

async function zapiPost(instanceId, token, clientToken, path, body) {
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'client-token': clientToken },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Z-API POST ${path} falhou (${res.status}): ${await res.text()}`);
  return res.json();
}

// --- Main ---

const [, , tenantId, labelName] = process.argv;

if (!tenantId || !labelName) {
  console.error('Uso: node setup-zapi-labels.mjs <tenantId> <nomeDaEtiqueta>');
  console.error('Exemplo: node setup-zapi-labels.mjs abc-123-def humano');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ZENYA_MASTER_KEY = process.env.ZENYA_MASTER_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ZENYA_MASTER_KEY) {
  console.error('Faltam variáveis: SUPABASE_URL, SUPABASE_SERVICE_KEY, ZENYA_MASTER_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Carregar credenciais Z-API do tenant
  const { data: row, error } = await sb
    .from('zenya_tenant_credentials')
    .select('credentials_encrypted')
    .eq('tenant_id', tenantId)
    .eq('service', 'zapi')
    .single();

  if (error || !row) {
    console.error(`Credenciais Z-API não encontradas para tenant=${tenantId}:`, error?.message);
    process.exit(1);
  }

  // Parse hex from Supabase
  const hexStr = typeof row.credentials_encrypted === 'string'
    ? row.credentials_encrypted.replace(/^\\x/, '')
    : Buffer.from(row.credentials_encrypted).toString('hex');
  const encryptedBuf = Buffer.from(hexStr, 'hex');
  const plaintext = decryptCredential(encryptedBuf, ZENYA_MASTER_KEY);
  const creds = JSON.parse(plaintext);

  const { instanceId, token, clientToken } = creds;
  console.log(`✅ Credenciais carregadas — instância: ${instanceId}`);

  // 2. Buscar etiquetas existentes
  console.log(`🔍 Buscando etiquetas existentes...`);
  const existingTags = await zapiGet(instanceId, token, clientToken, 'tags');
  const tagList = Array.isArray(existingTags) ? existingTags : (existingTags.tags ?? []);

  // 3. Verificar se etiqueta já existe
  const existing = tagList.find((t) => t.name?.toLowerCase() === labelName.toLowerCase());
  let labelId;

  if (existing) {
    labelId = String(existing.id);
    console.log(`♻️  Etiqueta "${labelName}" já existe — ID: ${labelId}`);
  } else {
    // 4. Criar nova etiqueta
    console.log(`🏷️  Criando etiqueta "${labelName}"...`);
    const created = await zapiPost(instanceId, token, clientToken, 'tags', { name: labelName, color: 1 });
    labelId = String(created.id);
    console.log(`✅ Etiqueta criada — ID: ${labelId}`);
  }

  // 5. Atualizar credenciais com o ID da etiqueta
  const updatedCreds = {
    ...creds,
    labels: {
      ...(creds.labels ?? {}),
      [labelName.toLowerCase()]: labelId,
    },
  };

  const encrypted = encryptCredential(JSON.stringify(updatedCreds), ZENYA_MASTER_KEY);
  const hexEncrypted = '\\x' + encrypted.toString('hex');

  const { error: upsertErr } = await sb
    .from('zenya_tenant_credentials')
    .upsert(
      { tenant_id: tenantId, service: 'zapi', credentials_encrypted: hexEncrypted },
      { onConflict: 'tenant_id,service' },
    );

  if (upsertErr) {
    console.error('Erro ao salvar credenciais atualizadas:', upsertErr.message);
    process.exit(1);
  }

  console.log(`✅ Credenciais atualizadas — labels.${labelName.toLowerCase()} = ${labelId}`);
  console.log(`\n🎉 Setup concluído! Ao escalar para humano, a Zenya aplicará a etiqueta "${labelName}" no WhatsApp Business.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
