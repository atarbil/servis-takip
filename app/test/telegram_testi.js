// Telegram botu uçtan uca testi: sahte Telegram API sunucusu + gerçek uygulama + boş veritabanı.
//   DATABASE_URL=... node test/telegram_testi.js
'use strict';
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const TOKEN = '123456:TEST-anahtar';
const API_PORT = 3199;
const APP_PORT = 3198;
const APP = `http://127.0.0.1:${APP_PORT}`;
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek) : ''); } };

// ---------- Sahte Telegram ----------
const bekleyen = []; let sonId = 100; const gonderilen = []; let komutlar = null; const bekleyenler = [];
function guncellemeEkle(from, metin, ek = {}) {
  bekleyen.push({ update_id: ++sonId, message: { message_id: sonId, from, chat: { id: from.id, type: ek.tur || 'private' }, date: 0, text: metin, ...ek.mesaj } });
  while (bekleyenler.length) bekleyenler.shift()();
}
const sahte = http.createServer((req, res) => {
  let g = ''; req.on('data', (d) => { g += d; });
  req.on('end', () => {
    const govde = g ? JSON.parse(g) : {};
    const [, token, metod] = req.url.match(/^\/bot([^/]+)\/(\w+)/) || [];
    const yaz = (sonuc) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(sonuc)); };
    if (token !== TOKEN) return yaz({ ok: false, error_code: 401, description: 'Unauthorized' });
    if (metod === 'getMe') return yaz({ ok: true, result: { id: 999, is_bot: true, first_name: 'Servis', username: 'deneme_servis_bot' } });
    if (metod === 'setMyCommands') { komutlar = govde.commands; return yaz({ ok: true, result: true }); }
    if (metod === 'sendMessage') { gonderilen.push(govde); return yaz({ ok: true, result: { message_id: Date.now() } }); }
    if (metod === 'getUpdates') {
      let cevaplandi = false;
      const ver = () => { if (cevaplandi) return; cevaplandi = true; yaz({ ok: true, result: bekleyen.filter((u) => u.update_id >= (govde.offset || 0)) }); };
      if (bekleyen.some((u) => u.update_id >= (govde.offset || 0))) return ver();
      const z = setTimeout(ver, 800); bekleyenler.push(() => { clearTimeout(z); ver(); });
      return undefined;
    }
    return yaz({ ok: false, description: 'bilinmeyen metod' });
  });
});

// ---------- Uygulama istemcisi ----------
let cerez = '';
async function api(yontem, yol, govde) {
  const r = await fetch(APP + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
  return { durum: r.status, veri: await r.json().catch(() => null) };
}
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));
async function cevapBekle(sohbet, onceki) {
  for (let i = 0; i < 40; i++) { const c = gonderilen.filter((m) => m.chat_id === sohbet); if (c.length > onceki) return c.at(-1).text; await bekle(100); }
  return null;
}
// Belirli içerikte bir mesaj gelene kadar bekler
async function mesajBekle(sohbet, desen, ms = 5000) {
  for (let i = 0; i < ms / 100; i++) { const m = gonderilen.find((x) => x.chat_id === sohbet && desen.test(x.text) && !x._alindi); if (m) { m._alindi = true; return m.text; } await bekle(100); }
  return null;
}
async function yaz(from, metin, ek) {
  const once = gonderilen.filter((m) => m.chat_id === from.id).length;
  guncellemeEkle(from, metin, ek);
  return cevapBekle(from.id, once);
}

(async () => {
  await new Promise((c) => sahte.listen(API_PORT, c));
  const uyg = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(APP_PORT), TELEGRAM_TOKEN: TOKEN, TELEGRAM_API: `http://127.0.0.1:${API_PORT}`, TELEGRAM_ZAMANLAYICI_MS: '400', ALAN_ADI: 'servis.ornek.com', GUVENLI_CEREZ: '0', DOSYA_KLASOR: '/tmp/tg-dosyalar' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = ''; uyg.stdout.on('data', (d) => { log += d; }); uyg.stderr.on('data', (d) => { log += d; });
  const bitir = (kod) => { uyg.kill('SIGTERM'); sahte.close(); process.exit(kod); };
  try {
    for (let i = 0; i < 50 && !/çalışıyor/.test(log); i++) await bekle(200);

    // Hazırlık: yönetici, teknisyen, müşteri
    await api('POST', '/ilk-kurulum', { ad_soyad: 'Murat Atar', kullanici_adi: 'murat', sifre: 'Sifre1234' });
    const ekip = (await api('GET', '/ekipler')).veri[0];
    const tek = (await api('POST', '/kullanicilar', { ad_soyad: 'Mehmet Usta', kullanici_adi: 'mehmet', sifre: 'Usta12345', rol: 'teknisyen', ekip_id: ekip.id })).veri;
    const musteri = (await api('POST', '/cariler', { unvan: 'Ahmet Market', telefon: '0532 111 22 33', adres: 'Moda Cad. 12' })).veri;
    // Test sırasında zamanlanmış özet araya girmesin
    await api('PUT', '/telegram/bildirimler', { bildirimler: {}, sabah_saat: '23:59', aksam_saat: '23:59' });

    for (let i = 0; i < 30 && !/@deneme_servis_bot/.test(log); i++) await bekle(200);
    let d = (await api('GET', '/telegram')).veri;
    kontrol('Bot çalışıyor ve adını biliyor', d.yapilandirildi && d.bot.calisiyor && d.bot.kullanici_adi === 'deneme_servis_bot', d);
    kontrol('Telegram komut menüsü ayarlandı', komutlar?.length === 3, komutlar);

    const murat = { id: 5001, first_name: 'Murat', last_name: 'Atar', username: 'muratatar' };
    const yabanci = { id: 6001, first_name: 'Yabancı' };
    const usta = { id: 7001, first_name: 'Mehmet' };

    let c = await yaz(yabanci, '/start');
    kontrol('Bağlı olmayan kişiye /start: bağlama talimatı', /\/baglan KOD/.test(c), c);
    c = await yaz(yabanci, 'Bana bir iş aç 0532 111 22 33');
    kontrol('Bağlı olmayan kişinin mesajı işe çevrilmedi', /bağlı değil/.test(c), c);
    kontrol('Havuz boş kaldı', (await api('GET', '/havuz')).veri.length === 0);

    c = await yaz(murat, '/baglan YANLIS123');
    kontrol('Yanlış kod reddedildi', /geçersiz/.test(c), c);
    const kod = (await api('POST', '/telegram/kod')).veri;
    kontrol('Bağlama kodu üretildi', /^[A-Z2-9]{8}$/.test(kod.kod) && kod.bot === 'deneme_servis_bot', kod);
    c = await yaz(murat, `/baglan ${kod.kod.toLowerCase()}`);
    kontrol('Doğru kodla hesap bağlandı (küçük harf de kabul)', /bağlandı.*Murat Atar/s.test(c), c);
    c = await yaz(yabanci, `/baglan ${kod.kod}`);
    kontrol('Aynı kod ikinci kez kullanılamaz', /geçersiz/.test(c), c);
    d = (await api('GET', '/telegram')).veri;
    kontrol('Ayarlar ekranında bağlı hesap görünüyor', d.benim?.ad === 'Murat Atar (@muratatar)' && d.bagli_hesaplar.length === 1, d);

    c = await yaz(murat, 'Ahmet bey 4 kamera görüntü gelmiyor\n0532 111 22 33 akşam 5ten sonra');
    kontrol('Mesaj havuza eklendi, müşteri telefondan eşleşti', /Havuza eklendi.*#1.*Ahmet bey 4 kamera görüntü gelmiyor.*Ahmet Market.*eşleşti/s.test(c), c);
    kontrol('Cevapta programdaki işin bağlantısı var', c.includes('https://servis.ornek.com/#/is/1'), c);
    c = await yaz(murat, 'ACİL: Zeynep Hanım Ataşehir DVR kayıt yapmıyor 0544 777 88 99');
    kontrol('"Acil" ile başlayan mesaj acil, kayıtsız numara belirtildi', /Acil/.test(c) && /05447778899.*bulunamadı/s.test(c), c);
    c = await yaz(murat, '', { mesaj: { text: undefined, contact: { phone_number: '+905321112233', first_name: 'Ahmet', last_name: 'Bey' } } });
    kontrol('Rehberden paylaşılan kişiyle iş açıldı', /Havuza eklendi.*Ahmet Market/s.test(c), c);
    c = await yaz(murat, '', { mesaj: { text: undefined, photo: [{ file_id: 'x' }] } });
    kontrol('Yazısız fotoğraf işe çevrilmedi', /yazılı mesaj/.test(c), c);
    c = await yaz(murat, 'Grup mesajı', { tur: 'group' });
    kontrol('Grup sohbetinden gelen mesaj yok sayıldı', c === null, c);

    const havuz = (await api('GET', '/havuz')).veri;
    kontrol('Havuzda 3 iş var', havuz.length === 3, havuz.map((h) => h.baslik));
    const acil = havuz.find((h) => h.oncelik === 1);
    kontrol('Acil iş başlığından "ACİL:" temizlendi', acil?.baslik === 'Zeynep Hanım Ataşehir DVR kayıt yapmıyor', acil?.baslik);
    const is1 = (await api('GET', '/isler/1')).veri;
    kontrol('İş kaynağı telegram, cari ve adres bağlı', is1.kaynak === 'telegram' && is1.cari_id === musteri.id && is1.adres === 'Moda Cad. 12', { k: is1.kaynak, c: is1.cari_id, a: is1.adres });

    c = await yaz(murat, '/havuz');
    kontrol('/havuz listesi', /Havuzda 3 iş bekliyor/.test(c) && /🔴 #2/.test(c), c);
    await api('POST', '/isler/1/planla', { ekip_id: ekip.id, baslangic: new Date(Date.now() + 3600000).toISOString() });
    c = await yaz(murat, '/bugun');
    const bugunMu = new Date(Date.now() + 3600000).toDateString() === new Date().toDateString();
    kontrol('/bugun listesi', bugunMu ? /Bugünkü işler \(1\)/.test(c) : /planlanmış iş yok/.test(c), c);
    c = await yaz(murat, '/bilinmeyen');
    kontrol('Bilinmeyen komut', /Bilinmeyen komut/.test(c), c);
    c = await yaz(murat, '<script>alert(1)</script> & test 0532 000 00 00');
    kontrol('HTML karakterleri güvenli gönderildi', c.includes('&lt;script&gt;') && !c.includes('<script>'), c);

    // ---------- Bildirimler ----------
    cerez = '';
    await api('POST', '/giris', { kullanici_adi: 'mehmet', sifre: 'Usta12345' });
    await api('POST', '/isler/1/baslat');
    await api('POST', '/isler/1/tanimsiz-urun', { ad: 'Özel adaptör 12V', miktar: 2, not: 'Ahmet beyin deposundan' });
    c = await mesajBekle(murat.id, /tanımsız ürün/);
    kontrol('Tanımsız ürün bildirimi yöneticiye gitti', c && /Özel adaptör 12V/.test(c) && /Mehmet Usta/.test(c) && /#\/urun\//.test(c), c);
    await api('POST', '/isler/1/teslim', { teslim_alan_ad: 'Ahmet Bey', imza: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' });
    await api('POST', '/isler/1/tamamla', { not: 'bitti' });
    c = await mesajBekle(murat.id, /İş tamamlandı/);
    kontrol('İş tamamlandı bildirimi (fiyatlandırma bekliyor)', c && /#1/.test(c) && /Ahmet Market/.test(c) && /Fiyatlandırma bekliyor/.test(c) && /teslim alan: Ahmet Bey/.test(c), c);
    cerez = '';
    await api('POST', '/giris', { kullanici_adi: 'murat', sifre: 'Sifre1234' });
    kontrol('Sabah planı elle gönderildi', (await api('POST', '/telegram/ozet', { tur: 'sabah' })).durum === 200);
    c = await mesajBekle(murat.id, /Günaydın/);
    kontrol('Sabah planı içeriği', c && /Havuzda: <b>3<\/b>/.test(c) && /Fiyatlandırma bekleyen: <b>1<\/b>/.test(c), c);
    await api('POST', '/telegram/ozet', { tur: 'aksam' });
    c = await mesajBekle(murat.id, /Günün özeti/);
    kontrol('Akşam özeti: biten iş listede', c && /Tamamlanan iş: 1/.test(c) && /#1 /.test(c), c);
    // Tercih kapalıysa gönderilmez
    await api('PUT', '/telegram/bildirimler', { bildirimler: { is_tamamlandi: false, urun_onay: false, sabah: true, aksam: true } });
    cerez = '';
    await api('POST', '/giris', { kullanici_adi: 'mehmet', sifre: 'Usta12345' });
    await api('POST', '/isler/1/tanimsiz-urun', { ad: 'Kapalı bildirim ürünü', miktar: 1 }).catch(() => {});
    cerez = '';
    await api('POST', '/giris', { kullanici_adi: 'murat', sifre: 'Sifre1234' });
    kontrol('Kapatılan bildirim gönderilmedi', (await mesajBekle(murat.id, /Kapalı bildirim/, 1200)) === null);
    // Zamanlayıcı: sabah saati şimdiye ayarlanınca bir kez gönderir
    const simdi = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    await api('PUT', '/telegram/bildirimler', { bildirimler: { sabah: true }, sabah_saat: simdi, aksam_saat: '23:59' });
    c = await mesajBekle(murat.id, /Günaydın/, 4000);
    kontrol('Zamanlanmış sabah planı gönderildi', !!c, c);
    await bekle(1500);
    kontrol('Sabah planı aynı gün ikinci kez gönderilmedi', (await mesajBekle(murat.id, /Günaydın/, 300)) === null);

    // Teknisyen bağlanırsa iş ekleyemez
    cerez = '';
    await api('POST', '/giris', { kullanici_adi: 'mehmet', sifre: 'Usta12345' });
    kontrol('Teknisyen bağlama kodu alamaz', (await api('POST', '/telegram/kod')).durum === 403);
    cerez = '';
    await api('POST', '/giris', { kullanici_adi: 'murat', sifre: 'Sifre1234' });
    // (yönetici, teknisyenin hesabını teknik olarak bağlamaya zorlarsa bile iş eklenemez)
    await fetch('http://x').catch(() => {});
    const { Havuz } = require('../lib/pg');
    const vt = new Havuz(process.env.DATABASE_URL, 1);
    await vt.query('UPDATE kullanicilar SET telegram_id = $1 WHERE id = $2', [usta.id, tek.id]);
    c = await yaz(usta, 'Bir iş 0532 111 22 33');
    kontrol('Bağlı teknisyenin mesajı işe çevrilmedi', /yetkiniz yok/.test(c), c);

    // Bağlantıyı kaldır
    await api('POST', '/telegram/kaldir');
    c = await yaz(murat, 'Bağlantı kaldırıldıktan sonra mesaj');
    kontrol('Bağlantı kaldırılınca mesaj reddedildi', /bağlı değil/.test(c), c);

    // Yeniden başlatmada aynı mesaj ikinci kez işlenmez
    const offset = (await vt.query("SELECT deger FROM ayarlar WHERE anahtar = 'telegram_offset'")).rows[0].deger;
    kontrol('Okunan son mesaj numarası kaydedildi', Number(offset) === sonId + 1, offset);
    await vt.kapat();

    kontrol('Uygulama günlüğünde hata yok', !/mesaj işlenemedi|döngü durdu|Error/.test(log), log.split('\n').filter((l) => /hata|Error/i.test(l)));
  } catch (e) { console.error(e); basarisiz++; }
  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nTÜM TELEGRAM TESTLERİ BAŞARILI');
  bitir(basarisiz ? 1 : 0);
})();
