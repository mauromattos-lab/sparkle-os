-- Migration 004: Test mode — allowed_phones whitelist per tenant
-- If allowed_phones is empty, all phones are accepted (production mode).
-- If non-empty, only listed phones receive responses (test/staging mode).
-- Safe to run multiple times.

ALTER TABLE zenya_tenants
  ADD COLUMN IF NOT EXISTS allowed_phones TEXT[] NOT NULL DEFAULT '{}';
