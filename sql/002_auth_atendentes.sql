-- =========================================================
-- MIGRAÇÃO 002: Autenticação de Atendentes
-- =========================================================

-- Novas colunas em atd.atendentes
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200);
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS grupo_atendimento VARCHAR(30) DEFAULT 'todos';
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS status_presenca VARCHAR(20) DEFAULT 'disponivel';

-- Atualizar atendentes existentes com usernames e grupos
UPDATE atd.atendentes SET username = 'renata', grupo_atendimento = 'eeg' WHERE nome = 'Renata';
UPDATE atd.atendentes SET username = 'paula', grupo_atendimento = 'recepcao' WHERE nome = 'Paula';
UPDATE atd.atendentes SET username = 'jefferson', grupo_atendimento = 'eeg' WHERE nome = 'Jefferson';
UPDATE atd.atendentes SET username = 'claudia', grupo_atendimento = 'recepcao' WHERE nome = 'Claudia Santrib';

-- Admin
INSERT INTO atd.atendentes (nome, username, grupo_atendimento, role, ramal)
VALUES ('Helder', 'helder', 'todos', 'admin', NULL)
ON CONFLICT DO NOTHING;

-- NOTA: Para definir senhas, usar o script:
-- npx tsx scripts/create-user.ts --set-all --password SUA_SENHA
