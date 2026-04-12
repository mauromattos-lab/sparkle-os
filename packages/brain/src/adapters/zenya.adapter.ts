// Zenya Adapter — transforms zenya_execution_log rows into InsightInput
// Source: docs/architecture/cerebro-coletivo.md §3.3 (zenya_operation → high confidence)
// Note v1: zenya_execution_log is populated manually for testing (see Story 3.2 AC6)

import type { InsightInput, ZenyaExecutionLog } from '../types/insight.js';

export class ZenyaAdapter {
  fromExecutionLog(log: ZenyaExecutionLog): InsightInput {
    const parts: string[] = [
      `Fluxo "${log.flowName}" executado com status ${log.status}`,
    ];

    if (log.durationMs !== null) {
      parts.push(`em ${log.durationMs}ms`);
    }
    if (log.errorMessage) {
      parts.push(`Erro: ${log.errorMessage}`);
    }

    const content = parts.join(' ');

    return {
      source: 'zenya_operation',
      nucleusId: 'zenya',
      sourceRef: log.executionId ?? log.flowId,
      content,
      tags: [log.flowName, log.status, 'zenya_execution'],
    };
  }
}
