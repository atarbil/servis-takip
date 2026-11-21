'use strict';
const { zorunlu, metin, sayi, tarih } = require('../lib/yardim');

module.exports = (r, { db, web, Y }) => {
  r.get('/fisler', Y, async (req) => {
    const p = []; const k = [];
    const ekle = (sql, v) => { p.push(v); k.push(sql.replaceAll('?', '$' + p.length)); };
    if (req.query.durum) ekle('f.durum = ?::belge_durum', req.query.durum);
    if (req.query.cari_id) ekle('f.cari_id = ?', req.query.cari_id);
    if (req.query.bas) ekle('f.tarih >= ?::date', req.query.bas);
    if (req.query.bit) ekle('f.tarih <= ?::date', req.query.bit);
    if (req.query.q) ekle(`(f.fis_no ILIKE '%' || ? || '%' OR c.unvan ILIKE '%' || ? || '%')`, req.query.q);
    return (await db.query(`
      SELECT f.id, f.fis_no, f.tarih, f.vade, f.durum, f.ara_toplam, f.kdv_toplam, f.genel_toplam, f.maliyet_toplam,
             f.ara_toplam - f.maliyet_toplam AS kar, f.is_id, f.cari_id, c.unvan, f.aciklama
      FROM satis_fisleri f JOIN cariler c ON c.id = f.cari_id
      ${k.length ? 'WHERE ' + k.join(' AND ') : ''}
      ORDER BY f.tarih DESC, f.id DESC LIMIT 500`, p)).rows;
  });

  async function fisGetir(id) {
    const f = (await db.query(`
      SELECT f.*, f.ara_toplam - f.maliyet_toplam AS kar, c.unvan, c.adres AS cari_adres, c.telefon AS cari_telefon,
             c.vergi_dairesi, c.vergi_no, i.baslik AS is_baslik
      FROM satis_fisleri f JOIN cariler c ON c.id = f.cari_id LEFT JOIN isler i ON i.id = f.is_id WHERE f.id = $1`, [id])).rows[0];
    if (!f) throw web.hata(404, 'Fiş bulunamadı.');
    f.satirlar = (await db.query(`
      SELECT s.*, round(s.miktar * s.birim_fiyat * (1 - s.iskonto_orani / 100), 2) AS tutar,
             round(s.miktar * s.birim_maliyet, 2) AS maliyet, u.kod AS urun_kod, u.onay_bekliyor, u.ort_maliyet AS urun_maliyet
      FROM satis_fisi_satirlari s LEFT JOIN urunler u ON u.id = s.urun_id WHERE s.fis_id = $1 ORDER BY s.sira, s.id`, [id])).rows;
    return f;
  }

  r.get('/fisler/:id', Y, async (req) => fisGetir(req.params.id));

  // İşe bağlı olmayan doğrudan satış fişi
  r.post('/fisler', Y, async (req) => {
    zorunlu(req.body, { cari_id: 'Cari' });
    return db.islem(req.kullanici.id, (q) => q.bir(`
      INSERT INTO satis_fisleri (cari_id, tarih, vade, aciklama, olusturan_id)
      VALUES ($1, coalesce($2::date, current_date), $3, $4, $5) RETURNING id`,
    [req.body.cari_id, tarih(req.body.tarih), tarih(req.body.vade), metin(req.body.aciklama), req.kullanici.id]));
  });

  // Taslak fişi kaydet: başlık + tüm satırlar
  r.put('/fisler/:id', Y, async (req) => {
    const b = req.body;
    await db.islem(req.kullanici.id, async (q) => {
      const f = await q.bir('SELECT * FROM satis_fisleri WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!f) throw web.hata(404, 'Fiş bulunamadı.');
      if (f.durum !== 'taslak') throw web.hata(400, 'Sadece taslak fiş düzenlenebilir.', 'FIS_KILITLI');
      await q(`UPDATE satis_fisleri SET cari_id = coalesce($2, cari_id), tarih = coalesce($3::date, tarih), vade = $4, aciklama = $5
               WHERE id = $1`, [f.id, b.cari_id || null, tarih(b.tarih), tarih(b.vade), metin(b.aciklama)]);
      if (Array.isArray(b.satirlar)) {
        // Var olan satırların maliyet ve stok bilgisini sunucudan koru
        const eski = new Map((await q.hepsi('SELECT id, birim_maliyet, stoktan_dus, urun_id FROM satis_fisi_satirlari WHERE fis_id = $1', [f.id]))
          .map((s) => [s.id, s]));
        await q('DELETE FROM satis_fisi_satirlari WHERE fis_id = $1', [f.id]);
        let sira = 0;
        for (const s of b.satirlar) {
          const tip = ['urun', 'iscilik', 'hizmet'].includes(s.tip) ? s.tip : 'urun';
          const urunId = tip === 'urun' ? (s.urun_id || null) : null;
          if (tip === 'urun' && !urunId) throw web.hata(400, 'Ürün satırında ürün seçilmeli.');
          // Ürün satırında açıklama stok kartındaki addır (veritabanı da zorlar); işçilik/hizmette serbest
          const aciklama = tip === 'urun' ? (metin(s.aciklama) || '-') : metin(s.aciklama);
          if (!aciklama) throw web.hata(400, 'Satır açıklaması boş olamaz.');
          const onceki = s.id ? eski.get(Number(s.id)) : null;
          const ayniUrun = onceki && onceki.urun_id === (urunId ? Number(urunId) : null);
          await q(`INSERT INTO satis_fisi_satirlari (fis_id, sira, tip, urun_id, aciklama, miktar, birim, birim_fiyat, iskonto_orani,
                     kdv_orani, birim_maliyet, stoktan_dus, notu)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [f.id, sira++, tip, urunId, aciklama, sayi(s.miktar, 'Miktar') || 1, metin(s.birim) || 'adet',
            sayi(s.birim_fiyat, 'Fiyat') || 0, sayi(s.iskonto_orani, 'İskonto') || 0, sayi(s.kdv_orani, 'KDV') ?? 20,
            ayniUrun ? onceki.birim_maliyet : 0, ayniUrun ? onceki.stoktan_dus : true, metin(s.notu)]);
        }
      }
    });
    return fisGetir(req.params.id);
  });

  r.post('/fisler/:id/onayla', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('SELECT satis_fisi_onayla($1)', [req.params.id]));
    return fisGetir(req.params.id);
  });

  r.post('/fisler/:id/iptal', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('SELECT satis_fisi_iptal($1)', [req.params.id]));
    return fisGetir(req.params.id);
  });
};
