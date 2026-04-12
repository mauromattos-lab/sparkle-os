// SparkleOS Content Engine — Entry Point
// Inicia o scheduler diário do AEO Squad Plaka

import { startScheduler } from './scheduler.js';

console.log('[content-engine] Iniciando Content Engine...');

startScheduler();

console.log('[content-engine] Content Engine ativo. Aguardando próximo tick do scheduler.');
