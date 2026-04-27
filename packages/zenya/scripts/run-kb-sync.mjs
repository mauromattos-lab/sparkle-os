#!/usr/bin/env node
// KB sync runner — Story 18.4 / TD-01.
//
// Roda o worker zenya-kb-sync (PM2) ou ad-hoc no terminal.
// Sincroniza Google Sheets → zenya_tenant_kb_entries pra todos tenants
// com credencial 'sheets_kb' cadastrada em zenya_tenant_credentials.
//
// Uso:
//   node scripts/run-kb-sync.mjs                       # loop infinito (PM2)
//   node scripts/run-kb-sync.mjs --once                # 1 sync e sai (debug)
//   node scripts/run-kb-sync.mjs --tenant=<uuid>       # 1 tenant específico (debug)
//   node scripts/run-kb-sync.mjs --once --tenant=<uuid> # equivalente a --tenant
//
// Env vars obrigatórias (via .env):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ZENYA_MASTER_KEY
//
// Credenciais Sheets ficam em zenya_tenant_credentials (Tier 2 criptografado),
// não em env vars. Nada de PLAKA_SHEETS_SA_PATH — esse path é histórico.

import 'dotenv/config';
import { startKbSyncLoop, runKbSyncOnce, syncTenantKB } from '../dist/worker/kb-sync.js';

const args = process.argv.slice(2);
const isOnce = args.includes('--once');
const tenantArg = args.find((a) => a.startsWith('--tenant='))?.split('=')[1];

if (tenantArg) {
  // Single tenant mode (--tenant=X implica --once)
  console.log(`[run-kb-sync] modo: tenant=${tenantArg}`);
  const report = await syncTenantKB(tenantArg);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.errors.length > 0 ? 1 : 0);
}

if (isOnce) {
  // One-shot all tenants
  console.log('[run-kb-sync] modo: --once (todos tenants)');
  const reports = await runKbSyncOnce();
  const hasErrors = reports.some((r) => r.errors.length > 0);
  process.exit(hasErrors ? 1 : 0);
}

// Default: loop infinito (uso com PM2)
console.log('[run-kb-sync] modo: loop infinito 15min (uso com PM2 zenya-kb-sync)');
await startKbSyncLoop();
