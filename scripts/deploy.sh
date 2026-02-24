#!/bin/bash
# Deploy Connect Schappo — atualiza sem derrubar o Traefik
# Uso: ./scripts/deploy.sh

set -e

cd "$(dirname "$0")/.."

echo "=== Deploy Connect Schappo ==="
echo ""

# 1. Pull do codigo
echo "[1/4] Atualizando codigo..."
git pull origin main

# 2. Build da nova imagem (sem parar o container atual)
echo "[2/4] Construindo imagem..."
docker compose build --network=host

# 3. Recriar container com a nova imagem (Traefik detecta automaticamente)
echo "[3/4] Recriando container..."
docker compose up -d --force-recreate --no-deps connect-schappo

# 4. Aguardar healthcheck
echo "[4/4] Aguardando app ficar pronto..."
for i in $(seq 1 30); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' connect-schappo 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    echo ""
    echo "=== Deploy concluido! App healthy ==="
    docker compose ps
    echo ""
    curl -s https://connect.clinicaschappo.com/api/health 2>/dev/null || curl -s http://localhost:3000/api/health
    exit 0
  fi
  printf "."
  sleep 2
done

echo ""
echo "AVISO: Timeout aguardando healthcheck. Verificar logs:"
echo "  docker compose logs --tail=30 connect-schappo"
docker compose ps
