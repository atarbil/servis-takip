#!/usr/bin/env bash
# =====================================================================
# Servis Takip - programdan güncelleme servisi (sunucuda root olarak çalışır)
# systemd, guncelleme/ klasörüne bir *.istek dosyası düşünce bunu çalıştırır:
#   kontrol.istek  → GitHub'da yeni sürüm var mı bak, surum.txt'ye yaz
#   guncelle.istek → scripts/guncelle.sh'yi çalıştır, ilerlemeyi son.log'a,
#                    sonucu durum.txt'ye yaz
# Program bu klasöre yalnızca istek bırakabilir; komut çalıştıramaz.
# Kurulum: bash scripts/guncelleme_servisi_kur.sh
# =====================================================================
set -uo pipefail

# Güncelleme bu dosyayı değiştirse bile bash çalışan kopyayı baştan okumuş olsun
ana() {
    local kok k
    kok="$(cd "$(dirname "$0")/.." && pwd)"
    k="$kok/guncelleme"
    cd "$kok" || exit 0
    mkdir -p "$k"

    # Atomik yazım: program yarım dosya okumasın
    yaz() { printf '%s' "$2" > "$k/.$1.tmp" && mv -f "$k/.$1.tmp" "$k/$1"; }
    simdi() { date -Iseconds; }

    surum_yaz() {
        local hata="" icerik
        if [[ -d .git ]]; then
            git fetch --quiet origin main 2>"$k/.fetch.err" || hata="GitHub'a bağlanılamadı: $(head -c 300 "$k/.fetch.err" | tr '\t\n' '  ')"
            icerik="kurulu	$(git log -1 --format='%h%x09%cI%x09%s' HEAD)"$'\n'
            if [[ -z "$hata" ]]; then
                icerik+="$(git log --format='yeni%x09%h%x09%cI%x09%s' HEAD..origin/main | head -50)"$'\n'
            fi
        else
            icerik=""
            hata="Kurulum klasörü GitHub'a bağlı değil (.git yok)"
        fi
        icerik+="kontrol	$(simdi)"$'\n'
        [[ -n "$hata" ]] && icerik+="hata	${hata}"$'\n'
        yaz surum.txt "$icerik"
        rm -f "$k/.fetch.err"
    }

    if [[ -f "$k/guncelle.istek" ]]; then
        local isteyen onceki baslangic kod simdiki
        isteyen="$(head -c 200 "$k/guncelle.istek" | tr -cd '[:print:]' | tr '=' '-')"
        rm -f "$k/guncelle.istek" "$k/kontrol.istek"
        onceki="$( [[ -d .git ]] && git rev-parse --short HEAD || echo '-')"
        baslangic="$(simdi)"
        yaz durum.txt "durum=calisiyor
baslangic=${baslangic}
isteyen=${isteyen}
onceki=${onceki}
"
        : > "$k/son.log"
        bash scripts/guncelle.sh >> "$k/son.log" 2>&1
        kod=$?
        simdiki="$( [[ -d .git ]] && git rev-parse --short HEAD || echo '-')"
        yaz durum.txt "durum=$([[ $kod -eq 0 ]] && echo basarili || echo hata)
baslangic=${baslangic}
bitis=$(simdi)
isteyen=${isteyen}
onceki=${onceki}
simdiki=${simdiki}
cikis_kodu=${kod}
"
        surum_yaz
    fi

    if [[ -f "$k/kontrol.istek" ]]; then
        rm -f "$k/kontrol.istek"
        surum_yaz
    fi
    # Bilinmeyen istek dosyaları silinir (systemd tekrar tetiklemesin)
    rm -f "$k"/*.istek
    exit 0
}
ana "$@"
