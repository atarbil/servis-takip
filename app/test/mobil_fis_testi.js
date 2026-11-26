// Telefon satış fişi (api_testi.js sonrası, aynı veritabanıyla):
//   node test/mobil_fis_testi.js http://127.0.0.1:3100
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
let hata = 0;
const kontrol = (ad, ok, ek) => { console.log(ok ? 'OK  ' : 'HATA', ad, ok ? '' : JSON.stringify(ek ?? '')); if (!ok) hata++; };
const pen = 'dialog.pencere[open]';

(async () => {
  let cerez = '';
  const y = async (yontem, yol, govde) => {
    const r = await fetch(T + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
    return r.json().catch(() => null);
  };
  await y('POST', '/giris', { kullanici_adi: 'Patron', sifre: '12345678' });
  const cari = await y('POST', '/cariler', { unvan: 'Telefon Fiş Müşteri', tip: 'musteri' });
  const fiyatli = await y('POST', '/urunler', { ad: 'Fiyatlı Test Kamera', birim: 'adet', kdv_orani: 20, onerilen_satis: 1500 });
  await y('POST', '/urunler', { ad: 'Fiyatsız Test Kablo', birim: 'metre', kdv_orani: 20 });
  const fis = await y('POST', '/fisler', { cari_id: cari.id });

  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage(); const hatalar = []; p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(T); await p.fill('[name=kullanici_adi]', 'Patron'); await p.fill('[name=sifre]', '12345678'); await p.click('#giris-form button');
  await p.waitForSelector('.mk-alt');
  await p.goto(`${T}/#/fis/${fis.id}`); await p.waitForSelector('.mf-ust');
  kontrol('Telefon fiş ekranı açıldı (tablo yok)', !(await p.$('table.fatura-tablo')) && await p.isVisible('[data-urun-ara]'));
  kontrol('Cari tek satır', (await p.textContent('.mf-cari')).includes('Telefon Fiş Müşteri'));
  kontrol('Fiş bilgileri kapalı', !(await p.$eval('.mf-bilgi', (d) => d.open)));

  // Fiyatlı ürün: doğrudan eklenir
  await p.click('[data-urun-ara]'); await p.keyboard.type('fiyatli test');
  await p.waitForSelector('.secici-liste .secici-oge:has-text("Fiyatlı Test Kamera")');
  await p.click('.secici-liste .secici-oge:has-text("Fiyatlı Test Kamera")');
  await p.waitForSelector('.mf-kalem');
  const alt = (await p.textContent('.mf-kalem .mf-kalem-alt')).replace(/\s+/g, ' ').trim();
  kontrol('Kalem tek satır: "1 adet × 1.500,00 … 1.500,00 ₺"', /1 adet × 1\.500,00/.test(alt) && alt.includes('1.500,00 ₺'), alt);
  kontrol('Kalemde giriş kutusu yok', !(await p.$('.mf-kalem input')));
  // Aynı ürün tekrar → miktar 2
  await p.click('[data-urun-ara]'); await p.keyboard.type('fiyatli test');
  await p.waitForSelector('.secici-liste .secici-oge:has-text("Fiyatlı Test Kamera")');
  await p.click('.secici-liste .secici-oge:has-text("Fiyatlı Test Kamera")'); await p.waitForTimeout(300);
  kontrol('Aynı ürün → tek kalem, 2 adet', (await p.$$('.mf-kalem')).length === 1 && (await p.textContent('.mf-kalem .mf-kalem-alt')).includes('2 adet'));

  // Fiyatsız ürün: kalem penceresi kendiliğinden açılır; fiyat girilir
  await p.click('[data-urun-ara]'); await p.keyboard.type('fiyatsiz test');
  await p.waitForSelector('.secici-liste .secici-oge:has-text("Fiyatsız Test Kablo")');
  await p.click('.secici-liste .secici-oge:has-text("Fiyatsız Test Kablo")');
  await p.waitForSelector(`${pen}.mf-kalem-pencere`);
  kontrol('Fiyatsız üründe kalem penceresi açıldı (tam ekran)', (await p.$eval(pen, (d) => d.getBoundingClientRect().width)) >= 389);
  kontrol('İskonto / KDV "Daha fazla" altında kapalı', !(await p.$eval(`${pen} .mf-daha`, (d) => d.open)));
  await p.click(`${pen} [data-d="1"]`); await p.click(`${pen} [data-d="1"]`);
  await p.fill(`${pen} [name=birim_fiyat]`, '25');
  kontrol('Canlı tutar 75,00', (await p.textContent(`${pen} [data-canli]`)).includes('75,00'));
  await p.click(`${pen} button[type=submit]`); await p.waitForTimeout(300);
  kontrol('İki kalem; fiyatsız işaret kalktı', (await p.$$('.mf-kalem')).length === 2 && !(await p.$('.mf-kalem.fiyatsiz')));

  // İşçilik: açıklama + fiyat
  await p.click('[data-stoksuz="iscilik"]'); await p.waitForSelector(`${pen} [name=aciklama]`);
  await p.fill(`${pen} [name=aciklama]`, 'Kamera montaj işçiliği'); await p.fill(`${pen} [name=birim_fiyat]`, '500');
  await p.click(`${pen} button[type=submit]`); await p.waitForTimeout(300);
  kontrol('İşçilik kalemi', (await p.textContent('.mf-kalemler')).includes('Kamera montaj işçiliği'));
  // Genel toplam: (3000 + 75 + 500) × 1,2 = 4.290,00
  kontrol('Alt çubukta genel toplam 4.290,00 ₺', (await p.textContent('.mf-toplam b')).includes('4.290,00'), await p.textContent('.mf-toplam b'));
  await p.click('[data-dokum]');
  kontrol('Toplam dökümü: ara toplam 3.575,00', (await p.textContent('.mf-dokum')).includes('3.575,00'));
  kontrol('Kaydedilmedi işareti', await p.isVisible('[data-kaydedilmedi]'));
  kontrol('Yatay taşma yok', (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  if (process.env.EKRAN) await p.screenshot({ path: '/tmp/mf_taslak.png' });

  // Kalemi düzenle → sil
  await p.click('.mf-kalem:has-text("Fiyatsız Test Kablo")'); await p.waitForSelector(pen);
  await p.click(`${pen} [data-kalem-sil]`); await p.waitForTimeout(300);
  kontrol('Kalem silindi', (await p.$$('.mf-kalem')).length === 2);

  // Kaydetmeden çıkınca taslak kendiliğinden kaydedilir
  await p.click('#mk-alt [data-sekme="panel"]'); await p.waitForTimeout(1200);
  const kayitli = await y('GET', `/fisler/${fis.id}`);
  kontrol('Çıkarken taslak kaydedildi (2 kalem)', kayitli.satirlar.length === 2, kayitli.satirlar.length);

  // Onayla
  await p.goto(`${T}/#/fis/${fis.id}`); await p.waitForSelector('[data-a="onayla"]');
  await p.click('[data-a="onayla"]'); await p.waitForSelector(pen); await p.click(`${pen} button[type=submit]`);
  await p.waitForSelector('[data-a="tahsilat"]');
  kontrol('Onaylandı: salt okunur, kalemlere dokunulmaz', !(await p.$('button.mf-kalem')) && !(await p.$('[data-urun-ara]')));
  if (process.env.EKRAN) await p.screenshot({ path: '/tmp/mf_onayli.png' });
  // ⋯ menüsü
  await p.click('#mk-eylem .mk-ust-dugme'); await p.waitForSelector('dialog.mk-sayfacik[open]');
  const m = await p.textContent('dialog.mk-sayfacik');
  kontrol('⋯: Yazdır, İptal', m.includes('Yazdır') && m.includes('iptal'));
  await p.click('dialog.mk-sayfacik .vazgec');
  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  void fiyatli;
  await b.close();
  console.log(hata ? `\n${hata} KONTROL BAŞARISIZ` : '\nTÜM KONTROLLER BAŞARILI');
  process.exit(hata ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
