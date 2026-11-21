#!/usr/bin/env bash
# Yeni sürümü yükledikten sonra çalıştırın: bash scripts/guncelle.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Güncelleme öncesi yedek alınıyor..."
bash scripts/yedekle.sh
docker compose pull db caddy
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
