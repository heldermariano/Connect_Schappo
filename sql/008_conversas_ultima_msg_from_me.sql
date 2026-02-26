-- 008: Adicionar coluna ultima_msg_from_me para timer de espera do paciente
-- TRUE = ultima mensagem foi enviada pelo atendente (paciente esperando resposta? Nao)
-- FALSE = ultima mensagem foi do paciente (paciente aguardando atendimento)

ALTER TABLE atd.conversas ADD COLUMN IF NOT EXISTS ultima_msg_from_me BOOLEAN DEFAULT FALSE;

-- Backfill: verificar a ultima mensagem de cada conversa
UPDATE atd.conversas c
SET ultima_msg_from_me = COALESCE(
  (SELECT m.from_me
   FROM atd.mensagens m
   WHERE m.conversa_id = c.id
   ORDER BY m.created_at DESC
   LIMIT 1),
  FALSE
);
