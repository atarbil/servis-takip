// Form tasarımı uçtan uca testi (tarayici_testi.js sonrası, aynı veritabanıyla; yönetici: ali / Sifre1234):
//   node test/form_testi.js http://127.0.0.1:3100 /tmp/ekran
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
const EKRAN = process.argv[3] || '/tmp/ekran';
let hata = 0;
const kontrol = (ad, ok, ek) => { console.log(ok ? 'OK  ' : 'HATA', ad, ok ? '' : (ek ?? '')); if (!ok) hata++; };

(async () => {
  const b = await chromium.launch(); require('./eski_gorunum')(b);
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await c.newPage();
  s.on('pageerror', (e) => { hata++; console.log('SAYFA HATASI', e.message); });
  await s.addInitScript(() => { window.print = () => { window.__yazdirildi = (window.__yazdirildi || 0) + 1; }; });
  await s.goto(T); await s.fill('[name=kullanici_adi]', 'ali'); await s.fill('[name=sifre]', 'Sifre1234');
  await s.click('#giris-form button'); await s.waitForSelector('#sayfa');
  const api = (y, yol, govde) => s.evaluate(async ([y2, yol2, g]) => {
    const r = await fetch('/api' + yol2, { method: y2, headers: { 'content-type': 'application/json', 'x-istek': '1' }, body: g ? JSON.stringify(g) : undefined });
    return { durum: r.status, veri: await r.json().catch(() => null) };
  }, [y, yol, govde]);

  const grupAc = async (ad) => { const d = s.locator(`details.fm-grup:has(summary:text("${ad}"))`); if (!(await d.getAttribute('open') !== null)) await d.locator('summary').click(); };
  // Menü
  await s.click('.um-kullanici.yalniz-masa .um-baslik');
  kontrol('Kişisel menüde "Form tasarımı"', await s.isVisible('.um-kullanici.yalniz-masa a[data-yol=formlar]'));
  await s.click('.um-kullanici.yalniz-masa a[data-yol=formlar]');
  await s.waitForSelector('.fm-kart');
  kontrol('7 belge türü sekmesi', (await s.locator('#fm-sekme button').count()) === 7);
  kontrol('Standart şablon varsayılan', (await s.textContent('.fm-kart.varsayilan')).includes('Standart'));

  // Standart değiştirilemez (API)
  const std = (await api('GET', '/sablonlar?tur=teklif')).veri.find((x) => x.sistem);
  kontrol('Standart şablon API ile değiştirilemez', (await api('PUT', `/sablonlar/${std.id}`, { ad: 'X' })).durum === 403);
  kontrol('Standart şablon silinemez', (await api('DELETE', `/sablonlar/${std.id}`)).durum === 403);

  // Yeni şablon: Modern tema
  await s.click('.fm-kart-yeni');
  await s.waitForSelector('.fm-temalar .fm-tema');
  kontrol('Tema galerisinde 4 tema', (await s.locator('.fm-tema').count()) === 4);
  await s.fill('dialog[open] [name=ad]', 'Modern teklif');
  await s.click('.fm-tema:nth-child(2)');
  await s.click('dialog[open] button[type=submit]');
  await s.waitForSelector('.fm-kagit .fb-tema-modern');
  const id = s.url().split('/').pop();
  kontrol('Düzenleme ekranı açıldı (Modern tema)', /^\d+$/.test(id));

  // Kolon kapat → önizlemeden kalkar
  await grupAc('Kolon ayarları');
  await s.locator('label.fm-anahtar:has(input[data-kolon=iskonto])').click();
  kontrol('İndirim kolonu kapatıldı', !(await s.$('.fm-kagit th.fb-k-iskonto')));
  await s.locator('label.fm-anahtar:has(input[data-kolon=kod])').click();
  kontrol('Ürün kodu kolonu açıldı', !!(await s.$('.fm-kagit th.fb-k-kod')));
  await s.fill('[data-kolon-ad=aciklama]', 'Ürün / Hizmet');
  await s.waitForTimeout(100);
  kontrol('Kolon başlığı değişti', (await s.textContent('.fm-kagit th.fb-k-aciklama')).includes('Ürün / Hizmet'));
  // Bölüm sırası: müşteri bölümünü yukarı al
  await grupAc('Bölümler');
  const once = await s.$$eval('.fm-kagit [data-bolum]', (x) => x.map((e) => e.dataset.bolum));
  await s.click('[data-sira=bolumler][data-i="2"][data-yon="-1"]');
  const sonra = await s.$$eval('.fm-kagit [data-bolum]', (x) => x.map((e) => e.dataset.bolum));
  kontrol('Bölüm sırası değişti (müşteri başlığın üstüne)', once.indexOf('musteri') - 1 === sonra.indexOf('musteri'), sonra.join(','));
  // Geri al
  await s.click('[data-a=geri]');
  const geri = await s.$$eval('.fm-kagit [data-bolum]', (x) => x.map((e) => e.dataset.bolum));
  kontrol('Geri al çalışıyor', geri.join() === once.join(), geri.join());
  await s.click('[data-a=ileri]');
  // Banka bölümünü aç ve metin yaz (doğrudan düzenleme)
  await s.locator('label.fm-anahtar:has(input[data-bolum=banka])').click();
  const banka = s.locator('.fm-kagit [data-metin=banka]');
  await banka.click(); await s.keyboard.type('Ziraat Bankası TR00 0001 0000 0000 0000 0000 00');
  kontrol('Biçim araç çubuğu göründü', await s.isVisible('#fm-arac'));
  await s.keyboard.press('Control+A'); await s.click('#fm-arac [data-k=bold]');
  // Firma adı kutusuna yaz
  const firmaAd = s.locator('.fm-kagit [data-metin=firma_ad]');
  await firmaAd.click(); await s.keyboard.press('End'); await s.keyboard.type(' — Teknik Servis');
  // Şablona özel logo yükle, sonra köşesinden büyüt
  await grupAc('Renk, yazı ve logo');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAAOUlEQVR42u3OMQ0AAAgDsM2/aDDBRUjrtJl6AQICAgICAgICAgICAgICAgICAgICAgICAgICAgICgkUDPV8BIVsECpEAAAAASUVORK5CYII=', 'base64');
  await s.setInputFiles('[data-gorsel=logo]', { name: 'logo.png', mimeType: 'image/png', buffer: png });
  const ozelLogo = await s.waitForSelector('.fm-kagit [data-logo] img[src*="/dosya/sablon/"]', { timeout: 8000 }).catch(() => null);
  kontrol('Şablona özel logo yüklendi', !!ozelLogo);
  const logo = await s.$('.fm-kagit [data-logo]');
  if (logo) {
    const g0 = await logo.evaluate((e) => e.offsetWidth);
    const t2 = await (await s.$('.fm-kagit [data-logo-boyut]')).boundingBox();
    await s.mouse.move(t2.x + 5, t2.y + 5); await s.mouse.down(); await s.mouse.move(t2.x + 80, t2.y + 5, { steps: 5 }); await s.mouse.up();
    const g1 = await s.$eval('.fm-kagit [data-logo]', (e) => e.offsetWidth);
    kontrol(`Logo köşeden büyütüldü (${g0} → ${g1})`, g1 > g0);
  }
  // Genel ayar: filigran kapat, sayfa no aç; QR aç
  await grupAc('Bölümler');
  await s.locator('label.fm-anahtar:has(input[data-bolum=qr])').click();
  kontrol('QR kod önizlemede', !!(await s.$('.fm-kagit .fb-qr svg')));
  // Sabit yazılar: başlığa önizlemede tıklayıp yaz, "Sayın"ı panelden değiştir
  const bas = s.locator('.fm-kagit [data-etiket=baslik]');
  await bas.click(); await s.keyboard.press('Control+A'); await s.keyboard.type('FİYAT TEKLİFİ'); await s.keyboard.press('Enter');
  kontrol('Başlık önizlemede değişti', (await bas.textContent()).trim() === 'FİYAT TEKLİFİ');
  await grupAc('Sabit yazılar');
  await s.fill('.fm-etiketler [data-etiket-giris=sayin]', 'Müşteri:');
  kontrol('"Sayın" panelden değişti', (await s.textContent('.fm-kagit [data-etiket=sayin]')).trim() === 'Müşteri:');
  const toplamYazi = s.locator('.fm-kagit .fb-toplam tr.genel [data-etiket=toplam]');
  await toplamYazi.click(); await s.keyboard.press('Control+A'); await s.keyboard.type('GENEL TOPLAM'); await s.locator('.fm-kagit [data-etiket=sayin]').click();
  kontrol('"Toplam" önizlemede değişti ve panele yansıdı', (await s.inputValue('.fm-etiketler [data-etiket-giris=toplam]')) === 'GENEL TOPLAM');
  await s.screenshot({ path: `${EKRAN}/F1_tasarim.png` });
  // Kaydet
  await s.click('[data-a=kaydet]'); await s.waitForTimeout(500);
  const kayitli = (await api('GET', `/sablonlar/${id}`)).veri;
  kontrol('Kaydedildi: banka metni', String(kayitli.ayar.metin.banka).includes('TR00 0001'));
  kontrol('Kaydedildi: firma adı metni', String(kayitli.ayar.metin.firma_ad).includes('Teknik Servis'));
  kontrol('Kaydedildi: kolon başlığı', kayitli.ayar.kolonlar.find((k) => k.id === 'aciklama').ad === 'Ürün / Hizmet');
  kontrol('Kaydedildi: sabit yazılar', kayitli.ayar.baslik === 'FİYAT TEKLİFİ' && kayitli.ayar.etiket.sayin === 'Müşteri:' && kayitli.ayar.etiket.toplam === 'GENEL TOPLAM', JSON.stringify(kayitli.ayar.etiket));
  // İkinci kayıt → sürüm
  await s.fill('[data-ad]', 'Modern teklif v2'); await s.waitForTimeout(600);
  await s.click('[data-a=kaydet]'); await s.waitForTimeout(400);
  const surumler = (await api('GET', `/sablonlar/${id}/surumler`)).veri;
  kontrol('Önceki sürümler saklandı', surumler.length === 2, surumler.length);
  await s.click('[data-a=surumler]'); await s.waitForSelector('dialog[open] [name=surum]');
  await s.click('dialog[open] [name=surum] >> nth=0'); await s.click('dialog[open] button[type=submit]'); await s.waitForTimeout(300);
  kontrol('Sürüm geri yüklendi (ad önceki)', (await s.textContent('#fm-ad-yazi')) === 'Modern teklif');

  // Zararlı içerik temizlenir
  const kotu = await api('PUT', `/sablonlar/${id}`, { ayar: { ...kayitli.ayar, metin: { ...kayitli.ayar.metin, notlar: 'Merhaba<script>alert(1)</script><img src=x onerror=alert(1)>' } } });
  kontrol('Sunucu zararlı etiketi temizledi', kotu.durum === 200 && !kotu.veri.ayar.metin.notlar.includes('script') && !kotu.veri.ayar.metin.notlar.includes('onerror'));

  // Telefon görünümü
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await c.storageState() })).newPage();
  await m.goto(`${T}/#/form/${id}`); await m.waitForSelector('.fm-mobil-sekme');
  kontrol('Telefonda ayarlar sekmesi önde', await m.isVisible('.fm-panel') && !(await m.isVisible('.fm-kagit')));
  await m.click('[data-mg=onizleme]'); await m.waitForTimeout(300);
  kontrol('Telefonda önizleme sekmesi', await m.isVisible('.fm-kagit'));
  await m.screenshot({ path: `${EKRAN}/F2_tasarim_telefon.png` });

  // Varsayılan yap + yazdırmada kullanılır
  await api('POST', `/sablonlar/${id}/varsayilan`);
  const pf = (await api('POST', '/teklifler', { tur: 'teklif', cari_id: (await api('GET', '/cariler')).veri[0].id, tarih: '2026-11-22', satirlar: [{ urun_id: (await api('POST', '/urunler', { ad: 'Test ürün' })).veri.id, aciklama: 'Test ürün', miktar: 2, birim: 'adet', birim_fiyat: 100, kdv_orani: 20 }] })).veri;
  await s.goto(`${T}/#/teklif/${pf.id}`); await s.waitForSelector('[data-a=yazdir]');
  await s.click('[data-a=yazdir]');
  await s.waitForSelector('dialog[open] [name=sablon]');
  kontrol('2 şablon varken yazdırırken seçim soruluyor', (await s.locator('dialog[open] [name=sablon]').count()) >= 2);
  await s.click('dialog[open] button[type=submit]');
  await s.waitForFunction(() => window.__yazdirildi > 0);
  const basilan = await s.$eval('#yazdir-alani', (e) => e.innerHTML);
  kontrol('Varsayılan (Modern) şablonla yazdırıldı', basilan.includes('fb-tema-modern') && basilan.includes('Ürün / Hizmet'));
  kontrol('Yazdırmada değiştirilmiş sabit yazılar', basilan.includes('FİYAT TEKLİFİ') && basilan.includes('Müşteri:') && basilan.includes('GENEL TOPLAM') && !basilan.includes('contenteditable'));
  await s.emulateMedia({ media: 'print' });
  await s.pdf({ path: `${EKRAN}/F3_modern_teklif.pdf`, format: 'A4' });
  await s.setViewportSize({ width: 794, height: 1123 });
  await s.screenshot({ path: `${EKRAN}/F3_modern_teklif.png`, fullPage: true });
  await s.emulateMedia({ media: 'screen' });
  await s.setViewportSize({ width: 1440, height: 900 });

  // Dışa / içe aktar
  const disa = (await api('GET', '/sablonlar/disa-aktar')).veri;
  kontrol('Dışa aktarım şablon içeriyor', disa.sablonlar.length >= 1);
  const ice = (await api('POST', '/sablonlar/ice-aktar', disa)).veri;
  kontrol('İçe aktarıldı', ice.eklenen === disa.sablonlar.length);
  kontrol('Geçersiz dosya reddedilir', (await api('POST', '/sablonlar/ice-aktar', { x: 1 })).durum === 400);

  // Varsayılan silinince Standart varsayılan olur
  await api('DELETE', `/sablonlar/${id}`);
  const sonListe = (await api('GET', '/sablonlar?tur=teklif')).veri;
  kontrol('Varsayılan silinince Standart varsayılan', sonListe.find((x) => x.varsayilan)?.sistem === true);

  // Diğer türlerin önizlemeleri hatasız
  for (const tur of ['proforma', 'satis_fisi', 'makbuz', 'teslim', 'dis_servis', 'ekstre']) {
    await s.goto(`${T}/#/formlar?tur=${tur}`); await s.waitForSelector('.fm-kart .fb');
  }
  kontrol('Tüm türlerin önizlemesi çizildi', true);
  await s.goto(`${T}/#/formlar?tur=makbuz`); await s.waitForTimeout(500);
  await s.screenshot({ path: `${EKRAN}/F4_liste.png` });

  await b.close();
  console.log(hata ? `FORM TESTİ: ${hata} HATA` : 'FORM TESTİ BAŞARILI');
  process.exit(hata ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
