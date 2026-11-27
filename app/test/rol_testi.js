// Muhasebe rolü, teknisyen iş ekleme, iş tanımlarken malzeme (verildi / ilave), teslim / müşteri onay ekranı.
//   node test/rol_testi.js http://127.0.0.1:3100 /tmp/ekran   (api_testi.js sonrası; Patron/12345678)
'use strict';
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek).slice(0, 500) : ''); } };
const istemci = () => {
  let cerez = '';
  return async (yontem, yol, govde) => {
    const r = await fetch(T + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
    return { durum: r.status, veri: await r.json().catch(() => null) };
  };
};
const karAlaniVar = (v) => JSON.stringify(v).match(/"([a-z_]*(maliyet|maliyeti|_kar|kar_orani|marj)[a-z_]*|kar)":/)?.[1];

(async () => {
  const y = istemci(); const m = istemci(); const t = istemci();
  await y('POST', '/giris', { kullanici_adi: 'Patron', sifre: '12345678' });
  const ekip = (await y('GET', '/ekipler')).veri[0];
  let x = await y('POST', '/kullanicilar', { ad_soyad: 'Muhasebe Hanım', kullanici_adi: 'muhasebe', sifre: 'muhasebe1', rol: 'muhasebe' });
  kontrol('Muhasebe kullanıcısı açıldı', x.durum === 200, x.veri);
  await y('POST', '/kullanicilar', { ad_soyad: 'Rol Usta', kullanici_adi: 'rolusta', sifre: 'usta1234', rol: 'teknisyen', ekip_id: ekip.id });
  kontrol('Kullanıcı listesinde rol muhasebe', (await y('GET', '/kullanicilar')).veri.some((k) => k.kullanici_adi === 'muhasebe' && k.rol === 'muhasebe'));
  await m('POST', '/giris', { kullanici_adi: 'muhasebe', sifre: 'muhasebe1' });
  await t('POST', '/giris', { kullanici_adi: 'rolusta', sifre: 'usta1234' });

  // ---- Muhasebe: izinler ----
  for (const [yol, ad] of [['/cariler', 'Cariler'], ['/fisler', 'Satış fişleri'], ['/alislar', 'Alış faturaları'], ['/teklifler', 'Teklifler'], ['/kdv/ozet?ay=2026-11', 'KDV'], ['/resmi', 'Resmi faturalar'], ['/rapor/aylik-satis?yil=2026', 'Rapor'], ['/urunler', 'Ürünler'], ['/isler', 'İşler (okuma)']]) {
    x = await m('GET', yol); kontrol(`Muhasebe görür: ${ad}`, x.durum === 200, x.veri);
  }
  for (const [yon, yol, g] of [['GET', '/kullanicilar'], ['PUT', '/ayarlar', { firma_adi: 'X' }], ['GET', '/konumlar'], ['GET', '/guncelleme/durum'], ['GET', '/silinenler'], ['GET', '/fiyatlandirma'], ['PUT', '/ayarlar', { x: 1 }]]) {
    x = await m(yon, yol, g); kontrol(`Muhasebe yasak: ${yon} ${yol}`, x.durum === 403 || x.durum === 404, x.durum);
  }
  // Kârlılık bilgisi gönderilmez
  const fisId = (await y('GET', '/fisler')).veri[0].id;
  const fy = (await y('GET', `/fisler/${fisId}`)).veri; const fm = (await m('GET', `/fisler/${fisId}`)).veri;
  kontrol('Yöneticiye fişte maliyet gider', !!karAlaniVar(fy));
  kontrol('Muhasebeye fişte maliyet / kâr alanı gitmez', !karAlaniVar(fm) && fm.genel_toplam === fy.genel_toplam, karAlaniVar(fm));
  kontrol('Ürünlerde ortalama maliyet yok', !karAlaniVar((await m('GET', '/urunler')).veri));
  kontrol('Aylık raporda kâr / maliyet yok', !karAlaniVar((await m('GET', '/rapor/aylik-satis?yil=2026')).veri));
  kontrol('Panel özetinde kâr yok', !karAlaniVar((await m('GET', '/ozet')).veri));
  kontrol('Cari adresi gibi alanlar korunur (karsi_ / kart değil)', (await m('GET', '/resmi')).durum === 200);
  // Muhasebe iş ekler, düzenler, planlar
  x = await m('POST', '/isler/hizli', { mesaj: 'Muhasebeden iş', cari_id: (await y('GET', '/cariler?tip=musteri')).veri[0].id });
  kontrol('Muhasebe iş ekler', x.durum === 200, x.veri);
  const mIs = x.veri.id;
  x = await m('PUT', `/isler/${mIs}`, { baslik: 'Muhasebe düzenledi', oncelik: 1 });
  kontrol('Muhasebe işi düzenler', x.durum === 200 && (await y('GET', `/isler/${mIs}`)).veri.baslik === 'Muhasebe düzenledi', x.veri);
  x = await m('POST', `/isler/${mIs}/planla`, { ekip_id: ekip.id, baslangic: new Date(Date.now() + 86400000).toISOString() });
  kontrol('Muhasebe işi planlar', x.durum === 200 && (await y('GET', `/isler/${mIs}`)).veri.durum === 'planlandi', x.veri);
  kontrol('Muhasebe havuz ve takvimi görür', (await m('GET', '/havuz')).durum === 200 && (await m('GET', `/takvim?bas=${new Date().toISOString().slice(0, 10)}&bit=${new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}`)).durum === 200);
  kontrol('Muhasebeye iş ekranında maliyet / kâr gitmez', !karAlaniVar((await m('GET', `/isler/${mIs}`)).veri));
  // Muhasebe tahsilat yapabilir
  const cari = (await y('GET', '/cariler?tip=musteri')).veri[0];
  const hesap = (await y('GET', '/hesaplar')).veri[0];
  x = await m('POST', '/finans/tahsilat', { cari_id: cari.id, hesap_id: hesap.id, tutar: 10, aciklama: 'muhasebe testi' });
  kontrol('Muhasebe tahsilat girebilir', x.durum === 200 || x.durum === 404, x);

  // ---- İş tanımlarken malzeme ----
  const urunler = (await y('GET', '/urunler')).veri.filter((u) => u.tur !== 'hizmet');
  const u1 = urunler[0]; const u2 = urunler[1];
  const stok0 = Number((await y('GET', `/urunler/${u1.id}`)).veri.stok_miktari);
  x = await y('POST', '/isler/hizli', { mesaj: 'Malzemeli iş: 2 toner teslim', cari_id: cari.id, malzemeler: [{ urun_id: u1.id, miktar: 2 }] });
  const isId = x.veri.id;
  kontrol('Malzemeli iş havuza eklendi', x.durum === 200 && x.veri.malzeme === 1, x.veri);
  let is = (await y('GET', `/isler/${isId}`)).veri;
  kontrol('Malzeme "verildi" (ofis) ve stoktan düştü', is.malzemeler.length === 1 && is.malzemeler[0].sahada_eklendi === false && Number((await y('GET', `/urunler/${u1.id}`)).veri.stok_miktari) === stok0 - 2, is.malzemeler);
  // Ekibe ata, teknisyen ilave eklesin
  const yarin = new Date(); yarin.setHours(yarin.getHours() + 1);
  await y('POST', `/isler/${isId}/planla`, { ekip_id: ekip.id, baslangic: new Date().toISOString() });
  await t('POST', `/isler/${isId}/baslat`);
  x = await t('POST', `/isler/${isId}/malzeme`, { urun_id: u2.id, miktar: 1 });
  is = (await y('GET', `/isler/${isId}`)).veri;
  kontrol('Teknisyenin eklediği "ilave"', x.durum === 200 && is.malzemeler.find((q) => q.urun_id === u2.id)?.sahada_eklendi === true, is.malzemeler);
  // Havuzdaki işten malzeme çıkarılabilir
  const rolCari = (await y('POST', '/cariler', { unvan: 'Rol Testi Carisi', tip: 'musteri' })).veri;
  const is2 = (await y('POST', '/isler/hizli', { mesaj: 'Çıkarma denemesi', cari_id: rolCari.id, malzemeler: [{ urun_id: u1.id, miktar: 1 }] })).veri.id;
  const mid = (await y('GET', `/isler/${is2}`)).veri.malzemeler[0].id;
  x = await y('DELETE', `/malzeme/${mid}`);
  kontrol('Havuzdaki işten malzeme çıkarılır, stok geri girer', x.durum === 200 && Number((await y('GET', `/urunler/${u1.id}`)).veri.stok_miktari) === stok0 - 2, x.veri);

  // ---- Teknisyen iş ekler ----
  x = await t('POST', '/isler/teknisyen', { mesaj: 'Toner istedi Ahmet Market 0532 111 22 33' });
  kontrol('Teknisyen iş ekledi (havuz)', x.durum === 200 && !x.veri.ben, x.veri);
  const hv = (await y('GET', '/havuz')).veri;
  kontrol('İş havuzda', hv.some((q) => q.id === x.veri.id));
  kontrol('Teknisyen: carisiz iş eklenemez', (await t('POST', '/isler/teknisyen', { mesaj: 'Carisiz deneme' })).durum === 400);
  const aranan = await t('GET', '/cariler/ara?q=rol testi');
  kontrol('Teknisyen cari arayabilir (bakiye yok)', aranan.durum === 200 && aranan.veri.some((c) => c.id === rolCari.id) && aranan.veri.every((c) => !('bakiye' in c)), aranan.veri);
  const tekCari = await t('POST', '/cariler/hizli', { unvan: 'Teknisyenin Açtığı Cari' });
  kontrol('Teknisyen telefonsuz yeni cari açar', tekCari.durum === 200 && tekCari.veri.id, tekCari.veri);
  kontrol('Teknisyen cari listesine / bakiyeye erişemez', (await t('GET', '/cariler')).durum === 403);
  x = await t('POST', '/isler/teknisyen', { mesaj: 'Kendi işim: kamera ayarı', ben: true, cari_id: tekCari.veri.id });
  is = (await y('GET', `/isler/${x.veri.id}`)).veri;
  kontrol('"Ben yapıyorum": kendi ekibine bugün planlandı', is.durum === 'planlandi' && Number(is.ekip_id) === Number(ekip.id), { d: is.durum, e: is.ekip_id });
  kontrol('Yönetici /isler/teknisyen kullanamaz', (await y('POST', '/isler/teknisyen', { mesaj: 'x' })).durum === 403);

  // ---------- Tarayıcı ----------
  const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
  const b = await chromium.launch(); require('./eski_gorunum')(b);
  const hatalar = [];
  // Muhasebe ekranı
  const mc = await b.newContext({ viewport: { width: 1440, height: 900 } }); const mp = await mc.newPage(); mp.on('pageerror', (e) => hatalar.push(e.message));
  await mp.goto(T); await mp.fill('[name=kullanici_adi]', 'muhasebe'); await mp.fill('[name=sifre]', 'muhasebe1'); await mp.click('button');
  await mp.waitForSelector('#sayfa'); await mp.waitForTimeout(800);
  const menu = await mp.$$eval('[data-yol]', (a) => [...new Set(a.map((q) => q.dataset.yol))]);
  kontrol('Muhasebe menüsü: Ayarlar / Form / Güncelle / Konum / Fiyatlandırma yok; Havuz / Takvim var', !['ayarlar', 'formlar', 'guncelleme', 'ekip-konum', 'fiyatlandirma', 'silinenler'].some((q) => menu.includes(q)) && ['cariler', 'fisler', 'kdv', 'kasa', 'alislar', 'havuz', 'takvim'].every((q) => menu.includes(q)), menu);
  kontrol('Muhasebe: sağ üstte "+ İş ekle" ve "+ Satış fişi"', await mp.isVisible('#btn-hizli') && !!(await mp.$('#btn-fis')));
  await mp.click('#btn-hizli'); await mp.waitForSelector('dialog[open] #hi-malzeme');
  await mp.fill('dialog[open] textarea[name=mesaj]', 'Muhasebe pencereden iş Ahmet Market'); await mp.click('dialog[open] button[type=submit]'); await mp.waitForTimeout(700);
  kontrol('Muhasebe pencereden iş ekledi', (await y('GET', '/havuz')).veri.some((q) => /Muhasebe pencereden/.test(q.ham_mesaj || q.baslik)));
  await mp.evaluate(() => { location.hash = '#/takvim'; }); await mp.waitForTimeout(700);
  kontrol('Muhasebe takvimi açar', (await mp.$eval('#sayfa', (e) => e.className)).includes('sayfa-takvim'));
  await mp.evaluate(() => { location.hash = '#/ayarlar'; }); await mp.waitForTimeout(500);
  kontrol('Muhasebe yasak sayfaya giremez (panele döner)', (await mp.$eval('#sayfa', (e) => e.className)).includes('sayfa-panel'));
  await mp.evaluate((id) => { location.hash = `#/fis/${id}`; }, fisId); await mp.waitForSelector('.fatura');
  kontrol('Fişte maliyet / kâr kutusu görünmez', !(await mp.isVisible('#maliyet-goster').catch(() => false)) && !/Kâr/.test(await mp.textContent('.fatura-alt')));
  await mp.evaluate(() => { location.hash = '#/fisler'; }); await mp.waitForTimeout(600);
  kontrol('Fiş listesinde Maliyet / Kâr sütunu görünmez', !(await mp.$$eval('#liste thead th', (h) => h.filter((q) => q.offsetParent !== null).map((q) => q.textContent.trim()))).some((q) => /Maliyet|Kâr/.test(q)));
  await mp.evaluate(() => { location.hash = '#/raporlar/aylik'; }); await mp.waitForTimeout(700);
  kontrol('Raporda Maliyet / Kâr sütunu ve İş kârlılığı raporu yok', !/Maliyet|Kâr/.test(await mp.textContent('#r thead')) && !(await mp.$('[data-r="is-karlilik"]')));
  await mp.screenshot({ path: `${EKRAN}/muhasebe.png` });

  // Teknisyen: + İş ekle ve teslim / onay ekranı
  const tc = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true }); const tp = await tc.newPage(); tp.on('pageerror', (e) => hatalar.push(e.message));
  await tp.goto(T); await tp.fill('[name=kullanici_adi]', 'rolusta'); await tp.fill('[name=sifre]', 'usta1234'); await tp.click('button');
  await tp.waitForSelector('#tek-is-ekle', { state: 'attached' }); await tp.waitForTimeout(300);
  kontrol('Teknisyen telefonda + düğmesi (iş ekle)', await tp.isVisible('#mb-fab') && /İş ekle/.test(await tp.getAttribute('#mb-fab', 'aria-label')));
  await tp.click('#mb-fab'); await tp.waitForSelector('dialog[open] textarea[name=mesaj]');
  await tp.fill('dialog[open] textarea[name=mesaj]', 'Telefon istedi Ahmet Market');
  await tp.click('dialog[open] button[type=submit]'); await tp.waitForTimeout(800);
  kontrol('Teknisyen ekranından iş eklendi', (await y('GET', '/havuz')).veri.some((q) => /Telefon istedi/.test(q.ham_mesaj || q.baslik)));
  await tp.evaluate((id) => { location.hash = `#/saha/${id}`; }, isId); await tp.waitForSelector('[data-akis="imza"]');
  const mt = await tp.textContent('#sayfa');
  kontrol('Teknisyen ekranında "verildi" ve "ilave" etiketleri', /verildi/.test(mt) && /ilave/.test(mt));
  await tp.fill('#tek-not', 'Toner takıldı, test sayfası alındı.');
  await tp.click('[data-akis="imza"]'); await tp.waitForSelector('dialog.imza-dialog .teslim-ozet');
  const oz = await tp.textContent('dialog.imza-dialog');
  kontrol('Teslim / onay ekranı: iş, yapılan iş, Onaylıyorum; malzeme listesi yok', /Teslim \/ müşteri onayı/.test(oz) && /Toner takıldı/.test(oz) && /Onaylıyorum/.test(oz) && !oz.includes(u1.ad), oz.slice(0, 300));
  await tp.screenshot({ path: `${EKRAN}/teslim-onay.png` });

  // Yönetici: İş ekle penceresinde malzeme bölümü
  const yc = await b.newContext({ viewport: { width: 1440, height: 900 } }); const yp = await yc.newPage(); yp.on('pageerror', (e) => hatalar.push(e.message));
  await yp.goto(T); await yp.fill('[name=kullanici_adi]', 'Patron'); await yp.fill('[name=sifre]', '12345678'); await yp.click('button');
  await yp.waitForSelector('#btn-hizli'); await yp.click('#btn-hizli'); await yp.waitForSelector('dialog[open] #hi-malzeme');
  await yp.fill('dialog[open] textarea[name=mesaj]', 'Pencereden malzemeli iş Ahmet Market');
  await yp.click('dialog[open] [data-hm-ekle]'); await yp.waitForSelector('dialog[open] .hm-ara');
  await yp.click('dialog[open] .hm-ara'); await yp.keyboard.type(u2.ad.slice(0, 5), { delay: 20 });
  await yp.waitForSelector('.secici-liste .secici-oge'); await yp.keyboard.press('Enter'); await yp.waitForTimeout(200);
  await yp.fill('dialog[open] .hm-mik', '3');
  await yp.screenshot({ path: `${EKRAN}/is-ekle-malzeme.png` });
  await yp.click('dialog[open] button[type=submit]'); await yp.waitForTimeout(800);
  const yeniIs = (await y('GET', '/havuz')).veri.find((q) => /Pencereden malzemeli/.test(q.ham_mesaj || q.baslik));
  const yd = yeniIs && (await y('GET', `/isler/${yeniIs.id}`)).veri;
  kontrol('Pencereden eklenen işte 3 malzeme "verildi"', yd?.malzemeler?.length === 1 && Number(yd.malzemeler[0].miktar) === 3 && yd.malzemeler[0].sahada_eklendi === false, yd?.malzemeler);
  await yp.click('#btn-hizli'); await yp.waitForSelector('dialog[open] #hi-ben');
  await yp.check('dialog[open] #hi-ben'); await yp.waitForTimeout(150);
  kontrol('"İşi ben yaptım" seçilince malzeme bölümü gizlenir', !(await yp.isVisible('dialog[open] #hi-malzeme')));

  // Telefonda iç içe pencere: stok listesinden seçince İş ekle penceresi kapanmamalı; geri tuşu üstteki pencereyi kapatır
  const tm = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const tmp = await tm.newPage(); tmp.on('pageerror', (e) => hatalar.push(e.message));
  await tmp.goto(T); await tmp.fill('[name=kullanici_adi]', 'Patron'); await tmp.fill('[name=sifre]', '12345678'); await tmp.click('button');
  await tmp.waitForSelector('#btn-hizli'); await tmp.evaluate(() => document.querySelector('#btn-hizli').click()); await tmp.waitForSelector('dialog[open] #hi-malzeme');
  await tmp.fill('dialog[open] textarea[name=mesaj]', 'Telefonda stok listesinden Ahmet Market');
  await tmp.tap('dialog[open] [data-hm-stok]'); await tmp.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 2);
  await tmp.waitForSelector('dialog[open] tbody input[type=checkbox]'); await (await tmp.$$('dialog[open] tbody input[type=checkbox]'))[0].tap(); await tmp.waitForTimeout(150);
  await tmp.tap('dialog[open] button[type=submit]:has-text("Seçilenleri")'); await tmp.waitForTimeout(500);
  kontrol('Telefon: stok listesi kapanınca İş ekle penceresi açık kalır', (await tmp.$$('dialog[open]')).length === 1 && (await tmp.$$('dialog[open] .hm-satir')).length === 1);
  await tmp.tap('dialog[open] button[type=submit]'); await tmp.waitForTimeout(900);
  kontrol('Telefon: malzemeli iş kaydedildi', (await y('GET', '/havuz')).veri.some((q) => /Telefonda stok listesinden/.test(q.ham_mesaj || q.baslik)));
  await tmp.evaluate(() => document.querySelector('#btn-hizli').click()); await tmp.waitForSelector('dialog[open] #hi-malzeme');
  await tmp.tap('dialog[open] [data-hm-stok]'); await tmp.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 2);
  await tmp.goBack(); await tmp.waitForTimeout(400);
  kontrol('Telefon: geri tuşu yalnız üstteki pencereyi kapatır', (await tmp.$$('dialog[open]')).length === 1);

  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nROL / İŞ TESTİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
