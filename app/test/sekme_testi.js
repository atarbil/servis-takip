// Program içi sekmeler.  node test/sekme_testi.js http://127.0.0.1:3100 /tmp/ekran   (api_testi.js sonrası; Patron/12345678)
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek) : ''); } };

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage();
  const hatalar = []; p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(T);
  await p.fill('[name=kullanici_adi]', 'Patron'); await p.fill('[name=sifre]', '12345678'); await p.click('button');
  await p.waitForSelector('#sayfa .kart, #sayfa h2, #sayfa .panel', { timeout: 15000 }).catch(() => {});
  const sekmeler = () => p.$$eval('#sekme-serit .sekme', (x) => x.map((s) => ({ ad: s.querySelector('.sekme-ad').textContent.trim(), aktif: s.classList.contains('aktif'), kirli: s.classList.contains('kirli') })));
  const git = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(500); };
  const api = (y, u, g) => p.evaluate(async ([y2, u2, g2]) => (await fetch('/api' + u2, { method: y2, headers: { 'content-type': 'application/json', 'x-istek': '1' }, body: g2 ? JSON.stringify(g2) : undefined })).json(), [y, u, g]);
  const cari = (await api('GET', '/cariler'))[0];

  await git('#/fisler');
  await git('#/teklif/yeni');
  await p.click('[data-ekle=iscilik]'); await p.keyboard.type('Sekmede kalan işçilik');
  await git('#/cariler');
  let s = await sekmeler();
  kontrol('Açılan sayfalar sekme oldu', s.map((x) => x.ad).join('|') === 'Panel|Satış Fişleri|Yeni teklif|Cariler' && s[3].aktif, s);
  kontrol('Kaydedilmemiş teklif sekmesinde nokta', s[2].kirli && !s[1].kirli, s);
  await p.fill('#sayfa input[type=search], #sayfa .sayfa-ust input, #sayfa input', 'Ahmet');
  // Sekmeye dönünce yazılanlar yerinde
  await p.click('#sekme-serit .sekme:has-text("Yeni teklif")'); await p.waitForTimeout(300);
  kontrol('Teklife dönünce yazılan satır duruyor (yeniden yüklenmedi)', await p.inputValue('#kalemler tr[data-i] [data-k=aciklama]') === 'Sekmede kalan işçilik');
  kontrol('Adres ve menü vurgusu', (await p.evaluate(() => location.hash)) === '#/teklif/yeni' && /Satış/.test(await p.textContent('.um-grup.aktif-grup')));
  await p.click('#sekme-serit .sekme:has-text("Cariler")'); await p.waitForTimeout(300);
  kontrol('Cariler aramasında yazılan duruyor', await p.inputValue('#sayfa input') === 'Ahmet');

  // Aynı sayfaya menüden gitmek yeni sekme açmaz
  await git('#/fisler');
  kontrol('Aynı sayfa ikinci kez açılmaz', (await sekmeler()).length === 4);

  // Yeni teklifi kaydet: sekme adresi ve başlığı güncellenir, nokta kalkar
  await p.click('#sekme-serit .sekme:has-text("Yeni teklif")'); await p.waitForTimeout(300);
  await p.click('#t-cari'); await p.keyboard.type(cari.unvan.slice(0, 4), { delay: 20 });
  await p.waitForSelector('.secici-liste .secici-oge'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.click('[data-a=kaydet]'); await p.waitForTimeout(800);
  const h = await p.evaluate(() => location.hash);
  s = await sekmeler();
  kontrol('Kayıt sonrası sekme adresi #/teklif/ID, nokta kalktı', /^#\/teklif\/\d+$/.test(h) && !s.find((x) => x.aktif).kirli, { h, s });

  // Veri değişince liste sekmesi kendini yeniler
  const onceki = await p.textContent('#sayfa');
  await p.click('#sekme-serit .sekme:has-text("Satış Fişleri")'); await p.waitForTimeout(600);
  kontrol('Liste sekmesi açılıyor', /Satış/.test(await p.textContent('#sayfa h2, #sayfa h1, #sayfa')) && onceki !== await p.textContent('#sayfa'));

  // Değişiklik varken kapatma sorar
  await p.click('#sekme-serit .sekme.aktif');
  await git(`${h}`);
  await p.click('[data-ekle=egitim]'); await p.keyboard.type('Kapatma denemesi'); await p.waitForTimeout(150);
  await p.click('#sekme-serit .sekme.aktif .sekme-kapat');
  await p.waitForSelector('dialog[open]');
  kontrol('Kaydedilmemiş sekme kapatılırken soruluyor', /kaydedilmemiş/i.test(await p.textContent('dialog[open]')));
  await p.click('dialog[open] .btn.ikincil, dialog[open] [value=iptal], dialog[open] button:has-text("Vazgeç")'); await p.waitForTimeout(200);
  kontrol('Vazgeçince sekme kalıyor', (await sekmeler()).some((x) => x.aktif && x.kirli));
  await p.click('#sekme-serit .sekme.aktif .sekme-kapat'); await p.waitForSelector('dialog[open]');
  await p.click('dialog[open] button:has-text("Kaydetmeden kapat")'); await p.waitForTimeout(400);
  s = await sekmeler();
  kontrol('Onaylayınca kapandı, son kullanılan sekmeye geçti', s.length === 3 && !s.some((x) => /Teklif/.test(x.ad)) && s.find((x) => x.aktif)?.ad === 'Satış Fişleri', s);

  // Orta tık ve Ctrl+Alt+ok
  await p.keyboard.press('Control+Alt+ArrowRight'); await p.waitForTimeout(300);
  kontrol('Ctrl+Alt+→ sonraki sekme', (await sekmeler()).find((x) => x.aktif)?.ad === 'Cariler');
  await p.click('#sekme-serit .sekme:has-text("Panel")', { button: 'middle' }); await p.waitForTimeout(300);
  kontrol('Orta tık sekmeyi kapatır', !(await sekmeler()).some((x) => x.ad === 'Panel'));

  // Silinen kaydın sekmesi kapanır
  const t2 = await api('POST', '/teklifler', { tur: 'teklif', cari_id: cari.id, satirlar: [] });
  await git(`#/teklif/${t2.id}`);
  const say = (await sekmeler()).length;
  await p.click('[data-a=sil]'); await p.waitForSelector('dialog[open]');
  await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(800);
  kontrol('Silinen teklifin sekmesi kapandı', (await sekmeler()).length === say && !(await sekmeler()).some((x) => x.ad.includes(t2.belge_no)) && (await p.evaluate(() => location.hash)) === '#/teklifler', await sekmeler());

  // Sınır: 12 sekme
  for (const y of ['panel', 'takvim', 'isler', 'havuz', 'urunler', 'alislar', 'kasa', 'raporlar', 'envanter', 'fiyatlandirma', 'ayarlar', 'formlar', 'silinenler']) await git(`#/${y}`);
  kontrol('En fazla 12 sekme', (await sekmeler()).length === 12, (await sekmeler()).length);

  // Sayfa yenilenince sekmeler geri gelir
  const once = (await sekmeler()).map((x) => x.ad);
  await p.reload(); await p.waitForSelector('#sekme-serit .sekme'); await p.waitForTimeout(500);
  const sonra = (await sekmeler()).map((x) => x.ad);
  kontrol('Yenileyince açık sekmeler geri geldi', JSON.stringify(once) === JSON.stringify(sonra), { once, sonra });
  await p.click('[data-sekme-tumu]'); await p.waitForTimeout(300);
  kontrol('Diğerlerini kapat', (await sekmeler()).length === 1);
  await p.screenshot({ path: `${EKRAN}/sekmeler.png` });

  // Telefon: açık sayfalar düğmesi
  await git('#/cariler'); await git('#/fisler');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  kontrol('Telefonda şerit gizli, sayaç düğmesi görünür', !(await p.isVisible('#sekme-serit')) && await p.isVisible('#btn-sekmeler') && (await p.textContent('#sekme-sayi')) === '3');
  await p.click('#btn-sekmeler'); await p.waitForSelector('dialog[open] .sekme-liste');
  kontrol('Açık sayfalar listesi', (await p.$$('dialog[open] .sekme-liste-oge')).length === 3);
  await p.screenshot({ path: `${EKRAN}/sekmeler-telefon.png` });
  await p.click('dialog[open] .sekme-liste-oge:has-text("Cariler") a'); await p.waitForTimeout(400);
  kontrol('Listeden sekmeye geçildi', (await p.evaluate(() => location.hash)) === '#/cariler');

  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nSEKME TESTİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
