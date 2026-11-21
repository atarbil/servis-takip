'use strict';
const { zorunlu, metin, pozitif, tarih } = require('../lib/yardim');

module.exports = (r, { db, web, Y }) => {
  r.get('/hesaplar', Y, async () => (await db.query(`
    SELECT h.id, h.ad, h.tip, h.aktif, b.bakiye FROM hesaplar h JOIN v_hesap_bakiye b ON b.id = h.id ORDER BY h.id`)).rows);

  r.post('/hesaplar', Y, async (req) => {
    zorunlu(req.body, { ad: 'Hesap adı' });
    return db.islem(req.kullanici.id, (q) => q.bir('INSERT INTO hesaplar (ad, tip) VALUES ($1, $2) RETURNING id',
      [metin(req.body.ad), req.body.tip || 'kasa']));
  });
  r.put('/hesaplar/:id', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('UPDATE hesaplar SET ad = coalesce($2, ad), tip = coalesce($3, tip), aktif = coalesce($4, aktif) WHERE id = $1',
      [req.params.id, metin(req.body.ad), req.body.tip || null, req.body.aktif ?? null]));
    return { tamam: true };
  });

  r.get('/finans', Y, async (req) => {
    const p = []; const k = [];
    const ekle = (sql, v) => { p.push(v); k.push(sql.replaceAll('?', '$' + p.length)); };
    if (req.query.hesap_id) ekle('f.hesap_id = ?', req.query.hesap_id);
    if (req.query.cari_id) ekle('f.cari_id = ?', req.query.cari_id);
    if (req.query.bas) ekle('f.tarih >= ?::date', req.query.bas);
    if (req.query.bit) ekle('f.tarih <= ?::date', req.query.bit);
    if (req.query.tip) ekle('f.tip = ?::finans_tip', req.query.tip);
    return (await db.query(`
      SELECT f.*, h.ad AS hesap_ad, c.unvan, k.ad_soyad AS olusturan,
             CASE WHEN f.tip IN ('tahsilat', 'virman_giris') THEN f.tutar ELSE -f.tutar END AS isaretli
      FROM finans_hareketleri f JOIN hesaplar h ON h.id = f.hesap_id
      LEFT JOIN cariler c ON c.id = f.cari_id LEFT JOIN kullanicilar k ON k.id = f.olusturan_id
      ${k.length ? 'WHERE ' + k.join(' AND ') : ''} ORDER BY f.tarih DESC, f.id DESC LIMIT 1000`, p)).rows;
  });

  const ortak = (b) => [pozitif(b.tutar, 'Tutar'), tarih(b.tarih) || new Date().toISOString().slice(0, 10), metin(b.aciklama)];

  r.post('/finans/tahsilat', Y, async (req) => {
    zorunlu(req.body, { cari_id: 'Cari', hesap_id: 'Kasa/Banka' });
    const [tutar, t, ac] = ortak(req.body);
    return db.islem(req.kullanici.id, (q) => q.bir('SELECT tahsilat_ekle($1, $2, $3, $4, $5, $6) AS id',
      [req.body.cari_id, req.body.hesap_id, tutar, t, ac, metin(req.body.belge_no)]));
  });
  r.post('/finans/odeme', Y, async (req) => {
    zorunlu(req.body, { cari_id: 'Cari', hesap_id: 'Kasa/Banka' });
    const [tutar, t, ac] = ortak(req.body);
    return db.islem(req.kullanici.id, (q) => q.bir('SELECT odeme_ekle($1, $2, $3, $4, $5, $6) AS id',
      [req.body.cari_id, req.body.hesap_id, tutar, t, ac, metin(req.body.belge_no)]));
  });
  r.post('/finans/masraf', Y, async (req) => {
    zorunlu(req.body, { hesap_id: 'Kasa/Banka', aciklama: 'Açıklama' });
    const [tutar, t, ac] = ortak(req.body);
    return db.islem(req.kullanici.id, (q) => q.bir('SELECT masraf_ekle($1, $2, $3, $4) AS id', [req.body.hesap_id, tutar, ac, t]));
  });
  r.post('/finans/virman', Y, async (req) => {
    zorunlu(req.body, { kaynak_id: 'Çıkış hesabı', hedef_id: 'Giriş hesabı' });
    if (String(req.body.kaynak_id) === String(req.body.hedef_id)) throw web.hata(400, 'Aynı hesaba virman yapılamaz.');
    const [tutar, t, ac] = ortak(req.body);
    await db.islem(req.kullanici.id, (q) => q('SELECT virman($1, $2, $3, $4, $5)', [req.body.kaynak_id, req.body.hedef_id, tutar, t, ac || 'Virman']));
    return { tamam: true };
  });
  // Tahsilat makbuzu verisi: hareket, cari bilgisi ve tahsilat sonrası kalan bakiye
  r.get('/finans/:id/makbuz', Y, async (req) => {
    const m = (await db.query(`
      SELECT f.*, h.ad AS hesap_ad, h.tip AS hesap_tip, c.unvan, c.adres AS cari_adres, c.il, c.ilce, c.telefon AS cari_telefon,
             c.vergi_dairesi, c.vergi_no, k.ad_soyad AS olusturan,
             (SELECT coalesce(sum(ch.borc - ch.alacak), 0) FROM cari_hareketler ch
              WHERE ch.cari_id = f.cari_id AND NOT ch.iptal
                AND (ch.tarih, ch.id) <= (SELECT x.tarih, x.id FROM cari_hareketler x WHERE x.belge_tip = f.tip::text::cari_belge AND x.belge_id = f.id LIMIT 1)
             ) AS kalan_bakiye
      FROM finans_hareketleri f JOIN hesaplar h ON h.id = f.hesap_id LEFT JOIN cariler c ON c.id = f.cari_id
      LEFT JOIN kullanicilar k ON k.id = f.olusturan_id WHERE f.id = $1`, [req.params.id])).rows[0];
    if (!m) throw web.hata(404, 'Kayıt bulunamadı.');
    if (m.tip !== 'tahsilat') throw web.hata(400, 'Makbuz sadece tahsilatlar için yazdırılır.');
    return m;
  });

  r.post('/finans/:id/iptal', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('SELECT finans_iptal($1)', [req.params.id]));
    return { tamam: true };
  });
};
