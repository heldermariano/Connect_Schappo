-- 015: Campo disponivel_desde em atendentes
-- Registra quando o operador ficou disponivel pela ultima vez (login ou retorno de pausa)
-- Usado para calcular tempo medio de resposta apenas a partir do momento que o operador esta online

ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS disponivel_desde TIMESTAMPTZ;

-- Inicializar com updated_at para operadores que ja estao disponiveis
UPDATE atd.atendentes SET disponivel_desde = updated_at WHERE status_presenca = 'disponivel' AND disponivel_desde IS NULL;
