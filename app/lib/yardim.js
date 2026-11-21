'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { hata } = require('./web');

// Zorunlu alan kontrolü
function zorunlu(govde, alanlar) {
  for (const [alan, ad] of Object.entries(alanlar)) {
    const v = govde[alan];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) throw hata(400, `${ad} zorunludur.`, 'EKSIK');
  }
}

const bos = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const metin = (v) => (bos(v) ? null : String(v).trim());
// Türkçe sayı biçimi: "5.000" = 5000, "1.250,50" = 1250.5, "12,5" = 12.5, "12.5" = 12.5
function sayiCoz(s) {
  let t = String(s).replace(/[\s₺TL]/gi, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return t === '' ? NaN : Number(t);
}
function sayi(v, ad = 'Sayı') {
  if (bos(v)) return null;
  const n = typeof v === 'number' ? v : sayiCoz(v);
  if (!Number.isFinite(n)) throw hata(400, `${ad} geçerli bir sayı değil.`, 'GECERSIZ');
  return n;
}
function pozitif(v, ad) {
  const n = sayi(v, ad);
  if (n === null || n <= 0) throw hata(400, `${ad} sıfırdan büyük olmalı.`, 'GECERSIZ');
  return n;
}
function tarih(v) {
  if (bos(v)) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(v))) throw hata(400, 'Tarih geçersiz.', 'GECERSIZ');
  return String(v);
}

// data:image/...;base64 biçimindeki görseli diske yazar, göreli yolu döndürür
function gorselKaydet(kok, veriUrl, altKlasor) {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(veriUrl || ''));
  if (!m) throw hata(400, 'Görsel biçimi geçersiz.', 'GECERSIZ');
  const veri = Buffer.from(m[2], 'base64');
  if (veri.length > 12 * 1024 * 1024) throw hata(413, 'Görsel çok büyük.');
  const uzanti = m[1] === 'jpeg' ? 'jpg' : m[1];
  const simdi = new Date();
  const goreli = path.posix.join(altKlasor, String(simdi.getFullYear()), String(simdi.getMonth() + 1).padStart(2, '0'),
    `${crypto.randomUUID()}.${uzanti}`);
  const tam = path.join(kok, goreli);
  fs.mkdirSync(path.dirname(tam), { recursive: true });
  fs.writeFileSync(tam, veri);
  return goreli;
}

// Telefondan yazılan mesajdan telefon numarasını ve başlığı ayıklar
const TEL_RX = /(?:\+?90[\s.-]?)?\(?0?([2-5]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{2})[\s.-]?(\d{2})/;
function mesajCoz(mesaj) {
  const ham = String(mesaj || '').trim();
  const m = TEL_RX.exec(ham);
  const telefon = m ? `0${m[1]}${m[2]}${m[3]}${m[4]}` : null;
  let baslik = (m ? ham.replace(m[0], ' ') : ham).split('\n').map((s) => s.trim()).find(Boolean) || ham;
  baslik = baslik.replace(/\s{2,}/g, ' ').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '');
  if (baslik.length > 90) baslik = baslik.slice(0, 87).trimEnd() + '…';
  return { telefon, baslik: baslik || 'Yeni iş' };
}

// Sadece izin verilen alanları alır
function sec(govde, alanlar) {
  const s = {};
  for (const a of alanlar) if (Object.prototype.hasOwnProperty.call(govde, a)) s[a] = govde[a] === '' ? null : govde[a];
  return s;
}

// {a:1,b:2} -> "a = $2, b = $3" (güncelleme sorgusu için)
function setIfadesi(alanlar, baslangic = 1) {
  const anahtarlar = Object.keys(alanlar);
  return {
    ifade: anahtarlar.map((a, i) => `${a} = $${i + baslangic}`).join(', '),
    degerler: anahtarlar.map((a) => alanlar[a]),
  };
}

const DOVIZLER = ['TRY', 'USD', 'EUR'];
const doviz = (d, varsayilan = 'TRY') => (DOVIZLER.includes(d) ? d : varsayilan);

module.exports = { doviz, DOVIZLER, zorunlu, bos, metin, sayi, sayiCoz, pozitif, tarih, gorselKaydet, mesajCoz, sec, setIfadesi };
