#!/usr/bin/env bash
# =====================================================================
# Test verilerini temizler (stok, cari, fatura, iş, kasa hareketleri…).
# KALANLAR: firma bilgileri / ayarlar (kaşe, imza, logo), kullanıcılar,
#           ekipler, belge şablonları, kasa / banka hesap tanımları.
# Önce otomatik tam yedek alınır.  Kullanım:
#   cd /opt/servis-takip && bash scripts/verileri_temizle.sh
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

echo "Bu işlem firma bilgileri, kullanıcılar ve şablonlar DIŞINDAKİ TÜM verileri silecek:"
echo "  stok kartları, cariler, alış/satış fişleri, resmi faturalar, teklifler, işler,"
echo "  kasa/banka hareketleri, takvim, konum ve denetim kayıtları, iş fotoğrafları ve imzalar."
read -r -p "Devam etmek için SİL yazın: " onay
[[ "$onay" == "SİL" || "$onay" == "SIL" ]] || { echo "İptal edildi."; exit 1; }

echo "Önce tam yedek alınıyor..."
bash scripts/yedekle.sh
YEDEK="$(ls -t yedekler/veritabani_*.dump | head -n 1)"

echo "Veriler siliniyor..."
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q \
    < db/araclar/test_verilerini_temizle.sql

# İş fotoğrafları, müşteri imzaları ve ürün resimleri (kaşe/logo/şablon görselleri kalır)
docker compose exec -T app sh -c 'rm -rf /data/dosyalar/fotograflar /data/dosyalar/imzalar /data/dosyalar/urunler'

echo
echo "Temizlik tamamlandı. Geri almak gerekirse:"
echo "  bash scripts/geri_yukle.sh $YEDEK"
