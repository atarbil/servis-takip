// Yeni telefon arayüzü (api_testi.js sonrası, aynı veritabanıyla):
//   node test/mobil_kabuk_testi.js http://127.0.0.1:3100
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
let hata = 0;
const kontrol = (ad, ok, ek) => { console.log(ok ? 'OK  ' : 'HATA', ad, ok ? '' : (ek ?? '')); if (!ok) hata++; };

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const s = await c.newPage();
  const hatalar = []; s.on('pageerror', (e) => hatalar.push(e.message));
  await s.goto(T); await s.fill('[name=kullanici_adi]', 'Patron'); await s.fill('[name=sifre]', '12345678');
  await s.click('#giris-form button');
  await s.waitForSelector('body.mobil-kabuk .mk-alt');
  kontrol('Telefonda ayrı arayüz açıldı', await s.isVisible('.mk-ust') && !(await s.$('.ust-cubuk')));
  kontrol('Alt sekmeler: Panel, İşler, Satış, Cariler, İş ekle, Menü', (await s.$$eval('#mk-alt > a span, #mk-alt > button span', (x) => x.map((e) => e.textContent).join(' '))) === 'Panel İşler Satış Cariler İş ekle Menü');
  kontrol('Ana sayfada geri düğmesi yok', !(await s.isVisible('#mk-geri')));
  // Yatay taşma yok
  const tasma = async () => s.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  kontrol('Panel yatay taşmıyor', (await tasma()) <= 1, await tasma());

  // İşler → Bugün / Havuz / Takvim / Tümü
  await s.click('#mk-alt [data-sekme="isler"]');
  await s.waitForSelector('.mk-bolumler'); await s.waitForSelector('#mk-liste :is(.mk-kart, .mk-bos)');
  kontrol('İşler: dört bölüm', (await s.$$('.mk-bolumler button')).length === 4);
  kontrol('İşler sekmesi seçili', await s.$eval('#mk-alt [data-sekme="isler"]', (a) => a.classList.contains('aktif')));
  await s.click('[data-bolum="havuz"]'); await s.waitForSelector('#mk-liste :is(.mk-kart, .mk-bos)');
  kontrol('Havuz bölümü adreste', (await s.evaluate(() => location.hash)).includes('b=havuz'));
  await s.click('[data-bolum="takvim"]'); await s.waitForSelector('.mk-hafta'); await s.waitForFunction(() => document.querySelectorAll('#mk-liste .mk-grup').length === 7).catch(() => {});
  if (process.env.EKRAN) await s.screenshot({ path: '/tmp/mk_takvim.png' });
  kontrol('Takvim: 7 gün', (await s.$$('#mk-liste .mk-grup')).length === 7);
  await s.click('[data-hafta="7"]'); await s.waitForTimeout(300);
  kontrol('Takvim: sonraki hafta / "Bu hafta" düğmesi', await s.isVisible('[data-hafta="0"]'));
  await s.click('[data-bolum="tum"]'); await s.waitForSelector('#mk-ara');
  await s.click('[data-durum=""]'); await s.waitForSelector('#mk-liste .mk-kart');
const kartSay = (await s.$$('#mk-liste .mk-kart')).length;
  kontrol(`Tümü: iş kartları (${kartSay})`, kartSay > 0);
  kontrol('İşler yatay taşmıyor', (await tasma()) <= 1, await tasma());

  // Aşağı kaydır → işe gir → geri → aynı bölüm ve kaydırma yeri
  await s.evaluate(() => window.scrollTo(0, 120));
  const y0 = await s.evaluate(() => scrollY);
  // Ekranda tamamen görünen ilk kart (yapışkan başlığın altında kalmayan)
  const href = await s.evaluate(() => [...document.querySelectorAll('#mk-liste a.mk-kart')].find((a) => a.getBoundingClientRect().top > 250 && /Havuzda|Planlandı|Tamamlandı/.test(a.querySelector('.rozet')?.textContent || ''))?.getAttribute('href'));
  await s.click(`#mk-liste a.mk-kart[href="${href}"]`);
  await s.waitForSelector('.mk-is-ust');
  kontrol('İş detayı açıldı, geri düğmesi görünür', await s.isVisible('#mk-geri') && (await s.evaluate(() => location.hash)) === href);
  kontrol('İş detayı yatay taşmıyor', (await tasma()) <= 1, await tasma());
  if (process.env.EKRAN) { await s.screenshot({ path: '/tmp/mk_detay.png', fullPage: true }); }
  kontrol('Detay en üstten açılır', (await s.evaluate(() => scrollY)) === 0);
  // ⋯ menüsü alttan açılır, Vazgeç kapatır
  await s.click('#mk-eylem .mk-ust-dugme');
  await s.waitForSelector('dialog.mk-sayfacik[open]');
  kontrol('⋯ işlem listesinde Düzenle', (await s.textContent('dialog.mk-sayfacik')).includes('Düzenle'));
  await s.click('dialog.mk-sayfacik .vazgec'); await s.waitForTimeout(200);
  kontrol('İşlem listesi kapandı', !(await s.$('dialog.mk-sayfacik')));
  // Düzenle penceresi tam ekran; geri tuşu pencereyi kapatır, sayfa yerinde kalır
  await s.click('#mk-eylem .mk-ust-dugme'); await s.click('dialog.mk-sayfacik [data-k="duzenle"]');
  await s.waitForSelector('dialog.pencere[open]'); await s.waitForTimeout(200);
  const gen = await s.$eval('dialog.pencere[open]', (d) => d.getBoundingClientRect().width);
  kontrol('Düzenle penceresi tam ekran', gen >= 389, gen);
  await s.goBack(); await s.waitForTimeout(400);
  kontrol('Geri tuşu pencereyi kapattı, iş sayfası duruyor', !(await s.$('dialog[open]')) && (await s.evaluate(() => location.hash)) === href);
  // Geri düğmesi → listeye, bölüm ve kaydırma korunur
  await s.click('#mk-geri');
  await s.waitForSelector('.mk-bolumler'); await s.waitForSelector('#mk-liste .mk-kart');
  await s.waitForTimeout(200);
  kontrol('Geri: Tümü bölümü korunur', await s.$eval('[data-bolum="tum"]', (x) => x.classList.contains('secili')));
  const y1 = await s.evaluate(() => scrollY);
  kontrol('Geri: kaydırma yeri korunur', Math.abs(y1 - y0) < 30, { y0, y1 });

  // İş ekle (alt menü) → tam ekran pencere
  await s.click('#mk-alt [data-hizli]');
  await s.waitForSelector('dialog.pencere[open]');
  kontrol('İş ekle penceresi açıldı', true);
  await s.goBack(); await s.waitForTimeout(300);

  // Henüz telefona yazılmamış sayfa (Cariler) kabuk içinde açılır
  await s.click('#mk-alt [data-sekme="cariler"]');
  await s.waitForSelector('#sayfa.mk-masa table, #sayfa.mk-masa .bos-durum');
  kontrol('Cariler sayfası telefon kabuğunda', await s.isVisible('.mk-alt') && (await s.textContent('#ust-baslik')).includes('Cari'));
  kontrol('Cariler: + düğmesi alt çubuğun üstünde', await s.isVisible('#mb-fab'));

  // Menü → bilgisayar görünümüne geç / geri dön
  await s.click('#mk-alt [data-menu]');
  await s.waitForSelector('dialog.mk-menu[open]');
  if (process.env.EKRAN) await s.screenshot({ path: '/tmp/mk_menu.png' });
  kontrol('Menüde Kasa / Banka ve Ayarlar', (await s.textContent('dialog.mk-menu')).includes('Kasa / Banka') && (await s.textContent('dialog.mk-menu')).includes('Ayarlar'));
  await s.click('dialog.mk-menu [data-m="masa"]');
  await s.waitForSelector('.ust-cubuk');
  kontrol('Bilgisayar görünümüne geçildi', !(await s.$('.mk-alt')));
  await s.click('#btn-menu'); await s.click('.um-kullanici.yalniz-mobil .um-baslik').catch(() => {});
  await s.click('[data-mobil-gorunum]');
  await s.waitForSelector('.mk-alt');
  kontrol('Mobil görünüme dönüldü', true);

  // Bilgisayarda yeni arayüz açılmaz
  const m = await (await b.newContext({ viewport: { width: 1366, height: 800 }, storageState: await c.storageState() })).newPage();
  await m.goto(T); await m.waitForSelector('.ust-cubuk');
  kontrol('Bilgisayarda eski görünüm', !(await m.$('.mk-alt')));

  // Teknisyen ve muhasebe telefonda
  let cerez = '';
  const y = async (yontem, yol, govde) => {
    const r = await fetch(T + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
    return r.json().catch(() => null);
  };
  await y('POST', '/giris', { kullanici_adi: 'Patron', sifre: '12345678' });
  const ekip = (await y('GET', '/ekipler'))[0];
  await y('POST', '/kullanicilar', { ad_soyad: 'Mobil Usta', kullanici_adi: 'mobilusta', sifre: 'usta1234', rol: 'teknisyen', ekip_id: ekip.id });
  await y('POST', '/kullanicilar', { ad_soyad: 'Mobil Muhasebe', kullanici_adi: 'mobilmuh', sifre: 'muhasebe1', rol: 'muhasebe' });
  const girisYap = async (ad, sifre) => {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
    p.on('pageerror', (e) => hatalar.push(e.message));
    await p.goto(T); await p.fill('[name=kullanici_adi]', ad); await p.fill('[name=sifre]', sifre); await p.click('#giris-form button');
    await p.waitForSelector('.mk-alt'); return p;
  };
  const tp = await girisYap('mobilusta', 'usta1234');
  await tp.waitForSelector('#sayfa.sayfa-islerim');
  kontrol('Teknisyen: İşlerim telefon kabuğunda', (await tp.$$eval('#mk-alt > a span, #mk-alt > button span', (x) => x.map((e) => e.textContent).join(' '))) === 'İşlerim Menü');
  await tp.goto(`${T}/#/cariler`); await tp.waitForTimeout(600);
  kontrol('Teknisyen: izinsiz sayfa İşlerim\'e döner', await tp.$('#sayfa.sayfa-islerim') !== null);
  await tp.click('#mk-alt [data-menu]'); await tp.waitForSelector('dialog.mk-menu[open]');
  kontrol('Teknisyen menüsünde yönetim sayfaları yok', !(await tp.textContent('dialog.mk-menu')).includes('Kasa'));
  const mp = await girisYap('mobilmuh', 'muhasebe1');
  await mp.goto(`${T}/#/is/${href.split('/').pop()}`); await mp.waitForSelector('.mk-is-ust');
  kontrol('Muhasebe: iş detayında kâr bloğu gizli', !(await mp.isVisible('.kar-bilgi')));
  await mp.click('#mk-alt [data-menu]'); await mp.waitForSelector('dialog.mk-menu[open]');
  const mm = await mp.textContent('dialog.mk-menu');
  kontrol('Muhasebe menüsünde Kullanıcılar / güncelleme yok', !mm.includes('Programı güncelle') && mm.includes('Kasa / Banka'));
  kontrol('Sayfa hatası yok', !hatalar.length, hatalar.join(' | '));
  await b.close();
  console.log(hata ? `\n${hata} KONTROL BAŞARISIZ` : '\nTÜM KONTROLLER BAŞARILI');
  process.exit(hata ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
