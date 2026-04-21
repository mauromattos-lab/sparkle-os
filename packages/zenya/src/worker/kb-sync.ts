// KB sync worker — sincroniza Google Sheets → zenya_tenant_kb_entries
// Implementa T2.2b do plaka-01 (lado escrita; a tool de leitura está em sheets-kb.ts).
//
// Fluxo por tenant que tem credencial 'sheets_kb':
//   1. Carrega credencial (spreadsheet_id, range, service_account JSON)
//   2. Autentica via Service Account (JWT)
//   3. Baixa linhas da planilha (colunas A=pergunta, B=resposta)
//   4. Normaliza pergunta (mesma função do sheets-kb.ts)
//   5. UPSERT em zenya_tenant_kb_entries por (tenant_id, question_normalized)
//
// Rodagem: processo separado, loop de 15min. Pode ser ativado por pm2 ou
// chamado standalone via `node scripts/run-kb-sync.mjs` pra dry-run/manual.

import { google } from 'googleapis';
import { getSupabase } from '../db/client.js';
import { getCredentialJson } from '../tenant/credentials.js';
import { normalizeQuestion } from '../integrations/sheets-kb.js';

const SYNC_INTERVAL_MS = 15 * 60 * 1_000; // 15 minutes

interface SheetsKbCredentials {
  spreadsheet_id: string;
  /**
   * Range único no formato A1 (ex: "Sheet1!A:B"). Usado quando o KB cabe em
   * uma aba só. Para KB multi-aba, use `ranges` (plural) abaixo — se ambos
   * forem definidos, `ranges` tem precedência.
   */
  range?: string;
  /**
   * Múltiplos ranges A1 (ex: ["'Aba 1'!B4:C", "'Aba 2'!B4:C"]). O worker
   * itera e concatena as linhas de todas as abas. Útil quando o KB de um
   * tenant está distribuído em várias abas com o mesmo schema.
   */
  ranges?: string[];
  /** JSON completo do Service Account (client_email + private_key + etc) */
  service_account: {
    client_email: string;
    private_key: string;
    [k: string]: unknown;
  };
}

interface SyncReport {
  tenantId: string;
  rowsRead: number;
  upserted: number;
  skipped: number;
  errors: string[];
}

/**
 * Lista tenants que têm credencial de `sheets_kb` cadastrada.
 * Consulta zenya_tenant_credentials (não zenya_tenants.active_tools) — credencial
 * presente é o gate real: sem credencial, nada a sincronizar.
 */
async function listTenantsWithSheetsKB(): Promise<string[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('zenya_tenant_credentials')
    .select('tenant_id')
    .eq('service', 'sheets_kb');
  if (error) {
    console.error(`[kb-sync] listTenantsWithSheetsKB error: ${error.message}`);
    return [];
  }
  const ids = (data ?? []).map((row: Record<string, unknown>) => String(row['tenant_id']));
  return [...new Set(ids)];
}

async function fetchSheetRows(creds: SheetsKbCredentials): Promise<string[][]> {
  const auth = new google.auth.JWT({
    email: creds.service_account.client_email,
    key: creds.service_account.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const ranges = creds.ranges && creds.ranges.length > 0
    ? creds.ranges
    : creds.range
      ? [creds.range]
      : null;

  if (!ranges) {
    throw new Error('sheets_kb credential precisa de `range` (string) ou `ranges` (array)');
  }

  // batchGet em uma chamada só (1 request HTTP) em vez de N chamadas seriais
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: creds.spreadsheet_id,
    ranges,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const rows: string[][] = [];
  for (const valueRange of res.data.valueRanges ?? []) {
    for (const r of (valueRange.values ?? []) as string[][]) {
      rows.push(r);
    }
  }
  return rows;
}

/**
 * Sincroniza a KB de um tenant. Lê a planilha, normaliza perguntas, faz
 * UPSERT em zenya_tenant_kb_entries. Preserva entradas antigas que não
 * estiverem na planilha atual (não deleta — marca apenas por `last_synced_at`).
 *
 * Exportado para testes unitários e invocação manual via CLI.
 */
export async function syncTenantKB(tenantId: string): Promise<SyncReport> {
  const report: SyncReport = {
    tenantId,
    rowsRead: 0,
    upserted: 0,
    skipped: 0,
    errors: [],
  };

  let creds: SheetsKbCredentials;
  try {
    creds = await getCredentialJson<SheetsKbCredentials>(tenantId, 'sheets_kb');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    report.errors.push(`credentials: ${msg}`);
    return report;
  }

  let rows: string[][];
  try {
    rows = await fetchSheetRows(creds);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    report.errors.push(`sheets fetch: ${msg}`);
    return report;
  }

  report.rowsRead = rows.length;
  if (rows.length === 0) return report;

  const sb = getSupabase();
  const now = new Date().toISOString();

  // Triggers podem vir como lista de palavras-chave separadas por '/' na mesma célula.
  // Ex: "oxidou / escureceu / preto / enferrujou / manchou" — cada keyword vira uma
  // entry separada apontando pra mesma resposta. Isso permite match por palavra-chave
  // individual (via fuzzy lookup em sheets-kb.ts) em vez de exigir que o cliente digite
  // a célula inteira.
  const entries = rows.flatMap((row) => {
    const raw = String(row[0] ?? '').trim();
    const answer = String(row[1] ?? '').trim();
    if (!raw || !answer) return [];

    const triggers = raw
      .split(/\s*\/\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
    const triggerList = triggers.length > 0 ? triggers : [raw];

    return triggerList
      .map((trigger) => ({
        tenant_id: tenantId,
        question_normalized: normalizeQuestion(trigger),
        question_raw: trigger,
        answer,
        last_synced_at: now,
        updated_at: now,
      }))
      .filter((e) => !!e.question_normalized);
  });

  report.skipped = rows.length - entries.length;

  if (entries.length === 0) return report;

  const { error } = await sb
    .from('zenya_tenant_kb_entries')
    .upsert(entries, { onConflict: 'tenant_id,question_normalized' });

  if (error) {
    report.errors.push(`upsert: ${error.message}`);
    return report;
  }

  report.upserted = entries.length;
  return report;
}

/** Executa 1 rodada de sincronização pra todos os tenants com KB configurada. */
export async function runKbSyncOnce(): Promise<SyncReport[]> {
  const tenants = await listTenantsWithSheetsKB();
  if (tenants.length === 0) {
    console.log('[kb-sync] nenhum tenant com credencial sheets_kb — nada a fazer');
    return [];
  }
  console.log(`[kb-sync] sincronizando ${tenants.length} tenants...`);

  const reports = await Promise.all(tenants.map((t) => syncTenantKB(t)));
  for (const r of reports) {
    if (r.errors.length > 0) {
      console.error(
        `[kb-sync] tenant=${r.tenantId} errors=${r.errors.length} upserted=${r.upserted} skipped=${r.skipped}: ${r.errors.join('; ')}`,
      );
    } else {
      console.log(
        `[kb-sync] tenant=${r.tenantId} OK — rows=${r.rowsRead} upserted=${r.upserted} skipped=${r.skipped}`,
      );
    }
  }
  return reports;
}

/** Loop infinito: roda runKbSyncOnce() a cada 15min. Pra uso com pm2. */
export async function startKbSyncLoop(): Promise<void> {
  console.log(`[kb-sync] loop iniciado (intervalo: ${SYNC_INTERVAL_MS / 60_000}min)`);
  while (true) {
    try {
      await runKbSyncOnce();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[kb-sync] erro no ciclo: ${msg}`);
    }
    await new Promise((resolve) => setTimeout(resolve, SYNC_INTERVAL_MS));
  }
}
