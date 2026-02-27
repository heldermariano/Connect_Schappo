-- 016: Tabela de tracking de pausas dos atendentes
-- Registra inicio/fim de cada pausa/ausente para metricas de supervisao

CREATE TABLE IF NOT EXISTS atd.atendente_pausas (
  id SERIAL PRIMARY KEY,
  atendente_id INTEGER NOT NULL REFERENCES atd.atendentes(id),
  tipo VARCHAR(20) NOT NULL DEFAULT 'pausa', -- 'pausa' ou 'ausente'
  inicio_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fim_at TIMESTAMPTZ,
  duracao_seg INTEGER GENERATED ALWAYS AS (
    CASE WHEN fim_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (fim_at - inicio_at))::integer
      ELSE NULL
    END
  ) STORED
);

CREATE INDEX idx_atendente_pausas_atendente ON atd.atendente_pausas(atendente_id);
CREATE INDEX idx_atendente_pausas_inicio ON atd.atendente_pausas(inicio_at);
