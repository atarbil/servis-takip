'use strict';
// Küçük HTTP yardımcıları: yönlendirici, JSON gövde, çerez, statik dosya.
const fs = require('node:fs');
const path = require('node:path');

class IstekHatasi extends Error {
  constructor(durum, mesaj, kod) { super(mesaj); this.durum = durum; this.kod = kod; }
}
const hata = (durum, mesaj, kod) => new IstekHatasi(durum, mesaj, kod);

class Yonlendirici {
  constructor() { this.yollar = []; }
  ekle(yontem, desen, ...isleyiciler) {
    const adlar = [];
    const rx = new RegExp('^' + desen.replace(/:(\w+)/g, (_, a) => { adlar.push(a); return '([^/]+)'; }) + '/?$');
    this.yollar.push({ yontem, rx, adlar, isleyiciler });
  }
  get(d, ...f) { this.ekle('GET', d, ...f); }
  post(d, ...f) { this.ekle('POST', d, ...f); }
  put(d, ...f) { this.ekle('PUT', d, ...f); }
  delete(d, ...f) { this.ekle('DELETE', d, ...f); }
  bul(yontem, yol) {
    let yolVar = false;
    for (const y of this.yollar) {
      const m = yol.match(y.rx);
      if (!m) continue;
      yolVar = true;
      if (y.yontem !== yontem) continue;
      const params = {};
      y.adlar.forEach((a, i) => { params[a] = decodeURIComponent(m[i + 1]); });
      return { y, params };
    }
    return yolVar ? 'yontem' : null;
  }
}

function govdeOku(req, sinir) {
  return new Promise((coz, reddet) => {
    let boyut = 0; const parcalar = [];
    req.on('data', (d) => {
      boyut += d.length;
      if (boyut > sinir) { reddet(hata(413, 'Gönderilen veri çok büyük.')); req.destroy(); return; }
      parcalar.push(d);
    });
    req.on('end', () => {
      if (!parcalar.length) return coz({});
      try { coz(JSON.parse(Buffer.concat(parcalar).toString('utf8'))); } catch { reddet(hata(400, 'Geçersiz JSON')); }
    });
    req.on('error', reddet);
  });
}

function cerezler(req) {
  const c = {};
  for (const p of (req.headers.cookie || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) c[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return c;
}

function json(res, durum, veri) {
  const govde = JSON.stringify(veri);
  res.writeHead(durum, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(govde);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.pdf': 'application/pdf',
};

function dosyaGonder(res, dosya, onbellek) {
  fs.stat(dosya, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('Bulunamadı'); }
    res.writeHead(200, {
      'content-type': MIME[path.extname(dosya).toLowerCase()] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': onbellek || 'no-cache',
    });
    fs.createReadStream(dosya).pipe(res);
  });
}

// Kök dizinin dışına çıkmayı engeller
function guvenliYol(kok, istenen) {
  const tam = path.resolve(kok, '.' + path.posix.normalize('/' + istenen));
  return tam.startsWith(path.resolve(kok) + path.sep) ? tam : null;
}

module.exports = { Yonlendirici, IstekHatasi, hata, govdeOku, cerezler, json, dosyaGonder, guvenliYol };
