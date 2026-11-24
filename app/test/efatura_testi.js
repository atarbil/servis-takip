// e-Fatura XML aktarımı + fiş düzeninde alış faturası (API ve tarayıcı).
//   node test/efatura_testi.js http://127.0.0.1:3100 /tmp/ekran   (api_testi.js sonrası; kullanıcı Patron/12345678)
'use strict';
const { ornekXml, zipYap } = require('./efatura_ornek');
const TABAN = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek).slice(0, 600) : ''); } };
const b64 = (s) => Buffer.from(s).toString('base64');

(async () => {
  let cerez = '';
  const y = async (yontem, yol, govde) => {
    const r = await fetch(TABAN + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
    return { durum: r.status, veri: await r.json().catch(() => null) };
  };
  await y('POST', '/giris', { kullanici_adi: 'Patron', sifre: '12345678' });
  await y('PUT', '/ayarlar', { firma_vergi_no: '9876543210' });
  const kamera = (await y('POST', '/urunler', { ad: 'Hikvision 4MP IP Kamera DS-2CD1043G2', kod: 'EF-KAM', barkodlar: ['6941264012345'], kdv_orani: 20 })).veri;
  const kablo = (await y('POST', '/urunler', { ad: 'Cat6 Kablo Makara', kod: 'EF-KBL', kdv_orani: 20 })).veri;

  // --- Okuma ---
  let x = await y('POST', '/efatura/oku', { dosyalar: [{ ad: 'fatura.xml', veri: b64(ornekXml()) }] });
  const f = x.veri.faturalar?.[0];
  kontrol('XML okundu', x.durum === 200 && f && f.no === 'ABC2026000000123' && f.tarih === '2026-11-20' && f.vade === '2026-12-20', x.veri);
  kontrol('Tedarikçi bilgileri', f.tedarikci.unvan === 'Teknoloji Dağıtım A.Ş.' && f.tedarikci.vkn === '1234567890' && f.tedarikci.vergi_dairesi === 'Kavaklıdere' && f.tedarikci.il === 'Ankara', f.tedarikci);
  kontrol('Kayıtlı cari yok → yeni tedarikçi', f.cari === null);
  kontrol('Satırlar: miktar, birim, net fiyat, iskonto, KDV', f.satirlar.length === 3 && f.satirlar[0].miktar === 10 && f.satirlar[0].birim_fiyat === 1125 && f.satirlar[0].iskonto_orani === 10
    && f.satirlar[2].birim === 'saat' && f.satirlar[2].ad === 'Kurulum & montaj hizmeti' && f.satirlar[1].kdv_orani === 20, f.satirlar);
  kontrol('Barkodla eşleşti', f.satirlar[0].oneri?.urun_id === kamera.id && f.satirlar[0].oneri.neden === 'barkod', f.satirlar[0].oneri);
  kontrol('Eşleşmeyen kalem önerisiz', !f.satirlar[2].oneri, f.satirlar[2].oneri);
  kontrol('Toplamlar ve uyarı yok', f.toplam.ara === 19550 && f.toplam.kdv === 3910 && f.toplam.odenecek === 23460 && f.uyarilar.length === 0, { t: f.toplam, u: f.uyarilar });
  kontrol('Mükerrer yok', f.mukerrer === null);

  // --- Kaydet: kablo mevcut karta, kurulum yeni hizmet kartı ---
  const govde = (ff, ek = {}) => ({
    fatura: { no: ff.no, ettn: ff.ettn, tarih: ff.tarih, vade: ff.vade, doviz: ff.doviz, kur: ff.kur },
    cari_id: ff.cari?.id || null,
    yeni_cari: ff.cari ? null : { unvan: ff.tedarikci.unvan, vergi_no: ff.tedarikci.vkn, vergi_dairesi: ff.tedarikci.vergi_dairesi, adres: ff.tedarikci.adres, il: ff.tedarikci.il, ilce: ff.tedarikci.ilce, telefon: ff.tedarikci.telefon },
    satirlar: ff.satirlar.map((s, i) => ({ urun_id: ek[i] ?? s.oneri?.urun_id ?? null, yeni_urun: (ek[i] ?? s.oneri?.urun_id) ? null : { ad: s.ad, birim: s.birim, kdv_orani: s.kdv_orani, tur: 'hizmet' }, miktar: s.miktar, birim_fiyat: s.birim_fiyat, kdv_orani: s.kdv_orani, anahtar: s.anahtar })),
  });
  x = await y('POST', '/efatura/kaydet', govde(f, { 1: kablo.id }));
  kontrol('Taslak alış faturası açıldı', x.durum === 200 && x.veri.id, x.veri);
  const alisId = x.veri.id;
  const a = (await y('GET', `/alislar/${alisId}`)).veri;
  kontrol('Alış: tedarikçi, no, tarih, vade, ETTN', a.durum === 'taslak' && a.belge_no === 'ABC2026000000123' && a.unvan === 'Teknoloji Dağıtım A.Ş.' && a.vergi_no === '1234567890' && a.vade === '2026-12-20' && a.ettn === '6f1c2b8e-3d4a-4b5c-9e7f-0a1b2c3d4e5f', a);
  kontrol('Alış satırları ve toplam', a.satirlar.length === 3 && Number(a.ara_toplam) === 19550 && Number(a.genel_toplam) === 23460 && a.satirlar[1].urun_id === kablo.id, a.satirlar);
  const hizmet = (await y('GET', `/urunler/${a.satirlar[2].urun_id}`)).veri;
  kontrol('Yeni hizmet kartı açıldı', hizmet.ad === 'Kurulum & montaj hizmeti' && hizmet.tur === 'hizmet' && hizmet.birim === 'saat', hizmet);
  const cari = (await y('GET', `/cariler/${a.cari_id}`)).veri;
  kontrol('Yeni tedarikçi carisi', cari.tip === 'tedarikci' && cari.il === 'Ankara' && cari.vergi_dairesi === 'Kavaklıdere', cari);

  // --- Mükerrer ---
  x = await y('POST', '/efatura/oku', { dosyalar: [{ ad: 'fatura.xml', veri: b64(ornekXml()) }] });
  kontrol('İkinci okumada mükerrer uyarısı ve cari eşleşti', x.veri.faturalar[0].mukerrer?.id === alisId && x.veri.faturalar[0].cari?.id === a.cari_id, x.veri.faturalar[0].mukerrer);
  x = await y('POST', '/efatura/kaydet', govde(x.veri.faturalar[0]));
  kontrol('Mükerrer kayıt reddedildi', x.durum === 409 && x.veri.kod === 'MUKERRER', x.veri);

  // --- Zip içinde iki fatura; hafıza eşleşmesi, USD ---
  const z = zipYap([
    { ad: 'ABC2026000000124.xml', icerik: ornekXml({ no: 'ABC2026000000124', ettn: '11111111-2222-3333-4444-555555555555' }) },
    { ad: 'USD.xml', icerik: ornekXml({ no: 'ABC2026000000125', ettn: '11111111-2222-3333-4444-666666666666', doviz: 'USD', kur: 42.5, satirlar: [{ ad: 'CAT6 UTP Kablo 305m', satici: 'KBL-C6-305', miktar: 1, birim: 'C62', fiyat: 80, isk: 0, kdv: 20 }] }) },
    { ad: 'ApplicationResponse.xml', icerik: '<?xml version="1.0"?><ApplicationResponse xmlns="urn:x"><ID>1</ID></ApplicationResponse>' },
    { ad: 'fatura.pdf', icerik: '%PDF-1.4' },
  ]);
  x = await y('POST', '/efatura/oku', { dosyalar: [{ ad: 'paket.zip', veri: z.toString('base64') }, { ad: 'bozuk.xml', veri: b64('<Invoice><cbc:ID>1</Invoice>') }] });
  kontrol('Zip: iki fatura okundu', x.veri.faturalar.length === 2, x.veri.faturalar.map((q) => q.no));
  kontrol('Fatura olmayan / bozuk XML hata listesinde', x.veri.hatalar.length === 2 && x.veri.hatalar.some((h) => /e-Fatura/.test(h.hata)) && x.veri.hatalar.some((h) => /XML/.test(h.hata)), x.veri.hatalar);
  const [f2, f3] = x.veri.faturalar;
  kontrol('Hatırlanan eşleşme (tedarikçi ürün kodu)', f2.satirlar[1].oneri?.urun_id === kablo.id && f2.satirlar[1].oneri.neden === 'hafiza' && f2.satirlar[2].oneri?.neden === 'hafiza', f2.satirlar.map((s) => s.oneri));
  kontrol('USD fatura: döviz, kur', f3.doviz === 'USD' && f3.kur === 42.5 && f3.satirlar[0].oneri?.urun_id === kablo.id, { d: f3.doviz, k: f3.kur });
  x = await y('POST', '/efatura/kaydet', govde(f3));
  const a3 = (await y('GET', `/alislar/${x.veri.id}`)).veri;
  kontrol('USD alış: döviz fiyatı ve TL fiyatı', a3.doviz === 'USD' && Number(a3.kur) === 42.5 && Number(a3.satirlar[0].doviz_fiyat) === 80 && Number(a3.satirlar[0].birim_fiyat) === 3400, a3.satirlar);

  // --- Uyarılar: alıcı VKN, iade, toplam tutarsızlığı ---
  x = await y('POST', '/efatura/oku', { dosyalar: [{ ad: 'i.xml', veri: b64(ornekXml({ no: 'IADE1', ettn: 'aaaaaaaa-0000-0000-0000-000000000001', tip: 'IADE', aliciVkn: '1111111111' }).replace('<cbc:LineExtensionAmount currencyID="TRY">19550.00</cbc:LineExtensionAmount>', '<cbc:LineExtensionAmount currencyID="TRY">19000.00</cbc:LineExtensionAmount>')) }] });
  const u = x.veri.faturalar[0].uyarilar.join(' | ');
  kontrol('Uyarılar: iade, alıcı VKN, toplam', /İADE/.test(u) && /alıcı vergi no/.test(u) && /tutmuyor/.test(u), u);

  // --- Onay: stok girer ---
  x = await y('POST', `/alislar/${alisId}/onayla`);
  const k2 = (await y('GET', `/urunler/${kamera.id}`)).veri;
  kontrol('Onaylanınca stok ve maliyet girdi', x.durum === 200 && Number(k2.stok_miktari) === 10 && Number(k2.ort_maliyet) === 1125, { s: k2.stok_miktari, m: k2.ort_maliyet });

  // --- Silinen fatura yeniden aktarılabilir ---
  const bek = (await y('POST', '/efatura/oku', { dosyalar: [{ ad: 'p.zip', veri: z.toString('base64') }] })).veri.faturalar[0];
  const kay = await y('POST', '/efatura/kaydet', govde(bek));
  x = await y('POST', '/sil', { tur: 'alis_faturasi', id: kay.veri.id });
  const tekrar = (await y('POST', '/efatura/oku', { dosyalar: [{ ad: 'p.zip', veri: z.toString('base64') }] })).veri.faturalar[0];
  kontrol('Silinen fatura mükerrer sayılmaz', x.durum === 200 && tekrar.mukerrer === null, { x: x.veri, m: tekrar.mukerrer });
  x = await y('POST', '/efatura/kaydet', govde(tekrar));
  kontrol('Silinen fatura yeniden aktarılabilir', x.durum === 200, x.veri);

  // ---------- Tarayıcı ----------
  const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage();
  const hatalar = []; p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(TABAN);
  await p.fill('[name=kullanici_adi]', 'Patron'); await p.fill('[name=sifre]', '12345678'); await p.click('button');
  await p.waitForSelector('#sayfa');

  // Alış ekranı fiş düzeninde
  await p.goto(`${TABAN}/#/alis/${alisId}`); await p.waitForSelector('.fatura');
  kontrol('Alış: fatura düzeni (tedarikçi kutusu, belge bilgisi, tablo, toplam)', !!(await p.$('.fatura-ust .fatura-cari')) && !!(await p.$('.fatura-belge')) && !!(await p.$('#kalemler.fatura-tablo')) && !!(await p.$('.fatura-alt .fatura-toplam')));
  kontrol('Alış: e-Fatura rozeti ve Yalnız yazısı', /e-Fatura/.test(await p.textContent('.detay-ust')) && /Yalnız/.test(await p.textContent('.fatura-alt')));
  const bas = await p.$$eval('#kalemler thead th', (x2) => x2.map((h) => h.textContent.trim()));
  kontrol('Alış: sütunlar', bas.slice(0, 8).join('|') === '#|Kod|Ürün|Miktar|Birim|Birim fiyat|KDV %|Tutar', bas);
  await p.screenshot({ path: `${EKRAN}/alis-onayli.png`, fullPage: true });

  await p.goto(`${TABAN}/#/alis/yeni`); await p.waitForSelector('.fatura');
  await p.click('#a-cari'); await p.keyboard.type('Teknoloji', { delay: 20 });
  await p.waitForSelector('.secici-liste .secici-oge'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  kontrol('Alış: tedarikçi seçilince adres / bakiye görünür', /Ankara/.test(await p.textContent('.fatura-cari')) && /Cari bakiye/.test(await p.textContent('.fatura-cari')));
  await p.fill('#a-no', 'EL-001');
  await p.click('[data-ekle]'); await p.keyboard.type('Hikvision', { delay: 20 });
  await p.waitForSelector('.secici-liste .secici-oge'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const od = await p.evaluate(() => document.activeElement?.dataset?.k);
  kontrol('Alış: ürün seçilince miktara geçer', od === 'miktar', od);
  await p.keyboard.type('3'); await p.keyboard.press('Tab'); await p.keyboard.press('Control+a'); await p.keyboard.type('1000');
  await p.waitForTimeout(150);
  kontrol('Alış: satır kodu ve birimi', (await p.textContent('#kalemler tbody tr[data-i="0"] td.kod')).trim() === 'EF-KAM' && (await p.textContent('#kalemler tbody tr[data-i="0"] td.brm')).trim() === 'adet');
  await p.screenshot({ path: `${EKRAN}/alis-yeni.png`, fullPage: true });
  await p.click('[data-a=kaydet]'); await p.waitForTimeout(700);
  const yeniA = (await y('GET', '/alislar?q=EL-001')).veri[0];
  kontrol('Alış: kaydedildi', yeniA && Number(yeniA.ara_toplam) === 3000, yeniA);

  // e-Fatura sayfası
  await p.goto(`${TABAN}/#/alislar`); await p.waitForSelector('#sayfa a.btn[href="#/resmi-yukle"]');
  await p.click('#sayfa a.btn[href="#/resmi-yukle"]'); await p.waitForSelector('#birak');
  const yeniXml = ornekXml({ no: 'XYZ2026000000001', ettn: '99999999-0000-0000-0000-000000000009', vkn: '5555555555', unvan: 'Yeni Güvenlik Ltd. Şti.',
    satirlar: [
      { ad: 'Hikvision DS-2CD1043G2-I 4MP IP Kamera', satici: 'Y-1', miktar: 4, birim: 'C62', fiyat: 1300, isk: 0, kdv: 20 },
      { ad: 'Cat6 kablo makara 305 metre', satici: 'Y-2', miktar: 1, birim: 'C62', fiyat: 3500, isk: 0, kdv: 20 },
      { ad: '12V 2A Adaptör', satici: 'Y-3', barkod: '8690000000017', miktar: 8, birim: 'C62', fiyat: 90, isk: 5, kdv: 20 },
    ] });
  await p.setInputFiles('#dosya', [{ name: 'yeni.xml', mimeType: 'application/xml', buffer: Buffer.from(yeniXml) },
    { name: 'paket.zip', mimeType: 'application/zip', buffer: z }]);
  await p.waitForSelector('.efatura-sekmeler');
  const sek = await p.$$eval('.efatura-sekme', (x2) => x2.map((s) => s.textContent.replace(/\s+/g, ' ').trim()));
  kontrol('e-Fatura: üç fatura sekmesi (ikisi daha önce girilmiş)', sek.length === 3 && sek.filter((s) => /daha önce girilmiş/.test(s)).length === 2 && /bekliyor/.test(sek[0]), sek);
  kontrol('e-Fatura: ilk bekleyen fatura açık', /Yeni Güvenlik/.test(await p.textContent('.fatura-cari')) && /Kayıtlı değil/.test(await p.textContent('.fatura-cari')));
  const es = await p.$$eval('.ef-tablo tbody tr', (rs) => rs.map((r) => r.querySelector('.ef-eslesme').textContent.replace(/\s+/g, ' ').trim()));
  kontrol('e-Fatura: ad benzerliğiyle eşleşti, adaptör yeni kart', /Hikvision 4MP/.test(es[0]) && /Ad benzerliği/.test(es[0]) && /Yeni stok kartı/.test(es[2]), es);
  await p.screenshot({ path: `${EKRAN}/efatura.png`, fullPage: true });
  // 2. kalem: mevcut karttan seç
  await p.click('[data-degistir="1"]'); await p.waitForSelector('[data-ara="1"]');
  await p.keyboard.type('Cat6 Kablo Makara', { delay: 20 }); await p.waitForSelector('.secici-liste .secici-oge'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  await p.fill('[data-yeni-ad="2"]', '12V 2A Kamera Adaptörü');
  await p.click('[data-olustur]'); await p.waitForTimeout(900);
  await p.waitForSelector('#kalemler'); 
  kontrol('e-Fatura: tek bekleyen aktarılınca taslak alış açıldı', /#\/alis\/\d+/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash));
  const yeniAlis = (await y('GET', '/alislar?q=XYZ2026000000001')).veri[0];
  const ya = (await y('GET', `/alislar/${yeniAlis.id}`)).veri;
  kontrol('e-Fatura: taslak alış doğru', ya.unvan === 'Yeni Güvenlik Ltd. Şti.' && ya.satirlar[1].urun_id === kablo.id && ya.satirlar[2].ad === '12V 2A Kamera Adaptörü' && Number(ya.ara_toplam) === 4*1300 + 3500 + 684, ya.satirlar.map((s) => [s.ad, s.birim_fiyat]));
  const adp = (await y('GET', `/urunler/${ya.satirlar[2].urun_id}`)).veri;
  kontrol('e-Fatura: yeni kart barkodu faturadan', (adp.barkodlar || []).includes('8690000000017'), adp.barkodlar);

  // Telefon görünümü
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${TABAN}/#/alis/${alisId}`); await p.waitForSelector('.fatura'); await p.waitForTimeout(300);
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  kontrol('Telefonda alış ekranı yatay taşmıyor', !tasma);
  await p.screenshot({ path: `${EKRAN}/alis-telefon.png`, fullPage: true });

  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nE-FATURA TESTİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
