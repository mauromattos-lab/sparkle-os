#!/usr/bin/env node
// Cleanup one-shot de mensagens pending órfãs em zenya_queue — Story 18.5 / TD-02.
//
// Após Story 18.5 deploy, leak ativo é zero (Fixes 1-4 fecham as 4 causas:
// tenant lookup, test-mode skip, failure path, race condition). Este script
// é pra LIMPEZA RETROATIVA das 875 mensagens pending órfãs acumuladas em
// 9 dias antes do fix.
//
// Uso:
//   node scripts/cleanup-stale-queue.mjs --dry-run      # preview, não atualiza
//   node scripts/cleanup-stale-queue.mjs                # executa
//
// Env vars obrigatórias:
//   SUPABASE_PAT             Management API token
//   SUPABASE_PROJECT_REF     ex: uqpwmygaktkgbknhmknx
//
// Env var opcional:
//   STALE_QUEUE_THRESHOLD_HOURS  default 24 (h); pending com created_at < NOW - X horas
//                                são marcadas como failed
//
// Idempotente: pode rodar múltiplas vezes sem problema (UPDATE só pega pending).
//
// Decisão semântica: status='failed' (não 'done'). Razão: estamos abandonando
// mensagens que não foram processadas. Status correto é 'failed', e operação
// fica auditavel ("essas mensagens foram marcadas failed pelo cleanup, não
// pelo webhook normal").

import 'dotenv/config';

const REQUIRED = ['SUPABASE_PAT', 'SUPABASE_PROJECT_REF'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`ERRO: env var ${key} não definida`);
    process.exit(1);
  }
}

const DRY_RUN = process.argv.includes('--dry-run');
const STALE_THRESHOLD_HOURS = parseInt(process.env.STALE_QUEUE_THRESHOLD_HOURS ?? '24', 10);

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

console.log(
  `[cleanup-stale-queue] threshold=${STALE_THRESHOLD_HOURS}h, dry_run=${DRY_RUN}`,
);

// 1. Preview agregado por tenant (visão de auditoria antes do UPDATE)
const previewSummarySql = `
  SELECT
    tenant_id,
    COUNT(*) AS pending_count,
    MIN(created_at) AS oldest,
    MAX(created_at) AS newest
  FROM zenya_queue
  WHERE status='pending'
    AND created_at < NOW() - INTERVAL '${STALE_THRESHOLD_HOURS} hours'
  GROUP BY tenant_id
  ORDER BY pending_count DESC;
`;

const summary = await querySupabase(previewSummarySql);
const summaryArray = Array.isArray(summary) ? summary : [];

const totalToCleanup = summaryArray.reduce(
  (acc, row) => acc + Number(row.pending_count ?? 0),
  0,
);

console.log(`\nMensagens pending órfãs (>${STALE_THRESHOLD_HOURS}h): ${totalToCleanup}`);
if (summaryArray.length > 0) {
  console.log('\nBreakdown por tenant_id:');
  console.log(JSON.stringify(summaryArray, null, 2));
}

if (totalToCleanup === 0) {
  console.log('\n✅ Nenhuma mensagem pending órfã pra limpar — sistema limpo.');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('\n🧪 DRY RUN — nada atualizado. Re-rode sem --dry-run pra aplicar.');
  process.exit(0);
}

// 2. Update real
const updateSql = `
  UPDATE zenya_queue
  SET status='failed'
  WHERE status='pending'
    AND created_at < NOW() - INTERVAL '${STALE_THRESHOLD_HOURS} hours'
  RETURNING message_id, tenant_id, phone_number;
`;

const updated = await querySupabase(updateSql);
const updatedArray = Array.isArray(updated) ? updated : [];

console.log(`\n✅ Marcadas como failed: ${updatedArray.length} mensagens.`);

// 3. Validação pós-cleanup: contar pending residual
const verifySql = `
  SELECT COUNT(*) AS pending_remaining
  FROM zenya_queue
  WHERE status='pending';
`;

const verify = await querySupabase(verifySql);
const verifyArray = Array.isArray(verify) ? verify : [];
const remaining = verifyArray[0]?.pending_remaining ?? '?';

console.log(`\nPending residual (todos timestamps): ${remaining}`);
console.log('\n✅ Cleanup completo. Story 18.5 Fixes 1-4 evitam acumulação futura.');
