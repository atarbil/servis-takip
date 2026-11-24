'use strict';
const { zorunlu, metin } = require('../lib/yardim');

module.exports = (r, { db, web, G, Y }) => {
  // Takvim: verilen aralıktaki işler ve notlar
  r.get('/takvim', G, async (req) => {
    const { bas, bit } = req.query;
    if (!bas || !bit) throw web.hata(400, 'Tarih aralığı gerekli.');
    const yon = ['yonetici', 'muhasebe'].includes(req.kullanici.rol);
    return (await db.query(`
      SELECT * FROM v_takvim
      WHERE baslangic < $2::timestamptz AND coalesce(bitis, baslangic) >= $1::timestamptz
        AND ($3 OR (tur = 'is' AND ekip_id = $4))
      ORDER BY baslangic`, [bas, bit, yon, req.kullanici.ekip_id])).rows;
  });

  r.post('/notlar', Y, async (req) => {
    zorunlu(req.body, { baslik: 'Not', baslangic: 'Tarih' });
    const b = req.body;
    return db.islem(req.kullanici.id, (q) => q.bir(`
      INSERT INTO takvim_notlari (baslik, aciklama, baslangic, bitis, tum_gun, renk, olusturan_id)
      VALUES ($1, $2, $3, $4, $5, coalesce($6, '#f59e0b'), $7) RETURNING id`,
    [metin(b.baslik), metin(b.aciklama), b.baslangic, b.bitis || null, b.tum_gun !== false, b.renk || null, req.kullanici.id]));
  });

  r.put('/notlar/:id', Y, async (req) => {
    const b = req.body;
    await db.islem(req.kullanici.id, (q) => q(`
      UPDATE takvim_notlari SET baslik = coalesce($2, baslik), aciklama = $3, baslangic = coalesce($4, baslangic),
        bitis = $5, tum_gun = coalesce($6, tum_gun), tamamlandi = coalesce($7, tamamlandi), renk = coalesce($8, renk)
      WHERE id = $1`,
    [req.params.id, metin(b.baslik), metin(b.aciklama), b.baslangic || null, b.bitis || null,
      b.tum_gun ?? null, b.tamamlandi ?? null, b.renk || null]));
    return { tamam: true };
  });

  r.delete('/notlar/:id', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q("SELECT kayit_sil('takvim_notu', $1)", [req.params.id]));
    return { tamam: true };
  });
};
