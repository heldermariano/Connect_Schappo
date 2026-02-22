-- =========================================================
-- MIGRAÇÃO 006: Campos SIP nos atendentes (Softphone WebRTC)
-- =========================================================

ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS sip_server VARCHAR(200);
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS sip_port INTEGER DEFAULT 8089;
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS sip_username VARCHAR(50);
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS sip_password_encrypted VARCHAR(300);
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS sip_transport VARCHAR(10) DEFAULT 'wss';
ALTER TABLE atd.atendentes ADD COLUMN IF NOT EXISTS sip_enabled BOOLEAN DEFAULT FALSE;
