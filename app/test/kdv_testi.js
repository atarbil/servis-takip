// Resmi fatura yükleme (alış/satış ayrımı), resmi faturalar, gider (yalnız KDV), elle kayıt, cari sekmesi, iki sütunlu KDV durumu.
//   node test/kdv_testi.js http://127.0.0.1:3100 /tmp/ekran   (api_testi.js sonrası; Patron/12345678)
'use strict';
const { ornekXml, zipYap } = require('./efatura_ornek');
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek).slice(0, 600) : ''); } };
const b64 = (s) => Buffer.from(s).toString('base64');
const FIRMA = '9876543210';

(async () => {
  let cerez = '';
  const y = async (yontem, yol, govde) => {
    const r = await fetch(T + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
    return { durum: r.status, veri: await r.json().catch(() => null) };
  };
  await y('POST', '/giris', { kullanici_adi: 'Patron', sifre: '12345678' });

  // Firma vergi no yokken yükleme reddedilir
  await y('PUT', '/ayarlar', { firma_vergi_no: '' });
  let x = await y('POST', '/resmi/yukle', { dosyalar: [{ ad: 'a.xml', veri: b64(ornekXml()) }] });
  kontrol('Firma vergi no yoksa yükleme durur', x.durum === 400 && x.veri.kod === 'FIRMA_VKN_YOK', x.veri);
  await y('PUT', '/ayarlar', { firma_vergi_no: FIRMA });

  const ted = (await y('POST', '/cariler', { unvan: 'KDV Test Tedarik', tip: 'tedarikci' })).veri;
  const musA = (await y('POST', '/cariler', { unvan: 'Müşteri A Ltd', vergi_no: '1112223334' })).veri;
  const urun = (await y('POST', '/urunler', { ad: 'KDV Test Ürünü', kdv_orani: 20 })).veri;
  const a1 = (await y('POST', '/alislar', { cari_id: ted.id, belge_no: 'KDV-A1', tarih: '2026-10-10', satirlar: [{ urun_id: urun.id, miktar: 10, birim_fiyat: 1000, kdv_orani: 20 }] })).veri;
  await y('POST', `/alislar/${a1.id}/onayla`); // KDV 2.000
  await y('POST', '/alislar', { cari_id: ted.id, belge_no: 'KDV-A2', tarih: '2026-10-12', satirlar: [{ urun_id: urun.id, miktar: 1, birim_fiyat: 500, kdv_orani: 20 }] }); // taslak
  const bakiyeOnce = (await y('GET', `/cariler/${musA.id}`)).veri.bakiye;
  const stokOnce = (await y('GET', '/urunler')).veri.length;

  const satis = (o) => ornekXml({ vkn: FIRMA, unvan: 'Atar Bilişim', ...o });
  const S1 = satis({ no: 'ATR2026000000001', ettn: 'a0000000-0000-0000-0000-000000000001', tarih: '2026-10-05', aliciVkn: '1112223334', aliciUnvan: 'MÜŞTERİ A LTD. ŞTİ.' }); // KDV 3.910
  const S2 = satis({ no: 'ATR2026000000002', ettn: 'a0000000-0000-0000-0000-000000000002', tarih: '2026-10-20', aliciVkn: '5556667778', aliciUnvan: 'Yeni Müşteri Ltd', tevkifat: 300,
    satirlar: [{ ad: 'Kamera montajı', miktar: 1, birim: 'C62', fiyat: 5000, isk: 0, kdv: 20 }] }); // KDV 1.000, tevkifat 300
  const G1 = ornekXml({ no: 'AKR2026000000077', ettn: 'c0000000-0000-0000-0000-000000000077', tarih: '2026-10-08', vkn: '4445556667', unvan: 'Akaryakıt A.Ş.', aliciVkn: FIRMA,
    satirlar: [{ ad: 'Motorin', miktar: 20, birim: 'LTR', fiyat: 50, isk: 0, kdv: 20 }] }); // KDV 200
  const YABANCI = ornekXml({ no: 'XXX1', ettn: 'd0000000-0000-0000-0000-000000000001', vkn: '1010101010', aliciVkn: '2020202020', tarih: '2026-10-09' });

  // ---- API: tek yükleme ----
  x = await y('POST', '/resmi/yukle', { dosyalar: [{ ad: 'ekim.zip', veri: zipYap([{ ad: 's1.xml', icerik: S1 }, { ad: 's2.xml', icerik: S2 }, { ad: 'g1.xml', icerik: G1 }]).toString('base64') },
    { ad: 'yabanci.xml', veri: b64(YABANCI) }] });
  const r = x.veri;
  kontrol('Yön ayrımı: 2 satış kaydedildi, 1 alış önizlemede, 1 reddedildi', x.durum === 200 && r.satis.eklenen.length === 2 && r.alis.length === 1 && r.reddedilen.length === 1, { s: r.satis, a: r.alis?.length, red: r.reddedilen });
  const e1 = r.satis.eklenen.find((q) => q.no === 'ATR2026000000001'); const e2 = r.satis.eklenen.find((q) => q.no === 'ATR2026000000002');
  kontrol('Satış faturası müşteriyle vergi no\'dan eşleşti', e1.cari?.id === musA.id && !e2.cari, { e1, e2 });
  kontrol('Alış önizlemesi tedarikçi ve tercih yok', r.alis[0].tedarikci.unvan === 'Akaryakıt A.Ş.' && !r.alis[0].tercih);
  // Gider olarak kaydet
  const ga = r.alis[0];
  x = await y('POST', '/resmi/gider', { fatura: { no: ga.no, ettn: ga.ettn, tarih: ga.tarih, tip: ga.tip, doviz: ga.doviz, kur: ga.kur, tedarikci: ga.tedarikci, kdvDokum: ga.kdvDokum, tevkifat: ga.tevkifat, satirlar: ga.satirlar }, gider_turu: 'Akaryakıt' });
  kontrol('Gider (yalnız KDV) kaydedildi', x.durum === 200 && x.veri.id, x.veri);
  const gid = x.veri.id;
  const gd = (await y('GET', `/resmi/${gid}`)).veri;
  kontrol('Gider kaydı: KDV 200, tür, cari yok', gd.yon === 'alis' && Number(gd.kdv) === 200 && Number(gd.matrah) === 1000 && gd.gider_turu === 'Akaryakıt' && !gd.cari_id && gd.kalemler.length === 1, gd);
  // Tekrar yükleme: satış tekrar, alış mükerrer + tercih hatırlanır
  x = await y('POST', '/resmi/yukle', { dosyalar: [{ ad: 's1.xml', veri: b64(S1) }, { ad: 'g1.xml', veri: b64(G1) }] });
  kontrol('Tekrar yüklenen satış sayılmaz', x.veri.satis.tekrar.length === 1 && !x.veri.satis.eklenen.length);
  kontrol('Gider olarak kaydedilen alış mükerrer ve tedarikçi tercihi "gider"', x.veri.alis[0].mukerrer?.resmi === true && x.veri.alis[0].tercih?.secim === 'gider' && x.veri.alis[0].tercih?.gider_turu === 'Akaryakıt', x.veri.alis[0]);
  x = await y('POST', '/efatura/kaydet', { fatura: { no: ga.no, ettn: ga.ettn, tarih: ga.tarih, doviz: 'TRY' }, yeni_cari: { unvan: 'Akaryakıt A.Ş.' }, satirlar: [{ urun_id: urun.id, miktar: 1, birim_fiyat: 1, kdv_orani: 20 }] });
  kontrol('Gider kaydı olan fatura stoklu alışa da girilemez', x.durum === 409, x.veri);

  // ---- Cari eşleştirme ----
  x = await y('PUT', `/resmi/${e2.id}/cari`, { yeni_cari: true });
  const yeniC = (await y('GET', `/cariler/${x.veri.cari_id}`)).veri;
  kontrol('Eşleşmeyen satıştan yeni cari açıldı', yeniC.unvan === 'Yeni Müşteri Ltd' && yeniC.vergi_no === '5556667778' && yeniC.tip === 'musteri', yeniC);
  kontrol('Resmi faturalar cari bakiyesini etkilemez', Number((await y('GET', `/cariler/${musA.id}`)).veri.bakiye) === Number(bakiyeOnce) && Number(yeniC.bakiye || 0) === 0);
  kontrol('Gider kaydı stok kartı açmaz', (await y('GET', '/urunler')).veri.length === stokOnce);

  // ---- KDV özeti ----
  x = await y('GET', '/kdv/ozet?ay=2026-10');
  const k = x.veri;
  const kd = (l) => l.reduce((t, q) => t + q.kdv, 0);
  kontrol('KDV özeti: alış stoklu + gider, satış iki fatura, taslak ayrı', k.alis.length === 2 && kd(k.alis) === 2200 && k.alis.some((q) => q.tur === 'gider') && k.satis.length === 2 && kd(k.satis) === 4910
    && k.satis.find((q) => q.belge_no === 'ATR2026000000002').tevkifat === 300 && k.taslaklar.length === 1, k);
  kontrol('Satışta cari adı', k.satis.find((q) => q.belge_no === 'ATR2026000000001').cari_unvan === 'Müşteri A Ltd');

  // ---------- Tarayıcı ----------
  const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage();
  const hatalar = []; p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(T); await p.fill('[name=kullanici_adi]', 'Patron'); await p.fill('[name=sifre]', '12345678'); await p.click('button');
  await p.waitForSelector('#sayfa');
  kontrol('Finans menüsü: Resmi fatura yükleme, Resmi faturalar, KDV durumu; Stok altında e-Fatura aktar yok',
    !!(await p.$('[data-yol="resmi-yukle"]')) && !!(await p.$('[data-yol="resmi-faturalar"]')) && !!(await p.$('[data-yol="kdv"]')) && !(await p.$('[data-yol="efatura"]')));

  // Resmi fatura yükleme ekranı
  await p.evaluate(() => { location.hash = '#/resmi-yukle'; }); await p.waitForSelector('#birak');
  const G2 = ornekXml({ no: 'AKR2026000000078', ettn: 'c0000000-0000-0000-0000-000000000078', tarih: '2026-10-15', vkn: '4445556667', unvan: 'Akaryakıt A.Ş.', aliciVkn: FIRMA,
    satirlar: [{ ad: 'Benzin', miktar: 10, birim: 'LTR', fiyat: 50, isk: 0, kdv: 20 }] }); // KDV 100
  const S3 = satis({ no: 'ATR2026000000003', ettn: 'a0000000-0000-0000-0000-000000000003', tarih: '2026-10-25', aliciVkn: '7778889990', aliciUnvan: 'Üçüncü Müşteri' }); // KDV 3910
  await p.setInputFiles('#dosya', [{ name: 'g2.xml', mimeType: 'application/xml', buffer: Buffer.from(G2) }, { name: 's3.xml', mimeType: 'application/xml', buffer: Buffer.from(S3) },
    { name: 'yabanci.xml', mimeType: 'application/xml', buffer: Buffer.from(YABANCI) }]);
  await p.waitForSelector('.rf-ozet');
  const oz = (await p.textContent('.rf-ozet')).replace(/\s+/g, ' ');
  kontrol('Özet: 1 satış (eşleşmeyen), 1 alış, 1 alınmayan', /1 satış faturası kaydedildi \(0 cariyle eşleşti, 1 eşleşmeyen\)/.test(oz) && /1 alış faturası/.test(oz) && /1 fatura firmanıza ait değil/.test(oz), oz);
  kontrol('Tedarikçi tercihi hatırlandı: gider seçili, açık mavi', await p.$eval('.rf-tur-dugme.gider', (b2) => b2.classList.contains('secili')) && !!(await p.$('.fatura.rf-gider')) && !(await p.$('.ef-eslesme-th')));
  kontrol('Gider türü hatırlandı', await p.$eval('#rf-gider-turu', (s2) => s2.value) === 'Akaryakıt');
  await p.click('[data-tur-sec="stoklu"]'); await p.waitForTimeout(100);
  kontrol('Stoklu seçilince yeşil ve stok kartı sütunu', !!(await p.$('.fatura.rf-stoklu')) && !!(await p.$('.ef-eslesme-th')) && !!(await p.$('[data-olustur]')));
  await p.screenshot({ path: `${EKRAN}/rf-stoklu.png`, fullPage: true });
  await p.click('[data-tur-sec="gider"]'); await p.waitForTimeout(100);
  await p.screenshot({ path: `${EKRAN}/rf-gider.png`, fullPage: true });
  await p.click('[data-gider-kaydet]'); await p.waitForTimeout(700);
  kontrol('Gider kaydedildi bilgisi', /Yalnız KDV \(gider\) olarak kaydedildi/.test(await p.textContent('#sayfa')));
  await p.click('[data-gorunum="satis"]'); await p.waitForSelector('.rf-satis');
  await p.click('[data-satis-cari]'); await p.keyboard.type('Müşteri A', { delay: 20 });
  await p.waitForSelector('.secici-liste .secici-oge'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  kontrol('Satış faturası listeden cariye bağlandı', /✓ Müşteri A Ltd/.test(await p.textContent('.rf-satis')));
  await p.screenshot({ path: `${EKRAN}/rf-satis.png`, fullPage: true });

  // KDV durumu: iki sütun
  await p.evaluate(() => { location.hash = '#/kdv?ay=2026-10'; }); await p.waitForSelector('.kdv-iki');
  // Satış 3910 + 1000 − 300 + 3910 = 8520 ; Alış 2000 + 200 + 100 = 2300 → ödenecek 6220
  const serit = (await p.textContent('.kdv-serit')).replace(/\s+/g, ' ');
  kontrol('Şerit: KDV ÇIKIYOR, ödenecek 6.220', /ÇIKIYOR/.test(serit) && /6\.220,00/.test(serit), serit);
  kontrol('Sol ALIŞ 2.300, sağ SATIŞ 8.520', /2\.300,00/.test(await p.textContent('.kdv-sutun-alis .kdv-sutun-tutar')) && /8\.520,00/.test(await p.textContent('.kdv-sutun-satis .kdv-sutun-tutar')));
  kontrol('Alışta renkler: 1 stoklu (yeşil), 2 gider (açık mavi), 1 taslak', (await p.$$('.kdv-sutun-alis tr.kdv-stoklu')).length === 1 && (await p.$$('.kdv-sutun-alis tr.kdv-gider')).length === 2 && (await p.$$('.kdv-sutun-alis tr.kdv-taslak')).length === 1);
  const bas = await p.$$eval('.kdv-sutun-satis thead th', (t) => t.map((h) => h.textContent.trim()));
  kontrol('Sütunlar: Fatura tutarı, KDV tutarı, Toplam tutar, Cari', bas.join('|') === 'Fatura|Cari|Fatura tutarı|KDV tutarı|Toplam tutar', bas);
  kontrol('Satışta cari adları', /Müşteri A Ltd/.test(await p.textContent('.kdv-sutun-satis')) && /Yeni Müşteri Ltd/.test(await p.textContent('.kdv-sutun-satis')));
  await p.screenshot({ path: `${EKRAN}/kdv-iki-sutun.png`, fullPage: true });
  await p.click('[data-gor="satis:cari"]'); await p.waitForTimeout(150);
  const cr = await p.$$eval('.kdv-sutun-satis tbody tr', (t) => t.map((q) => [...q.cells].map((h) => h.textContent.trim())));
  kontrol('Satış cariye göre: Müşteri A 2 fatura', cr.some((q) => /Müşteri A Ltd/.test(q[0]) && q[1] === '2' && q[3] === '7.820,00 ₺'), cr);
  await p.click('.kdv-sutun-satis tr[data-cari-filtre]:has-text("Müşteri A")'); await p.waitForTimeout(150);
  kontrol('Cariye tıklayınca o carinin faturaları', /Yalnız Müşteri A Ltd/.test(await p.textContent('.kdv-sutun-satis .kdv-filtre')) && (await p.$$('.kdv-sutun-satis tbody tr')).length === 2);
  await p.fill('#kdv-devreden', '7000'); await p.press('#kdv-devreden', 'Tab'); await p.waitForTimeout(200);
  kontrol('Devreden 7.000 ile ÇIKMIYOR, devreden 780', /ÇIKMIYOR/.test(await p.textContent('.kdv-serit')) && /780,00/.test(await p.textContent('.kdv-serit')));
  await p.fill('#kdv-devreden', ''); await p.press('#kdv-devreden', 'Tab'); await p.waitForTimeout(200);
  // Elle kayıt
  await p.click('[data-elle]'); await p.waitForSelector('dialog[open] .rf-elle');
  await p.fill('dialog[open] [name=tarih]', '2026-10-28'); await p.fill('dialog[open] [name=karsi_unvan]', 'Kırtasiye Dükkanı');
  await p.waitForTimeout(300); if (await p.$('.secici-liste:not([hidden])')) await p.keyboard.press('Escape');
  await p.fill('dialog[open] [name=matrah]', '500'); await p.selectOption('dialog[open] [name=gider_turu]', 'Kırtasiye');
  kontrol('Elle kayıtta KDV hesaplanıyor', /100,00/.test(await p.textContent('dialog[open] #el-ozet')) && /600,00/.test(await p.textContent('dialog[open] #el-ozet')));
  await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(700);
  kontrol('Elle gider eklenince alış KDV 2.400', /2\.400,00/.test(await p.textContent('.kdv-sutun-alis .kdv-sutun-tutar')) && /elle/.test(await p.textContent('.kdv-sutun-alis')));
  // Satır tıklama: ayrıntı
  await p.click('.kdv-sutun-satis [data-filtre-kaldir]').catch(() => {});
  await p.click('.kdv-sutun-satis tr[data-ac]:has-text("ATR2026000000002") td:first-child'); await p.waitForSelector('dialog[open] .rf-detay');
  kontrol('Ayrıntıda kalemler ve tevkifat', /Kamera montajı/.test(await p.textContent('dialog[open]')) && /Tevkifat/.test(await p.textContent('dialog[open]')));
  await p.click('dialog[open] .vazgec');

  // Cari ekranı → Resmi faturalar
  await p.evaluate((id) => { location.hash = `#/cari/${id}?sekme=resmi`; }, musA.id); await p.waitForSelector('#icerik .rf-cari-ust');
  await p.selectOption('#rf-yil', '2026'); await p.waitForTimeout(400);
  const rc = (await p.textContent('#icerik')).replace(/\s+/g, ' ');
  kontrol('Cari → Resmi faturalar: 2 fatura, toplamlar', /ATR2026000000001/.test(rc) && /ATR2026000000003/.test(rc) && /2 fatura/.test(rc) && /bakiyesini etkilemez/.test(rc), rc.slice(0, 300));
  await p.screenshot({ path: `${EKRAN}/cari-resmi.png`, fullPage: true });

  // Resmi faturalar listesi: gider sekmesi, sil
  await p.evaluate(() => { location.hash = '#/resmi-faturalar?ay=2026-10'; }); await p.waitForSelector('.rf-tablo');
  kontrol('Liste: satış 3 fatura', (await p.$$('.rf-tablo tbody tr')).length === 3);
  await p.click('[data-yon="alis"]'); await p.waitForTimeout(400);
  kontrol('Gider sekmesi açık mavi satırlar', (await p.$$('.rf-tablo tr.rf-satir-gider')).length === 3);
  await p.click('.rf-tablo tr.rf-satir-gider:has-text("Kırtasiye") td:first-child'); await p.waitForSelector('dialog[open] [data-sil]');
  await p.click('dialog[open] [data-sil]'); await p.waitForTimeout(300); await p.click('dialog[open] button[type=submit]'); await p.waitForTimeout(600);
  kontrol('Elle kayıt silindi', (await p.$$('.rf-tablo tr.rf-satir-gider')).length === 2);
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { location.hash = '#/kdv?ay=2026-10'; }); await p.waitForTimeout(600);
  kontrol('Telefonda KDV ekranı taşmıyor', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)));
  await p.screenshot({ path: `${EKRAN}/kdv-telefon.png`, fullPage: true });

  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nKDV / RESMİ FATURA TESTİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
