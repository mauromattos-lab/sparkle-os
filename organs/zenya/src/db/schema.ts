import { pgTable, uuid, text, jsonb, index, timestamp, integer } from 'drizzle-orm/pg-core';

export const zenyaClients = pgTable(
  'zenya_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalId: text('external_id').unique(),
    name: text('name').notNull(),
    whatsappNumber: text('whatsapp_number').notNull(),
    n8nWorkflowIds: text('n8n_workflow_ids').array().notNull().default([]),
    chatwootInboxId: integer('chatwoot_inbox_id'),
    status: text('status').notNull().default('active'),
    dataIsolationKey: text('data_isolation_key').notNull().unique(),
    provisionedAt: timestamp('provisioned_at', { withTimezone: true }).notNull().defaultNow(),
    provisionedBy: text('provisioned_by').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index('idx_zenya_clients_status').on(t.status),
    index('idx_zenya_clients_isolation_key').on(t.dataIsolationKey),
  ],
);

export type ZenyaClientRow = typeof zenyaClients.$inferSelect;
export type InsertZenyaClient = typeof zenyaClients.$inferInsert;

// --- Zenya Conversations (RLS-isolated) ---

export const zenyaConversations = pgTable(
  'zenya_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id').notNull().references(() => zenyaClients.id),
    isolationKey: text('isolation_key').notNull(),
    chatwootConvId: integer('chatwoot_conv_id'),
    content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_zenya_conversations_client').on(t.clientId),
    index('idx_zenya_conversations_isolation_key').on(t.isolationKey),
  ],
);

export type ZenyaConversationRow = typeof zenyaConversations.$inferSelect;
export type InsertZenyaConversation = typeof zenyaConversations.$inferInsert;
