'use strict';
const { zorunlu, metin, sayi, tarih } = require('../lib/yardim');
const { doviz } = require('../lib/yardim');

const DURUMLAR = ['taslak', 'gonderildi', 'kabul', 'red', 'iptal'];

module.exports = (r, { db, web, Y }) => {
  r.get('/teklifler', Y, async (req) => {
    const p = []; const k = [];
    const ekle = (sql, v) => { p.push(v); k.push(sql.replaceAll('?', '$' + p.length)); };
    if (req.query.tur) ekle('t.tur = ?::teklif_tur', req.query.tur);
    if (req.query.durum) ekle('t.durum = ?::teklif_durum', req.query.durum);
    if (req.query.cari_id) ekle('t.cari_id = ?', req.query.cari_id);
    if (req.query.bas) ekle('t.tarih >= ?::date', req.query.bas);
    if (req.query.bit) ekle('t.tarih <= ?::date', req.query.bit);
    if (req.query.q) ekle(`(t.belge_no ILIKE '%' || ? || '%' OR c.unvan ILIKE '%' || ? || '%')`, req.query.q);
    return (await db.query(`
      SELECT t.id, t.tur, t.belge_no, t.tarih, t.gecerlilik, t.durum, t.ara_toplam, t.kdv_toplam, t.genel_toplam, t.cari_id, c.unvan, t.fis_id,
             f.fis_no
      FROM teklifler t JOIN cariler c ON c.id = t.cari_id LEFT JOIN satis_fisleri f ON f.id = t.fis_id
      ${k.length ? 'WHERE ' + k.join(' AND ') : ''} ORDER BY t.tarih DESC, t.id DESC LIMIT 500`, p)).rows;
  });

  async function getir(id) {
    const t = (await db.query(`
      SELECT t.*, c.unvan, c.adres AS cari_adres, c.il, c.ilce, c.telefon AS cari_telefon, c.vergi_dairesi, c.vergi_no,
             f.fis_no, f.durum AS fis_durum, k.belge_no AS kaynak_belge_no
      FROM teklifler t JOIN cariler c ON c.id = t.cari_id LEFT JOIN satis_fisleri f ON f.id = t.fis_id
      LEFT JOIN teklifler k ON k.id = t.kaynak_teklif_id WHERE t.id = $1`, [id])).rows[0];
    if (!t) throw web.hata(404, 'Belge bulunamadı.');
    t.satirlar = (await db.query(`
      SELECT s.*, round(s.miktar * s.birim_fiyat * (1 - s.iskonto_orani / 100), 2) AS tutar, u.kod AS urun_kod,
             u.resim AS urun_resim, u.raf_yeri, u.onerilen_satis AS liste_fiyati, (SELECT min(b.barkod) FROM urun_barkodlari b WHERE b.urun_id = u.id) AS barkod
      FROM teklif_satirlari s LEFT JOIN urunler u ON u.id = s.urun_id WHERE s.teklif_id = $1 ORDER BY s.sira, s.id`, [id])).rows;
    return t;
  }

  async function satirlariYaz(q, id, satirlar) {
    if (!Array.isArray(satirlar)) return;
    await q('DELETE FROM teklif_satirlari WHERE teklif_id = $1', [id]);
    let sira = 0;
    for (const s of satirlar) {
      const urunId = s.urun_id || null;
      const aciklama = urunId ? (metin(s.aciklama) || '-') : metin(s.aciklama);
      if (!aciklama) throw web.hata(400, 'Satır açıklaması boş olamaz.');
      await q(`INSERT INTO teklif_satirlari (teklif_id, sira, urun_id, aciklama, notu, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, ++sira, urunId, aciklama, metin(s.notu), sayi(s.miktar, 'Miktar') || 1, metin(s.birim) || 'adet',
        sayi(s.birim_fiyat, 'Fiyat') || 0, sayi(s.iskonto_orani, 'İskonto') || 0, sayi(s.kdv_orani, 'KDV') ?? 20]);
    }
  }

  r.get('/teklifler/:id', Y, async (req) => getir(req.params.id));

  r.post('/teklifler', Y, async (req) => {
    const b = req.body;
    zorunlu(b, { cari_id: 'Cari' });
    const tur = b.tur === 'proforma' ? 'proforma' : 'teklif';
    const id = await db.islem(req.kullanici.id, async (q) => {
      const a = await q.bir('SELECT deger FROM ayarlar WHERE anahtar = $1', ['teklif_giris']);
      const kp = await q.bir('SELECT deger FROM ayarlar WHERE anahtar = $1', ['teklif_kapanis']);
      const d = doviz(b.doviz);
      const t = await q.bir(`INSERT INTO teklifler (tur, cari_id, tarih, gecerlilik, giris_metni, kapanis_metni, aciklama, olusturan_id, doviz, kur, tl_karsilik_goster)
        VALUES ($1, $2, coalesce($3::date, current_date), $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [tur, b.cari_id, tarih(b.tarih), tarih(b.gecerlilik),
        tur === 'teklif' ? (b.giris_metni ?? a?.deger ?? null) : null, tur === 'teklif' ? (b.kapanis_metni ?? kp?.deger ?? null) : null,
        metin(b.aciklama), req.kullanici.id, d, d === 'TRY' ? null : sayi(b.kur, 'Kur'), d !== 'TRY' && !!b.tl_karsilik_goster]);
      await satirlariYaz(q, t.id, b.satirlar);
      return t.id;
    });
    return getir(id);
  });

  r.put('/teklifler/:id', Y, async (req) => {
    const b = req.body;
    await db.islem(req.kullanici.id, async (q) => {
      const t = await q.bir('SELECT durum, fis_id FROM teklifler WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!t) throw web.hata(404, 'Belge bulunamadı.');
      if (t.durum === 'iptal') throw web.hata(400, 'İptal edilmiş belge düzenlenemez.');
      if (t.fis_id && Array.isArray(b.satirlar)) throw web.hata(400, 'Satış fişine dönüştürülmüş belgenin satırları değiştirilemez.');
      await q(`UPDATE teklifler SET cari_id = coalesce($2, cari_id), tarih = coalesce($3::date, tarih), gecerlilik = $4,
                 giris_metni = $5, kapanis_metni = $6, aciklama = $7, kase_imza = coalesce($8, kase_imza),
                 doviz = coalesce($9, doviz), kur = CASE WHEN coalesce($9, doviz) = 'TRY' THEN NULL ELSE coalesce($10, kur) END,
                 tl_karsilik_goster = coalesce($11, tl_karsilik_goster) AND coalesce($9, doviz) <> 'TRY' WHERE id = $1`,
      [req.params.id, b.cari_id || null, tarih(b.tarih), tarih(b.gecerlilik), metin(b.giris_metni), metin(b.kapanis_metni),
        metin(b.aciklama), b.kase_imza ?? null, b.doviz ? doviz(b.doviz) : null, sayi(b.kur, 'Kur'),
        b.tl_karsilik_goster === undefined ? null : !!b.tl_karsilik_goster]);
      await satirlariYaz(q, req.params.id, b.satirlar);
    });
    return getir(req.params.id);
  });

  r.post('/teklifler/:id/durum', Y, async (req) => {
    if (!DURUMLAR.includes(req.body.durum)) throw web.hata(400, 'Geçersiz durum.');
    await db.islem(req.kullanici.id, (q) => q('UPDATE teklifler SET durum = $2::teklif_durum WHERE id = $1', [req.params.id, req.body.durum]));
    return getir(req.params.id);
  });

  r.post('/teklifler/:id/kopyala', Y, async (req) => {
    const tur = req.body.tur === 'proforma' ? 'proforma' : 'teklif';
    const { id } = await db.islem(req.kullanici.id, (q) => q.bir('SELECT teklif_kopyala($1, $2) AS id', [req.params.id, tur]));
    return { id };
  });

  r.post('/teklifler/:id/fise-donustur', Y, async (req) => db.islem(req.kullanici.id,
    (q) => q.bir('SELECT teklifi_fise_donustur($1, $2) AS id', [req.params.id, sayi(req.body?.kur, 'Kur')])));
};
