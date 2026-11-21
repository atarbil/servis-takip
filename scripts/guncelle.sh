#!/usr/bin/env bash
# =====================================================================
# Servis Takip - güncelleme
#   bash scripts/guncelle.sh
# GitHub bağlantısı kuruluysa son sürümü çeker, önce yedek alır,
# sonra programı yeni sürümle yeniden başlatır. Veritabanı değişiklikleri
# program açılırken otomatik uygulanır.
# =====================================================================
set -euo pipefail

# Tüm işlem bir fonksiyon içinde: güncelleme bu dosyanın kendisini değiştirse
# bile bash çalışan kopyayı baştan sona okumuş olur.
ana() {
    cd "$(dirname "$0")/.."

    echo "==> Güncelleme öncesi yedek"
    bash scripts/yedekle.sh

    if [[ -d .git ]]; then
        echo "==> GitHub'dan son sürüm alınıyor"
        local onceki
        onceki="$(git rev-parse --short HEAD)"
        git fetch --quiet origin main
        git reset --hard --quiet origin/main
        echo "Sürüm: ${onceki} -> $(git rev-parse --short HEAD)"
        git log --oneline "${onceki}..HEAD" | head -20 || true
    else
        echo "(GitHub bağlantısı yok; klasördeki dosyalarla devam ediliyor)"
    fi

    echo "==> Program yeniden başlatılıyor"
    docker compose pull --quiet db caddy
    docker compose up -d --build
    docker image prune -f >/dev/null

    echo "==> Program açılıyor..."
    for i in $(seq 1 30); do
        if docker compose exec -T app wget -qO- http://127.0.0.1:3000/saglik >/dev/null 2>&1; then
            docker compose ps
            echo
            echo "Güncelleme tamamlandı."
            return 0
        fi
        sleep 2
    done
    echo "UYARI: Program 60 saniyede açılmadı. Kayıtlar:"
    docker compose logs app --tail 30
    exit 1
}

ana "$@"
