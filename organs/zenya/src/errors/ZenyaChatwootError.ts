import { ZenyaBaseError } from './ZenyaBaseError.js';

/**
 * ZenyaChatwootError — erros originados no cliente Chatwoot.
 * Codes: CHATWOOT_UNAVAILABLE, CHATWOOT_INBOX_CREATE_FAILED, CHATWOOT_INBOX_DELETE_FAILED, CHATWOOT_API_ERROR
 */
export class ZenyaChatwootError extends ZenyaBaseError {
  constructor(
    code: string,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(code, message, { ...options, statusCode: 502 });
  }

  static unavailable(cause?: unknown): ZenyaChatwootError {
    return new ZenyaChatwootError('CHATWOOT_UNAVAILABLE', 'Chatwoot está indisponível', { cause });
  }

  static inboxCreateFailed(name: string, cause?: unknown): ZenyaChatwootError {
    return new ZenyaChatwootError(
      'CHATWOOT_INBOX_CREATE_FAILED',
      `Falha ao criar inbox Chatwoot: ${name}`,
      { context: { name }, cause },
    );
  }

  static inboxDeleteFailed(inboxId: number, cause?: unknown): ZenyaChatwootError {
    return new ZenyaChatwootError(
      'CHATWOOT_INBOX_DELETE_FAILED',
      `Falha ao deletar inbox Chatwoot: ${inboxId}`,
      { context: { inboxId }, cause },
    );
  }

  static apiError(status: number, statusText: string, cause?: unknown): ZenyaChatwootError {
    return new ZenyaChatwootError(
      'CHATWOOT_API_ERROR',
      `Chatwoot API respondeu com erro: ${status} ${statusText}`,
      { context: { status, statusText }, cause },
    );
  }
}
