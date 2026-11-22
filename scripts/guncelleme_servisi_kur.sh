#!/usr/bin/env bash
# =====================================================================
# Servis Takip - "Programı güncelle" düğmesi için sunucu servisini kurar.
# Bir kez, sunucuda root olarak çalıştırılır:
#   cd /opt/servis-takip && bash scripts/guncelleme_servisi_kur.sh
# Kaldırmak için:
#   systemctl disable --now servis-takip-guncelleme.path
#   rm /etc/systemd/system/servis-takip-guncelleme.{path,service}
# =====================================================================
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Bu betik root olarak çalıştırılmalı (sudo bash ...)."; exit 1; fi

KOK="$(cd "$(dirname "$0")/.." && pwd)"
K="$KOK/guncelleme"

echo "==> Ortak klasör: $K"
mkdir -p "$K"
# Program konteynerde 'node' kullanıcısıyla (1000) çalışır; yalnızca istek dosyası bırakabilmeli
chown 1000:1000 "$K"
chmod 775 "$K"

echo "==> systemd servisi yazılıyor"
cat > /etc/systemd/system/servis-takip-guncelleme.service <<EOF
[Unit]
Description=Servis Takip - programdan güncelleme
After=docker.service

[Service]
Type=oneshot
# git kimlik bilgileri (~/.git-credentials, ~/.ssh) root kullanıcısınınkiler
Environment=HOME=/root
ExecStart=/usr/bin/env bash $KOK/scripts/guncelleme_servisi.sh
TimeoutStartSec=1800
EOF

cat > /etc/systemd/system/servis-takip-guncelleme.path <<EOF
[Unit]
Description=Servis Takip - güncelleme isteği izleyici

[Path]
PathExistsGlob=$K/*.istek
Unit=servis-takip-guncelleme.service

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now servis-takip-guncelleme.path

echo "==> Programın bu klasörü görmesi için yeniden başlatılıyor"
docker compose -f "$KOK/docker-compose.yml" up -d >/dev/null

echo "==> İlk sürüm kontrolü"
touch "$K/kontrol.istek"
for i in $(seq 1 20); do [[ -f "$K/surum.txt" ]] && break; sleep 1; done
if [[ -f "$K/surum.txt" ]]; then
    echo "Hazır. Programda sağ üstteki menüden 'Programı güncelle' ekranını açabilirsiniz."
else
    echo "Servis kuruldu ama ilk kontrol 20 saniyede bitmedi. Durum: systemctl status servis-takip-guncelleme.service"
fi
