-- 014: Adicionar paciente_nome e data_exame na tabela de alertas de fichas EEG
-- + indices para consulta por tecnico
-- Execucao: psql -U connect_dev -d connect_schappo -f sql/014_alertas_ficha_paciente_data.sql

BEGIN;

ALTER TABLE atd.eeg_alertas_ficha
  ADD COLUMN IF NOT EXISTS paciente_nome VARCHAR(200),
  ADD COLUMN IF NOT EXISTS data_exame TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_eeg_alertas_ficha_tecnico_id
  ON atd.eeg_alertas_ficha (tecnico_id);

CREATE INDEX IF NOT EXISTS idx_eeg_alertas_ficha_created_at
  ON atd.eeg_alertas_ficha (created_at DESC);

COMMIT;
