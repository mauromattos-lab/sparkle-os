-- Migration: 0007_image_drive_url
-- Story: 5.5 — Integração Google Drive
-- Epic: 5 — Content Engine: Automação e Integração

ALTER TABLE content_posts
  ADD COLUMN IF NOT EXISTS image_drive_url TEXT;

COMMENT ON COLUMN content_posts.image_drive_url IS 'URL da imagem selecionada no Google Drive (Vista) para publicação no Pinterest';
