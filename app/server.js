'use strict';
// Servis Takip - uygulama sunucusu (bağımlılıksız Node.js)
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { Havuz } = require('./lib/pg');
const { semaGuncelle } = require('./lib/sema');
const web = require('./lib/web');
const oturum = require('./lib/oturum');

const AYAR = {
  port: Number(process.env.PORT || 3000),
  dbUrl: process.env.DATABASE_URL || 'postgres://servis:servis@127.0.0.1:5432/servis',
  dbKlasor: process.env.DB_KLASOR || path.join(__dirname, '..', 'db'),
  dosyaKlasor: process.env.DOSYA_KLASOR || '/data/dosyalar',
  public: path.join(__dirname, 'public'),
  guvenliCerez: process.env.GUVENLI_CEREZ !== '0',
  govdeSiniri: 20 * 1024 * 1024,
};

const db = new Havuz(AYAR.dbUrl, 10);
const r = new web.Yonlendirici();

// ---------- Yetki ----------
const girisGerekli = (req) => { if (!req.kullanici) throw web.hata(401, 'Oturum açmanız gerekiyor.'); };
const yonetici = (req) => {
  girisGerekli(req);
  if (req.kullanici.rol !== 'yonetici') throw web.hata(403, 'Bu işlem için yetkiniz yok.');
};

const ctx = { db, AYAR, web, oturum, G: girisGerekli, Y: yonetici };
for (const modul of ['giris', 'isler', 'takvim', 'cariler', 'urunler', 'fisler', 'alis', 'finans', 'raporlar', 'ayarlar']) {
  require(`./routes/${modul}`)(r, ctx);
}

// ---------- Hata çevirisi ----------
function hataYaz(res, e) {
  if (e instanceof web.IstekHatasi) return web.json(res, e.durum, { hata: e.message, kod: e.kod });
  if (e.pg) {
    if (e.ipucu) return web.json(res, 400, { hata: e.message, kod: e.ipucu });           // bizim iş kuralları
    if (e.kod === '23505') return web.json(res, 409, { hata: 'Bu kayıt zaten var (aynı kod/numara kullanılmış).', kod: 'TEKRAR' });
    if (e.kod === '23503') return web.json(res, 400, { hata: 'Bağlı kayıt bulunamadı veya kayıt başka yerde kullanılıyor.', kod: 'BAGLANTI' });
    if (e.kod === '23514' || e.kod === '22P02' || e.kod === '22007' || e.kod === '22008' || e.kod === '23502') {
      return web.json(res, 400, { hata: 'Girilen bilgiler geçersiz veya eksik.', kod: 'GECERSIZ', detay: e.message });
    }
  }
  console.error(new Date().toISOString(), e);
  web.json(res, 500, { hata: 'Beklenmeyen bir hata oluştu. Tekrar deneyin.' });
}

// ---------- İstek işleme ----------
async function isle(req, res) {
  const url = new URL(req.url, 'http://x');
  const yol = url.pathname;
  req.ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const cerez = web.cerezler(req);
  req.token = cerez.oturum;

  if (yol === '/saglik') {
    await db.query('SELECT 1');
    return web.json(res, 200, { durum: 'ok' });
  }

  if (yol.startsWith('/api/')) {
    const bulunan = r.bul(req.method, yol.slice(4));
    if (!bulunan) throw web.hata(404, 'Bulunamadı');
    if (bulunan === 'yontem') throw web.hata(405, 'Yöntem desteklenmiyor');
    // CSRF koruması: değiştiren istekler sadece kendi arayüzümüzden (özel başlıkla) gelebilir
    if (req.method !== 'GET' && req.headers['x-istek'] !== '1') throw web.hata(403, 'Geçersiz istek kaynağı.');
    req.kullanici = await oturum.oturumBul(db, req.token);
    req.params = bulunan.params;
    req.query = Object.fromEntries(url.searchParams);
    req.body = req.method === 'GET' ? {} : await web.govdeOku(req, AYAR.govdeSiniri);
    let sonuc;
    for (const f of bulunan.y.isleyiciler) sonuc = await f(req, res);
    if (!res.headersSent) web.json(res, 200, sonuc === undefined ? { tamam: true } : sonuc);
    return;
  }

  // Yüklenen dosyalar (imza, fotoğraf) sadece giriş yapmış kullanıcılara
  if (yol.startsWith('/dosya/')) {
    const k = await oturum.oturumBul(db, req.token);
    if (!k) { res.writeHead(401); return res.end('Yetkisiz'); }
    const dosya = web.guvenliYol(AYAR.dosyaKlasor, decodeURIComponent(yol.slice(7)));
    if (!dosya) { res.writeHead(404); return res.end(); }
    return web.dosyaGonder(res, dosya, 'private, max-age=86400');
  }

  // Arayüz dosyaları
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  const dosya = web.guvenliYol(AYAR.public, yol === '/' ? '/index.html' : yol);
  if (dosya && fs.existsSync(dosya) && fs.statSync(dosya).isFile()) {
    const uzun = /\.(png|svg|ico|webp)$/.test(dosya) ? 'public, max-age=604800' : 'no-cache';
    return web.dosyaGonder(res, dosya, uzun);
  }
  // Tek sayfa uygulama: bilinmeyen yollar index.html'e
  return web.dosyaGonder(res, path.join(AYAR.public, 'index.html'));
}

const sunucu = http.createServer((req, res) => {
  isle(req, res).catch((e) => { if (!res.headersSent) hataYaz(res, e); else res.end(); });
});

async function basla() {
  fs.mkdirSync(AYAR.dosyaKlasor, { recursive: true });
  // Veritabanı hazır olana kadar bekle (ilk açılışta birkaç saniye sürebilir)
  for (let deneme = 1; ; deneme++) {
    try { await db.query('SELECT 1'); break; } catch (e) {
      if (deneme >= 30) throw e;
      console.log(`Veritabanı bekleniyor (${deneme})... ${e.message}`);
      await new Promise((c) => setTimeout(c, 2000));
    }
  }
  await semaGuncelle(db, AYAR.dbKlasor);
  sunucu.listen(AYAR.port, () => console.log(`Servis Takip ${AYAR.port} portunda çalışıyor`));
}

process.on('SIGTERM', () => sunucu.close(() => db.kapat().then(() => process.exit(0))));
basla().catch((e) => { console.error('Başlatılamadı:', e); process.exit(1); });

module.exports = { sunucu, db };
