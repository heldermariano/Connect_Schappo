-- 010: Respostas Prontas (Quick Replies)
-- Cada operador gerencia suas proprias respostas

CREATE TABLE atd.respostas_prontas (
    id              SERIAL PRIMARY KEY,
    atendente_id    INTEGER NOT NULL REFERENCES atd.atendentes(id) ON DELETE CASCADE,
    atalho          VARCHAR(50) NOT NULL,
    conteudo        TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_respostas_atalho_atendente
  ON atd.respostas_prontas(atendente_id, LOWER(atalho));
