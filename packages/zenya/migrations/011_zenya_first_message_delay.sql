-- Migration 011: Coluna `first_message_delay_s` (INTEGER) para delay per-tenant na 1ª mensagem.
-- Story 18.25 — Per-tenant first-message delay (Fun Personalize: 60s).
--
-- Alguns tenants precisam de uma pausa extra antes de responder à primeira mensagem
-- de uma nova conversa (messages_count === 1). O cliente pode estar ainda digitando
-- sua intenção completa — o delay dá tempo antes do bot processar.
--
-- Aplicado APÓS o DEBOUNCE_MS existente (2.5s). Não interfere com mensagens
-- subsequentes da mesma conversa.
--
-- Default 0 preserva comportamento atual de todos os tenants.

ALTER TABLE zenya_tenants
  ADD COLUMN IF NOT EXISTS first_message_delay_s INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN zenya_tenants.first_message_delay_s IS
  'Delay extra (segundos) antes de processar a 1ª mensagem de uma nova conversa (messages_count=1). 0 = sem delay extra. Aplicado após DEBOUNCE_MS.';

-- Fun Personalize: 60 segundos de delay na 1ª mensagem (pedido Julia)
UPDATE zenya_tenants
  SET first_message_delay_s = 60
  WHERE chatwoot_account_id = '5';
