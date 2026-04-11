import { Hono } from 'hono';
import { flowsRouter } from './routes/flows.js';

const app = new Hono();

// Health check — público
app.get('/health', (c) => c.json({ status: 'ok', service: 'organ-zenya' }));

// Rotas do inventário de fluxos
app.route('/flows', flowsRouter);

export { app };
