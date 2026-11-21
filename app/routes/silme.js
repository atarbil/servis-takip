'use strict';
// Yöneticinin silme yetkisi ve Silinenler kutusu.
// Silme önizlemesi gerçek silmeyi çalıştırıp geri sarar: penceredeki etkiler birebir doğrudur.

const TURLER = ['satis_fisi', 'alis_faturasi', 'teklif', 'finans', 'is', 'cari', 'urun', 'envanter', 'takvim_notu', 'kullanici', 'dis_servis'];

module.exports = (r, { db, web, Y }) => {
  const dogrula = (b) => {
    if (!TURLER.includes(b.tur)) throw web.hata(400, 'Geçersiz kayıt türü.');
    const id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0) throw web.hata(400, 'Geçersiz kayıt.');
    return id;
  };

  r.post('/sil/onizleme', Y, async (req) => {
    const id = dogrula(req.body);
    const b = await db.al();
    try {
      await b.query('BEGIN');
      await b.query("SELECT set_config('app.kullanici_id', $1, true)", [req.kullanici.id]);
      const s = (await b.query('SELECT kayit_sil($1, $2) AS s', [req.body.tur, id])).rows[0].s;
      return { baslik: s.baslik, ozet: s.ozet, adet: s.adet };
    } finally {
      try { await b.query('ROLLBACK'); } catch { b.kapat(); }
      db.birak(b);
    }
  });

  r.post('/sil', Y, async (req) => {
    const id = dogrula(req.body);
    return db.islem(req.kullanici.id, async (q) => (await q('SELECT kayit_sil($1, $2) AS s', [req.body.tur, id])).rows[0].s);
  });

  r.get('/silinenler', Y, async (req) => {
    const durum = ['bekliyor', 'geri_alindi', 'kalici'].includes(req.query.durum) ? req.query.durum : 'bekliyor';
    return (await db.query(`SELECT s.id, s.tur, s.kayit_id, s.baslik, s.ozet, jsonb_array_length(s.bagli) AS adet, s.durum, s.zaman,
        k.ad_soyad AS silen, s.islem_zamani, ky.ad_soyad AS islem_yapan,
        greatest(0, 30 - extract(day FROM now() - s.zaman)::int) AS kalan_gun
      FROM silinenler s LEFT JOIN kullanicilar k ON k.id = s.silen_id LEFT JOIN kullanicilar ky ON ky.id = s.islem_yapan_id
      WHERE s.durum = $1 ORDER BY coalesce(s.islem_zamani, s.zaman) DESC LIMIT 500`, [durum])).rows;
  });

  r.post('/silinenler/:id/geri-al', Y, async (req) => db.islem(req.kullanici.id,
    async (q) => ({ baslik: (await q.bir('SELECT kayit_geri_al($1) AS b', [req.params.id])).b })));

  r.post('/silinenler/:id/kalici', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('SELECT kayit_kalici_sil($1)', [req.params.id]));
    return { tamam: true };
  });
};
