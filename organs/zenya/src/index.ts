import { Hono } from 'hono';
import { flowsRouter } from './routes/flows.js';
import { clientsRouter } from './routes/clients.js';
import { healthRouter } from './routes/health.js';
import { ZenyaBaseError } from './errors/index.js';

const app = new Hono();

// Handler centralizado de erros — intercepta ZenyaBaseError e retorna resposta tipada.
// Erros não-tipados são propagados como 500 genérico com mensagem sanitizada.
app.onError((err, c) => {
  if (err instanceof ZenyaBaseError) {
    return c.json(err.toJSON(), err.statusCode as 400 | 500 | 502 | 503);
  }
  // Erro desconhecido — não expõe stack trace em produção
  const message = process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message;
  return c.json({ error: 'InternalError', code: 'INTERNAL_ERROR', message }, 500);
});

// Rotas de health check — verificam n8n, Chatwoot e Postgres
app.route('/health', healthRouter);

// Rotas do inventário de fluxos
app.route('/flows', flowsRouter);

// Rotas de provisionamento de clientes Zenya
app.route('/clients', clientsRouter);

export { app };
