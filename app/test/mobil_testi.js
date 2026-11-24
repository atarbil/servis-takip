// Telefon görünümü testi (api_testi.js sonrası, aynı veritabanıyla):
//   node test/mobil_testi.js http://127.0.0.1:3100
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const T = process.argv[2] || 'http://127.0.0.1:3100';
let hata = 0;
const kontrol = (ad, ok, ek) => { console.log(ok ? 'OK  ' : 'HATA', ad, ok ? '' : (ek ?? '')); if (!ok) hata++; };

async function giris(s) {
  await s.goto(T); await s.fill('[name=kullanici_adi]', 'Patron'); await s.fill('[name=sifre]', '12345678');
  await s.click('#giris-form button'); await s.waitForSelector('#sayfa');
}

(async () => {
  const tarayici = await chromium.launch();
  const s = await (await tarayici.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  s.on('pageerror', (e) => { hata++; console.log('SAYFA HATASI', e.message); });
  await giris(s);

  // Cariler: + düğmesi, ⋯ menüsü, başlık tekrarı yok, sıkı liste
  await s.goto(`${T}/#/cariler`); await s.waitForSelector('.tablo.mobil-kart tbody tr');
  await s.waitForTimeout(300);
  kontrol('+ düğmesi görünür', await s.isVisible('#mb-fab'));
  kontrol('Sayfa içi "+ Yeni cari" gizli', !(await s.isVisible('.sayfa-ust .btn.birincil')));
  kontrol('Başlık tekrarı gizli', !(await s.isVisible('.sayfa-ust h2')));
  const satirH = await s.$eval('.tablo.mobil-kart tbody tr', (e) => e.getBoundingClientRect().height);
  kontrol(`Liste satırı sıkı (${Math.round(satirH)} px)`, satirH < 90);
  await s.click('.ust-cubuk .mb-daha');
  kontrol('⋯ menüsünde Excel', (await s.textContent('#mb-menu')).includes('Excel'));
  await s.click('body', { position: { x: 20, y: 400 } });
  kontrol('⋯ menüsü dışarı dokununca kapanır', !(await s.isVisible('#mb-menu')));

  // + → tam ekran pencere; geri tuşu pencereyi kapatır, sayfa değişmez
  await s.click('#mb-fab');
  await s.waitForSelector('dialog.pencere[open]');
  const gen = await s.$eval('dialog.pencere[open]', (d) => d.getBoundingClientRect().width);
  kontrol('Pencere tam ekran', gen >= 389, gen);
  await s.goBack(); await s.waitForTimeout(400);
  kontrol('Geri tuşu pencereyi kapattı, sayfa aynı', !(await s.$('dialog[open]')) && (await s.evaluate(() => location.hash)) === '#/cariler');
  // Vazgeç ile kapatınca geçmiş temizlenir: geri tuşu önceki sayfaya gider
  await s.click('#mb-fab'); await s.waitForSelector('dialog.pencere[open]');
  await s.click('dialog.pencere[open] .vazgec'); await s.waitForTimeout(300);
  kontrol('Vazgeç sonrası pencere kapalı', !(await s.$('dialog[open]')));

  // Filtre
  await s.goto(`${T}/#/fisler`); await s.waitForSelector('.mb-filtre-dugme');
  kontrol('Filtre kapalıyken durum seçimi gizli', !(await s.isVisible('.filtre select')));
  await s.click('.mb-filtre-dugme');
  kontrol('Filtre açılınca durum seçimi görünür', await s.isVisible('.filtre select'));
  await s.selectOption('.filtre select', { index: 1 });
  kontrol('Seçili filtre sayısı düğmede', (await s.textContent('.mb-filtre-dugme b')) === '1');

  // Taslak fiş: altta toplam + Kaydet / Onayla
  const id = await s.evaluate(async () => (await (await fetch('/api/fisler', { headers: { 'x-istek': '1' } })).json()).find((f) => f.durum === 'taslak')?.id);
  await s.goto(`${T}/#/fis/${id}`); await s.waitForSelector('#mb-alt:not([hidden])');
  kontrol('Alt çubukta genel toplam', /₺/.test(await s.textContent('#mb-alt')));
  kontrol('Alt çubukta Onayla', (await s.textContent('#mb-alt')).includes('Onayla'));
  kontrol('Fişte + düğmesi yok', !(await s.isVisible('#mb-fab')));
  await s.click('#mb-alt .btn.basari');
  await s.waitForSelector('dialog[open]');
  kontrol('Alt çubuktaki Onayla asıl düğmeyi çalıştırır (onay sorusu)', !!(await s.$('dialog[open]')));
  await s.goBack(); await s.waitForTimeout(300);

  // Bilgisayarda değişiklik yok
  const m = await (await tarayici.newContext({ viewport: { width: 1366, height: 800 } })).newPage();
  await giris(m);
  await m.goto(`${T}/#/cariler`); await m.waitForSelector('.tablo tbody tr'); await m.waitForTimeout(300);
  kontrol('Bilgisayarda + düğmesi yok', !(await m.isVisible('#mb-fab')));
  kontrol('Bilgisayarda "+ Yeni cari" yerinde', await m.isVisible('.sayfa-ust .btn.birincil'));
  kontrol('Bilgisayarda filtreler açık', await m.isVisible('.filtre select'));

  // Üst çubuk "+ Satış fişi": cari seç → taslak fiş açılır, imleç ilk satırın ürün kutusunda
  kontrol('"+ Satış fişi" düğmesi "+ İş ekle"nin yanında', await m.isVisible('#btn-fis') && (await m.textContent('#btn-fis')).includes('Satış fişi'));
  await m.click('#btn-fis'); await m.waitForSelector('dialog[open] #yf-cari');
  await m.keyboard.press('Escape'); // açılan cari listesini kapat
  await m.click('dialog[open] button[type=submit]');
  kontrol('Cari seçmeden fiş açılmaz', (await m.textContent('dialog[open] .pencere-hata')).includes('cari'));
  await m.fill('dialog[open] #yf-cari', 'ahmet'); await m.waitForSelector('.secici-liste .secici-oge[data-i]');
  await m.keyboard.press('Enter');
  await m.click('dialog[open] button[type=submit]');
  await m.waitForURL(/#\/fis\/\d+/); await m.waitForSelector('tr[data-i="0"] .urun-ara');
  await m.waitForTimeout(200);
  kontrol('Fiş açıldı, imleç ilk satırın ürün kutusunda', await m.evaluate(() => document.activeElement?.classList.contains('urun-ara')));
  kontrol('Fişin carisi seçilen cari', (await m.inputValue('#f-cari')).toLowerCase().includes('ahmet'));
  // Cari kartındayken o cari hazır gelir
  const cid = await m.evaluate(async () => (await (await fetch('/api/cariler', { headers: { 'x-istek': '1' } })).json())[0].id);
  await m.goto(`${T}/#/cari/${cid}`); await m.waitForTimeout(600);
  await m.click('#btn-fis'); await m.waitForSelector('dialog[open] #yf-cari');
  kontrol('Cari kartındayken cari hazır seçili', (await m.inputValue('dialog[open] #yf-cari')).length > 0);
  await m.click('dialog[open] .vazgec');

  await tarayici.close();
  console.log(hata ? `MOBİL TEST: ${hata} HATA` : 'MOBİL TEST BAŞARILI');
  process.exit(hata ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
