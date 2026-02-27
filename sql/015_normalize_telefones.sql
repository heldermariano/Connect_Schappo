-- 015_normalize_telefones.sql
-- Normaliza telefones na tabela conversas:
-- 1) Remove caracteres nao numericos (+, -, espacos)
-- 2) Adiciona 9o digito em celulares BR (12 dig → 13 dig)
-- 3) Mescla conversas duplicadas (mesma pessoa, mesmo canal, formatos diferentes)
--
-- EXECUTADO MANUALMENTE em 2026-02-27. Este arquivo serve como referencia.

-- Passo 1: Limpar caracteres especiais
-- UPDATE atd.conversas SET telefone = REGEXP_REPLACE(telefone, '[^0-9]', '', 'g')
-- WHERE telefone ~ '[^0-9]' AND telefone IS NOT NULL;

-- Passo 2: Mesclar duplicatas (sem-9 + com-9) — mover mensagens e chamadas, deletar sem-9
-- Passo 3: Normalizar 9o digito nos restantes
-- UPDATE atd.conversas
-- SET telefone = LEFT(telefone, 4) || '9' || RIGHT(telefone, 8),
--     wa_chatid = LEFT(telefone, 4) || '9' || RIGHT(telefone, 8) || '@s.whatsapp.net'
-- WHERE telefone ~ '^55[0-9]{10}$' AND LENGTH(telefone) = 12 AND tipo = 'individual';
