-- =========================================================
-- MIGRAÇÃO 003: Cache de participantes de grupo + menções
-- =========================================================

CREATE TABLE IF NOT EXISTS atd.participantes_grupo (
    id              SERIAL PRIMARY KEY,
    wa_phone        VARCHAR(50) NOT NULL,
    wa_chatid       VARCHAR(100),
    nome_whatsapp   VARCHAR(200),
    nome_salvo      VARCHAR(200),
    avatar_url      TEXT,
    atualizado_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wa_phone, wa_chatid)
);

CREATE INDEX IF NOT EXISTS idx_participantes_phone ON atd.participantes_grupo(wa_phone);
CREATE INDEX IF NOT EXISTS idx_participantes_grupo ON atd.participantes_grupo(wa_chatid);

ALTER TABLE atd.mensagens ADD COLUMN IF NOT EXISTS mencoes TEXT[] DEFAULT '{}';
