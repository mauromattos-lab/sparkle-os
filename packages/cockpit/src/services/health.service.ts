// Health Service — checks external integrations
// Used by the Overview panel to display system health status

export type ServiceStatus = 'ok' | 'degraded' | 'offline';

export interface BrainHealthResponse {
  status: string;
  db: string;
  embeddingService: string;
}

export interface IntegrationHealth {
  name: string;
  status: ServiceStatus;
  detail: string;
  checkedAt: string;
}

export interface SystemHealth {
  overall: ServiceStatus;
  integrations: IntegrationHealth[];
  checkedAt: string;
}

/**
 * Check Brain API health by calling GET /brain/health
 * Returns offline if the service is unreachable
 */
export async function checkBrainHealth(brainUrl: string): Promise<IntegrationHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch(`${brainUrl}/brain/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        name: 'Brain API',
        status: 'degraded',
        detail: `Respondeu com status ${res.status}`,
        checkedAt,
      };
    }

    const data = (await res.json()) as BrainHealthResponse;

    if (data.status === 'ok') {
      return {
        name: 'Brain API',
        status: 'ok',
        detail: `Banco de dados: ${data.db} | Embeddings: ${data.embeddingService}`,
        checkedAt,
      };
    }

    return {
      name: 'Brain API',
      status: 'degraded',
      detail: `Banco de dados: ${data.db} | Embeddings: ${data.embeddingService}`,
      checkedAt,
    };
  } catch {
    return {
      name: 'Brain API',
      status: 'offline',
      detail: 'Serviço indisponível ou sem resposta',
      checkedAt,
    };
  }
}

/**
 * Aggregate system health from all integration checks
 */
export async function getSystemHealth(brainUrl: string): Promise<SystemHealth> {
  const checkedAt = new Date().toISOString();

  const results = await Promise.allSettled([checkBrainHealth(brainUrl)]);

  const integrations: IntegrationHealth[] = results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      name: 'Desconhecido',
      status: 'offline' as ServiceStatus,
      detail: 'Erro inesperado na verificação',
      checkedAt,
    };
  });

  const hasOffline = integrations.some((i) => i.status === 'offline');
  const hasDegraded = integrations.some((i) => i.status === 'degraded');
  const overall: ServiceStatus = hasOffline ? 'offline' : hasDegraded ? 'degraded' : 'ok';

  return { overall, integrations, checkedAt };
}
