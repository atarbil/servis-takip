// "Programı güncelle" uçtan uca testi (sahte git deposu + systemd benzetimi + tarayıcı).
// Sunucu GUNCELLEME_KLASOR=<kök>/guncelleme ile çalışırken, api_testi.js sonrası:
//   node test/guncelleme_testi.js http://127.0.0.1:3100 /tmp/gnc/kok
// <kök> her çalıştırmada sahte bir depo olarak yeniden kurulur (gerçek kurulum klasörünü vermeyin).
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const T = process.argv[2] || 'http://127.0.0.1:3100';
const KOK = process.argv[3];
const K = path.join(KOK, 'guncelleme');
let hata = 0;
const kontrol = (ad, ok, ek) => { console.log(ok ? 'OK  ' : 'HATA', ad, ok ? '' : (ek ?? '')); if (!ok) hata++; };
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// systemd .path benzetimi: *.istek görünce servis betiğini çalıştırır
let servis = null;
function servisBaslat() {
  servis = spawn('bash', ['-c', `while true; do ls ${K}/*.istek >/dev/null 2>&1 && bash ${KOK}/scripts/guncelleme_servisi.sh; sleep 0.5; done`], { stdio: 'ignore' });
}

function sahteDepo() {
  const ana = path.dirname(KOK); const SERVIS = path.join(__dirname, '..', '..', 'scripts', 'guncelleme_servisi.sh');
  const g = 'git -c user.name=t -c user.email=t@t -c push.negotiate=false';
  require('child_process').execSync(`set -e
    rm -rf ${ana}/origin.git ${ana}/ikinci ${KOK}/.git ${KOK}/scripts
    git init -q --bare -b main ${ana}/origin.git
    mkdir -p ${KOK}/scripts ${K} && cd ${KOK} && git init -q -b main && git remote add origin ${ana}/origin.git
    cp ${SERVIS} scripts/
    printf '%s\n' '#!/usr/bin/env bash' 'set -e' 'echo "==> Güncelleme öncesi yedek"; sleep 1' \
      'echo "==> GitHub'"'"'dan son sürüm alınıyor"; git fetch -q origin main; git reset --hard -q origin/main; sleep 1' \
      'echo "==> Program yeniden başlatılıyor"; sleep 1' 'echo "==> Program açılıyor..."; sleep 1; echo Tamam' > scripts/guncelle.sh
    printf 'guncelleme/\n' > .gitignore
    git add -A && ${g} commit -q -m "İlk sürüm" && ${g} push -q origin main
    git clone -q ${ana}/origin.git ${ana}/ikinci && cd ${ana}/ikinci
    ${g} commit -q --allow-empty -m "Barkod okuma iyileştirmesi"
    ${g} commit -q --allow-empty -m "Güncelle düğmesi" && ${g} push -q origin main`, { stdio: 'ignore', shell: '/bin/bash' });
}

(async () => {
  if (!KOK) throw new Error('Kök klasör verin');
  sahteDepo();
  for (const f of fs.readdirSync(K)) fs.rmSync(path.join(K, f));
  const tarayici = await chromium.launch(); require('./eski_gorunum')(tarayici);
  const s = await (await tarayici.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  s.on('pageerror', (e) => { hata++; console.log('SAYFA HATASI', e.message); });
  await s.goto(T);
  await s.fill('input[name=kullanici_adi]', 'Patron');
  await s.fill('input[name=sifre]', '12345678');
  await s.click('#giris-form button');
  await s.waitForSelector('#sayfa');

  // 1) Servis kurulu değil
  await s.goto(`${T}/#/guncelleme`);
  await s.waitForSelector('.gnc-komut');
  kontrol('Servis yokken kurulum komutu gösterilir', (await s.textContent('.gnc-komut')).includes('guncelleme_servisi_kur.sh'));

  // Kişisel menüde bağlantı var
  kontrol('Kişisel menüde "Programı güncelle"', await s.locator('a[data-yol=guncelleme]').count() > 0);

  // 2) Servis çalışıyor: kontrol isteği → yeni sürümler listelenir
  servisBaslat();
  fs.writeFileSync(path.join(K, 'kontrol.istek'), '');
  for (let i = 0; i < 40 && !fs.existsSync(path.join(K, 'surum.txt')); i++) await bekle(250);
  await s.reload();
  await s.waitForSelector('.gnc-liste li');
  const liste = await s.$$eval('.gnc-liste li', (l) => l.map((x) => x.textContent));
  kontrol('Yeni sürümdeki 2 değişiklik listelenir', liste.length === 2 && liste.some((x) => x.includes('Güncelle düğmesi')), liste);

  // 3) Yanlış şifre
  await s.click('[data-baslat]');
  await s.fill('dialog input[name=sifre]', 'yanlis-sifre');
  await s.click('dialog button[type=submit]');
  await s.waitForSelector('.pencere-hata:not([hidden])');
  kontrol('Yanlış şifre reddedilir', (await s.textContent('.pencere-hata')).includes('Şifre hatalı'));
  kontrol('Yanlış şifrede istek dosyası yazılmaz', !fs.existsSync(path.join(K, 'guncelle.istek')));

  // 4) Doğru şifre: güncelleme başlar, adımlar görünür, bitince sayfa yenilenir
  await s.fill('dialog input[name=sifre]', '12345678');
  const yenilendi = s.waitForEvent('load', { timeout: 60000 });
  await s.click('dialog button[type=submit]');
  await s.waitForSelector('.gnc-adimlar', { timeout: 10000 });
  await s.waitForSelector('.gnc-adimlar li.bitti', { timeout: 20000 });
  kontrol('İlerleme adımları görünür', await s.locator('.gnc-adimlar li.bitti').count() >= 1);
  await yenilendi;
  await s.waitForSelector('.gnc-guncel', { timeout: 15000 });
  const sonuc = await s.textContent('#sayfa');
  kontrol('Güncelleme sonrası "Program güncel"', sonuc.includes('Program güncel'));
  kontrol('Son güncelleme başarılı görünür', sonuc.includes('Başarılı') && sonuc.includes('Patron'), sonuc.slice(0, 400));
  const durum = fs.readFileSync(path.join(K, 'durum.txt'), 'utf8');
  kontrol('durum.txt başarılı', durum.includes('durum=basarili'), durum);

  // 5) API yetki: teknisyen/oturumsuz erişemez
  const r = await fetch(`${T}/api/guncelleme`, { headers: { 'x-istek': '1' } });
  kontrol('Oturumsuz erişim yok', r.status === 401);

  servis.kill();
  await tarayici.close();
  console.log(hata ? `GÜNCELLEME TESTİ: ${hata} HATA` : 'GÜNCELLEME TESTİ BAŞARILI');
  process.exit(hata ? 1 : 0);
})().catch((e) => { console.error(e); servis?.kill(); process.exit(1); });
