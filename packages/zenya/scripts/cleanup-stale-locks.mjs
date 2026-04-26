#!/usr/bin/env node
// Cleanup one-shot de locks órfãos em zenya_session_lock — Story 18.1 / TD-06.
//
// Após Story 18.1 deploy, locks órfãos são limpos automaticamente em cada acquireLock
// (cleanup pre-acquire). Este script é pra LIMPEZA RETROATIVA dos órfãos atuais
// (validação Brownfield Fase 2: 2 locks da Julia com 5d e 8d de idade).
//
// Uso:
//   node scripts/cleanup-stale-locks.mjs --dry-run      # preview, não deleta
//   node scripts/cleanup-stale-locks.mjs                # executa
//
// Env vars obrigatórias:
//   SUPABASE_PAT             Management API token
//   SUPABASE_PROJECT_REF     ex: uqpwmygaktkgbknhmknx
//
// Env var opcional:
//   STALE_LOCK_THRESHOLD_MIN  default 5 (min); locks com locked_at < NOW - X min são removidos
//
// Idempotente: pode rodar múltiplas vezes sem problema.

import 'dotenv/config';

const REQUIRED = ['SUPABASE_PAT', 'SUPABASE_PROJECT_REF'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const DRY_RUN = process.argv.includes('--dry-run');
const STALE_THRESHOLD_MIN = parseInt(process.env.STALE_LOCK_THRESHOLD_MIN ?? '5', 10);

async function querySupabase(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Management API failed (${res.status}): ${body}`);
  }
  return res.json();
}

console.log(`[cleanup-stale-locks] threshold=${STALE_THRESHOLD_MIN}min, dry_run=${DRY_RUN}`);

// 1. Preview
const previewSql = `
  SELECT tenant_id, phone_number, locked_at, NOW() - locked_at AS age
  FROM zenya_session_lock
  WHERE locked_at < NOW() - INTERVAL '${STALE_THRESHOLD_MIN} minutes'
  ORDER BY locked_at;
`;

const preview = await querySupabase(previewSql);
const previewArray = Array.isArray(preview) ? preview : [];

console.log(`\nLocks órfãos encontrados: ${previewArray.length}`);
if (previewArray.length > 0) {
  console.log(JSON.stringify(previewArray, null, 2));
}

if (previewArray.length === 0) {
  console.log('\n✅ Nenhum lock órfão pra limpar — sistema limpo.');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('\n🧪 DRY RUN — nada deletado. Re-rode sem --dry-run pra aplicar.');
  process.exit(0);
}

// 2. Delete real
const deleteSql = `
  DELETE FROM zenya_session_lock
  WHERE locked_at < NOW() - INTERVAL '${STALE_THRESHOLD_MIN} minutes'
  RETURNING tenant_id, phone_number;
`;

const deleted = await querySupabase(deleteSql);
const deletedArray = Array.isArray(deleted) ? deleted : [];

console.log(`\n✅ Removidos ${deletedArray.length} locks órfãos.`);
console.log(JSON.stringify(deletedArray, null, 2));
console.log('\n✅ Cleanup completo. Pre-acquire cleanup do Story 18.1 evita acumulação futura.');
