-- Migration 001: Zenya core tables
-- Safe to run multiple times (IF NOT EXISTS, no DROP statements)
-- Does not affect existing n8n tables

-- Message queue: persists incoming WhatsApp messages before processing
-- Enables idempotency (UNIQUE on message_id) and serial processing per session
CREATE TABLE IF NOT EXISTS zenya_queue (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT        NOT NULL,
  phone_number TEXT       NOT NULL,
  message_id  TEXT        NOT NULL UNIQUE,
  payload     JSONB       NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending',
  -- status values: pending | processing | done | failed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching pending messages by session (tenant + phone)
CREATE INDEX IF NOT EXISTS idx_zenya_queue_session
  ON zenya_queue (tenant_id, phone_number, status);

-- Index for message_id lookups (idempotency checks)
CREATE INDEX IF NOT EXISTS idx_zenya_queue_message_id
  ON zenya_queue (message_id);

-- Distributed session lock: prevents concurrent agent executions per session
-- One row per active (tenant_id, phone_number) pair
-- INSERT ON CONFLICT DO NOTHING provides mutual exclusion without advisory locks
-- (Supabase JS client does not expose SELECT FOR UPDATE SKIP LOCKED)
CREATE TABLE IF NOT EXISTS zenya_session_lock (
  tenant_id    TEXT        NOT NULL,
  phone_number TEXT        NOT NULL,
  locked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, phone_number)
);
