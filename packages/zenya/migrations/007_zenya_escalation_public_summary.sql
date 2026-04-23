-- Migration 007: Flag por tenant para controlar envio do resumo público em escalarHumano.
-- Quando TRUE (default): a tool escalarHumano posta o resumo "[ATENDIMENTO] ..." como
-- mensagem PÚBLICA na conversa (cliente também vê). Útil para tenants cuja equipe
-- atende apenas no WhatsApp e precisa ver o handoff no canal.
-- Quando FALSE: a tool escalarHumano não recebe parâmetro `resumo` e NÃO envia
-- mensagem de resumo — só faz o handoff técnico (labels). Ativar via onboarding
-- para tenants que consideram o resumo público indesejado (ex: Julia - Fun Personalize).
--
-- Default TRUE preserva o comportamento vigente para todos os tenants existentes.
-- O opt-out é explícito, por tenant.

ALTER TABLE zenya_tenants
  ADD COLUMN IF NOT EXISTS escalation_public_summary BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN zenya_tenants.escalation_public_summary IS
  'Quando TRUE, escalarHumano envia resumo "[ATENDIMENTO] ..." como mensagem pública na conversa. Quando FALSE, só faz o handoff técnico sem resumo.';
