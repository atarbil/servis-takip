#!/usr/bin/env bash
# =====================================================================
# Servis Takip - Natro sunucusu ilk kurulum
# Ubuntu 22.04 / 24.04 için. Proje klasörünün içinden root olarak çalıştırın:
#   sudo bash scripts/kurulum.sh servis.firmaadi.com
# =====================================================================
set -euo pipefail

ALAN_ADI="${1:-}"
PROJE_DIZINI="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJE_DIZINI"

renk() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
dur()  { printf '\n\033[1;31mHATA: %s\033[0m\n' "$1"; exit 1; }

[[ $EUID -eq 0 ]] || dur "Bu betik root olarak çalıştırılmalı: sudo bash scripts/kurulum.sh <alan-adi>"
[[ -n "$ALAN_ADI" ]] || dur "Alan adı verilmedi. Örnek: sudo bash scripts/kurulum.sh servis.firmaadi.com"
grep -qiE 'ubuntu|debian' /etc/os-release || dur "Bu betik Ubuntu/Debian için hazırlandı."

renk "Saat dilimi: Europe/Istanbul"
timedatectl set-timezone Europe/Istanbul || true

renk "Sistem güncelleniyor"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

renk "Gerekli paketler kuruluyor (Docker, güvenlik duvarı, fail2ban, otomatik güvenlik güncellemeleri)"
apt-get install -y ca-certificates curl ufw fail2ban unattended-upgrades openssl cron rclone
if ! command -v docker >/dev/null 2>&1; then
    # Docker'ın resmi kurulum betiği
    curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || dur "Docker Compose bulunamadı."
systemctl enable --now docker cron fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

renk "Güvenlik duvarı: sadece SSH, HTTP ve HTTPS açık"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

renk ".env ayar dosyası"
if [[ -f .env ]]; then
    echo ".env zaten var, dokunulmadı."
    sed -i "s/^ALAN_ADI=.*/ALAN_ADI=${ALAN_ADI}/" .env
else
    cat > .env <<EOF
ALAN_ADI=${ALAN_ADI}
POSTGRES_DB=servis
POSTGRES_USER=servis
POSTGRES_PASSWORD=$(openssl rand -hex 24)
OTURUM_GIZLI=$(openssl rand -hex 32)
YEDEK_SAKLAMA_GUN=30
UZAK_YEDEK_HEDEF=
TELEGRAM_TOKEN=
EOF
    chmod 600 .env
    echo ".env oluşturuldu (şifreler rastgele üretildi)."
fi

renk "Alan adı kontrolü"
SUNUCU_IP="$(curl -fsS4 https://api.ipify.org || true)"
ALAN_IP="$(getent ahostsv4 "$ALAN_ADI" | awk 'NR==1{print $1}' || true)"
echo "Sunucu IP : ${SUNUCU_IP:-bilinmiyor}"
echo "Alan adı  : ${ALAN_ADI} -> ${ALAN_IP:-çözülemedi}"
if [[ -n "$SUNUCU_IP" && "$SUNUCU_IP" != "$ALAN_IP" ]]; then
    echo "UYARI: Alan adı bu sunucuyu göstermiyor. Natro DNS panelinden A kaydını ${SUNUCU_IP} yapın."
    echo "       HTTPS sertifikası, DNS doğru olana kadar alınamaz (Caddy otomatik tekrar dener)."
fi

renk "Servisler başlatılıyor"
docker compose up -d --build

renk "Gece yedeği (her gün 03:15)"
chmod +x scripts/*.sh
CRON_SATIRI="15 3 * * * cd ${PROJE_DIZINI} && bash scripts/yedekle.sh >> /var/log/servis-yedek.log 2>&1"
# Sunucuda hiç zamanlanmış görev yoksa "crontab -l" hata döner; bu durumda da devam etmeli
{ crontab -l 2>/dev/null | grep -v 'scripts/yedekle.sh' || true; echo "$CRON_SATIRI"; } | crontab -

renk "Kurulum tamamlandı"
docker compose ps
echo
echo "Adres: https://${ALAN_ADI}"
echo "Yedek klasörü: ${PROJE_DIZINI}/yedekler"
echo "ÖNEMLİ: ${PROJE_DIZINI}/.env dosyasının bir kopyasını güvenli bir yerde saklayın."
