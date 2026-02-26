-- 015: Chat interno - suporte a media, reacoes e respostas citadas

-- Tipo de mensagem (text, image, audio, video, document, ptt)
ALTER TABLE atd.chat_interno_mensagens
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'text';

-- Media
ALTER TABLE atd.chat_interno_mensagens
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_mimetype VARCHAR(100),
  ADD COLUMN IF NOT EXISTS media_filename VARCHAR(255);

-- Reacoes (array de objetos: [{emoji, atendente_id, nome}])
ALTER TABLE atd.chat_interno_mensagens
  ADD COLUMN IF NOT EXISTS reacoes JSONB DEFAULT '[]';

-- Respostas citadas (reply)
ALTER TABLE atd.chat_interno_mensagens
  ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES atd.chat_interno_mensagens(id);

-- Permitir conteudo null para mensagens de media sem texto
ALTER TABLE atd.chat_interno_mensagens
  ALTER COLUMN conteudo DROP NOT NULL;
