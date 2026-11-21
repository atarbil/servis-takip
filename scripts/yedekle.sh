#!/usr/bin/env bash
# =====================================================================
# Veritabanı + dosya (imza, fotoğraf) yedeği.
# Cron her gece çalıştırır. Elle: bash scripts/yedekle.sh
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

ZAMAN="$(date +%Y-%m-%d_%H%M)"
HEDEF="yedekler"
mkdir -p "$HEDEF"
chmod 700 "$HEDEF"

echo "[$(date '+%F %T')] Yedek başlıyor"

# 1) Veritabanı (sıkıştırılmış özel format, pg_restore ile geri yüklenir)
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 6 \
    > "$HEDEF/veritabani_${ZAMAN}.dump"

# Yedeğin bozuk olmadığını kontrol et
docker compose exec -T db pg_restore --list < "$HEDEF/veritabani_${ZAMAN}.dump" > /dev/null \
    || { echo "HATA: Yedek dosyası doğrulanamadı!"; exit 1; }

# 2) Dosyalar (imzalar, fotoğraflar, PDF'ler)
docker compose exec -T app tar -czf - -C /data dosyalar > "$HEDEF/dosyalar_${ZAMAN}.tar.gz"

# 3) Ayar dosyası
cp .env "$HEDEF/env_${ZAMAN}.bak"
chmod 600 "$HEDEF"/*

# 4) Eski yedekleri temizle
find "$HEDEF" -type f -mtime +"${YEDEK_SAKLAMA_GUN:-30}" -delete

# 5) İkinci konuma kopya (UZAK_YEDEK_HEDEF ayarlıysa)
if [[ -n "${UZAK_YEDEK_HEDEF:-}" ]]; then
    rclone copy "$HEDEF" "$UZAK_YEDEK_HEDEF" --max-age 25h
    echo "Uzak kopya: $UZAK_YEDEK_HEDEF"
fi

ls -lh "$HEDEF" | tail -n 4
echo "[$(date '+%F %T')] Yedek tamam"
