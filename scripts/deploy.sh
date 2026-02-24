#!/bin/bash
# Deploy Connect Schappo — atualiza garantindo que Traefik reconecte
# Uso: ./scripts/deploy.sh
#
# O que faz:
#   1. Build da imagem nova (container antigo continua rodando)
#   2. Recria container com a imagem nova
#   3. Aguarda app responder no healthcheck
#   4. Verifica se Traefik detectou o container; se nao, reinicia Traefik
#   5. Limpa imagens antigas

set -e

cd "$(dirname "$0")/.."

COMPOSE_SERVICE="connect-schappo"
DOMAIN="https://connect.clinicaschappo.com"
TRAEFIK_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i traefik | head -1)

echo "=== Deploy Connect Schappo ==="
echo ""

# 1. Pull do codigo
echo "[1/5] Atualizando codigo..."
git pull origin main

# 2. Build da nova imagem (container antigo continua servindo)
echo "[2/5] Construindo imagem..."
docker compose build --network=host

# 3. Recriar container
echo "[3/5] Recriando container..."
docker compose up -d --force-recreate --no-deps "$COMPOSE_SERVICE"

# Pegar nome real do container (sem container_name, compose gera nome automatico)
CONTAINER=$(docker compose ps -q "$COMPOSE_SERVICE" 2>/dev/null)
CONTAINER_NAME=$(docker inspect --format '{{.Name}}' "$CONTAINER" 2>/dev/null | sed 's/^\///')
echo "    Container: $CONTAINER_NAME"

# 4. Aguardar app responder
echo "[4/5] Aguardando app ficar pronto..."
APP_READY=false
for i in $(seq 1 30); do
  # Checar healthcheck do Docker
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "none")
  if [ "$STATUS" = "healthy" ]; then
    APP_READY=true
    break
  fi
  # Fallback: checar direto via rede Docker
  if [ "$STATUS" = "none" ]; then
    CONTAINER_IP=$(docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$CONTAINER" 2>/dev/null)
    if [ -n "$CONTAINER_IP" ] && curl -sf "http://$CONTAINER_IP:3000/api/health" >/dev/null 2>&1; then
      APP_READY=true
      break
    fi
  fi
  printf "."
  sleep 2
done
echo ""

if [ "$APP_READY" != "true" ]; then
  echo "ERRO: App nao respondeu apos 60s. Verificar logs:"
  echo "  docker compose logs --tail=50 $COMPOSE_SERVICE"
  exit 1
fi
echo "    App respondendo OK"

# 5. Verificar se Traefik detectou o container
echo "[5/5] Verificando Traefik..."
TRAEFIK_OK=false

# Testar acesso via dominio
for i in $(seq 1 10); do
  HTTP_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --connect-timeout 5 "$DOMAIN/api/health" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    TRAEFIK_OK=true
    break
  fi
  printf "."
  sleep 3
done
echo ""

if [ "$TRAEFIK_OK" != "true" ]; then
  echo "    Traefik nao detectou o container. Reiniciando Traefik..."
  if [ -n "$TRAEFIK_CONTAINER" ]; then
    docker restart "$TRAEFIK_CONTAINER"
    echo "    Traefik reiniciado ($TRAEFIK_CONTAINER). Aguardando..."
    sleep 5
    # Verificar novamente
    HTTP_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --connect-timeout 10 "$DOMAIN/api/health" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      TRAEFIK_OK=true
    fi
  else
    echo "    AVISO: Container Traefik nao encontrado. Reinicie manualmente."
  fi
fi

# Limpar imagens antigas (dangling)
docker image prune -f >/dev/null 2>&1 || true

echo ""
if [ "$TRAEFIK_OK" = "true" ]; then
  echo "=== Deploy concluido com sucesso! ==="
  echo ""
  curl -sk "$DOMAIN/api/health" 2>/dev/null
  echo ""
else
  echo "=== Deploy parcial: app OK mas Traefik pode precisar de restart manual ==="
  echo "    docker restart <traefik-container>"
fi
echo ""
docker compose ps
