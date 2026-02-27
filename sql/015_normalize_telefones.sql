-- 015_normalize_telefones.sql
-- Normalizacao completa de telefones em TODAS as tabelas.
-- Padrao: somente digitos, DDI 55, 9o digito para celulares BR.
--
-- Executado manualmente em 2026-02-27.
-- Funcao + triggers garantem que novos registros sejam normalizados automaticamente.

-- =============================================
-- Funcao de normalizacao (reutilizavel)
-- =============================================
CREATE OR REPLACE FUNCTION atd.normalize_phone(p_phone VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql IMMUTABLE AS $function$
DECLARE
  cleaned VARCHAR;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN RETURN p_phone; END IF;
  IF p_phone LIKE '%@g.us%' THEN RETURN p_phone; END IF;
  cleaned := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
  IF cleaned !~ '^55' AND LENGTH(cleaned) >= 10 THEN
    cleaned := '55' || cleaned;
  END IF;
  IF LENGTH(cleaned) = 12 AND cleaned ~ '^55[0-9]{10}$' THEN
    cleaned := LEFT(cleaned, 4) || '9' || RIGHT(cleaned, 8);
  END IF;
  RETURN cleaned;
END;
$function$;

-- =============================================
-- Triggers BEFORE INSERT/UPDATE em todas as tabelas
-- =============================================

-- conversas
CREATE OR REPLACE FUNCTION atd.trg_normalize_conversas_phone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.telefone := atd.normalize_phone(NEW.telefone);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conversas_normalize_phone ON atd.conversas;
CREATE TRIGGER trg_conversas_normalize_phone
  BEFORE INSERT OR UPDATE OF telefone ON atd.conversas
  FOR EACH ROW EXECUTE FUNCTION atd.trg_normalize_conversas_phone();

-- contatos
CREATE OR REPLACE FUNCTION atd.trg_normalize_contatos_phone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.telefone := atd.normalize_phone(NEW.telefone);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_contatos_normalize_phone ON atd.contatos;
CREATE TRIGGER trg_contatos_normalize_phone
  BEFORE INSERT OR UPDATE OF telefone ON atd.contatos
  FOR EACH ROW EXECUTE FUNCTION atd.trg_normalize_contatos_phone();

-- participantes_grupo
CREATE OR REPLACE FUNCTION atd.trg_normalize_participantes_phone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.wa_phone := atd.normalize_phone(NEW.wa_phone);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_participantes_normalize_phone ON atd.participantes_grupo;
CREATE TRIGGER trg_participantes_normalize_phone
  BEFORE INSERT OR UPDATE OF wa_phone ON atd.participantes_grupo
  FOR EACH ROW EXECUTE FUNCTION atd.trg_normalize_participantes_phone();

-- hub_usuarios
CREATE OR REPLACE FUNCTION atd.trg_normalize_hub_phone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.telefone := atd.normalize_phone(NEW.telefone);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_hub_normalize_phone ON atd.hub_usuarios;
CREATE TRIGGER trg_hub_normalize_phone
  BEFORE INSERT OR UPDATE OF telefone ON atd.hub_usuarios
  FOR EACH ROW EXECUTE FUNCTION atd.trg_normalize_hub_phone();

-- chamadas
CREATE OR REPLACE FUNCTION atd.trg_normalize_chamadas_phone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.caller_number := atd.normalize_phone(NEW.caller_number);
  NEW.called_number := atd.normalize_phone(NEW.called_number);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_chamadas_normalize_phone ON atd.chamadas;
CREATE TRIGGER trg_chamadas_normalize_phone
  BEFORE INSERT OR UPDATE OF caller_number, called_number ON atd.chamadas
  FOR EACH ROW EXECUTE FUNCTION atd.trg_normalize_chamadas_phone();
