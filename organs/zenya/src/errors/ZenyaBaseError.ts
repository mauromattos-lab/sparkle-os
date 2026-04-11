/**
 * ZenyaBaseError — classe base para todos os erros tipados da Zenya.
 * Carrega: code (identificador único), message e context opcional.
 * Usado pelo handler centralizado em src/index.ts.
 */
export class ZenyaBaseError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;
  readonly statusCode: number;

  constructor(
    code: string,
    message: string,
    options?: { context?: Record<string, unknown>; statusCode?: number; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.code = code;
    this.context = options?.context ?? {};
    this.statusCode = options?.statusCode ?? 500;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}
