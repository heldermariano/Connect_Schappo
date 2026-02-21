#!/bin/bash
# =============================================================
# Certbot — Copiar certificados TLS para o Asterisk
# Executar no servidor de PRODUCAO como root
# Agendar no cron para renovacao automatica
# =============================================================

set -euo pipefail

DOMAIN="connect.clinicaschappo.com"
CERT_SRC="/etc/letsencrypt/live/${DOMAIN}"
CERT_DST="/etc/asterisk/keys"

echo "=== Copiando certificados TLS para Asterisk ==="

# Verificar se certificados existem
if [ ! -d "${CERT_SRC}" ]; then
    echo "ERRO: Certificados nao encontrados em ${CERT_SRC}"
    echo "Execute primeiro: certbot certonly --standalone -d ${DOMAIN}"
    exit 1
fi

# Criar diretorio destino
mkdir -p "${CERT_DST}"

# Copiar certificados
cp "${CERT_SRC}/fullchain.pem" "${CERT_DST}/fullchain.pem"
cp "${CERT_SRC}/privkey.pem" "${CERT_DST}/privkey.pem"

# Ajustar permissoes para o Asterisk
chown asterisk:asterisk "${CERT_DST}/fullchain.pem" "${CERT_DST}/privkey.pem"
chmod 640 "${CERT_DST}/fullchain.pem" "${CERT_DST}/privkey.pem"

# Recarregar PJSIP para usar novos certificados
asterisk -rx "pjsip reload" 2>/dev/null || true

echo "=== Certificados copiados ==="
echo "  fullchain: ${CERT_DST}/fullchain.pem"
echo "  privkey:   ${CERT_DST}/privkey.pem"
echo ""
echo "Para renovacao automatica, adicione ao crontab:"
echo "  0 3 * * * certbot renew --quiet --deploy-hook '${0}'"
