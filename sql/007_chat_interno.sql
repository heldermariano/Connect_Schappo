-- 007: Chat Interno entre atendentes
-- Tabela de chats 1:1 entre operadores

CREATE TABLE IF NOT EXISTS atd.chat_interno (
  id SERIAL PRIMARY KEY,
  participante1_id INTEGER NOT NULL REFERENCES atd.atendentes(id),
  participante2_id INTEGER NOT NULL REFERENCES atd.atendentes(id),
  ultima_mensagem TEXT,
  ultima_msg_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chat_interno_diff CHECK (participante1_id != participante2_id)
);

-- Unique index com expressao para evitar duplicata (A,B) e (B,A)
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_interno_pair
  ON atd.chat_interno (LEAST(participante1_id, participante2_id), GREATEST(participante1_id, participante2_id));

CREATE TABLE IF NOT EXISTS atd.chat_interno_mensagens (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES atd.chat_interno(id) ON DELETE CASCADE,
  atendente_id INTEGER NOT NULL REFERENCES atd.atendentes(id),
  conteudo TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_interno_msg_chat ON atd.chat_interno_mensagens(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_interno_participantes ON atd.chat_interno(participante1_id, participante2_id);
