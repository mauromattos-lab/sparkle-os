-- Migration 009: Coluna `audio_format` para escolher o formato do áudio TTS por tenant.
-- 'mp3' (default): formato genérico, compatível com Z-API. Funcional mas o WhatsApp
-- entrega o áudio como ANEXO baixável.
-- 'ogg_opus': WhatsApp Cloud API renderiza como mensagem de voz NATIVA (PTT), com
-- waveform tocável inline. Necessário para tenants migrados pra Cloud API.
--
-- Default 'mp3' preserva comportamento atual de todos os tenants Z-API. Tenants Cloud
-- API são opt-in explícito via UPDATE pós-migration.

ALTER TABLE zenya_tenants
  ADD COLUMN IF NOT EXISTS audio_format TEXT NOT NULL DEFAULT 'mp3'
    CHECK (audio_format IN ('mp3', 'ogg_opus'));

COMMENT ON COLUMN zenya_tenants.audio_format IS
  'Formato do áudio TTS gerado pela ElevenLabs. mp3 (default) para Z-API; ogg_opus para Cloud API renderizar como voice message nativo (PTT).';
