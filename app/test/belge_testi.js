// Belge şablonları görsel testi: örnek proforma ve teklifi aynı verilerle oluşturup yazdırma görüntüsünü kaydeder.
//   node test/belge_testi.js http://127.0.0.1:3100 /tmp/ekran [kase.png]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
const KASE = process.argv[4];
const GORSEL = path.join(__dirname, '..', '..', 'docs', 'gorseller');
const hatalar = [];
const veriUrl = (dosya, tur) => `data:image/${tur};base64,${fs.readFileSync(dosya).toString('base64')}`;

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage();
  p.on('pageerror', (e) => hatalar.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await p.goto(T);
  await p.fill('[name=kullanici_adi]', 'ali'); await p.fill('[name=sifre]', 'Sifre1234'); await p.click('button');
  await p.waitForSelector('#sayfa');

  const api = (yontem, yol, govde) => p.evaluate(async ([y, u, g]) => {
    const r = await fetch('/api' + u, { method: y, headers: { 'content-type': 'application/json', 'x-istek': '1' }, body: g ? JSON.stringify(g) : undefined });
    return r.json();
  }, [yontem, yol, govde]);

  await api('PUT', '/ayarlar', {
    firma_adi: 'ATAR BİLİŞİM HİZMETLERİ', firma_adres: 'Hacımiktat Mah. Tuna Sok. No:1/Z05 Sefa Merve İşhanı Merkez/Giresun',
    firma_eposta: 'info@atarbilisim.com', firma_gsm: '0 507 170 77 28', firma_telefon: '', firma_web: 'www.atarbilisim.com',
    firma_vergi_dairesi: 'Giresun', firma_vergi_no: '45682144284',
  });
  await api('POST', '/ayarlar/gorsel', { tur: 'logo', veri: veriUrl(path.join(GORSEL, 'atar-logo.png'), 'png') });
  await api('POST', '/ayarlar/gorsel', { tur: 'serit', veri: veriUrl(path.join(GORSEL, 'teklif-baslik-seridi.jpg'), 'jpeg') });
  if (KASE) await api('POST', '/ayarlar/gorsel', { tur: 'kase', veri: veriUrl(KASE, 'png') });

  const meb = await api('POST', '/cariler', { unvan: 'ŞEBİNKARAHİSAR İLÇE MİLLİ EĞİTİM MÜDÜRLÜĞÜ', vergi_no: '4710295984', il: 'Giresun' });
  const fisko = await api('POST', '/cariler', { unvan: 'FİSKOBİRLİK ENTEGRE FINDIK İŞLEME TESİSLERİ SANAYİ VE TİCARET ANONİM ŞİRKETİ',
    adres: 'GAZİLER MAH. ATATÜRK BLV. 483 MERKEZ/GİRESUN', vergi_dairesi: 'GİRESUN VERGİ DAİRESİ MÜD.', vergi_no: '3360326902' });
  // Her kalem stok kartlı: belge örneğindeki ürünlerin kartları
  const kart = async (ad) => (await api('POST', '/urunler', { ad })).id;
  const [hp, br, inpos] = [await kart('HP Proone 240 G10 B6JC3ES Core I5-1334U 8gb 512GB SSD 23.8″ Fhd Freedos All In One Pc'),
    await kart('Brother MFC-L8690CDW Wifi Çok Fonksiyonlu Lazer Yazıcı'), await kart('inPOS m530 EFT-POS')];
  const pf = await api('POST', '/teklifler', { tur: 'proforma', cari_id: meb.id, tarih: '2026-10-30', satirlar: [
    { urun_id: hp, aciklama: 'HP Proone 240 G10 B6JC3ES Core I5-1334U 8gb 512GB SSD 23.8″ Fhd Freedos All In One Pc', miktar: 5, birim: 'adet', birim_fiyat: 43750, kdv_orani: 20 },
    { urun_id: br, aciklama: 'Brother MFC-L8690CDW Wifi Çok Fonksiyonlu Lazer Yazıcı', miktar: 6, birim: 'adet', birim_fiyat: 34000, kdv_orani: 20 }] });
  const tk = await api('POST', '/teklifler', { tur: 'teklif', cari_id: fisko.id, tarih: '2026-11-19', satirlar: [
    { urun_id: inpos, aciklama: 'inPOS m530 EFT-POS', miktar: 80, birim: 'adet', birim_fiyat: 6670, kdv_orani: 20 }] });
  console.log('Proforma', pf.belge_no, pf.genel_toplam, '| Teklif', tk.belge_no, tk.genel_toplam);
  if (pf.genel_toplam !== 507300 || tk.genel_toplam !== 640320) hatalar.push('Toplamlar örneklerle uyuşmuyor');

  // Yazdırma görüntüsü: window.print yerine yazdırma ortamına geçip ekran görüntüsü alınır
  await p.addInitScript(() => { window.print = () => { window.__yazdirildi = true; }; });
  await p.reload(); await p.waitForSelector('#sayfa');
  async function yazdirGoruntusu(ad) {
    await p.waitForFunction(() => window.__yazdirildi === true, null, { timeout: 8000 });
    await p.emulateMedia({ media: 'print' });
    await p.setViewportSize({ width: 794, height: 1123 });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${EKRAN}/${ad}.png`, fullPage: true });
    await p.pdf({ path: `${EKRAN}/${ad}.pdf`, format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
    await p.emulateMedia({ media: 'screen' });
    await p.setViewportSize({ width: 1400, height: 900 });
    await p.evaluate(() => { window.__yazdirildi = false; });
  }

  for (const [id, ad] of [[pf.id, 'B1_proforma'], [tk.id, 'B2_teklif']]) {
    await p.goto(`${T}/#/teklif/${id}`);
    await p.waitForSelector('[data-a=yazdir]');
    await p.screenshot({ path: `${EKRAN}/${ad}_ekran.png` });
    await p.click('[data-a=yazdir]');
    await yazdirGoruntusu(ad);
  }

  // Tahsilat + makbuz (iki nüsha)
  const hesap = (await api('GET', '/hesaplar'))[0];
  const th = await api('POST', '/finans/tahsilat', { cari_id: fisko.id, hesap_id: hesap.id, tutar: 125750.5, aciklama: 'Teklif TK ön ödemesi', belge_no: 'D-4471' });
  await p.goto(`${T}/#/kasa`);
  await p.click(`[data-makbuz="${th.id}"]`);
  await p.check('dialog.pencere[open] [name=iki]');
  await p.click('dialog.pencere[open] button[type=submit]');
  await yazdirGoruntusu('B3_makbuz');

  // Stok listesi: filtreleyip seç, teklife ekle
  await api('POST', '/urunler', { ad: 'Dome Kamera 2MP', marka: 'Hikvision', model: 'DS-2CD1123G0E-I', ana_grup: 'Güvenlik Kamerası', alt_grup: 'IP Kamera', onerilen_satis: 1500 });
  await api('POST', '/urunler', { ad: 'Bullet Kamera 4MP', marka: 'Hikvision', model: 'DS-2CD1043G2-I', ana_grup: 'Güvenlik Kamerası', alt_grup: 'IP Kamera', onerilen_satis: 1900 });
  await api('POST', '/urunler', { ad: 'NVR 8 Kanal', marka: 'Dahua', model: 'NVR4108HS', ana_grup: 'Güvenlik Kamerası', alt_grup: 'Kayıt Cihazı', onerilen_satis: 3200 });
  await p.goto(`${T}/#/teklif/${tk.id}`);
  await p.waitForSelector('[data-stok-listesi]');
  await p.click('[data-stok-listesi]');
  await p.waitForSelector('#sl-liste tr[data-u]');
  await p.selectOption('#sl-ana', 'Güvenlik Kamerası');
  await p.waitForTimeout(400);
  await p.selectOption('#sl-alt', 'IP Kamera');
  await p.waitForTimeout(400);
  const satirSay = await p.locator('#sl-liste tr[data-u]').count();
  if (satirSay !== 2) hatalar.push(`Stok listesi filtresi 2 ürün göstermeliydi, ${satirSay} gösterdi`);
  await p.locator('#sl-liste tr[data-u]').nth(0).click();
  await p.fill('#sl-liste tr[data-u]:nth-child(2) [data-mik]', '4');
  await p.screenshot({ path: `${EKRAN}/D1_stok_listesi.png` });
  await p.click('dialog.pencere[open] button[type=submit]');
  await p.waitForTimeout(400);
  const kalem = await p.locator('#toplam .genel').innerText();
  await p.click('[data-a=kaydet]'); await p.waitForTimeout(500);
  const tk2 = await api('GET', `/teklifler/${tk.id}`);
  if (tk2.satirlar.length !== 3) hatalar.push(`Teklifte 3 kalem olmalıydı: ${tk2.satirlar.length}`);
  console.log('Stok listesinden eklendi, teklif toplamı:', kalem.replace(/\s+/g, ' '), '| kalem sayısı:', tk2.satirlar.length);
  // Kalem açıklamasına model yazınca öneri
  await p.click('[data-ekle]');
  await p.locator('.urun-ara').last().fill('NVR4108');
  await p.waitForSelector('.secici-oge >> text=NVR 8 Kanal', { timeout: 4000 }).catch(() => hatalar.push('Model yazınca öneri gelmedi'));
  await p.screenshot({ path: `${EKRAN}/D2_urun_onerisi.png` });

  // Yeni ekranlar
  for (const [yol, ad] of [['panel', 'B4_panel'], ['fiyatlandirma', 'B5_fiyatlandirma'], ['teklifler', 'B6_teklifler'], ['ayarlar/firma', 'B7_ayarlar_firma']]) {
    await p.goto(`${T}/#/${yol}`); await p.waitForTimeout(900); await p.screenshot({ path: `${EKRAN}/${ad}.png`, fullPage: true });
  }
  // Giriş ekranında logo
  const g = await (await b.newContext({ viewport: { width: 900, height: 700 } })).newPage();
  await g.goto(T); await g.waitForTimeout(600); await g.screenshot({ path: `${EKRAN}/B8_giris.png` });
  await b.close();
  console.log(hatalar.length ? 'HATALAR:\n' + hatalar.join('\n') : 'BELGE TESTİ BAŞARILI');
  process.exit(hatalar.length ? 1 : 0);
})().catch((e) => { console.error('BAŞARISIZ', e); process.exit(1); });
