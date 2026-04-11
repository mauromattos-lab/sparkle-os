import { Hono } from 'hono';
import { contextRouter } from './context/context-router.js';
import { adrRouter } from './adr/adr-router.js';
import { decisionRouter } from './decisions/decision-router.js';
import { costRouter } from './costs/cost-router.js';
import { requireInternalToken } from './middleware/auth.js';

const app = new Hono();

// Health check is public — no auth required
app.get('/health', (c) => c.json({ status: 'ok', service: 'sparkle-os-core' }));

// All API routes require internal token
app.use('/api/*', requireInternalToken);
app.route('/api/context', contextRouter);
app.route('/api/adrs', adrRouter);
app.route('/api/decisions', decisionRouter);
app.route('/api/costs', costRouter);

export { app };
export type { AgentContext, SaveContextInput, WorkState, DecisionEntry } from './context/types.js';
export { saveContext, loadContext, loadContextHistory, deleteContext } from './context/context-store.js';
export type { ADR, CreateAdrInput, AdrStatus } from './adr/types.js';
export { createAdr, listAdrs, getAdrByNumber, getNextAdrNumber, adrFilePath } from './adr/adr-store.js';
export type { PendingDecision, DecisionOption, CreateDecisionInput, ResolveDecisionInput } from './decisions/types.js';
export { createDecision, listPendingDecisions, resolveDecision } from './decisions/decision-store.js';
export type { CostEvent, RecordCostInput, CostSummary, AgentCostSummary, BudgetStatus } from './costs/types.js';
export { recordCost, getCostSummary, getCostByAgent, getBudgetStatus } from './costs/cost-store.js';
export { requireInternalToken } from './middleware/auth.js';
