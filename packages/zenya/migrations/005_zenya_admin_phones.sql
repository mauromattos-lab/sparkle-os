-- Migration 005: Admin channel — admin_phones whitelist per tenant
-- Numbers in admin_phones receive admin-mode responses (metrics, stats) instead of customer flow.
-- If admin_phones is empty, no admin channel is active.

ALTER TABLE zenya_tenants
  ADD COLUMN IF NOT EXISTS admin_phones TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN zenya_tenants.admin_phones IS
  'Personal numbers that receive admin-mode responses (metrics/stats) when messaging the tenant WhatsApp.';
