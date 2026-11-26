// Satış fişi kalem tablosunun klavyeyle (Excel gibi) kullanımı.
//   node test/klavye_testi.js http://127.0.0.1:3100 /tmp/ekran   (tarayici_testi.js sonrası, aynı veritabanıyla)
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek) : ''); } };

(async () => {
  const b = await chromium.launch(); require('./eski_gorunum')(b);
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage();
  const hatalar = [];
  p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(T);
  await p.fill('[name=kullanici_adi]', 'ali'); await p.fill('[name=sifre]', 'Sifre1234'); await p.click('button');
  await p.waitForSelector('#sayfa');
  const api = (y, u, g) => p.evaluate(async ([y, u, g]) => (await fetch('/api' + u, { method: y, headers: { 'content-type': 'application/json', 'x-istek': '1' }, body: g ? JSON.stringify(g) : undefined })).json(), [y, u, g]);
  const cari = (await api('GET', '/cariler'))[0];
  await api('POST', '/urunler', { ad: 'Klavye Test Kamerası', kod: 'KLV-1', onerilen_satis: 1000 });
  await api('POST', '/urunler', { ad: 'Klavye Test Kablosu', kod: 'KLV-2', birim: 'metre', onerilen_satis: 20 });
  const f = await api('POST', '/fisler', { cari_id: cari.id });
  await p.goto(`${T}/#/fis/${f.id}`);
  await p.waitForSelector('.fatura');
  const odak = () => p.evaluate(() => { const a = document.activeElement; return { k: a?.dataset?.k, i: a?.closest('tr')?.dataset?.i, v: a?.value }; });
  const tus = async (...k) => { for (const x of k) { await p.keyboard.press(x); await p.waitForTimeout(60); } };

  // 1. satır: ürün ara, Enter ile seç -> imleç miktara
  await p.click('[data-ekle=urun]');
  let o = await odak();
  kontrol('+ Satır açıklama hücresine odaklandı', o.k === 'aciklama' && o.i === '0', o);
  await p.keyboard.type('klavye kamera', { delay: 20 });
  await p.waitForSelector('.secici-liste:not([hidden]) .secici-oge');
  await tus('Enter'); await p.waitForTimeout(250);
  o = await odak();
  kontrol('Ürün seçilince imleç miktar hücresinde', o.k === 'miktar' && o.i === '0', o);
  await p.keyboard.type('3');
  kontrol('Hücreye girince içerik seçili, yazılan üzerine yazdı', (await odak()).v === '3');
  await tus('Enter'); o = await odak();
  kontrol('Enter sonraki hücreye (birim)', o.k === 'birim', o);
  await tus('ArrowRight'); o = await odak();
  kontrol('→ fiyat hücresine', o.k === 'birim_fiyat' && o.v === '1000', o);
  await p.keyboard.type('950');
  await tus('ArrowRight'); o = await odak();
  kontrol('Yazdıktan sonra imleç sondaysa → sonraki hücre (iskonto)', o.k === 'iskonto_orani', o);
  await p.keyboard.type('10');
  await tus('ArrowLeft', 'ArrowLeft'); o = await odak();
  kontrol('Düzenlemede ← imleci gezdirir', o.k === 'iskonto_orani', o);
  await tus('Escape'); o = await odak();
  kontrol('Esc hücreyi geri aldı', o.k === 'iskonto_orani' && o.v === '', o);
  await p.keyboard.type('10');
  // Son hücrede (KDV) Enter: "Enter ile yeni satır aç" işaretsizken yeni satır AÇMAZ
  kontrol('"Enter ile yeni satır aç" varsayılan kapalı', !(await p.isChecked('#enter-yeni-satir')));
  await tus('Enter', 'Enter'); o = await odak();
  kontrol('Kutu kapalıyken son hücrede Enter yeni satır açmadı', (await p.$$('tr[data-i]')).length === 1 && o.i === '0' && o.k === 'kdv_orani', o);
  await p.check('#enter-yeni-satir');
  await p.click('tr[data-i="0"] [data-k=kdv_orani]');
  await tus('Enter'); o = await odak();
  kontrol('Kutu açıkken son hücrede Enter yeni satır açtı, imleç ürün hücresinde', o.i === '1' && o.k === 'aciklama', o);
  await p.keyboard.type('klavye kablo', { delay: 20 });
  await p.waitForSelector('.secici-liste:not([hidden]) .secici-oge');
  await tus('Enter'); await p.waitForTimeout(250);
  await p.keyboard.type('25');
  // ↑ aynı sütunda üst satıra
  await tus('ArrowUp'); o = await odak();
  kontrol('↑ üst satırda aynı sütun (miktar)', o.i === '0' && o.k === 'miktar' && o.v === '3', o);
  await tus('ArrowDown'); o = await odak();
  kontrol('↓ alt satıra', o.i === '1' && o.k === 'miktar' && o.v === '25', o);
  // Ctrl+Insert araya satır, Ctrl+Delete sil
  await tus('Control+Insert'); o = await odak();
  kontrol('Ctrl+Insert araya boş satır ekledi', o.i === '1' && (await p.$$('tr[data-i]')).length === 3, o);
  await tus('Control+Delete'); o = await odak();
  kontrol('Ctrl+Delete satırı sildi', (await p.$$('tr[data-i]')).length === 2, o);
  // Tutar ve toplam
  const toplam = await p.textContent('.fatura-toplam tr.genel');
  // 3 × 950 × %90 = 2565 ; 25 × 20 = 500 ; ara 3065, KDV 613, genel 3678
  kontrol('Genel toplam doğru', /3\.678,00/.test(toplam), toplam);
  kontrol('Yazıyla tutar', /Üç Bin Altı Yüz Yetmiş Sekiz Türk Lirası/.test(await p.textContent('.fatura-yazi')));
  kontrol('KDV dökümü', /KDV %20: matrah 3\.065,00/.test(await p.textContent('.fatura-kdv-dokum')));
  await p.screenshot({ path: `${EKRAN}/klavye_fis.png`, fullPage: true });
  // Ctrl+S kaydet
  await tus('Control+s'); await p.waitForTimeout(700);
  const kayit = await api('GET', `/fisler/${f.id}`);
  kontrol('Ctrl+S ile kaydedildi', kayit.satirlar.length === 2 && Number(kayit.genel_toplam) === 3678, { n: kayit.satirlar.length, t: kayit.genel_toplam });
  // F4 stok listesi açılır
  await p.click('tr[data-i="0"] [data-k=miktar]');
  await tus('F4');
  kontrol('F4 stok listesini açtı', await p.isVisible('dialog'));
  await tus('Escape');
  // Maliyet sütunu gizlenebilir
  await p.uncheck('#maliyet-goster'); await p.waitForTimeout(150);
  kontrol('Maliyet sütunu gizlendi', !(await p.isVisible('th.maliyet')));
  await p.check('#maliyet-goster');
  // Üst çubuktaki "+ İş ekle" penceresi işi havuza ekler
  const havuzOnce = (await api('GET', '/havuz')).length;
  await p.click('#btn-hizli'); await p.waitForSelector('dialog textarea');
  await p.keyboard.type('acil Hızlı ekleme denemesi 0532 111 22 33');
  await tus('Control+Enter'); await p.waitForTimeout(700);
  const havuz = await api('GET', '/havuz');
  kontrol('+ İş ekle penceresi havuza ekledi', havuz.length === havuzOnce + 1 && havuz.some((x) => x.baslik.includes('Hızlı ekleme denemesi') && x.oncelik === 1), havuz.length);
  kontrol('+ İş ekle penceresi kapandı', !(await p.isVisible('dialog')));
  // Telefon görünümü
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const mp = await m.newPage(); mp.on('pageerror', (e) => hatalar.push('mobil: ' + e.message));
  await mp.goto(T); await mp.fill('[name=kullanici_adi]', 'ali'); await mp.fill('[name=sifre]', 'Sifre1234'); await mp.click('button'); await mp.waitForSelector('#sayfa');
  await mp.goto(`${T}/#/fis/${f.id}`); await mp.waitForSelector('.fatura'); await mp.waitForTimeout(400);
  await mp.screenshot({ path: `${EKRAN}/klavye_fis_mobil.png`, fullPage: true });
  kontrol('Telefonda yatay taşma yok', await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nKLAVYE TESTİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error('BAŞARISIZ', e); process.exit(1); });
