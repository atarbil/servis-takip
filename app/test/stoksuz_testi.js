// İşçilik / Eğitim / Hizmet düğmeleri: satış fişine ve teklife stoksuz satır ekler; Tür sütunu yok; teklif fiş düzeninde.
//   node test/stoksuz_testi.js http://127.0.0.1:3100 /tmp/ekran   (tarayici_testi.js sonrası)
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
  const hatalar = [];
  p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(T);
  await p.fill('[name=kullanici_adi]', 'ali'); await p.fill('[name=sifre]', 'Sifre1234'); await p.click('button');
  await p.waitForSelector('#sayfa');
  const api = (y, u, g) => p.evaluate(async ([y, u, g]) => (await fetch('/api' + u, { method: y, headers: { 'content-type': 'application/json', 'x-istek': '1' }, body: g ? JSON.stringify(g) : undefined })).json(), [y, u, g]);
  const cari = (await api('GET', '/cariler'))[0];
  await api('POST', '/urunler', { ad: 'Stoksuz Test Kamerası', kod: 'STK-1', onerilen_satis: 1000 });

  // Satış fişi
  const f = await api('POST', '/fisler', { cari_id: cari.id });
  await p.goto(`${T}/#/fis/${f.id}`); await p.waitForSelector('.fatura');
  const basliklar = await p.$$eval('#kalemler thead th', (x) => x.map((h) => h.textContent.trim()));
  kontrol('Fişte Tür sütunu yok', !basliklar.includes('Tür'), basliklar);
  kontrol('Fişte İşçilik / Eğitim / Hizmet düğmeleri', await p.$$eval('[data-ekle]', (x) => x.map((d) => d.dataset.ekle).join()) === 'urun,iscilik,egitim,hizmet,barkod');
  await p.click('[data-ekle=urun]');
  await p.keyboard.type('stoksuz test', { delay: 20 });
  await p.waitForSelector('.secici-liste:not([hidden]) .secici-oge');
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  await p.keyboard.type('2');
  await p.click('[data-ekle=iscilik]'); await p.waitForTimeout(150);
  const od = await p.evaluate(() => ({ k: document.activeElement?.dataset?.k, v: document.activeElement?.value, s: document.activeElement?.selectionEnd }));
  kontrol('İşçilik satırı açıldı, açıklama seçili', od.k === 'aciklama' && od.v === 'İşçilik' && od.s === 7, od);
  await p.keyboard.type('Kamera montaj işçiliği');
  await p.press('tr[data-i="1"] [data-k=miktar]', 'Control+a').catch(() => {});
  await p.fill('tr[data-i="1"] [data-k=miktar]', '3');
  await p.fill('tr[data-i="1"] [data-k=birim_fiyat]', '400');
  await p.click('[data-ekle=egitim]'); await p.waitForTimeout(100);
  await p.keyboard.type('NVR eğitimi');
  await p.fill('tr[data-i="2"] [data-k=birim_fiyat]', '250');
  kontrol('Stoksuz satırlar rozetli', await p.$$eval('.satir-tur.iscilik, .satir-tur.egitim', (x) => x.length) === 2);
  await p.screenshot({ path: `${EKRAN}/stoksuz-fis.png` });
  await p.click('[data-a=kaydet]'); await p.waitForTimeout(600);
  const fx = await api('GET', `/fisler/${f.id}`);
  kontrol('Fiş kaydedildi: 1 ürün + işçilik + eğitim', fx.satirlar.length === 3 && fx.satirlar[1].tip === 'iscilik' && !fx.satirlar[1].urun_id && fx.satirlar[1].aciklama === 'Kamera montaj işçiliği' && fx.satirlar[1].birim === 'saat' && fx.satirlar[2].tip === 'egitim', fx.satirlar.map((s) => [s.tip, s.aciklama, s.birim]));
  kontrol('Fiş toplamı (2000 + 1200 + 250)', Number(fx.ara_toplam) === 3450, fx.ara_toplam);
  // Boş açıklamalı stoksuz satır kaydedilmez
  await p.click('[data-ekle=hizmet]'); await p.waitForTimeout(100);
  await p.keyboard.press('Control+a'); await p.keyboard.press('Backspace');
  await p.click('[data-a=kaydet]'); await p.waitForTimeout(400);
  kontrol('Boş hizmet açıklaması uyarı verdi', /açıklamasını yazın/.test(await p.textContent('body')));

  // Teklif — fiş düzeninde
  await p.goto(`${T}/#/teklif/yeni?cari=${cari.id}`); await p.waitForSelector('.fatura');
  kontrol('Teklif fiş düzeninde (fatura-ust, fatura-tablo, toplam)', !!(await p.$('.fatura-ust .fatura-cari')) && !!(await p.$('#kalemler.fatura-tablo')) && !!(await p.$('.fatura-alt .fatura-toplam')));
  kontrol('Teklifte Tür sütunu yok', !(await p.$$eval('#kalemler thead th', (x) => x.map((h) => h.textContent.trim()))).includes('Tür'));
  kontrol('Teklif metinleri bölümü', !!(await p.$('details.teklif-metinleri #t-giris')));
  await p.click('[data-ekle=urun]');
  await p.keyboard.type('stoksuz test', { delay: 20 });
  await p.waitForSelector('.secici-liste:not([hidden]) .secici-oge');
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  await p.click('[data-ekle=hizmet]'); await p.waitForTimeout(100);
  await p.keyboard.type('Uzaktan izleme kurulumu');
  await p.fill('tr[data-i="1"] [data-k=birim_fiyat]', '500');
  await p.check('#maliyet-goster'); await p.waitForTimeout(100);
  kontrol('Maliyet sütunu açılıyor', await p.$eval('#kalemler', (t) => !t.classList.contains('maliyetsiz')));
  await p.screenshot({ path: `${EKRAN}/stoksuz-teklif.png`, fullPage: true });
  await p.click('[data-a=kaydet]'); await p.waitForTimeout(700);
  const tid = (await p.evaluate(() => location.hash)).split('/')[2];
  const tx = await api('GET', `/teklifler/${tid}`);
  kontrol('Teklif kaydedildi, hizmet satırı stoksuz', tx.satirlar?.length === 2 && tx.satirlar[1].tip === 'hizmet' && !tx.satirlar[1].urun_id && Number(tx.ara_toplam) === 1500, tx.satirlar?.map((s) => [s.tip, s.aciklama]));
  await p.uncheck('#maliyet-goster');

  // İşi ben yaptım: aynı düğmeler
  await p.click('#btn-hizli'); await p.waitForSelector('dialog[open] #hi-ben');
  await p.check('#hi-ben'); await p.waitForTimeout(400); if (await p.$('.secici-liste:not([hidden])')) await p.keyboard.press('Escape');
  kontrol('İşi ben yaptım: + İşçilik / + Eğitim / + Hizmet', await p.$$eval('dialog[open] [data-hi-ekle]', (x) => x.map((d) => d.dataset.hiEkle).join()) === 'urun,iscilik,egitim,hizmet');
  await p.click('dialog[open] [data-hi-ekle=iscilik]'); await p.waitForTimeout(100);
  const hi = await p.evaluate(() => ({ v: document.activeElement?.value, r: !!document.activeElement?.closest('.stoksuz-hucre') }));
  kontrol('İşi ben yaptım: stoksuz işçilik satırı açıldı', hi.v === 'İşçilik' && hi.r, hi);
  await p.keyboard.type('Kamera bakımı');
  await p.fill('dialog[open] textarea[name=mesaj]', 'Ahmet Market kamera bakımı');
  await p.click('#hi-cari'); await p.keyboard.type('Ahmet', { delay: 20 });
  await p.waitForSelector('.secici-liste:not([hidden]) .secici-oge'); await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${EKRAN}/stoksuz-isi-ben-yaptim.png` });
  await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(900);
  const sonFis = (await api('GET', '/fisler')).sort((a1, b1) => b1.id - a1.id)[0];
  const sf = sonFis && await api('GET', `/fisler/${sonFis.id}`);
  kontrol('İşi ben yaptım: fişe stoksuz işçilik geçti', sf?.satirlar?.some((x) => x.tip === 'iscilik' && !x.urun_id && x.aciklama === 'Kamera bakımı' && x.birim === 'saat'), sf?.satirlar);

  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nSTOKSUZ SATIR TESTİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
