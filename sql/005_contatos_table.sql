-- =========================================================
-- MIGRAÇÃO 005: Tabela dedicada de contatos
-- Suporte a import CSV do Chatwoot e contatos enriquecidos
-- =========================================================

CREATE TABLE atd.contatos (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(200) NOT NULL,
    telefone        VARCHAR(20),
    email           VARCHAR(200),
    avatar_url      TEXT,
    chatwoot_id     INTEGER,
    notas           TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Telefone unico (ignora NULL e vazio)
CREATE UNIQUE INDEX idx_contatos_telefone ON atd.contatos(telefone) WHERE telefone IS NOT NULL AND telefone != '';

-- Busca por nome
CREATE INDEX idx_contatos_nome ON atd.contatos(nome);

-- Busca por email
CREATE INDEX idx_contatos_email ON atd.contatos(email) WHERE email IS NOT NULL;

-- Busca por chatwoot_id (para sync)
CREATE INDEX idx_contatos_chatwoot_id ON atd.contatos(chatwoot_id) WHERE chatwoot_id IS NOT NULL;
