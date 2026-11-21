#!/usr/bin/env bash
# =====================================================================
# Yedekten geri yükleme. DİKKAT: mevcut veritabanının yerine yazar.
#   bash scripts/geri_yukle.sh yedekler/veritabani_2026-11-21_0315.dump [yedekler/dosyalar_....tar.gz]
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

DB_YEDEK="${1:-}"
DOSYA_YEDEK="${2:-}"
[[ -f "$DB_YEDEK" ]] || { echo "Kullanım: bash scripts/geri_yukle.sh <veritabani.dump> [dosyalar.tar.gz]"; exit 1; }

echo "Bu işlem şu anki verilerin YERİNE '$DB_YEDEK' yedeğini yükleyecek."
read -r -p "Devam etmek için EVET yazın: " onay
[[ "$onay" == "EVET" ]] || { echo "İptal edildi."; exit 1; }

echo "Önce mevcut durumun güvenlik yedeği alınıyor..."
bash scripts/yedekle.sh

docker compose stop app
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS ${POSTGRES_DB} WITH (FORCE)" \
    -c "CREATE DATABASE ${POSTGRES_DB}"
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner < "$DB_YEDEK"

if [[ -n "$DOSYA_YEDEK" ]]; then
    docker compose start app
    docker compose exec -T app sh -c 'rm -rf /data/dosyalar/* && tar -xzf - -C /data' < "$DOSYA_YEDEK"
fi

docker compose start app
echo "Geri yükleme tamamlandı."
