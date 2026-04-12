import { pgTable, uuid, text, jsonb, index, timestamp, integer, numeric } from 'drizzle-orm/pg-core';
import type { WorkState, DecisionEntry } from '../context/types.js';

export const agentContexts = pgTable(
  'agent_contexts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: text('agent_id').notNull(),
    sessionId: text('session_id').notNull(),
    storyId: text('story_id'),
    workState: jsonb('work_state').$type<WorkState>().notNull().default({
      currentTask: '',
      filesModified: [],
      nextAction: '',
      blockers: [],
    }),
    decisionLog: jsonb('decision_log').$type<DecisionEntry[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_agent_contexts_agent_created').on(t.agentId, t.createdAt)],
);

export type AgentContextRow = typeof agentContexts.$inferSelect;
export type InsertAgentContext = typeof agentContexts.$inferInsert;

// --- ADR Registry ---

export const adrs = pgTable(
  'adrs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: integer('number').notNull().unique(),
    title: text('title').notNull(),
    status: text('status').notNull().default('proposed'),
    context: text('context'),
    decision: text('decision'),
    rationale: text('rationale'),
    alternatives: jsonb('alternatives').$type<string[]>().notNull().default([]),
    consequences: text('consequences'),
    createdBy: text('created_by'),
    storyId: text('story_id'),
    filePath: text('file_path').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_adrs_number').on(t.number)],
);

export type AdrRow = typeof adrs.$inferSelect;
export type InsertAdr = typeof adrs.$inferInsert;

// --- Decision Queue ---

import type { DecisionOption } from '../decisions/types.js';

export const pendingDecisions = pgTable(
  'pending_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    context: text('context').notNull(),
    options: jsonb('options').$type<DecisionOption[]>().notNull().default([]),
    requestedBy: text('requested_by').notNull(),
    storyId: text('story_id'),
    priority: text('priority').notNull().default('normal'),
    status: text('status').notNull().default('pending'),
    resolution: text('resolution'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('idx_pending_decisions_status').on(t.status, t.createdAt)],
);

export type PendingDecisionRow = typeof pendingDecisions.$inferSelect;
export type InsertPendingDecision = typeof pendingDecisions.$inferInsert;

// --- Cost Events ---

export const costEvents = pgTable(
  'cost_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: text('agent_id').notNull(),
    operationType: text('operation_type').notNull(),
    model: text('model'),
    units: numeric('units').notNull(),
    unitCost: numeric('unit_cost').notNull(),
    totalCost: numeric('total_cost').notNull(),
    storyId: text('story_id'),
    sessionId: text('session_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_cost_events_agent_created').on(t.agentId, t.createdAt),
    index('idx_cost_events_created').on(t.createdAt),
  ],
);

export type CostEventRow = typeof costEvents.$inferSelect;
export type InsertCostEvent = typeof costEvents.$inferInsert;

// --- Tenants (Multi-tenant Isolation Base) ---

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_tenants_slug').on(t.slug),
    index('idx_tenants_status').on(t.status),
  ],
);

export type TenantRow = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// --- Content Posts (Content Engine — Epic 5) ---

export const POST_STATUSES = [
  'gerando',
  'aguardando_aprovacao',
  'aprovado',
  'publicado',
  'escalado',
  'erro',
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const contentPosts = pgTable(
  'content_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: text('client_id').notNull().default('plaka'),
    status: text('status').$type<PostStatus>().notNull().default('gerando'),
    topic: text('topic'),
    title: text('title'),
    meta: text('meta'),
    bodyPreview: text('body_preview'),
    bodyFull: text('body_full'),
    imageDesc: text('image_desc'),
    pinCopy: text('pin_copy'),
    pinHashtags: text('pin_hashtags'),
    blogUrl: text('blog_url'),
    pinUrl: text('pin_url'),
    errorMsg: text('error_msg'),
    rejectionNote: text('rejection_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_content_posts_status_created').on(t.status, t.createdAt),
    index('idx_content_posts_client_created').on(t.clientId, t.createdAt),
  ],
);

export type ContentPostRow = typeof contentPosts.$inferSelect;
export type InsertContentPost = typeof contentPosts.$inferInsert;
