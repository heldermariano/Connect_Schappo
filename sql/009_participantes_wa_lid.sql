-- 009: Adicionar coluna wa_lid para mapear Linked IDs do WhatsApp
-- WhatsApp usa LIDs em vez de telefones reais nas mencoes de grupo.
-- wa_lid permite resolver @LID para o nome real do participante.

ALTER TABLE atd.participantes_grupo ADD COLUMN IF NOT EXISTS wa_lid VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_participantes_grupo_wa_lid
  ON atd.participantes_grupo (wa_lid) WHERE wa_lid IS NOT NULL;

-- Backfill: popular wa_lid a partir do metadata das mensagens existentes
UPDATE atd.participantes_grupo pg
SET wa_lid = sub.lid
FROM (
  SELECT DISTINCT ON (sender_phone)
    sender_phone,
    REPLACE(metadata->>'sender_lid', '@lid', '') as lid
  FROM atd.mensagens
  WHERE metadata->>'sender_lid' IS NOT NULL
    AND metadata->>'sender_lid' LIKE '%@lid'
    AND sender_phone IS NOT NULL
  ORDER BY sender_phone, id DESC
) sub
WHERE pg.wa_phone = sub.sender_phone
  AND pg.wa_lid IS NULL
  AND sub.lid IS NOT NULL;
