// KDV durumu.  node test/kdv_testi.js http://127.0.0.1:3100 /tmp/ekran   (api_testi.js sonrası; Patron/12345678)
'use strict';
const { ornekXml, zipYap } = require('./efatura_ornek');
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek).slice(0, 500) : ''); } };
const b64 = (s) => Buffer.from(s).toString('base64');

(async () => {
  let cerez = '';
  const y = async (yontem, yol, govde) => {
    const r = await fetch(T + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
    return { durum: r.status, veri: await r.json().catch(() => null) };
  };
  await y('POST', '/giris', { kullanici_adi: 'Patron', sifre: '12345678' });
  await y('PUT', '/ayarlar', { firma_vergi_no: '9876543210' });
  const ted = (await y('POST', '/cariler', { unvan: 'KDV Test Tedarik', tip: 'tedarikci' })).veri;
  const urun = (await y('POST', '/urunler', { ad: 'KDV Test Ürünü', kdv_orani: 20 })).veri;
  const a1 = (await y('POST', '/alislar', { cari_id: ted.id, belge_no: 'KDV-A1', tarih: '2026-10-10', satirlar: [{ urun_id: urun.id, miktar: 10, birim_fiyat: 1000, kdv_orani: 20 }] })).veri;
  await y('POST', `/alislar/${a1.id}/onayla`);
  await y('POST', '/alislar', { cari_id: ted.id, belge_no: 'KDV-A2', tarih: '2026-10-12', satirlar: [{ urun_id: urun.id, miktar: 1, birim_fiyat: 500, kdv_orani: 20 }] });
  const sayilar = async () => ({ alis: (await y('GET', '/alislar')).veri.length, fis: (await y('GET', '/fisler')).veri.length, cari: (await y('GET', '/cariler')).veri.length });
  const once = await sayilar();

  // ---- API ----
  let x = await y('GET', '/kdv/alis?ay=2026-10');
  kontrol('Alış KDV: yalnız onaylı alış faturası', x.veri.kdv === 2000 && x.veri.fatura === 1 && x.veri.taslaklar.length === 1 && x.veri.firma_vkn === '9876543210', x.veri);
  const firma = { vkn: '9876543210', unvan: 'Atar Bilişim', aliciVkn: '1112223334' };
  const S1 = ornekXml({ ...firma, no: 'ATR2026000000001', ettn: 'a0000000-0000-0000-0000-000000000001', tarih: '2026-10-05' }); // KDV 3910
  const S2 = ornekXml({ ...firma, no: 'ATR2026000000002', ettn: 'a0000000-0000-0000-0000-000000000002', tarih: '2026-10-20', tevkifat: 300,
    satirlar: [{ ad: 'Kamera montajı', miktar: 1, birim: 'C62', fiyat: 5000, isk: 0, kdv: 20 }] }); // KDV 1000, tevkifat 300
  const S3 = ornekXml({ ...firma, no: 'ATR2026000000003', ettn: 'a0000000-0000-0000-0000-000000000003', tarih: '2026-11-02' });
  const ALIS = ornekXml({ no: 'TED2026000000009', ettn: 'b0000000-0000-0000-0000-000000000009', tarih: '2026-10-07' }); // satıcı başka firma
  const zip = zipYap([{ ad: '1.xml', icerik: S1 }, { ad: '2.xml', icerik: S2 }]);
  x = await y('POST', '/kdv/oku', { dosyalar: [{ ad: 'ekim.zip', veri: zip.toString('base64') }, { ad: '3.xml', veri: b64(S3) }] });
  const s2 = x.veri.faturalar.find((f) => f.no === 'ATR2026000000002');
  kontrol('XML özetleri okundu', x.durum === 200 && x.veri.faturalar.length === 3 && s2.tevkifat === 300 && s2.dokum[0].kdv === 1000 && s2.satici_vkn === '9876543210', x.veri);
  kontrol('Okuma hiçbir şey kaydetmedi', JSON.stringify(await sayilar()) === JSON.stringify(once), { once, sonra: await sayilar() });

  // ---- Tarayıcı ----
  const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage();
  const hatalar = []; p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(T); await p.fill('[name=kullanici_adi]', 'Patron'); await p.fill('[name=sifre]', '12345678'); await p.click('button');
  await p.waitForSelector('#sayfa');
  await p.evaluate(() => { location.hash = '#/kdv?ay=2026-10'; });
  await p.waitForSelector('.kdv-sonuc');
  kontrol('Menüde KDV durumu', await p.$('[data-yol="kdv"]') !== null);
  kontrol('Yüklemeden önce: satış bekleniyor, alış KDV görünür', /Satış faturalarını yükleyin/.test(await p.textContent('.kdv-sonuc')) && /2\.000,00/.test(await p.textContent('.kdv-sonuc')));
  kontrol('Taslak alış uyarısı', /1 taslak alış faturası/.test(await p.textContent('.uyari-kutu')) && !!(await p.$('.uyari-kutu a[href^="#/alis/"]')));
  await p.setInputFiles('#dosya', [{ name: 'ekim.zip', mimeType: 'application/zip', buffer: zip }, { name: '3.xml', mimeType: 'application/xml', buffer: Buffer.from(S3) },
    { name: 'tekrar.xml', mimeType: 'application/xml', buffer: Buffer.from(S1) }, { name: 'alis.xml', mimeType: 'application/xml', buffer: Buffer.from(ALIS) },
    { name: 'bozuk.xml', mimeType: 'application/xml', buffer: Buffer.from('<Invoice>') }]);
  await p.waitForSelector('.kdv-sonuc.cikiyor');
  const sonuc = (await p.textContent('.kdv-sonuc')).replace(/\s+/g, ' ');
  // Hesaplanan 3910 + 1000 − 300 tevkifat = 4610; indirilecek 2000 → ödenecek 2610
  kontrol('Sonuç: KDV ÇIKIYOR, ödenecek 2.610', /ÇIKIYOR/.test(sonuc) && /2\.610,00/.test(sonuc), sonuc);
  const uy = (await p.textContent('.uyari-kutu')).replace(/\s+/g, ' ');
  kontrol('Uyarılar: başka ay, başka firma, tekrar', /1 fatura Ekim 2026 dışında/.test(uy) && /1 fatura sizin kestiğiniz bir fatura değil/.test(uy) && /1 fatura birden çok kez/.test(uy), uy);
  kontrol('Okunamayan dosya listesi', /1 dosya okunamadı/.test(await p.textContent('.kdv-hatalar summary')));
  const hesap = (await p.textContent('.kdv-hesap')).replace(/\s+/g, ' ');
  kontrol('Hesap satırları', /4\.910,00/.test(hesap) && /−300,00/.test(hesap) && /−2\.000,00/.test(hesap) && /2 fatura · 05\.10\.2026 – 20\.10\.2026/.test(hesap), hesap);
  await p.screenshot({ path: `${EKRAN}/kdv-cikiyor.png`, fullPage: true });
  await p.fill('#kdv-devreden', '3000'); await p.press('#kdv-devreden', 'Tab'); await p.waitForTimeout(200);
  const s2t = (await p.textContent('.kdv-sonuc')).replace(/\s+/g, ' ');
  kontrol('Devreden 3.000 ile: ÇIKMIYOR, devreden 390', /ÇIKMIYOR/.test(s2t) && /390,00/.test(s2t), s2t);
  await p.screenshot({ path: `${EKRAN}/kdv-cikmiyor.png`, fullPage: true });
  // Ay değişince yüklenenler bellekte kalır, Kasım hesaplanır
  await p.fill('#kdv-ay', '2026-11'); await p.dispatchEvent('#kdv-ay', 'change'); await p.waitForTimeout(500);
  kontrol('Kasım seçilince Kasım faturası sayılır', /1 fatura/.test(await p.textContent('.kdv-hesap')) && /Kasım 2026/.test(await p.textContent('.kdv-sonuc')));
  // Sekme değişip dönünce yüklenenler duruyor
  await p.evaluate(() => { location.hash = '#/cariler'; }); await p.waitForTimeout(400);
  await p.click('#sekme-serit .sekme:has-text("KDV")'); await p.waitForTimeout(300);
  kontrol('Sekmeye dönünce yüklenenler duruyor', /Yüklenen: 4 fatura/.test(await p.textContent('.kdv-yuklenen')));
  await p.click('[data-temizle]'); await p.waitForTimeout(200);
  kontrol('Temizle', !(await p.$('.kdv-yuklenen')));
  kontrol('Ekrandan yükleme de hiçbir şey kaydetmedi', JSON.stringify(await sayilar()) === JSON.stringify(once));
  // Telefon
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  kontrol('Telefonda taşma yok', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)));
  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nKDV TESTİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
