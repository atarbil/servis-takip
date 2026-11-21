'use strict';
const { zorunlu, metin } = require('../lib/yardim');

module.exports = (r, { db, web, oturum, G, Y }) => {
  r.get('/ayarlar', G, async () => Object.fromEntries(
    (await db.query('SELECT anahtar, deger FROM ayarlar')).rows.map((x) => [x.anahtar, x.deger])));

  r.put('/ayarlar', Y, async (req) => {
    await db.islem(req.kullanici.id, async (q) => {
      for (const [k, v] of Object.entries(req.body)) {
        if (!/^[a-z_]{2,40}$/.test(k)) continue;
        await q('INSERT INTO ayarlar (anahtar, deger) VALUES ($1, $2) ON CONFLICT (anahtar) DO UPDATE SET deger = excluded.deger', [k, v == null ? '' : String(v)]);
      }
    });
    return { tamam: true };
  });

  // ---------- Ekipler ----------
  r.get('/ekipler', G, async () => (await db.query(`
    SELECT e.*, (SELECT string_agg(ad_soyad, ', ') FROM kullanicilar k WHERE k.ekip_id = e.id AND k.aktif) AS uyeler
    FROM ekipler e ORDER BY e.id`)).rows);
  r.post('/ekipler', Y, async (req) => {
    zorunlu(req.body, { ad: 'Ekip adı' });
    return db.islem(req.kullanici.id, (q) => q.bir('INSERT INTO ekipler (ad, renk) VALUES ($1, coalesce($2, \'#2563eb\')) RETURNING id',
      [metin(req.body.ad), req.body.renk || null]));
  });
  r.put('/ekipler/:id', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('UPDATE ekipler SET ad = coalesce($2, ad), renk = coalesce($3, renk), aktif = coalesce($4, aktif) WHERE id = $1',
      [req.params.id, metin(req.body.ad), req.body.renk || null, req.body.aktif ?? null]));
    return { tamam: true };
  });

  // ---------- Kullanıcılar ----------
  r.get('/kullanicilar', Y, async () => (await db.query(`
    SELECT k.id, k.ad_soyad, k.kullanici_adi, k.rol, k.ekip_id, e.ad AS ekip_ad, k.telefon, k.aktif, k.son_giris
    FROM kullanicilar k LEFT JOIN ekipler e ON e.id = k.ekip_id ORDER BY k.aktif DESC, k.rol, k.ad_soyad`)).rows);

  r.post('/kullanicilar', Y, async (req) => {
    const b = req.body;
    zorunlu(b, { ad_soyad: 'Ad soyad', kullanici_adi: 'Kullanıcı adı', sifre: 'Şifre' });
    if (String(b.sifre).length < 8) throw web.hata(400, 'Şifre en az 8 karakter olmalı.');
    if (b.rol === 'teknisyen' && !b.ekip_id) throw web.hata(400, 'Teknisyen için ekip seçin.');
    return db.islem(req.kullanici.id, (q) => q.bir(`
      INSERT INTO kullanicilar (ad_soyad, kullanici_adi, sifre_hash, rol, ekip_id, telefon)
      VALUES ($1, lower($2), $3, $4, $5, $6) RETURNING id`,
    [metin(b.ad_soyad), metin(b.kullanici_adi), oturum.sifreOzet(String(b.sifre)), b.rol === 'yonetici' ? 'yonetici' : 'teknisyen',
      b.ekip_id || null, metin(b.telefon)]));
  });

  r.put('/kullanicilar/:id', Y, async (req) => {
    const b = req.body;
    if (Number(req.params.id) === req.kullanici.id && (b.aktif === false || b.rol === 'teknisyen')) {
      throw web.hata(400, 'Kendi yönetici hesabınızı pasif yapamaz veya teknisyene çeviremezsiniz.');
    }
    await db.islem(req.kullanici.id, async (q) => {
      await q(`UPDATE kullanicilar SET ad_soyad = coalesce($2, ad_soyad), rol = coalesce($3::kullanici_rol, rol),
               ekip_id = $4, telefon = $5, aktif = coalesce($6, aktif) WHERE id = $1`,
      [req.params.id, metin(b.ad_soyad), b.rol || null, b.ekip_id || null, metin(b.telefon), b.aktif ?? null]);
      if (metin(b.sifre)) {
        if (String(b.sifre).length < 8) throw web.hata(400, 'Şifre en az 8 karakter olmalı.');
        await q('UPDATE kullanicilar SET sifre_hash = $2 WHERE id = $1', [req.params.id, oturum.sifreOzet(String(b.sifre))]);
        await q('DELETE FROM oturumlar WHERE kullanici_id = $1', [req.params.id]);
      }
      if (b.aktif === false) await q('DELETE FROM oturumlar WHERE kullanici_id = $1', [req.params.id]);
    });
    return { tamam: true };
  });

  // Denetim kaydı (son 500)
  r.get('/denetim', Y, async (req) => (await db.query(`
    SELECT d.id, d.zaman, d.tablo, d.kayit_id, d.islem, d.eski, d.yeni, k.ad_soyad
    FROM denetim_kaydi d LEFT JOIN kullanicilar k ON k.id = d.kullanici_id
    WHERE ($1::text IS NULL OR d.tablo = $1) AND ($2::bigint IS NULL OR d.kayit_id = $2)
    ORDER BY d.id DESC LIMIT 500`, [req.query.tablo || null, req.query.kayit_id || null])).rows);
};
