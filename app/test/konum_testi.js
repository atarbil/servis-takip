// Ekip konumları.  node test/konum_testi.js http://127.0.0.1:3100 /tmp/ekran   (api_testi.js sonrası; Patron/12345678, mehmet/usta1234)
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek).slice(0, 500) : ''); } };

(async () => {
  const b = await chromium.launch(); require('./eski_gorunum')(b);
  const hatalar = [];
  const yc = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const yp = await yc.newPage(); yp.on('pageerror', (e) => hatalar.push(e.message));
  await yp.goto(T); await yp.fill('[name=kullanici_adi]', 'Patron'); await yp.fill('[name=sifre]', '12345678'); await yp.click('button');
  await yp.waitForSelector('#sayfa');
  const api = (y, u, g) => yp.evaluate(async ([y2, u2, g2]) => { const r = await fetch('/api' + u2, { method: y2, headers: { 'content-type': 'application/json', 'x-istek': '1' }, body: g2 ? JSON.stringify(g2) : undefined }); return { durum: r.status, veri: await r.json() }; }, [y, u, g]);
  const ekip = (await api('GET', '/ekipler')).veri[0];
  await api('POST', '/kullanicilar', { ad_soyad: 'İzinsiz Usta', kullanici_adi: 'izinsiz', sifre: 'usta1234', rol: 'teknisyen', ekip_id: ekip.id });
  await api('POST', '/kullanicilar', { ad_soyad: 'Saha Usta', kullanici_adi: 'konumusta', sifre: 'usta1234', rol: 'teknisyen', ekip_id: ekip.id });
  // Teknisyen telefonda programı açar (konum izni verilmiş)
  const tc = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, geolocation: { latitude: 41.0082, longitude: 28.9784, accuracy: 15 }, permissions: ['geolocation'] });
  const tp = await tc.newPage(); tp.on('pageerror', (e) => hatalar.push(e.message));
  await tp.goto(T); await tp.fill('[name=kullanici_adi]', 'konumusta'); await tp.fill('[name=sifre]', 'usta1234'); await tp.click('button');
  await tp.waitForSelector('#sayfa'); await tp.waitForTimeout(1500);
  const metin = await tp.textContent('body');
  kontrol('Teknisyen ekranında konum bilgisi / onayı yok', !/konum/i.test(metin), metin.match(/.{0,30}konum.{0,30}/i)?.[0]);
  // İzin vermeyen ikinci teknisyen
  const ic = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const ip = await ic.newPage();
  await ip.goto(T); await ip.fill('[name=kullanici_adi]', 'izinsiz'); await ip.fill('[name=sifre]', 'usta1234'); await ip.click('button');
  await ip.waitForSelector('#sayfa'); await ip.waitForTimeout(1500);

  let k = (await api('GET', '/konumlar')).veri;
  const m = k.find((x) => x.ad_soyad === 'Saha Usta');
  kontrol('Teknisyen konumu kaydedildi', m && Math.abs(m.enlem - 41.0082) < 1e-6 && Math.abs(m.boylam - 28.9784) < 1e-6 && m.dogruluk === 15 && m.izin === 'var', m);
  kontrol('İzin vermeyen teknisyen "yok"', k.find((x) => x.ad_soyad === 'İzinsiz Usta')?.izin === 'yok', k.find((x) => x.ad_soyad === 'İzinsiz Usta'));
  kontrol('Yönetici listede yok', !k.some((x) => x.rol === 'yonetici'));
  // Teknisyen konum listesini göremez
  const tk = await tp.evaluate(async () => (await fetch('/api/konumlar', { headers: { 'x-istek': '1' } })).status);
  kontrol('Teknisyen konum listesini göremez', tk === 403, tk);
  // Yeni konum üzerine yazılır (geçmiş tutulmaz)
  await tc.setGeolocation({ latitude: 40.99, longitude: 29.03, accuracy: 20 });
  await tp.evaluate(() => fetch('/api/konum', { method: 'POST', headers: { 'content-type': 'application/json', 'x-istek': '1' }, body: JSON.stringify({ enlem: 40.99, boylam: 29.03, dogruluk: 20 }) }));
  k = (await api('GET', '/konumlar')).veri;
  kontrol('Yalnız son konum tutulur', k.filter((x) => x.ad_soyad === 'Saha Usta').length === 1 && k.find((x) => x.ad_soyad === 'Saha Usta').enlem === 40.99);
  kontrol('Geçersiz konum reddedilir', (await api('POST', '/konum', { enlem: 200, boylam: 10 })).durum === 400);

  // Yönetici: Ekip konumları ekranı
  await yp.evaluate(() => { location.hash = '#/ekip-konum'; }); await yp.waitForSelector('#harita');
  kontrol('Menüde Ekip konumları', !!(await yp.$('[data-yol="ekip-konum"]')));
  await yp.waitForTimeout(800);
  kontrol('Haritada teknisyen işareti', (await yp.$$('.harita-isaret')).length === 1 && /Saha Usta/.test(await yp.textContent('.harita-isaret')));
  kontrol('Harita karoları yüklendi', (await yp.$$('.harita-karo')).length > 4);
  const kartlar = (await yp.textContent('#konum-liste')).replace(/\s+/g, ' ');
  kontrol('Listede son görülme ve izin durumu', /Son görülme/.test(kartlar) && /Konum izni yok/.test(kartlar), kartlar.slice(0, 300));
  kontrol('Google Haritalar bağlantısı', !!(await yp.$('a[href^="https://www.google.com/maps?q=40.99,29.03"]')));
  await yp.click('[data-z="1"]'); await yp.click('[data-goster]'); await yp.waitForTimeout(200);
  kontrol('Haritada göster seçer', !!(await yp.$('.harita-isaret.secili')) && !!(await yp.$('.konum-kart.secili')));
  await yp.screenshot({ path: `${EKRAN}/konum.png` });
  await yp.setViewportSize({ width: 390, height: 844 }); await yp.waitForTimeout(300);
  kontrol('Telefonda taşma yok', !(await yp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)));
  await yp.screenshot({ path: `${EKRAN}/konum-telefon.png`, fullPage: true });

  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nKONUM TESTİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
