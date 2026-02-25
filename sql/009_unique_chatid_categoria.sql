-- =========================================================
-- Migração 009: UNIQUE(wa_chatid) → UNIQUE(wa_chatid, categoria)
--
-- Problema: mesmo contato conversando com EEG e Recepção
-- gera o mesmo wa_chatid. Com UNIQUE(wa_chatid) só existe
-- uma conversa, e as mensagens de ambos os canais se misturam.
--
-- Solução: chave composta (wa_chatid, categoria) permite
-- uma conversa por canal para o mesmo contato.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. Remover constraint UNIQUE antiga ANTES de separar dados
-- =========================================================

ALTER TABLE atd.conversas DROP CONSTRAINT IF EXISTS conversas_wa_chatid_key;

-- =========================================================
-- 2. Separar mensagens: criar novas conversas para mensagens
--    que vieram de instância diferente da categoria da conversa
-- =========================================================

CREATE TEMP TABLE instance_map (instance_name TEXT, categoria TEXT);
INSERT INTO instance_map VALUES
  ('EEG', 'eeg'),
  ('Recepção', 'recepcao'),
  ('Geral', 'geral');

DO $$
DECLARE
  r RECORD;
  new_conversa_id INTEGER;
  target_categoria TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT c.id AS conversa_id, c.wa_chatid, c.tipo, c.provider,
           c.nome_contato, c.nome_grupo, c.telefone, c.avatar_url,
           im.categoria AS nova_categoria,
           m_agg.instance_name
    FROM atd.conversas c
    JOIN LATERAL (
      SELECT m.metadata->>'instance_name' AS instance_name
      FROM atd.mensagens m
      WHERE m.conversa_id = c.id
        AND m.metadata->>'instance_name' IS NOT NULL
        AND m.metadata->>'instance_name' != ''
      GROUP BY m.metadata->>'instance_name'
    ) m_agg ON TRUE
    JOIN instance_map im ON im.instance_name = m_agg.instance_name
    WHERE im.categoria != c.categoria
  LOOP
    target_categoria := r.nova_categoria;

    SELECT id INTO new_conversa_id
    FROM atd.conversas
    WHERE wa_chatid = r.wa_chatid AND categoria = target_categoria;

    IF new_conversa_id IS NULL THEN
      INSERT INTO atd.conversas (
        wa_chatid, tipo, categoria, provider,
        nome_contato, nome_grupo, telefone, avatar_url
      ) VALUES (
        r.wa_chatid, r.tipo, target_categoria, r.provider,
        r.nome_contato, r.nome_grupo, r.telefone, r.avatar_url
      )
      RETURNING id INTO new_conversa_id;
    END IF;

    UPDATE atd.mensagens
    SET conversa_id = new_conversa_id
    WHERE conversa_id = r.conversa_id
      AND metadata->>'instance_name' = r.instance_name;

    UPDATE atd.conversas SET
      ultima_mensagem = (
        SELECT LEFT(conteudo, 200) FROM atd.mensagens
        WHERE conversa_id = new_conversa_id ORDER BY created_at DESC LIMIT 1
      ),
      ultima_msg_at = (
        SELECT created_at FROM atd.mensagens
        WHERE conversa_id = new_conversa_id ORDER BY created_at DESC LIMIT 1
      ),
      nao_lida = (
        SELECT COUNT(*) FROM atd.mensagens
        WHERE conversa_id = new_conversa_id AND from_me = FALSE
        AND created_at > COALESCE(
          (SELECT MAX(created_at) FROM atd.mensagens WHERE conversa_id = new_conversa_id AND from_me = TRUE),
          '1970-01-01'
        )
      ),
      updated_at = NOW()
    WHERE id = new_conversa_id;

    RAISE NOTICE 'Moveu msgs da instancia % (conversa %) para nova conversa % (categoria %)',
      r.instance_name, r.conversa_id, new_conversa_id, target_categoria;
  END LOOP;
END $$;

-- Atualizar conversas originais que perderam mensagens
UPDATE atd.conversas c SET
  ultima_mensagem = sub.ultima_mensagem,
  ultima_msg_at = sub.ultima_msg_at,
  nao_lida = sub.nao_lida,
  updated_at = NOW()
FROM (
  SELECT
    c2.id,
    (SELECT LEFT(conteudo, 200) FROM atd.mensagens WHERE conversa_id = c2.id ORDER BY created_at DESC LIMIT 1) AS ultima_mensagem,
    (SELECT created_at FROM atd.mensagens WHERE conversa_id = c2.id ORDER BY created_at DESC LIMIT 1) AS ultima_msg_at,
    COALESCE((
      SELECT COUNT(*) FROM atd.mensagens
      WHERE conversa_id = c2.id AND from_me = FALSE
      AND created_at > COALESCE(
        (SELECT MAX(created_at) FROM atd.mensagens WHERE conversa_id = c2.id AND from_me = TRUE),
        '1970-01-01'
      )
    ), 0) AS nao_lida
  FROM atd.conversas c2
  WHERE c2.id IN (
    SELECT DISTINCT c3.id
    FROM atd.conversas c3
    JOIN atd.mensagens m ON m.conversa_id = c3.id
    JOIN instance_map im ON im.instance_name = m.metadata->>'instance_name'
    WHERE im.categoria != c3.categoria
  )
) sub
WHERE c.id = sub.id;

DROP TABLE instance_map;

-- =========================================================
-- 3. Criar nova constraint composta
-- =========================================================

ALTER TABLE atd.conversas ADD CONSTRAINT conversas_wa_chatid_categoria_key UNIQUE (wa_chatid, categoria);

-- =========================================================
-- 4. Atualizar a função upsert_conversa
-- =========================================================

CREATE OR REPLACE FUNCTION atd.upsert_conversa(
    p_wa_chatid VARCHAR,
    p_tipo VARCHAR,
    p_categoria VARCHAR,
    p_provider VARCHAR DEFAULT 'uazapi',
    p_nome_contato VARCHAR DEFAULT NULL,
    p_nome_grupo VARCHAR DEFAULT NULL,
    p_telefone VARCHAR DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO atd.conversas (
        wa_chatid, tipo, categoria, provider,
        nome_contato, nome_grupo, telefone, avatar_url
    )
    VALUES (
        p_wa_chatid, p_tipo, p_categoria, p_provider,
        p_nome_contato, p_nome_grupo, p_telefone, p_avatar_url
    )
    ON CONFLICT (wa_chatid, categoria) DO UPDATE SET
        nome_contato = COALESCE(EXCLUDED.nome_contato, atd.conversas.nome_contato),
        nome_grupo = COALESCE(EXCLUDED.nome_grupo, atd.conversas.nome_grupo),
        avatar_url = COALESCE(EXCLUDED.avatar_url, atd.conversas.avatar_url),
        telefone = COALESCE(EXCLUDED.telefone, atd.conversas.telefone),
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
