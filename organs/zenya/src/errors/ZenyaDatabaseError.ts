import { ZenyaBaseError } from './ZenyaBaseError.js';

/**
 * ZenyaDatabaseError — erros originados nas operações de banco de dados.
 * Codes: DB_UNAVAILABLE, DB_INSERT_FAILED, DB_QUERY_FAILED, DB_ISOLATION_ERROR
 */
export class ZenyaDatabaseError extends ZenyaBaseError {
  constructor(
    code: string,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(code, message, { ...options, statusCode: 503 });
  }

  static unavailable(cause?: unknown): ZenyaDatabaseError {
    return new ZenyaDatabaseError('DB_UNAVAILABLE', 'Banco de dados indisponível', { cause });
  }

  static insertFailed(table: string, cause?: unknown): ZenyaDatabaseError {
    return new ZenyaDatabaseError(
      'DB_INSERT_FAILED',
      `Falha ao inserir em ${table}`,
      { context: { table }, cause },
    );
  }

  static queryFailed(operation: string, cause?: unknown): ZenyaDatabaseError {
    return new ZenyaDatabaseError(
      'DB_QUERY_FAILED',
      `Falha na operação de banco: ${operation}`,
      { context: { operation }, cause },
    );
  }

  static isolationError(cause?: unknown): ZenyaDatabaseError {
    return new ZenyaDatabaseError(
      'DB_ISOLATION_ERROR',
      'Erro de isolamento RLS — isolation key não configurada',
      { cause },
    );
  }
}
