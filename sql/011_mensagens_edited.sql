-- 011: Campos para edicao de mensagens
-- is_edited: indica se a mensagem foi editada
-- edited_at: timestamp da ultima edicao

ALTER TABLE atd.mensagens ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE atd.mensagens ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
