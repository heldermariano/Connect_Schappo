-- 019: Soft-delete de mensagens (auditoria)
-- Adiciona campos para manter mensagens no banco apos exclusao

ALTER TABLE atd.mensagens
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES atd.atendentes(id);

-- Index para queries filtradas (maioria das mensagens nao sao deletadas)
CREATE INDEX IF NOT EXISTS idx_mensagens_is_deleted ON atd.mensagens (conversa_id, is_deleted) WHERE is_deleted = TRUE;
