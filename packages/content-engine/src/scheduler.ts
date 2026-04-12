// scheduler.ts — cron job diário para disparar a pipeline do Content Engine
// Story 5.6: auto-descobre clientes em clients/*/config.yaml — sem alterar código
// para adicionar novo cliente, basta criar clients/{client-id}/config.yaml

import cron from 'node-cron';
import { getPendingPostForToday } from '@sparkle-os/core';
import { runDailyPipeline } from './pipeline-runner.js';
import { loadClientConfig, listClientIds } from './client-config.js';

const DEFAULT_SCHEDULE = '0 8 * * *'; // 8h diário

export function startScheduler(): void {
  // AC3: auto-descobre clientes sem alterar código
  void (async () => {
    const clientIds = await listClientIds();
    console.log(`[content-engine] Scheduler iniciando para ${clientIds.length} cliente(s): ${clientIds.join(', ')}`);

    for (const clientId of clientIds) {
      const config = await loadClientConfig(clientId).catch(() => null);
      const schedule = config?.scheduleTime ?? DEFAULT_SCHEDULE;

      if (!cron.validate(schedule)) {
        console.error(
          `[content-engine] scheduleTime inválido para ${clientId}: "${schedule}". Usando default "${DEFAULT_SCHEDULE}".`,
        );
      }

      const effectiveSchedule = cron.validate(schedule) ? schedule : DEFAULT_SCHEDULE;
      console.log(`[content-engine] ${clientId}: agendado para "${effectiveSchedule}" (horário Brasília)`);

      cron.schedule(
        effectiveSchedule,
        async () => {
          console.log(`[content-engine] Tick — ${clientId} — verificando guard...`);
          await runPipelineWithGuard(clientId);
        },
        { timezone: 'America/Sao_Paulo' },
      );
    }
  })();
}

export async function runPipelineWithGuard(clientId = 'plaka'): Promise<void> {
  // Guard — não roda se já existe post pendente criado hoje
  const pending = await getPendingPostForToday(clientId);
  if (pending) {
    console.log(
      `[content-engine] Guard ativado — post de hoje já existe para ${clientId} (id: ${pending.id}, status: ${pending.status}). Pulando execução.`,
    );
    return;
  }

  await runDailyPipeline(clientId);
}
