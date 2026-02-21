-- =========================================================
-- Connect Schappo — Schema de Atendimento
-- Arquivo: sql/001_schema_atd.sql
-- Executar no banco: connect_schappo
-- =========================================================

-- =========================================================
-- SCHEMA: atd (atendimento)
-- =========================================================

CREATE SCHEMA IF NOT EXISTS atd;

-- =========================================================
-- TABELA: atd.atendentes
-- =========================================================
CREATE TABLE IF NOT EXISTS atd.atendentes (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(200) NOT NULL,
    telefone        VARCHAR(20),
    email           VARCHAR(200),
    ramal           VARCHAR(10),
    ativo           BOOLEAN DEFAULT TRUE,
    role            VARCHAR(30) DEFAULT 'atendente',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- TABELA: atd.conversas
-- =========================================================
CREATE TABLE IF NOT EXISTS atd.conversas (
    id              SERIAL PRIMARY KEY,
    wa_chatid       VARCHAR(100) NOT NULL UNIQUE,
    tipo            VARCHAR(20) NOT NULL DEFAULT 'individual',
    categoria       VARCHAR(30) NOT NULL DEFAULT 'geral',
    provider        VARCHAR(20) NOT NULL DEFAULT 'uazapi',
    nome_contato    VARCHAR(200),
    nome_grupo      VARCHAR(200),
    telefone        VARCHAR(20),
    avatar_url      TEXT,
    ultima_mensagem TEXT,
    ultima_msg_at   TIMESTAMPTZ,
    nao_lida        INTEGER DEFAULT 0,
    is_archived     BOOLEAN DEFAULT FALSE,
    is_muted        BOOLEAN DEFAULT FALSE,
    atendente_id    INTEGER REFERENCES atd.atendentes(id),
    labels          TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversas_categoria ON atd.conversas(categoria);
CREATE INDEX IF NOT EXISTS idx_conversas_tipo ON atd.conversas(tipo);
CREATE INDEX IF NOT EXISTS idx_conversas_provider ON atd.conversas(provider);
CREATE INDEX IF NOT EXISTS idx_conversas_ultima_msg ON atd.conversas(ultima_msg_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_wa_chatid ON atd.conversas(wa_chatid);

-- =========================================================
-- TABELA: atd.mensagens
-- =========================================================
CREATE TABLE IF NOT EXISTS atd.mensagens (
    id              SERIAL PRIMARY KEY,
    conversa_id     INTEGER NOT NULL REFERENCES atd.conversas(id) ON DELETE CASCADE,
    wa_message_id   VARCHAR(200) UNIQUE,
    from_me         BOOLEAN DEFAULT FALSE,
    sender_phone    VARCHAR(20),
    sender_name     VARCHAR(200),
    tipo_mensagem   VARCHAR(30) DEFAULT 'text',
    conteudo        TEXT,
    media_url       TEXT,
    media_mimetype  VARCHAR(100),
    media_filename  VARCHAR(200),
    is_forwarded    BOOLEAN DEFAULT FALSE,
    quoted_msg_id   VARCHAR(200),
    status          VARCHAR(20) DEFAULT 'received',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON atd.mensagens(conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_wa_id ON atd.mensagens(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created ON atd.mensagens(created_at DESC);

-- =========================================================
-- TABELA: atd.chamadas
-- =========================================================
CREATE TABLE IF NOT EXISTS atd.chamadas (
    id              SERIAL PRIMARY KEY,
    conversa_id     INTEGER REFERENCES atd.conversas(id),
    wa_chatid       VARCHAR(100),
    origem          VARCHAR(20) NOT NULL,
    direcao         VARCHAR(10) NOT NULL DEFAULT 'recebida',
    caller_number   VARCHAR(30),
    called_number   VARCHAR(30),
    ramal_atendeu   VARCHAR(10),
    atendente_id    INTEGER REFERENCES atd.atendentes(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'ringing',
    duracao_seg     INTEGER DEFAULT 0,
    inicio_at       TIMESTAMPTZ DEFAULT NOW(),
    atendida_at     TIMESTAMPTZ,
    fim_at          TIMESTAMPTZ,
    gravacao_url    TEXT,
    asterisk_id     VARCHAR(100),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chamadas_conversa ON atd.chamadas(conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chamadas_origem ON atd.chamadas(origem);
CREATE INDEX IF NOT EXISTS idx_chamadas_status ON atd.chamadas(status);
CREATE INDEX IF NOT EXISTS idx_chamadas_created ON atd.chamadas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chamadas_asterisk ON atd.chamadas(asterisk_id);

-- =========================================================
-- FUNCAO: atd.upsert_conversa
-- =========================================================
CREATE OR REPLACE FUNCTION atd.upsert_conversa(
    p_wa_chatid VARCHAR,
    p_tipo VARCHAR,
    p_categoria VARCHAR,
    p_provider VARCHAR DEFAULT 'uazapi',
    p_nome_contato VARCHAR DEFAULT NULL,
    p_nome_grupo VARCHAR DEFAULT NULL,
    p_telefone VARCHAR DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO atd.conversas (
        wa_chatid, tipo, categoria, provider,
        nome_contato, nome_grupo, telefone, avatar_url
    )
    VALUES (
        p_wa_chatid, p_tipo, p_categoria, p_provider,
        p_nome_contato, p_nome_grupo, p_telefone, p_avatar_url
    )
    ON CONFLICT (wa_chatid) DO UPDATE SET
        nome_contato = COALESCE(EXCLUDED.nome_contato, atd.conversas.nome_contato),
        nome_grupo = COALESCE(EXCLUDED.nome_grupo, atd.conversas.nome_grupo),
        avatar_url = COALESCE(EXCLUDED.avatar_url, atd.conversas.avatar_url),
        telefone = COALESCE(EXCLUDED.telefone, atd.conversas.telefone),
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- FUNCAO: atd.registrar_mensagem
-- =========================================================
CREATE OR REPLACE FUNCTION atd.registrar_mensagem(
    p_conversa_id INTEGER,
    p_wa_message_id VARCHAR,
    p_from_me BOOLEAN,
    p_sender_phone VARCHAR,
    p_sender_name VARCHAR,
    p_tipo_mensagem VARCHAR,
    p_conteudo TEXT,
    p_media_url TEXT DEFAULT NULL,
    p_media_mimetype VARCHAR DEFAULT NULL,
    p_media_filename VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS INTEGER AS $$
DECLARE
    v_msg_id INTEGER;
BEGIN
    INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me,
        sender_phone, sender_name, tipo_mensagem,
        conteudo, media_url, media_mimetype,
        media_filename, metadata
    )
    VALUES (
        p_conversa_id, p_wa_message_id, p_from_me,
        p_sender_phone, p_sender_name, p_tipo_mensagem,
        p_conteudo, p_media_url, p_media_mimetype,
        p_media_filename, p_metadata
    )
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING id INTO v_msg_id;

    IF v_msg_id IS NOT NULL THEN
        UPDATE atd.conversas SET
            ultima_mensagem = LEFT(p_conteudo, 200),
            ultima_msg_at = NOW(),
            nao_lida = CASE
                WHEN p_from_me THEN 0
                ELSE nao_lida + 1
            END,
            updated_at = NOW()
        WHERE id = p_conversa_id;
    END IF;

    RETURN COALESCE(v_msg_id, 0);
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- DADOS INICIAIS: Atendentes
-- =========================================================
INSERT INTO atd.atendentes (nome, telefone, ramal) VALUES
('Renata', NULL, '201'),
('Paula', NULL, '202'),
('Jefferson', NULL, '203'),
('Claudia Santrib', NULL, '204')
ON CONFLICT DO NOTHING;
