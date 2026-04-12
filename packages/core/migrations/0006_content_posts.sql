-- Migration: 0006_content_posts
-- Story: 5.1 — Scheduler Diário do Squad
-- Epic: 5 — Content Engine: Automação e Integração

CREATE TABLE IF NOT EXISTS content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL DEFAULT 'plaka',
  status TEXT NOT NULL DEFAULT 'gerando',
  topic TEXT,
  title TEXT,
  meta TEXT,
  body_preview TEXT,
  body_full TEXT,
  image_desc TEXT,
  pin_copy TEXT,
  pin_hashtags TEXT,
  blog_url TEXT,
  pin_url TEXT,
  error_msg TEXT,
  rejection_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_posts_status_created
  ON content_posts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_posts_client_created
  ON content_posts (client_id, created_at DESC);

COMMENT ON TABLE content_posts IS 'Posts gerados pelo Content Engine — rastreamento de status da pipeline AEO';
COMMENT ON COLUMN content_posts.status IS 'gerando | aguardando_aprovacao | aprovado | publicado | escalado | erro';
