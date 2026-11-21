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
  await p.waitForSelector('#ust-baslik');

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
  const pf = await api('POST', '/teklifler', { tur: 'proforma', cari_id: meb.id, tarih: '2026-10-30', satirlar: [
    { aciklama: 'HP Proone 240 G10 B6JC3ES Core I5-1334U 8gb 512GB SSD 23.8″ Fhd Freedos All In One Pc', miktar: 5, birim: 'adet', birim_fiyat: 43750, kdv_orani: 20 },
    { aciklama: 'Brother MFC-L8690CDW Wifi Çok Fonksiyonlu Lazer Yazıcı', miktar: 6, birim: 'adet', birim_fiyat: 34000, kdv_orani: 20 }] });
  const tk = await api('POST', '/teklifler', { tur: 'teklif', cari_id: fisko.id, tarih: '2026-11-19', satirlar: [
    { aciklama: 'inPOS m530 EFT-POS', miktar: 80, birim: 'adet', birim_fiyat: 6670, kdv_orani: 20 }] });
  console.log('Proforma', pf.belge_no, pf.genel_toplam, '| Teklif', tk.belge_no, tk.genel_toplam);
  if (pf.genel_toplam !== 507300 || tk.genel_toplam !== 640320) hatalar.push('Toplamlar örneklerle uyuşmuyor');

  // Yazdırma görüntüsü: window.print yerine yazdırma ortamına geçip ekran görüntüsü alınır
  await p.addInitScript(() => { window.print = () => { window.__yazdirildi = true; }; });
  await p.reload(); await p.waitForSelector('#ust-baslik');
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
