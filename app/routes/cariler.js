'use strict';
const { bugun, zorunlu, metin, sayi, tarih, sec, setIfadesi } = require('../lib/yardim');

const ALANLAR = ['kod', 'tip', 'unvan', 'yetkili', 'telefon', 'telefon2', 'eposta', 'adres', 'il', 'ilce',
  'vergi_dairesi', 'vergi_no', 'notlar', 'aktif'];

module.exports = (r, { db, web, Y }) => {
  r.get('/cariler', Y, async (req) => {
    const p = []; const k = [];
    if (req.query.q) {
      p.push(req.query.q);
      k.push(`(c.unvan ILIKE '%' || $1 || '%' OR c.kod ILIKE $1 || '%' OR c.yetkili ILIKE '%' || $1 || '%'
               OR (telefon_sade($1) IS NOT NULL AND (telefon_sade(c.telefon) LIKE '%' || telefon_sade($1) || '%'
                   OR telefon_sade(c.telefon2) LIKE '%' || telefon_sade($1) || '%')))`);
    }
    if (req.query.tip) { p.push(req.query.tip); k.push(`(c.tip = $${p.length}::cari_tip OR c.tip = 'her_ikisi')`); }
    if (req.query.pasif !== '1') k.push('c.aktif');
    if (req.query.bakiyeli === '1') k.push('b.bakiye <> 0');
    return (await db.query(`
      SELECT c.id, c.kod, c.tip, c.unvan, c.yetkili, c.telefon, c.il, c.ilce, c.aktif,
             b.bakiye, b.son_hareket, b.son_tahsilat
      FROM cariler c JOIN v_cari_bakiye b ON b.id = c.id
      ${k.length ? 'WHERE ' + k.join(' AND ') : ''}
      ORDER BY c.unvan LIMIT ${Math.min(Number(req.query.limit) || 500, 2000)}`, p)).rows;
  });

  r.get('/cariler/:id', Y, async (req) => {
    const c = (await db.query(`SELECT c.*, b.bakiye, b.toplam_borc, b.toplam_alacak, b.son_tahsilat
      FROM cariler c JOIN v_cari_bakiye b ON b.id = c.id WHERE c.id = $1`, [req.params.id])).rows[0];
    if (!c) throw web.hata(404, 'Cari bulunamadı.');
    const [vade, yillik, isler] = await Promise.all([
      db.query('SELECT gecikmis_tutar, en_eski_vade, gecikme_gun FROM v_vadesi_gecen WHERE cari_id = $1', [c.id]),
      db.query('SELECT * FROM v_yillik_cari_ozet WHERE cari_id = $1 ORDER BY yil DESC', [c.id]),
      db.query(`SELECT i.id, i.baslik, i.durum, i.plan_baslangic, i.olusturma, k.satis_kdv_haric, k.kar
                FROM isler i LEFT JOIN v_is_karlilik k ON k.is_id = i.id
                WHERE i.cari_id = $1 ORDER BY coalesce(i.plan_baslangic, i.olusturma) DESC LIMIT 100`, [c.id]),
    ]);
    return { ...c, vadesi_gecen: vade.rows[0] || null, yillik: yillik.rows, isler: isler.rows };
  });

  r.post('/cariler', Y, async (req) => {
    zorunlu(req.body, { unvan: 'Ünvan / ad soyad' });
    const a = sec(req.body, ALANLAR);
    a.unvan = metin(a.unvan);
    const devir = sayi(req.body.devir_bakiye, 'Açılış bakiyesi');
    return db.islem(req.kullanici.id, async (q) => {
      const anahtarlar = Object.keys(a);
      const c = await q.bir(`INSERT INTO cariler (${anahtarlar.join(', ')}, olusturan_id)
        VALUES (${anahtarlar.map((_, i) => '$' + (i + 1)).join(', ')}, $${anahtarlar.length + 1}) RETURNING id, unvan`,
      [...anahtarlar.map((k) => a[k]), req.kullanici.id]);
      if (devir) await q('SELECT cari_devir_ekle($1, $2, $3)', [c.id, devir, tarih(req.body.devir_tarih) || bugun()]);
      return c;
    });
  });

  r.put('/cariler/:id', Y, async (req) => {
    const a = sec(req.body, ALANLAR);
    if ('unvan' in a && !metin(a.unvan)) throw web.hata(400, 'Ünvan boş olamaz.');
    if (!Object.keys(a).length) return { tamam: true };
    await db.islem(req.kullanici.id, (q) => {
      const { ifade, degerler } = setIfadesi(a, 2);
      return q(`UPDATE cariler SET ${ifade} WHERE id = $1`, [req.params.id, ...degerler]);
    });
    return { tamam: true };
  });

  // Tarih aralıklı ekstre (ilk satır devreden bakiye)
  r.get('/cariler/:id/ekstre', Y, async (req) => {
    const yil = new Date().getFullYear();
    const bas = tarih(req.query.bas) || `${yil}-01-01`;
    const bit = tarih(req.query.bit) || `${yil}-12-31`;
    const cari = (await db.query('SELECT id, kod, unvan, telefon, adres, vergi_dairesi, vergi_no FROM cariler WHERE id = $1', [req.params.id])).rows[0];
    if (!cari) throw web.hata(404, 'Cari bulunamadı.');
    const satirlar = (await db.query('SELECT * FROM cari_ekstre($1, $2, $3)', [req.params.id, bas, bit])).rows;
    return { cari, bas, bit, satirlar };
  });

  r.post('/cariler/:id/devir', Y, async (req) => {
    const tutar = sayi(req.body.tutar, 'Tutar');
    if (!tutar) throw web.hata(400, 'Tutar sıfır olamaz.');
    await db.islem(req.kullanici.id, (q) => q('SELECT cari_devir_ekle($1, $2, $3, $4)',
      [req.params.id, tutar, tarih(req.body.tarih) || bugun(), metin(req.body.aciklama) || 'Devir bakiyesi']));
    return { tamam: true };
  });

  r.get('/cariler/:id/fisler', Y, async (req) => (await db.query(`
    SELECT id, fis_no, tarih, vade, durum, genel_toplam, ara_toplam, maliyet_toplam, is_id, aciklama
    FROM satis_fisleri WHERE cari_id = $1 ORDER BY tarih DESC, id DESC`, [req.params.id])).rows);
};
