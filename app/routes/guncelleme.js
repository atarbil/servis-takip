'use strict';
// "Programı güncelle": program sunucuda komut çalıştırmaz. Ortak klasöre (GUNCELLEME_KLASOR) istek dosyası bırakır;
// sunucudaki systemd servisi (scripts/guncelleme_servisi.sh) güncellemeyi yapar, sonucu aynı klasöre yazar.

const fs = require('fs');
const path = require('path');

const KURULUM = 'cd /opt/servis-takip && bash scripts/guncelleme_servisi_kur.sh';

module.exports = (r, { db, web, oturum, Y }) => {
  const K = process.env.GUNCELLEME_KLASOR || '/data/guncelleme';
  const yol = (ad) => path.join(K, ad);
  const oku = (ad) => { try { return fs.readFileSync(yol(ad), 'utf8'); } catch { return null; } };
  const yas = (ad) => { try { return (Date.now() - fs.statSync(yol(ad)).mtimeMs) / 1000; } catch { return null; } };

  const durumOku = () => {
    const t = oku('durum.txt'); if (!t) return null;
    const d = {};
    for (const satir of t.split('\n')) { const i = satir.indexOf('='); if (i > 0) d[satir.slice(0, i)] = satir.slice(i + 1); }
    return d;
  };
  const surumOku = () => {
    const t = oku('surum.txt'); if (!t) return null;
    const s = { kurulu: null, yeni: [], kontrol: null, hata: null };
    for (const satir of t.split('\n')) {
      const [tur, ...p] = satir.split('\t');
      if (tur === 'kurulu' && p.length >= 3) s.kurulu = { kod: p[0], tarih: p[1], baslik: p.slice(2).join('\t') };
      else if (tur === 'yeni' && p.length >= 3) s.yeni.push({ kod: p[0], tarih: p[1], baslik: p.slice(2).join('\t') });
      else if (tur === 'kontrol') s.kontrol = p[0];
      else if (tur === 'hata') s.hata = p.join(' ');
    }
    return s;
  };
  const istekYaz = (ad, icerik) => {
    try { fs.writeFileSync(yol(ad), icerik); } catch {
      throw web.hata(503, `Güncelleme servisi sunucuda kurulu değil. Bir kez SSH ile şunu çalıştırın: ${KURULUM}`, 'SERVIS_YOK');
    }
  };

  r.get('/guncelleme', Y, async () => {
    const log = oku('son.log') || '';
    const bekleyen = ['guncelle.istek', 'kontrol.istek'].map(yas).filter((x) => x !== null);
    return {
      servis: oku('surum.txt') !== null,
      kurulum: KURULUM,
      surum: surumOku(),
      durum: durumOku(),
      log: log.split('\n').slice(-200).join('\n'),
      istek: { guncelle: yas('guncelle.istek') !== null, kontrol: yas('kontrol.istek') !== null },
      // İstek 45 sn'den uzun beklediyse servis çalışmıyordur
      yanitsiz: bekleyen.some((s) => s > 45),
    };
  });

  r.post('/guncelleme/kontrol', Y, async () => {
    istekYaz('kontrol.istek', '');
    return { tamam: true };
  });

  r.post('/guncelleme/baslat', Y, async (req) => {
    const k = (await db.query('SELECT ad_soyad, sifre_hash FROM kullanicilar WHERE id = $1', [req.kullanici.id])).rows[0];
    if (!k || !oturum.sifreDogru(String(req.body.sifre || ''), k.sifre_hash)) throw web.hata(400, 'Şifre hatalı.');
    const d = durumOku();
    if (d?.durum === 'calisiyor' && Date.now() - Date.parse(d.baslangic) < 40 * 60 * 1000) {
      throw web.hata(409, 'Bir güncelleme zaten sürüyor.');
    }
    if (yas('guncelle.istek') !== null) throw web.hata(409, 'Güncelleme isteği zaten gönderildi.');
    istekYaz('guncelle.istek', `${k.ad_soyad} ${new Date().toISOString()}`);
    return { tamam: true, zaman: new Date().toISOString() };
  });
};
