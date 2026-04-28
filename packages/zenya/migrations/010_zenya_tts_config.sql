-- Migration 010: Coluna `tts_config` (JSONB) para override per-tenant das configurações TTS.
-- Story 18.24 — TTS qualidade por-tenant (modelo expressivo + voice curada + settings).
--
-- Defaults globais (cross-tenant) aplicam-se quando `tts_config` é NULL:
--   model_id: 'eleven_multilingual_v2' (mais expressivo que flash_v2_5 anterior)
--   voice_id: process.env.ELEVENLABS_VOICE_ID (fallback global)
--   voice_settings: {
--     stability: 0.40,
--     similarity_boost: 0.65,
--     style: 0.40,
--     use_speaker_boost: true
--   }
--
-- Quando `tts_config` é preenchido, faz deep-merge sobre os defaults (campo a campo).
-- Tenant pode override só `voice_id` mantendo settings default, ou tudo.
--
-- Shape esperado:
--   {
--     "voice_id": "RGymW84CSmfVugnA5tvA",            -- ElevenLabs voice ID
--     "model_id": "eleven_multilingual_v2",          -- ElevenLabs model
--     "voice_settings": {
--       "stability": 0.35,
--       "similarity_boost": 0.75,
--       "style": 0.30,
--       "speed": 1.10,
--       "use_speaker_boost": true
--     }
--   }
--
-- Default NULL preserva comportamento de tenants pré-migration que usavam
-- defaults hardcoded em código. Após esta migration, `elevenlabs.ts` muda
-- defaults para os valores acima — TODOS os tenants se beneficiam de qualidade
-- melhor automaticamente. Tenants que querem voz/settings custom (Scar) usam tts_config.

ALTER TABLE zenya_tenants
  ADD COLUMN IF NOT EXISTS tts_config JSONB DEFAULT NULL;

COMMENT ON COLUMN zenya_tenants.tts_config IS
  'Override TTS per-tenant. Shape: {voice_id?, model_id?, voice_settings?: {stability, similarity_boost, style, speed, use_speaker_boost}}. NULL = usa defaults globais (eleven_multilingual_v2 + voice_settings expressivos).';
