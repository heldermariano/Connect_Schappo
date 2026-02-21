-- Atualiza funcao registrar_mensagem para aceitar parametro mencoes (TEXT[])
-- A coluna mencoes ja existe na tabela atd.mensagens (criada em 003)

CREATE OR REPLACE FUNCTION atd.registrar_mensagem(
    p_conversa_id INTEGER,
    p_wa_message_id VARCHAR,
    p_from_me BOOLEAN,
    p_sender_phone VARCHAR,
    p_sender_name VARCHAR,
    p_tipo_mensagem VARCHAR,
    p_conteudo TEXT,
    p_media_url TEXT DEFAULT NULL,
    p_media_mimetype VARCHAR DEFAULT NULL,
    p_media_filename VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_mencoes TEXT[] DEFAULT '{}'
) RETURNS INTEGER AS $$
DECLARE
    v_msg_id INTEGER;
BEGIN
    INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me,
        sender_phone, sender_name, tipo_mensagem,
        conteudo, media_url, media_mimetype,
        media_filename, metadata, mencoes
    )
    VALUES (
        p_conversa_id, p_wa_message_id, p_from_me,
        p_sender_phone, p_sender_name, p_tipo_mensagem,
        p_conteudo, p_media_url, p_media_mimetype,
        p_media_filename, p_metadata, p_mencoes
    )
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING id INTO v_msg_id;

    IF v_msg_id IS NOT NULL THEN
        UPDATE atd.conversas SET
            ultima_mensagem = LEFT(p_conteudo, 200),
            ultima_msg_at = NOW(),
            nao_lida = CASE
                WHEN p_from_me THEN 0
                ELSE nao_lida + 1
            END,
            updated_at = NOW()
        WHERE id = p_conversa_id;
    END IF;

    RETURN COALESCE(v_msg_id, 0);
END;
$$ LANGUAGE plpgsql;
