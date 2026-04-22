#!/usr/bin/env node
// Edita triggers da planilha PLAKA via Sheets API (SA com escopo Editor).
// Faz SET (overwrite) em cada célula da coluna B das entries listadas.
//
// Para cada edição:
//   - MODE=SET   → substitui completamente o valor da célula
//   - MODE=APPEND → append " / kw1 / kw2 ..." ao valor atual (preserva existing)
//
// Uso:
//   cd packages/zenya
//   node --env-file=.env scripts/patch-plaka-triggers.mjs [--dry-run]

import { google } from 'googleapis';
import { readFileSync } from 'node:fs';

if (!process.env.PLAKA_SHEETS_SA_PATH || !process.env.PLAKA_KB_SPREADSHEET_ID) {
  console.error('ERRO: PLAKA_SHEETS_SA_PATH e PLAKA_KB_SPREADSHEET_ID obrigatórios');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

const sa = JSON.parse(readFileSync(process.env.PLAKA_SHEETS_SA_PATH, 'utf-8'));
const auth = new google.auth.JWT({
  email: sa.client_email,
  key: sa.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.PLAKA_KB_SPREADSHEET_ID;

// Lista de edições. mode SET substitui, APPEND concatena na existing.
// Row baseado na planilha (row 4 = primeira data row após headers).
const EDITS = [
  // 🔧 Produto & Qualidade
  // P06 (row 9): append keywords de cor/prata (não estava editado corretamente)
  { sheet: '🔧 Produto & Qualidade', row: 9, mode: 'APPEND', add: 'prata ou dourada / é prata / é dourada / na tonalidade / dourado / prateado / cor diferente / diferente da foto' },
  // P07 (row 10): REVERTER — tinha sido contaminado com keywords de P06. Valor correto original:
  { sheet: '🔧 Produto & Qualidade', row: 10, mode: 'SET', value: 'colar arrebentou / quebrou / caiu pingente / soltou pingente / defeito' },

  // 📦 Pedidos & Logística
  { sheet: '📦 Pedidos & Logística', row: 4,  mode: 'APPEND', add: 'prazo de entrega / quanto tempo leva / quando vai ser enviado / demora pra produzir / tá demorando / quando chega / dias pra chegar' },
  { sheet: '📦 Pedidos & Logística', row: 7,  mode: 'APPEND', add: 'etiqueta emitida / email de confirmação / confirmação do envio / não chegou email' },
  { sheet: '📦 Pedidos & Logística', row: 10, mode: 'APPEND', add: 'veio outra peça / não é o que comprei / pedido errado / recebi errado / produto diferente' },
  { sheet: '📦 Pedidos & Logística', row: 11, mode: 'APPEND', add: 'rastrear / rastreamento / código de rastreio / como acompanhar / onde encontro o rastreio / ver rastreio' },
  { sheet: '📦 Pedidos & Logística', row: 12, mode: 'APPEND', add: 'pedido sumiu / foi roubado / perdeu o pedido / não chegou nada / extravio' },
  { sheet: '📦 Pedidos & Logística', row: 13, mode: 'APPEND', add: 'cancelar / cancelamento / queria cancelar / preciso cancelar / desistir / desistência' },

  // 🔄 Garantia & Trocas
  { sheet: '🔄 Garantia & Trocas', row: 6, mode: 'APPEND', add: 'não gostei / quero devolver / trocar / ainda rola devolver / arrependimento / devolução' },
  { sheet: '🔄 Garantia & Trocas', row: 7, mode: 'APPEND', add: 'garantia / 6 meses / dentro da garantia / prazo da garantia' },

  // 🛍️ Compras & Pagamento
  { sheet: '🛍️ Compras & Pagamento', row: 9,  mode: 'APPEND', add: 'embalagem presente / sacolinha / presentear / embrulhar / vem sacola' },
  { sheet: '🛍️ Compras & Pagamento', row: 11, mode: 'APPEND', add: 'kit da influencer / vi no Instagram / acessório de influenciadora' },

  // 🏪 Sobre a Plaka
  { sheet: '🏪 Sobre a Plaka', row: 9,  mode: 'APPEND', add: 'como comprar / onde comprar / ver peças online / lugar pra comprar / site' },
  { sheet: '🏪 Sobre a Plaka', row: 10, mode: 'APPEND', add: 'feitas aqui / feitas aí / vocês fabricam / vocês produzem / importam / artesanais' },
  { sheet: '🏪 Sobre a Plaka', row: 12, mode: 'APPEND', add: 'parceria com influenciadoras / quero ser parceira / trabalhar com vocês' },

  // ⚡ Escalamento
  // E01 (row 4): trigger está VAZIO na planilha — SET obrigatório
  { sheet: '⚡ Escalamento', row: 4, mode: 'SET', value: 'atendente / humano / falar com alguém / suporte / ajuda humana / quero conversar / falar com um humano / falar com uma pessoa' },
  { sheet: '⚡ Escalamento', row: 5, mode: 'APPEND', add: 'chegou com defeito / peça com defeito / dentro de 7 dias / veio defeituoso' },
  { sheet: '⚡ Escalamento', row: 6, mode: 'APPEND', add: 'item errado / peça errada / veio outra coisa / recebi errado' },
];

async function getCurrentValue(sheet, row) {
  const range = `'${sheet}'!B${row}`;
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  return r.data.values?.[0]?.[0] ?? '';
}

async function setCell(sheet, row, value) {
  const range = `'${sheet}'!B${row}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

console.log(`${DRY_RUN ? '🧪 DRY RUN' : '✏️  APLICANDO'} — ${EDITS.length} edições\n`);

let ok = 0;
for (const [i, e] of EDITS.entries()) {
  const label = `[${i + 1}/${EDITS.length}] '${e.sheet}'!B${e.row}`;
  try {
    const current = await getCurrentValue(e.sheet, e.row);
    let next;
    if (e.mode === 'SET') {
      next = e.value;
    } else if (e.mode === 'APPEND') {
      // Se current tá vazio, só o add. Se não, current + " / " + add.
      next = current ? `${current} / ${e.add}` : e.add;
    } else {
      console.warn(`${label} mode desconhecido: ${e.mode}`);
      continue;
    }

    const currentPreview = current.slice(0, 80);
    const nextPreview = next.slice(0, 80);
    console.log(`${label} ${e.mode}`);
    console.log(`   antes: ${currentPreview}${current.length > 80 ? '...' : ''}`);
    console.log(`   agora: ${nextPreview}${next.length > 80 ? '...' : ''}`);

    if (!DRY_RUN) {
      await setCell(e.sheet, e.row, next);
      console.log(`   ✅ salvo`);
    }
    console.log('');
    ok += 1;
  } catch (err) {
    console.error(`${label} ❌ ${err.message}`);
  }
}

console.log(`\n${ok}/${EDITS.length} edições ${DRY_RUN ? 'validadas' : 'aplicadas'}.`);
if (!DRY_RUN) {
  console.log(`\n➡️  Próximo passo: rodar kb-sync pra atualizar zenya_tenant_kb_entries:`);
  console.log(`   node --env-file=.env --input-type=module -e "import('./dist/worker/kb-sync.js').then(m => m.runKbSyncOnce()).then(r => console.log(JSON.stringify(r,null,2)))"`);
}
