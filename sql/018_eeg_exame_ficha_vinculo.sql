-- 018_eeg_exame_ficha_vinculo.sql
-- Tabela de vinculo entre exames do bot N8N (eeg_exames) e fichas do neuro_schappo (exams)
-- Permite rastrear qual ficha de paciente corresponde a qual exame do bot

CREATE TABLE IF NOT EXISTS atd.eeg_exame_ficha_vinculo (
    id SERIAL PRIMARY KEY,
    eeg_exame_id INTEGER NOT NULL,          -- ID no banco do N8N (eeg_exames)
    neuro_exam_id UUID,                      -- ID no neuro_schappo (exams)
    caixa_codigo VARCHAR(10),
    tecnico_nome VARCHAR(100),
    paciente_nome VARCHAR(200),
    aparelho VARCHAR(100),                   -- device_model do neuro_schappo
    is_continuo BOOLEAN DEFAULT FALSE,
    status VARCHAR(30) DEFAULT 'ativo',      -- ativo, finalizado, assumido
    assumido_por_nome VARCHAR(100),          -- se outro tecnico assumiu
    assumido_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eeg_vinculo_exame ON atd.eeg_exame_ficha_vinculo(eeg_exame_id);
CREATE INDEX IF NOT EXISTS idx_eeg_vinculo_neuro ON atd.eeg_exame_ficha_vinculo(neuro_exam_id);
CREATE INDEX IF NOT EXISTS idx_eeg_vinculo_caixa ON atd.eeg_exame_ficha_vinculo(caixa_codigo);
CREATE INDEX IF NOT EXISTS idx_eeg_vinculo_status ON atd.eeg_exame_ficha_vinculo(status);
