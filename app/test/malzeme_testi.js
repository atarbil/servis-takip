// Malzeme ekleme kolaylıkları (api_testi.js sonrası, aynı veritabanıyla):
//   node test/malzeme_testi.js http://127.0.0.1:3100
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
let hata = 0;
const kontrol = (ad, ok, ek) => { console.log(ok ? 'OK  ' : 'HATA', ad, ok ? '' : JSON.stringify(ek ?? '')); if (!ok) hata++; };
const istemci = () => {
  let cerez = '';
  const f = async (yontem, yol, govde) => {
    const r = await fetch(T + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
    return { durum: r.status, veri: await r.json().catch(() => null) };
  };
  f.cerez = () => cerez;
  return f;
};

(async () => {
  const y = istemci();
  await y('POST', '/giris', { kullanici_adi: 'Patron', sifre: '12345678' });
  const cari = (await y('POST', '/cariler', { unvan: 'Malzeme Test Ltd', tip: 'musteri' })).veri;
  const urun = (await y('POST', '/urunler', { ad: 'Cat 6 UTP Kablo Malzeme', birim: 'metre', kdv_orani: 20 })).veri;
  const urun2 = (await y('POST', '/urunler', { ad: 'Adaptör 12V 2A Malzeme', birim: 'adet', kdv_orani: 20, barkodlar: ['8690000012345'] })).veri;
  const stok = async (id) => Number((await y('GET', `/urunler/${id}`)).veri.stok_miktari);

  // Hataya toleranslı arama
  const ara = async (q) => (await y('GET', `/urunler?q=${encodeURIComponent(q)}`)).veri.map((u) => u.id);
  kontrol('Arama: "cat6" → "Cat 6 UTP"', (await ara('cat6')).includes(urun.id));
  kontrol('Arama: "adaptor 12v" → "Adaptör 12V"', (await ara('adaptor 12v')).includes(urun2.id));
  kontrol('Arama: barkodla', (await ara('8690000012345')).includes(urun2.id));

  const is = (await y('POST', '/isler', { baslik: 'Malzeme test işi', cari_id: cari.id })).veri;
  const s0 = await stok(urun.id);
  let r = await y('POST', `/isler/${is.id}/malzeme`, { urun_id: urun.id, miktar: 1, birlestir: true });
  kontrol('Ekle: yeni satır', r.durum === 200 && !r.veri.birlesti, r);
  const mid = r.veri.id;
  r = await y('POST', `/isler/${is.id}/malzeme`, { urun_id: urun.id, miktar: 1, birlestir: true });
  kontrol('Aynı ürün tekrar: miktar artar (2)', r.veri.birlesti && r.veri.id === mid && r.veri.miktar === 2 && r.veri.onceki === 1, r.veri);
  kontrol('Stoktan 2 düştü', (await stok(urun.id)) === s0 - 2);
  r = await y('PUT', `/malzeme/${mid}`, { miktar: 10 });
  kontrol('Miktar 10 yapıldı, stok farkı düştü', r.durum === 200 && (await stok(urun.id)) === s0 - 10);
  await y('PUT', `/malzeme/${mid}`, { miktar: 4 });
  kontrol('Miktar 4: fark stoğa iade', (await stok(urun.id)) === s0 - 4);
  let d = (await y('GET', `/isler/${is.id}`)).veri;
  kontrol('Tek satır, miktar 4', d.malzemeler.length === 1 && Number(d.malzemeler[0].miktar) === 4, d.malzemeler);
  r = await y('POST', `/isler/${is.id}/malzeme`, { barkod: '8690000012345', miktar: 1, birlestir: true });
  r = await y('POST', `/isler/${is.id}/malzeme`, { barkod: '8690000012345', miktar: 1, birlestir: true });
  d = (await y('GET', `/isler/${is.id}`)).veri;
  const bm = d.malzemeler.find((m) => m.urun_id === urun2.id);
  kontrol('Barkod iki kez: tek satır × 2, barkodla işaretli', bm && Number(bm.miktar) === 2 && bm.barkodla_eklendi, bm);
  r = await y('POST', `/isler/${is.id}/malzeme`, { barkod: '000111222333', birlestir: true });
  kontrol('Tanımsız barkod: hata kodu', r.durum >= 400 && /barkod/i.test(JSON.stringify(r.veri)), r.veri);
  r = await y('PUT', `/malzeme/${bm.id}`, { miktar: 0 });
  d = (await y('GET', `/isler/${is.id}`)).veri;
  kontrol('Miktar 0: satır çıkarıldı', !d.malzemeler.some((m) => m.urun_id === urun2.id));

  // Öneriler: bu müşteride daha önce kullanılanlar, son kullanılanlar
  const is2 = (await y('POST', '/isler', { baslik: 'Malzeme test işi 2', cari_id: cari.id })).veri;
  const o = (await y('GET', `/isler/${is2.id}/malzeme-onerileri`)).veri;
  kontrol('Öneri: bu müşteride kullanılan kablo', o.musteri.some((u) => u.id === urun.id), o);
  kontrol('Öneri: son kullanılanlar', o.son.some((u) => u.id === urun.id));

  // Fişi kesilmiş işte miktar değişmez
  // (fiş akışı ağır; durum kuralı DB fonksiyonunda — api_testi'deki fişli işle denenir)
  const fisli = (await y('GET', '/isler?durum=fis_kesildi')).veri[0];
  if (fisli) {
    const fd = (await y('GET', `/isler/${fisli.id}`)).veri;
    if (fd.malzemeler[0]) kontrol('Fişi kesilmiş işte miktar değiştirilemez', (await y('PUT', `/malzeme/${fd.malzemeler[0].id}`, { miktar: 99 })).durum >= 400);
  }

  // ---------- Telefon: iş detayında ara-ekle, liste kutunun altında, − / +, geri al ----------
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await c.newPage(); const hatalar = []; p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(T); await p.fill('[name=kullanici_adi]', 'Patron'); await p.fill('[name=sifre]', '12345678'); await p.click('#giris-form button');
  await p.waitForSelector('.mk-alt');
  await p.goto(`${T}/#/is/${is2.id}`); await p.waitForSelector('[data-mz-ara]');
  kontrol('Telefon: yalnız 2 sabit çip, başka öneri yok', (await p.$$('[data-mz-sabit]')).length === 2 && !(await p.$('[data-mz-oner]')));
  await p.click('[data-mz-ara]'); await p.keyboard.type('cat6');
  await p.waitForFunction(() => (document.querySelector('.secici-liste .secici-oge')?.textContent || '').includes('Cat 6 UTP') || (document.querySelector('.secici-liste .secici-oge')?.textContent || '').includes('CAT6'));
  kontrol('Arama sonuçları yalnız eşleşenler', await p.$$eval('.secici-liste .secici-oge', (x) => x.every((e) => /cat ?6/i.test(e.textContent))));
  const kutu = await p.$eval('[data-mz-ara]', (e) => e.getBoundingClientRect().bottom);
  const lst = await p.$eval('.secici-liste', (e) => e.getBoundingClientRect().top);
  kontrol('Liste yazılan kutunun hemen altında', Math.abs(lst - kutu) < 12, { kutu, lst });
  kontrol('Liste ekranın altına yapışık değil (tel-alt)', await p.$eval('.secici-liste', (e) => e.classList.contains('tel-alt')));
  if (process.env.EKRAN) await p.screenshot({ path: '/tmp/mz_liste.png' });
  await p.click('.secici-liste .secici-oge:has-text("Cat 6 UTP")');
  await p.waitForSelector('.mz-satir');
  kontrol('Seçilince 1 adet eklendi, kutu boşaldı', (await p.$$('.mz-satir')).length === 1 && (await p.inputValue('[data-mz-ara]')) === '');
  kontrol('Eklemede "Geri al" düğmesi yok', !(await p.$('.bildirim-eylem')));
  await p.click('.mz-satir [data-mz-arttir]'); await p.waitForTimeout(500);
  kontrol('+ ile miktar 2', (await p.textContent('.mz-satir .mz-sayi')).startsWith('2'));
  kontrol('Metre için hızlı düğmeler', (await p.$$('.mz-satir [data-mz-ayarla]')).length === 4);
  await p.click('.mz-satir [data-mz-ayarla="20"]'); await p.waitForTimeout(500);
  kontrol('Hızlı 20', (await p.textContent('.mz-satir .mz-sayi')).startsWith('20'));
  await p.click('.mz-satir [data-mz-yaz]'); await p.waitForSelector('dialog.pencere[open] input');
  await p.fill('dialog.pencere[open] input', '1'); await p.click('dialog.pencere[open] button[type=submit]'); await p.waitForTimeout(600);
  kontrol('Miktarı elle 1 yaptı', (await p.textContent('.mz-satir .mz-sayi')).startsWith('1'));
  await p.click('.mz-satir [data-mz-azalt]'); await p.waitForTimeout(600);
  kontrol('1\'de 🗑 → satır çıktı', !(await p.$('.mz-satir')));
  kontrol('Çıkarınca "Geri al" var', await p.isVisible('.bildirim-eylem'));
  await p.locator('.bildirim-eylem').last().click(); await p.waitForSelector('.mz-satir');
  kontrol('Geri al → satır geri geldi', (await p.textContent('.mz-satir .mz-sayi')).startsWith('1'));
  await p.click('.mz-satir [data-mz-azalt]'); await p.waitForTimeout(600);
  if (process.env.EKRAN) await p.screenshot({ path: '/tmp/mz_is.png', fullPage: true });
  // Sabit çipler: "Servis" ve "Kurulum İşçiliği" ayrı; hizmet kartı açılır / eklenir, stok tutulmaz
  await p.waitForSelector('[data-mz-sabit="kurulum"]');
  kontrol('İki sabit çip: Servis, Kurulum İşçiliği', (await p.$$eval('[data-mz-sabit]', (x) => x.map((e) => e.textContent.trim()))).join('|') === '+ Servis|+ Kurulum İşçiliği');
  await p.click('[data-mz-sabit="kurulum"]'); await p.waitForSelector('.mz-satir:has-text("Kurulum İşçiliği")');
  await p.click('[data-mz-sabit="servis"]'); await p.waitForSelector('.mz-satir:has-text("Servis")');
  const hz = (await y('GET', '/urunler?q=kurulum')).veri.find((u) => u.ad === 'Kurulum İşçiliği');
  kontrol('Kurulum İşçiliği hizmet kartı açıldı', hz && hz.tur === 'hizmet');
  await p.click('[data-mz-sabit="kurulum"]'); await p.waitForTimeout(500);
  kontrol('İkinci dokunuş aynı kartı kullanır (tek satır × 2)', (await y('GET', '/urunler?q=kurulum')).veri.filter((u) => u.ad === 'Kurulum İşçiliği').length === 1
    && (await p.textContent('.mz-satir:has-text("Kurulum İşçiliği") .mz-sayi')).startsWith('2'));
  // Ofis: Teslim et / Tamamla → özet (kalem tablosu kapalı), teslim bilgisi zorunlu, fişe geçer
  await p.click('[data-a="teslimet"]'); await p.waitForSelector('dialog.pencere[open] .te-malzeme');
  kontrol('Teslim et: malzeme özeti var, kalem tablosu kapalı', await p.$eval('dialog.pencere[open] .te-ek', (e) => e.hidden));
  kontrol('Düğme: "Tamamla ve satış fişine geç"', (await p.textContent('dialog.pencere[open] button[type=submit]')).includes('satış fişine geç'));
  await p.fill('dialog.pencere[open] [name=teslim_alan_ad]', ''); await p.fill('dialog.pencere[open] [name=teslim_alan_tel]', '');
  await p.click('dialog.pencere[open] button[type=submit]'); await p.waitForTimeout(400);
  kontrol('Teslim bilgisi boşken kapanmaz', /Kime teslim/.test(await p.textContent('dialog.pencere[open]')));
  await p.fill('dialog.pencere[open] [name=teslim_alan_ad]', 'Ayşe Hanım');
  await p.click('dialog.pencere[open] button[type=submit]');
  await p.waitForSelector('.mf-ust');
  const fisMetin = await p.textContent('.mf-kalemler');
  kontrol('Satış fişine geçildi; servis ve işçilik fişte', fisMetin.includes('Kurulum İşçiliği') && /Servis/.test(fisMetin));
  kontrol('Sayfa hatası yok', !hatalar.length, hatalar);
  await b.close();
  console.log(hata ? `\n${hata} KONTROL BAŞARISIZ` : '\nTÜM KONTROLLER BAŞARILI');
  process.exit(hata ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
