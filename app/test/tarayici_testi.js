// Gerçek tarayıcıda uçtan uca senaryo. Boş veritabanıyla çalışan sunucuya karşı:
//   node test/tarayici_testi.js http://127.0.0.1:3100 /tmp/ekran
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
const hatalar = [];
let adim = 0;
const sayfalar = [];

function izle(p, ad) {
  sayfalar.push([ad, p]);
  p.on('pageerror', (e) => hatalar.push(`[${ad}] pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|cdn\.jsdelivr|ERR_NAME|ERR_CONNECTION|ERR_TUNNEL|Failed to load resource/.test(m.text())) hatalar.push(`[${ad}] console: ${m.text()}`); });
  p.on('dialog', (d) => d.dismiss());
}
const ok = (m) => console.log(`OK   ${String(++adim).padStart(2)} ${m}`);
async function foto(p, ad, tam = false) { await p.waitForTimeout(350); await p.screenshot({ path: `${EKRAN}/${ad}.png`, fullPage: tam }); }
const pen = 'dialog.pencere[open]';
async function penKaydet(p) { await p.click(`${pen} button[type=submit]`); await p.waitForTimeout(400); }
async function bekleYok(p, sec) { await p.waitForSelector(sec, { state: 'detached', timeout: 8000 }); }
async function sec(p, inputSec, metin, secim) {
  await p.fill(inputSec, metin);
  const o = p.locator('.secici-oge', { hasText: secim || metin }).first();
  await o.waitFor({ timeout: 5000 });
  await p.waitForTimeout(300);
  await o.dispatchEvent('mousedown');
  await p.waitForTimeout(200);
}

(async () => {
  const b = await chromium.launch();
  const masa = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const y = await masa.newPage(); izle(y, 'yönetici');

  // 1) Kurulum
  await y.goto(T);
  await y.fill('[name=firma_adi]', 'Güven Güvenlik Sistemleri');
  await y.fill('[name=ad_soyad]', 'Ali Yılmaz');
  await y.fill('[name=kullanici_adi]', 'ali');
  await y.fill('[name=sifre]', 'Sifre1234');
  await y.click('button');
  await y.waitForSelector('#sayfa');
  ok('İlk kurulum ve giriş');

  // 2) Ayarlar: firma + teknisyen
  await y.goto(T + '/#/ayarlar');
  await y.fill('[name=firma_telefon]', '0216 555 00 11');
  await y.fill('[name=firma_adres]', 'Bağdat Cad. No:1 Kadıköy / İstanbul');
  await y.click('#firma button');
  await y.waitForSelector('.bildirim.basari');
  await y.click('[data-s=kullanicilar]');
  await y.click('#k-yeni');
  await y.fill(`${pen} [name=ad_soyad]`, 'Mehmet Usta');
  await y.fill(`${pen} [name=kullanici_adi]`, 'mehmet');
  await y.selectOption(`${pen} [name=ekip_id]`, { index: 1 });
  await y.fill(`${pen} [name=sifre]`, 'Usta12345');
  await penKaydet(y);
  await y.waitForSelector('text=Mehmet Usta');
  ok('Firma bilgisi ve teknisyen hesabı');

  // 3) Cari
  await y.goto(T + '/#/cariler');
  await y.click('#yeni');
  await y.fill(`${pen} [name=unvan]`, 'Ahmet Market');
  await y.fill(`${pen} [name=telefon]`, '0532 111 22 33');
  await y.fill(`${pen} [name=adres]`, 'Moda Cad. 12, Kadıköy');
  await y.fill(`${pen} [name=devir_bakiye]`, '1.000');
  await penKaydet(y);
  await y.waitForURL(/#\/cari\/\d+/);
  await y.waitForSelector('text=1.000,00 ₺');
  ok('Yeni cari + "1.000" devir bakiyesi bin lira olarak işlendi');

  // 4) Ürünler
  for (const [ad, barkod, fiyat, birim] of [['IP Kamera 4MP', '8690000000011', '2.000', 'adet'], ['CAT6 Kablo', '8690000000028', '25', 'metre']]) {
    await y.goto(T + '/#/urunler');
    await y.click('#yeni');
    await y.fill(`${pen} [name=ad]`, ad);
    await y.fill(`${pen} [name=birim]`, birim);
    await y.fill(`${pen} [name=onerilen_satis]`, fiyat);
    await y.fill(`${pen} #barkod-yeni`, barkod);
    await y.click(`${pen} #barkod-ekle`);
    await penKaydet(y);
    await y.waitForURL(/#\/urun\/\d+/);
  }
  ok('İki ürün barkodlarıyla tanımlandı');

  // 5) Alış faturası (tedarikçi listeden yeni oluşturulur)
  await y.goto(T + '/#/alis/yeni');
  await y.fill('#a-cari', 'Güvenlik Dağıtım');
  await y.waitForTimeout(600);
  await y.locator('.secici-liste [data-yeni-kart]').first().dispatchEvent('mousedown');
  await y.waitForSelector(pen);
  await penKaydet(y);
  await bekleYok(y, pen);
  await y.fill('#a-no', 'GD-2026-118');
  for (const [ara, mik, fiyat] of [['Kamera', '10', '1.000'], ['CAT6', '100', '10']]) {
    await y.click('[data-ekle]');
    await sec(y, '.urun-ara >> nth=-1', ara);
    await y.fill('tr[data-i]:last-child [data-k=miktar]', mik);
    await y.fill('tr[data-i]:last-child [data-k=birim_fiyat]', fiyat);
  }
  await y.waitForSelector('#toplam >> text=13.200,00 ₺');
  await foto(y, '10_alis_faturasi');
  await y.click('[data-a=onayla]');
  await y.waitForSelector(pen);
  await penKaydet(y);
  await y.waitForSelector('.rozet >> text=Onaylandı');
  ok('Alış faturası 13.200 ₺ onaylandı (stok + maliyet)');

  // 6) Hızlı iş — telefon numarasından müşteri bulunur
  await y.goto(T + '/#/havuz');
  await y.fill('#hizli textarea', 'Ahmet bey 4 kamera görüntü gelmiyor\n0532 111 22 33 akşam 5ten sonra');
  await y.click('#hizli button.birincil');
  await y.waitForSelector('.bildirim >> text=Ahmet Market ile eşleşti');
  await y.fill('#hizli textarea', 'Zeynep Hanım Ataşehir DVR kurulumu 0544 777 88 99');
  await y.click('#hizli button.birincil');
  await y.waitForTimeout(600);
  await foto(y, '11_havuz');
  ok('Havuza 2 iş eklendi, ilki müşteriyle otomatik eşleşti');

  // 7) Takvim: havuzdan sürükle-bırak
  await y.goto(T + '/#/takvim');
  await y.waitForSelector('.takvim-havuz [data-is]');
  await y.click('#tk-gorunum [data-v=hafta]');
  await y.waitForTimeout(300);
  const yarin = new Date(Date.now() + 86400000);
  const ys = `${yarin.getFullYear()}-${String(yarin.getMonth() + 1).padStart(2, '0')}-${String(yarin.getDate()).padStart(2, '0')}`;
  const hedefGun = `.tk-gun[data-gun="${ys}"]`;
  if (!(await y.$(hedefGun))) { await y.click('[data-git="1"]'); await y.waitForTimeout(400); }
  const kutu = await y.locator(hedefGun).boundingBox();
  await y.locator('.takvim-havuz [data-is]').first().dragTo(y.locator(hedefGun), { targetPosition: { x: kutu.width / 2, y: 56 * 3 + 10 } });
  await y.waitForSelector(pen);
  await penKaydet(y);
  await y.waitForSelector('.tk-olay');
  ok('Havuzdaki iş sürükle-bırak ile takvime (yarın 10:00) yerleşti');
  // Boş saate tıklayıp havuzdan seç
  await y.locator(hedefGun).click({ position: { x: 20, y: 56 * 6 + 5 } });
  await y.click(`${pen} [data-sec=havuz]`);
  await y.click(`${pen} [data-sec-is]`);
  await y.waitForSelector(`${pen} [name=ekip_id]`);
  await y.selectOption(`${pen} [name=ekip_id]`, { index: 1 });
  await penKaydet(y);
  await y.waitForTimeout(500);
  await y.locator('[data-tumgun]').nth(2).click();
  await y.fill(`${pen} [name=baslik]`, 'Kamera siparişi ver');
  await penKaydet(y);
  await y.waitForSelector('.tk-not');
  await foto(y, '12_takvim_hafta');
  ok('Boş saate tıklayıp havuzdan iş + takvim notu eklendi');

  // Planlı işi havuza geri al ve tekrar planla
  const isId = await y.locator('.tk-olay').first().getAttribute('data-olay');
  await y.goto(T + `/#/is/${isId}`);
  await y.click('[data-a=havuz]');
  await y.fill(`${pen} [name=v]`, 'Müşteri yarın evde yok');
  await penKaydet(y);
  await y.waitForSelector('.rozet >> text=Havuzda');
  await y.click('[data-a=planla]');
  await penKaydet(y);
  await y.waitForSelector('.rozet >> text=Planlandı');
  ok('İş havuza geri alındı ve yeniden planlandı (geçmiş kayıtlı)');

  // 8) Teknisyen — telefon ekranı
  const tel = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const t = await tel.newPage(); izle(t, 'teknisyen');
  await t.goto(T);
  await t.fill('[name=kullanici_adi]', 'mehmet');
  await t.fill('[name=sifre]', 'Usta12345');
  await t.click('button');
  await t.waitForSelector('.is-kart');
  await foto(t, '20_teknisyen_islerim');
  await t.goto(T + `/#/saha/${isId}`);
  await t.click('#basla');
  await t.waitForSelector('[data-akis=barkod]');
  // Barkod: headless tarayıcıda kamera yok -> elle yazma kutusu
  await t.click('[data-akis=barkod]');
  await t.waitForSelector('.tam-ekran');
  await t.waitForTimeout(500);
  await foto(t, '21_barkod_ekrani');
  await t.fill('.tam-ekran [name=b]', '8690000000011');
  await t.click('.tam-ekran button.birincil');
  await t.waitForSelector(pen);
  await t.click(`${pen} [data-d="1"]`); await t.click(`${pen} [data-d="1"]`); await t.click(`${pen} [data-d="1"]`);
  await penKaydet(t);
  await t.waitForSelector('.malzeme-satir >> text=IP Kamera 4MP');
  await t.click('[data-akis=liste]');
  await sec(t, `${pen} #u-ara`, 'CAT6');
  await t.fill(`${pen} [name=miktar]`, '30');
  await penKaydet(t);
  await t.waitForSelector('.malzeme-satir >> text=CAT6 Kablo');
  // Tanımsız barkod -> tanımsız ürün formu
  await t.click('[data-akis=barkod]');
  await t.fill('.tam-ekran [name=b]', '4006381333931');
  await t.click('.tam-ekran button.birincil');
  await t.waitForSelector(`${pen} [name=ad]`);
  await t.fill(`${pen} [name=ad]`, 'RJ45 Konnektör (mavi poşet)');
  await t.fill(`${pen} [name=miktar]`, '8');
  await penKaydet(t);
  await t.waitForSelector('.malzeme-satir >> text=onay bekliyor');
  const maliyetGorunur = await t.locator('text=/maliyet/i').count();
  ok(`Teknisyen: barkod (elle), listeden ve tanımsız ürün eklendi; maliyet görünmüyor (${maliyetGorunur === 0})`);
  // Fotoğraf
  const [secici] = await Promise.all([t.waitForEvent('filechooser'), t.click('[data-akis=foto]')]);
  await secici.setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: require('node:fs').readFileSync(require('node:path').join(__dirname, '../public/ikon/ikon-512.png')) });
  await t.waitForSelector('.foto-izgara img');
  // İmzasız tamamlanamaz
  const tamamlaKapali = await t.locator('#tamamla').isDisabled();
  // İmza
  await t.click('[data-akis=imza]');
  await t.waitForSelector('.imza-ekran canvas');
  await t.waitForTimeout(300);
  const cb = await t.locator('.imza-ekran canvas').boundingBox();
  await t.mouse.move(cb.x + 60, cb.y + cb.height * 0.6);
  await t.mouse.down();
  for (let i = 0; i <= 24; i++) await t.mouse.move(cb.x + 60 + i * 10, cb.y + cb.height * 0.6 + Math.sin(i / 2.5) * 40);
  await t.mouse.up();
  await t.fill('.imza-ekran [name=ad]', 'Ahmet Yılmaz');
  await foto(t, '22_imza');
  await t.click('[data-kaydet]');
  await t.waitForSelector('.imza-gor');
  await t.fill('#tek-not', '3 kamera değişti, kayıt cihazı ayarlandı');
  await t.click('#tamamla');
  await t.waitForSelector('.is-kart.bitti');
  ok(`Fotoğraf + müşteri imzası alındı, iş tamamlandı (imzasızken buton kapalı: ${tamamlaKapali})`);
  await t.goto(T + `/#/saha/${isId}`);
  await t.waitForSelector('#form-yazdir');
  await foto(t, '23_saha_tamamlandi', true);

  // 9) Yönetici: fiş (sayfa aynı adreste açık kaldığı için yeniden yükle)
  await y.goto(T + `/#/is/${isId}`);
  await y.reload();
  await y.waitForSelector('[data-a=fis]');
  await foto(y, '13_is_detay', true);
  await y.click('[data-a=fis]');
  await y.waitForURL(/#\/fis\/\d+/);
  await y.waitForSelector('.uyari-kutu >> text=maliyeti girilmemiş');
  // Ürün onayı
  await y.click('.uyari-kutu a');
  await y.click('[data-a=onayla]');
  await y.fill(`${pen} [name=birim_maliyet]`, '5');
  await y.fill(`${pen} [name=onerilen_satis]`, '15');
  await penKaydet(y);
  await y.waitForSelector('.bildirim >> text=Ürün onaylandı');
  await y.goBack();
  await y.waitForSelector('#satirlar');
  // İşçilik de kartlı kalem: yazılan ad stokta yoksa "yeni stok kartı açılsın mı?" sorulur → Hizmet kartı açılır
  await y.click('[data-ekle=urun]');
  await y.fill('tr[data-i]:last-child .urun-ara', 'Montaj işçiliği');
  await y.waitForTimeout(400);
  await y.click('#f-tarih');
  await y.waitForSelector(`${pen} >> text=stokta bulunamadı`);
  ok('Stokta olmayan ad yazılınca "yeni stok kartı açılsın mı?" soruldu');
  await penKaydet(y);
  await y.waitForSelector(`${pen} [name=tur]`);
  await y.selectOption(`${pen} [name=tur]`, 'hizmet');
  await y.fill(`${pen} [name=birim]`, 'saat');
  await y.fill(`${pen} [name=onerilen_satis]`, '1.500');
  await penKaydet(y);
  await y.waitForSelector('tr[data-i]:last-child .urun-adi >> text=Montaj işçiliği');
  ok('Hizmet kartı açıldı ve satıra bağlandı');
  await y.fill('tr[data-i]:last-child [data-k=birim_fiyat]', '1.500');
  await y.waitForTimeout(200);
  const toplam = await y.locator('#toplam .genel').innerText();
  await foto(y, '14_fis_taslak');
  await y.click('[data-a=onayla]');
  await y.waitForSelector(pen);
  await penKaydet(y);
  await y.waitForSelector('.rozet >> text=Onaylandı');
  ok(`Fiş onaylandı: ${toplam.replace(/\s+/g, ' ')}`);
  await foto(y, '15_fis_onayli');

  // 10) Cari: tahsilat + ekstre
  await y.goto(T + '/#/cariler');
  await y.click('text=Ahmet Market');
  await y.click('[data-a=tahsilat]');
  await y.fill(`${pen} [name=tutar]`, '5.000');
  await penKaydet(y);
  await y.waitForSelector('.bildirim >> text=5.000,00 ₺');
  await y.waitForTimeout(500);
  await foto(y, '16_cari_ekstre', true);
  const bakiye = await y.locator('.detay-ust .kart').innerText();
  ok(`Tahsilat 5.000 ₺ alındı · cari kartı: ${bakiye.replace(/\s+/g, ' ')}`);

  // 11) Diğer sayfalar
  for (const [yol, ad] of [['panel', '17_panel'], ['kasa', '18_kasa'], ['raporlar/is-karlilik', '19_rapor_karlilik'], ['raporlar/yillik', '19b_rapor_yillik'], ['urunler', '19c_urunler'], ['isler', '19d_isler'], ['ayarlar/denetim', '19e_denetim'], ['ayarlar/telegram', '19h_telegram'], ['fisler', '19f_fisler'], ['takvim', '19g_takvim_son']]) {
    await y.goto(T + '/#/' + yol);
    await y.waitForTimeout(700);
    await foto(y, ad);
  }
  for (const r of ['cari-bakiye', 'vadesi-gecen', 'aylik', 'ekip', 'stok']) { await y.goto(T + '/#/raporlar/' + r); await y.waitForTimeout(400); }
  ok('Panel, kasa, tüm raporlar, ürünler, işler, denetim kaydı, fişler açıldı');

  // 12) Yönetici mobil görünüm
  const ym = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'tr-TR', storageState: await masa.storageState() })).newPage();
  izle(ym, 'yönetici-mobil');
  for (const [yol, ad] of [['panel', '30_mobil_panel'], ['takvim', '31_mobil_takvim'], ['havuz', '32_mobil_havuz'], [`cari/1`, '33_mobil_cari']]) {
    await ym.goto(T + '/#/' + yol); await ym.waitForTimeout(800); await foto(ym, ad);
  }
  ok('Yönetici mobil ekranlar');

  // Teknisyen yönetici sayfasına giremez
  await t.goto(T + '/#/cariler');
  await t.waitForTimeout(500);
  ok(`Teknisyen /cariler adresine gidince işlerine yönlendirildi: ${(await t.locator('h2').first().innerText())}`);

  await b.close();
  if (hatalar.length) { console.log('\nTARAYICI HATALARI:\n' + hatalar.join('\n')); process.exit(1); }
  console.log('\nTARAYICI TESTİ BAŞARILI — hata yok');
})().catch(async (e) => {
  for (const [ad, p] of sayfalar) { try { await p.screenshot({ path: `${EKRAN}/HATA_${ad}.png` }); const b = await p.locator('#bildirimler').innerText().catch(() => ''); if (b) console.log(`[${ad}] bildirim: ${b}`); } catch { /* */ } }
  console.error('\nBAŞARISIZ:', e.message); if (hatalar.length) console.log(hatalar.join('\n')); process.exit(1); });
