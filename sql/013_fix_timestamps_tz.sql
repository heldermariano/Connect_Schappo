-- 013: Corrigir timezone do database e colunas TIMESTAMP → TIMESTAMPTZ
-- Execucao: psql -U connect_dev -d connect_schappo -f sql/013_fix_timestamps_tz.sql

BEGIN;

-- Timezone padrao do database
ALTER DATABASE connect_schappo SET timezone TO 'America/Sao_Paulo';

-- hub_usuarios: TIMESTAMP → TIMESTAMPTZ
ALTER TABLE atd.hub_usuarios
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

-- eeg_alertas_ficha: TIMESTAMP → TIMESTAMPTZ
ALTER TABLE atd.eeg_alertas_ficha
  ALTER COLUMN corrigido_at TYPE TIMESTAMPTZ,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

COMMIT;
