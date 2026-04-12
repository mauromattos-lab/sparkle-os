// scheduler.ts — cron job diário para disparar a pipeline do Content Engine
// Configurável via CONTENT_SCHEDULE_TIME (formato cron, default: "0 8 * * *" = 8h)

import cron from 'node-cron';
import { getPendingPostForToday } from '@sparkle-os/core';
import { runDailyPipeline } from './pipeline-runner.js';

const DEFAULT_SCHEDULE = '0 8 * * *'; // 8h diário

export function startScheduler(): void {
  const schedule = process.env['CONTENT_SCHEDULE_TIME'] ?? DEFAULT_SCHEDULE;

  if (!cron.validate(schedule)) {
    throw new Error(
      `CONTENT_SCHEDULE_TIME inválido: "${schedule}". Use formato cron (ex: "0 8 * * *")`,
    );
  }

  console.log(`[content-engine] Scheduler iniciado — execução: "${schedule}" (horário Brasília)`);

  cron.schedule(
    schedule,
    async () => {
      console.log('[content-engine] Tick do scheduler — verificando guard...');
      await runPipelineWithGuard();
    },
    { timezone: 'America/Sao_Paulo' },
  );
}

export async function runPipelineWithGuard(clientId = 'plaka'): Promise<void> {
  // AC5: Guard — não roda se já existe post pendente criado hoje
  const pending = await getPendingPostForToday(clientId);
  if (pending) {
    console.log(
      `[content-engine] Guard ativado — post de hoje já existe (id: ${pending.id}, status: ${pending.status}). Pulando execução.`,
    );
    return;
  }

  await runDailyPipeline(clientId);
}
