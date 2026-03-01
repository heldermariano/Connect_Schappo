-- 015: Tabela de tracking de confirmacao de agendamentos
-- Rastreia disparos WhatsApp e respostas dos pacientes

CREATE TABLE atd.confirmacao_agendamento (
  id SERIAL PRIMARY KEY,
  chave_agenda INT NOT NULL,          -- FK para arq_agendal.chave no banco externo (schappo)
  cod_paciente INT NOT NULL,
  id_medico INT NOT NULL,
  dat_agenda DATE NOT NULL,
  telefone_envio VARCHAR(20),         -- Telefone usado no envio
  wa_message_id VARCHAR(100),         -- ID da mensagem WhatsApp enviada
  status VARCHAR(20) DEFAULT 'enviado', -- enviado, confirmado, desmarcou, sem_resposta
  enviado_por INT REFERENCES atd.atendentes(id),
  enviado_at TIMESTAMPTZ DEFAULT NOW(),
  respondido_at TIMESTAMPTZ,
  atualizado_por INT REFERENCES atd.atendentes(id),
  UNIQUE(chave_agenda)                -- Um registro por agendamento
);

CREATE INDEX idx_confirmacao_data ON atd.confirmacao_agendamento(dat_agenda);
CREATE INDEX idx_confirmacao_medico ON atd.confirmacao_agendamento(id_medico, dat_agenda);
