-- 016: Templates de mensagem para confirmacao de agendamento
-- Permite que recepcionistas salvem e reutilizem mensagens customizadas

CREATE TABLE atd.template_confirmacao (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  conteudo TEXT NOT NULL,
  padrao BOOLEAN DEFAULT FALSE,
  atendente_id INT REFERENCES atd.atendentes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template padrao do sistema
INSERT INTO atd.template_confirmacao (nome, conteudo, padrao) VALUES (
  'Padrao',
  E'Clínica Schappo - Confirmação de Agendamento\n\nGostaríamos de confirmar seu agendamento:\n- Data: {data}\n- Médico(a): {nome_medico}\n- Horário: {hora}\n- Procedimento: {procedimento}\n\nPor favor, responda:\n1 - Confirmo meu agendamento\n2 - Preciso remarcar\n\nEm caso de dúvidas, entre em contato.\nClínica Schappo - (61) 3345-5701',
  TRUE
);

-- Adicionar coluna provider na tabela de confirmacao (para 360Dialog)
ALTER TABLE atd.confirmacao_agendamento ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'uazapi';
