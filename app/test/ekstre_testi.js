// Detaylı cari ekstre + cari listesi varsayılan Müşteriler.  node test/ekstre_testi.js http://127.0.0.1:3100 /tmp/ekran   (api_testi.js sonrası)
'use strict';
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek).slice(0, 600) : ''); } };

(async () => {
  let cerez = '';
  const y = async (yontem, yol, govde) => {
    const r = await fetch(T + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
    return { durum: r.status, veri: await r.json().catch(() => null) };
  };
  await y('POST', '/giris', { kullanici_adi: 'Patron', sifre: '12345678' });
  // Hareketi bol bir müşteri: satış fişi kalemli olan ve tahsilatı olan
  const cariler = (await y('GET', '/cariler?tip=musteri')).veri;
  let secilen = null; let ek = null;
  for (const c of cariler) {
    const e = (await y('GET', `/cariler/${c.id}/detayli-ekstre?bas=2000-01-01&bit=2100-12-31`)).veri;
    if (e.satirlar.some((s) => s.belge_tip === 'satis_fisi' && s.kalemler.length) && e.satirlar.some((s) => s.belge_tip === 'tahsilat')) { secilen = c; ek = e; break; }
  }
  kontrol('Satış fişi ve tahsilatı olan müşteri bulundu', !!secilen);
  const cari = (await y('GET', `/cariler/${secilen.id}`)).veri;
  kontrol('Kalan bakiye cari bakiyesiyle aynı', Math.abs(ek.toplam.bakiye - Number(cari.bakiye)) < 0.01, { e: ek.toplam, b: cari.bakiye });
  const fis = ek.satirlar.find((s) => s.belge_tip === 'satis_fisi' && s.kalemler.length);
  const kalemToplam = fis.kalemler.reduce((t, k) => t + k.kdvli, 0);
  kontrol('Satış fişinin kalemleri (KDV dahil toplam ≈ borç)', Math.abs(kalemToplam - fis.borc) < 0.05 * fis.kalemler.length + 0.01, { kalemToplam, borc: fis.borc });
  const th = ek.satirlar.find((s) => s.belge_tip === 'tahsilat');
  kontrol('Tahsilatta ödeme şekli (hesap)', th.odeme && th.odeme.hesap, th);
  kontrol('Vade bilgisi yok', !JSON.stringify(ek).includes('"vade"'));
  kontrol('Yürüyen bakiye tutarlı', Math.abs(ek.satirlar.reduce((b, s) => b + s.borc - s.alacak, ek.devir) - ek.toplam.bakiye) < 0.01);
  // Dönem: ilk hareketten sonrası → devir dolu
  const ilk = ek.satirlar[0].tarih; const ikinci = ek.satirlar.find((s) => s.tarih > ilk)?.tarih;
  if (ikinci) {
    const e2 = (await y('GET', `/cariler/${secilen.id}/detayli-ekstre?bas=${ikinci}&bit=2100-12-31`)).veri;
    kontrol('Başlangıçtan önceki hareketler devir olur', Math.abs(e2.devir + e2.toplam.borc - e2.toplam.alacak - e2.toplam.bakiye) < 0.01 && Math.abs(e2.toplam.bakiye - ek.toplam.bakiye) < 0.01 && e2.devir !== 0, e2.devir);
  }

  // ---------- Tarayıcı ----------
  const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage();
  const hatalar = []; p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(T); await p.fill('[name=kullanici_adi]', 'Patron'); await p.fill('[name=sifre]', '12345678'); await p.click('button');
  await p.waitForSelector('#sayfa');
  await p.evaluate(() => { location.hash = '#/cariler'; }); await p.waitForSelector('#tip'); await p.waitForTimeout(500);
  kontrol('Cari listesi açılışta Müşteriler', await p.$eval('#tip', (s) => s.value) === 'musteri');
  const tedVar = (await y('GET', '/cariler')).veri.some((x) => x.tip === 'tedarikci');
  if (tedVar) kontrol('Listede yalnız tedarikçi olan cari yok', !/Tedarikçi<\/span>/.test(await p.innerHTML('#liste')));
  await p.evaluate((id) => { location.hash = `#/cari/${id}`; }, secilen.id); await p.waitForSelector('[data-sekme="detayli"]');
  const sek = await p.$$eval('.sekmeler button', (x) => x.map((q) => q.textContent.trim()));
  kontrol('İlk sekme Detaylı ekstre, ikinci Ekstre (32.2)', sek[0] === 'Detaylı ekstre' && sek[1] === 'Ekstre', sek);
  kontrol('Cari kartı Detaylı ekstre ile açılır', await p.$eval('[data-sekme="detayli"]', (b) => b.classList.contains('aktif')));
  await p.click('[data-sekme="detayli"]'); await p.waitForSelector('.dekstre');
  await p.click('[data-dar^="2000-01-01"]'); await p.waitForTimeout(500);
  const t = (await p.textContent('.dekstre')).replace(/\s+/g, ' ');
  kontrol('Kurumsal başlık, cari, dönem', /CARİ HESAP EKSTRESİ/.test(t) && t.includes(secilen.unvan) && /Dönem:/.test(t), t.slice(0, 200));
  const bas = await p.$$eval('.dek-tablo > thead th', (x) => x.map((q) => q.textContent.trim()));
  kontrol('Sütunlar: Tarih, Belge, Açıklama, Borç, Alacak, Bakiye (vade yok)', bas.join('|') === 'Tarih|Belge|Açıklama|Borç|Alacak|Bakiye', bas);
  kontrol('Satış fişinin altında aldığı kalemler', (await p.$$('.dek-kalem')).length >= 1 && /Aldığı ürün/.test(t));
  kontrol('Tahsilatta ödeme şekli', new RegExp(th.odeme.hesap).test(t));
  kontrol('Özet: devir, borç, alacak, kalan bakiye', /Devir bakiyesi/.test(t) && /Dönem borç toplamı/.test(t) && /Dönem alacak toplamı/.test(t) && /Kalan bakiye/.test(t));
  await p.screenshot({ path: `${EKRAN}/detayli-ekstre.png`, fullPage: true });
  // Yazdır: yazdırma alanına aynı içerik
  await p.evaluate(() => { window.print = () => { window.__yazdirildi = true; }; });
  await p.click('#d-yazdir'); await p.waitForTimeout(600);
  kontrol('Yazdır / PDF', await p.evaluate(() => window.__yazdirildi === true && /CARİ HESAP EKSTRESİ/.test(document.querySelector('#yazdir-alani').textContent)));
  await p.emulateMedia({ media: 'print' }); await p.screenshot({ path: `${EKRAN}/detayli-ekstre-cikti.png`, fullPage: true }); await p.emulateMedia({ media: 'screen' });
  // Bu ay
  await p.click('[data-dar]:has-text("Bu ay")'); await p.waitForTimeout(400);
  kontrol('Bu ay seçilince tarih değişti', (await p.inputValue('#d-bas')).endsWith('-01'));
  // Kaleme tıklayınca fiş açılır
  await p.click('[data-dar^="2000-01-01"]'); await p.waitForTimeout(400);
  await p.click('.dek-satir[data-fis] td:first-child'); await p.waitForTimeout(600);
  kontrol('Satış fişi satırına tıklayınca fiş açılır', /#\/fis\/\d+/.test(await p.evaluate(() => location.hash)));
  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nDETAYLI EKSTRE TESTİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
