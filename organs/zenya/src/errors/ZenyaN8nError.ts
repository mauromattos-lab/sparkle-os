import { ZenyaBaseError } from './ZenyaBaseError.js';

/**
 * ZenyaN8nError — erros originados no cliente n8n.
 * Codes: N8N_UNAVAILABLE, N8N_CLONE_FAILED, N8N_DELETE_FAILED, N8N_API_ERROR
 */
export class ZenyaN8nError extends ZenyaBaseError {
  constructor(
    code: string,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(code, message, { ...options, statusCode: 502 });
  }

  static unavailable(cause?: unknown): ZenyaN8nError {
    return new ZenyaN8nError('N8N_UNAVAILABLE', 'n8n está indisponível', { cause });
  }

  static cloneFailed(workflowId: string, cause?: unknown): ZenyaN8nError {
    return new ZenyaN8nError('N8N_CLONE_FAILED', `Falha ao clonar workflow ${workflowId}`, {
      context: { workflowId },
      cause,
    });
  }

  static deleteFailed(workflowId: string, cause?: unknown): ZenyaN8nError {
    return new ZenyaN8nError('N8N_DELETE_FAILED', `Falha ao deletar workflow ${workflowId}`, {
      context: { workflowId },
      cause,
    });
  }

  static apiError(status: number, statusText: string, cause?: unknown): ZenyaN8nError {
    return new ZenyaN8nError(
      'N8N_API_ERROR',
      `n8n API respondeu com erro: ${status} ${statusText}`,
      { context: { status, statusText }, cause },
    );
  }
}
