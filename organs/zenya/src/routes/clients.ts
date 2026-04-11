import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import { ZenyaN8nClient } from '../n8n/client.js';
import { ZenyaChatwootClient } from '../chatwoot/client.js';
import { getDb, schema } from '../db/client.js';

const clientsRouter = new Hono();

// ID do flow template a clonar: 01. Secretária v3
const TEMPLATE_WORKFLOW_ID = 'r3C1FMc6NIi6eCGI';

function rowToClient(row: typeof schema.zenyaClients.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    whatsappNumber: row.whatsappNumber,
    n8nWorkflowIds: row.n8nWorkflowIds,
    chatwootInboxId: row.chatwootInboxId,
    status: row.status,
    dataIsolationKey: row.dataIsolationKey,
    provisionedAt: row.provisionedAt.toISOString(),
    provisionedBy: row.provisionedBy,
    metadata: row.metadata,
  };
}

// POST /clients — provisionar novo cliente Zenya
// Saga: clone n8n → criar inbox Chatwoot → INSERT Postgres
// Compensação em caso de falha parcial (reverse order)
clientsRouter.post('/', async (c) => {
  const body = await c.req.json<{
    name: string;
    whatsappNumber: string;
    provisionedBy?: string;
  }>();

  const { name, whatsappNumber, provisionedBy = 'agent' } = body;

  if (!name?.trim() || !whatsappNumber?.trim()) {
    return c.json({ error: 'name and whatsappNumber are required' }, 400);
  }

  const n8nClient = new ZenyaN8nClient();
  const chatwootClient = new ZenyaChatwootClient();
  const db = getDb();

  let clonedWorkflowId: string | null = null;
  let chatwootInboxId: number | null = null;

  try {
    // Step 1: Clone n8n workflow template
    const clonedWorkflow = await n8nClient.cloneWorkflow(
      TEMPLATE_WORKFLOW_ID,
      `${name.trim()} - Secretária v3`,
    );
    clonedWorkflowId = clonedWorkflow.id;

    // Step 2: Create Chatwoot inbox
    const inbox = await chatwootClient.createInbox(name.trim());
    chatwootInboxId = inbox.id;

    // Step 3: Register client in Postgres
    const dataIsolationKey = crypto.randomUUID();
    const [row] = await db
      .insert(schema.zenyaClients)
      .values({
        name: name.trim(),
        whatsappNumber: whatsappNumber.trim(),
        n8nWorkflowIds: [clonedWorkflowId],
        chatwootInboxId,
        status: 'active',
        dataIsolationKey,
        provisionedBy,
        metadata: {},
      })
      .returning();

    if (!row) throw new Error('Failed to create client record in database');

    return c.json(rowToClient(row), 201);
  } catch (error) {
    // Compensation: rollback in reverse order (Postgres already failed or not reached)
    if (chatwootInboxId !== null) {
      try {
        await chatwootClient.deleteInbox(chatwootInboxId);
      } catch (compensationErr) {
        console.error(
          `[compensation] Failed to delete Chatwoot inbox ${chatwootInboxId}:`,
          compensationErr,
        );
      }
    }

    if (clonedWorkflowId !== null) {
      try {
        await n8nClient.deleteWorkflow(clonedWorkflowId);
      } catch (compensationErr) {
        console.error(
          `[compensation] Failed to delete n8n workflow ${clonedWorkflowId}:`,
          compensationErr,
        );
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown provisioning error';
    return c.json({ error: `Provisioning failed: ${message}` }, 500);
  }
});

// GET /clients — listar todos os clientes Zenya com status
clientsRouter.get('/', async (c) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.zenyaClients)
    .orderBy(asc(schema.zenyaClients.provisionedAt));

  return c.json(rows.map(rowToClient));
});

export { clientsRouter };
