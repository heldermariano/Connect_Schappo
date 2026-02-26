-- 012: Hub de usuarios (tecnicos) e alertas de fichas EEG
-- Execucao: psql -U connect_dev -d connect_schappo -f sql/012_hub_usuarios_alertas_ficha.sql

BEGIN;

-- Tabela hub_usuarios: diretorio de tecnicos EEG
CREATE TABLE IF NOT EXISTS atd.hub_usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    cargo VARCHAR(50) DEFAULT 'Técnico EEG',
    setor VARCHAR(100),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_usuarios_telefone
  ON atd.hub_usuarios (telefone);

CREATE INDEX IF NOT EXISTS idx_hub_usuarios_nome_lower
  ON atd.hub_usuarios (LOWER(nome));

-- Tabela eeg_alertas_ficha: controle de alertas enviados
CREATE TABLE IF NOT EXISTS atd.eeg_alertas_ficha (
    id SERIAL PRIMARY KEY,
    exam_id UUID NOT NULL,
    patient_id UUID,
    tecnico_nome VARCHAR(100),
    tecnico_id INTEGER REFERENCES atd.hub_usuarios(id),
    tecnico_telefone VARCHAR(20),
    tecnico_tipo VARCHAR(20), -- 'plantonista' ou 'rotineiro'
    campos_faltantes TEXT[],
    total_campos_ok INTEGER,
    total_campos INTEGER DEFAULT 14,
    corrigido BOOLEAN DEFAULT FALSE,
    corrigido_at TIMESTAMP,
    notificado_correcao BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eeg_alertas_ficha_exam_id
  ON atd.eeg_alertas_ficha (exam_id);

CREATE INDEX IF NOT EXISTS idx_eeg_alertas_ficha_corrigido
  ON atd.eeg_alertas_ficha (corrigido) WHERE corrigido = FALSE;

COMMIT;
