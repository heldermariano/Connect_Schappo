#!/bin/bash
# =============================================================
# Firewall — Abrir portas para WhatsApp Voz (SIP/TLS + RTP)
# Executar no servidor de PRODUCAO como root
# =============================================================

set -euo pipefail

echo "=== Configurando firewall para WhatsApp Voz ==="

# SIP TLS (porta 5061/tcp)
echo "[1/3] Abrindo porta 5061/tcp (SIP TLS)..."
iptables -A INPUT -p tcp --dport 5061 -j ACCEPT
ip6tables -A INPUT -p tcp --dport 5061 -j ACCEPT

# RTP media (portas 10000-20000/udp)
echo "[2/3] Abrindo portas 10000-20000/udp (RTP media)..."
iptables -A INPUT -p udp --dport 10000:20000 -j ACCEPT
ip6tables -A INPUT -p udp --dport 10000:20000 -j ACCEPT

# Salvar regras (funciona em CentOS/RHEL/Issabel)
echo "[3/3] Salvando regras..."
if command -v iptables-save &> /dev/null; then
    iptables-save > /etc/sysconfig/iptables 2>/dev/null || \
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
    ip6tables-save > /etc/sysconfig/ip6tables 2>/dev/null || \
    ip6tables-save > /etc/iptables/rules.v6 2>/dev/null || true
fi

echo ""
echo "=== Firewall configurado ==="
echo "Portas abertas:"
echo "  - 5061/tcp  (SIP TLS — 360Dialog SBC)"
echo "  - 10000-20000/udp (RTP media streams)"
echo ""
echo "Para verificar: iptables -L -n | grep -E '5061|10000'"
