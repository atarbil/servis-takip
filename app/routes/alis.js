'use strict';
const { zorunlu, metin, sayi, tarih } = require('../lib/yardim');
const { doviz } = require('../lib/yardim');

module.exports = (r, { db, web, Y }) => {
  r.get('/alislar', Y, async (req) => {
    const p = []; const k = [];
    const ekle = (sql, v) => { p.push(v); k.push(sql.replaceAll('?', '$' + p.length)); };
    if (req.query.durum) ekle('a.durum = ?::belge_durum', req.query.durum);
    if (req.query.cari_id) ekle('a.cari_id = ?', req.query.cari_id);
    if (req.query.bas) ekle('a.tarih >= ?::date', req.query.bas);
    if (req.query.bit) ekle('a.tarih <= ?::date', req.query.bit);
    if (req.query.q) ekle(`(a.belge_no ILIKE '%' || ? || '%' OR c.unvan ILIKE '%' || ? || '%')`, req.query.q);
    return (await db.query(`
      SELECT a.id, a.belge_no, a.tarih, a.vade, a.durum, a.ara_toplam, a.kdv_toplam, a.genel_toplam, a.cari_id, c.unvan
      FROM alis_faturalari a JOIN cariler c ON c.id = a.cari_id
      ${k.length ? 'WHERE ' + k.join(' AND ') : ''} ORDER BY a.tarih DESC, a.id DESC LIMIT 500`, p)).rows;
  });

  async function getir(id) {
    const a = (await db.query(`SELECT a.*, c.unvan, c.adres AS cari_adres, c.il, c.ilce, c.telefon AS cari_telefon, c.vergi_dairesi, c.vergi_no,
      (SELECT bakiye FROM v_cari_bakiye b WHERE b.id = a.cari_id) AS cari_bakiye
      FROM alis_faturalari a JOIN cariler c ON c.id = a.cari_id WHERE a.id = $1`, [id])).rows[0];
    if (!a) throw web.hata(404, 'Fatura bulunamadı.');
    a.satirlar = (await db.query(`
      SELECT s.*, u.ad, u.kod, u.birim, round(s.miktar * s.birim_fiyat, 2) AS tutar
      FROM alis_faturasi_satirlari s JOIN urunler u ON u.id = s.urun_id WHERE s.fatura_id = $1 ORDER BY s.id`, [id])).rows;
    return a;
  }

  async function satirlariYaz(q, id, satirlar) {
    if (!Array.isArray(satirlar)) return;
    // Dövizli faturada satır fiyatı dövizdir; TL fiyat fatura kuruyla hesaplanır
    const fat = await q.bir('SELECT doviz, kur FROM alis_faturalari WHERE id = $1', [id]);
    const dovizli = fat.doviz !== 'TRY';
    if (dovizli && !(Number(fat.kur) > 0)) throw web.hata(400, 'Dövizli fatura için kur girin.', 'KUR_YOK');
    await q('DELETE FROM alis_faturasi_satirlari WHERE fatura_id = $1', [id]);
    for (const s of satirlar) {
      if (!s.urun_id) throw web.hata(400, 'Her satırda ürün seçilmeli.');
      const miktar = sayi(s.miktar, 'Miktar');
      if (!miktar || miktar <= 0) throw web.hata(400, 'Miktar sıfırdan büyük olmalı.');
      const dFiyat = dovizli ? (sayi(s.doviz_fiyat, 'Döviz fiyatı') || 0) : null;
      const tlFiyat = dovizli ? Math.round(dFiyat * Number(fat.kur) * 10000) / 10000 : (sayi(s.birim_fiyat, 'Fiyat') || 0);
      await q(`INSERT INTO alis_faturasi_satirlari (fatura_id, urun_id, miktar, birim_fiyat, kdv_orani, doviz_fiyat) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, s.urun_id, miktar, tlFiyat, sayi(s.kdv_orani, 'KDV') ?? 20, dFiyat]);
    }
  }

  r.get('/alislar/:id', Y, async (req) => getir(req.params.id));

  r.post('/alislar', Y, async (req) => {
    zorunlu(req.body, { cari_id: 'Tedarikçi', belge_no: 'Fatura numarası' });
    const b = req.body;
    const id = await db.islem(req.kullanici.id, async (q) => {
      const d = doviz(b.doviz);
      const a = await q.bir(`INSERT INTO alis_faturalari (belge_no, cari_id, tarih, vade, aciklama, olusturan_id, doviz, kur)
        VALUES ($1, $2, coalesce($3::date, current_date), $4, $5, $6, $7, $8) RETURNING id`,
      [metin(b.belge_no), b.cari_id, tarih(b.tarih), tarih(b.vade), metin(b.aciklama), req.kullanici.id, d, d === 'TRY' ? null : sayi(b.kur, 'Kur')]);
      await satirlariYaz(q, a.id, b.satirlar);
      return a.id;
    });
    return getir(id);
  });

  r.put('/alislar/:id', Y, async (req) => {
    const b = req.body;
    await db.islem(req.kullanici.id, async (q) => {
      const a = await q.bir('SELECT durum FROM alis_faturalari WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!a) throw web.hata(404, 'Fatura bulunamadı.');
      if (a.durum !== 'taslak') throw web.hata(400, 'Sadece taslak fatura düzenlenebilir.', 'FATURA_KILITLI');
      const d = doviz(b.doviz);
      await q(`UPDATE alis_faturalari SET belge_no = coalesce($2, belge_no), cari_id = coalesce($3, cari_id),
               tarih = coalesce($4::date, tarih), vade = $5, aciklama = $6, doviz = $7, kur = $8 WHERE id = $1`,
      [req.params.id, metin(b.belge_no), b.cari_id || null, tarih(b.tarih), tarih(b.vade), metin(b.aciklama), d, d === 'TRY' ? null : sayi(b.kur, 'Kur')]);
      await satirlariYaz(q, req.params.id, b.satirlar);
    });
    return getir(req.params.id);
  });

  r.post('/alislar/:id/onayla', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('SELECT alis_faturasi_onayla($1)', [req.params.id]));
    return getir(req.params.id);
  });
  r.post('/alislar/:id/iptal', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('SELECT alis_faturasi_iptal($1)', [req.params.id]));
    return getir(req.params.id);
  });
};
