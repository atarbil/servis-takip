'use strict';
const { tarih } = require('../lib/yardim');
const { kurGetir } = require('../lib/kur');

module.exports = (r, { db, G, Y }) => {
  // Üst çubuktaki döviz kuru
  r.get('/kur', G, async () => (await kurGetir()) || { usd: null, eur: null });

  // Menüdeki rozetler
  r.get('/sayaclar', Y, async () => (await db.query(`SELECT
      (SELECT count(*)::int FROM isler WHERE durum = 'tamamlandi') AS fiyatlandirma,
      (SELECT count(*)::int FROM isler WHERE durum = 'havuz') AS havuz,
      (SELECT count(*)::int FROM dis_servis WHERE durum = 'dis_serviste') AS dis_servis`)).rows[0]);

  r.get('/fiyatlandirma', Y, async () => (await db.query(`
    SELECT *, extract(epoch FROM bekleme)::int AS bekleme_sn FROM v_fiyatlandirma_bekleyen ORDER BY bitis_zamani`)).rows);

  // Ana panel
  r.get('/ozet', Y, async () => {
    const [sayilar, hesaplar, ay, uyari] = await Promise.all([
      db.query(`SELECT
          count(*) FILTER (WHERE durum = 'havuz')::int AS havuz,
          count(*) FILTER (WHERE durum = 'planlandi' AND plan_baslangic::date = current_date)::int AS bugun,
          count(*) FILTER (WHERE durum = 'sahada')::int AS sahada,
          count(*) FILTER (WHERE durum = 'tamamlandi')::int AS fis_bekleyen,
          count(*) FILTER (WHERE durum = 'planlandi' AND plan_baslangic < now() - interval '1 day')::int AS geciken
        FROM isler`),
      db.query('SELECT h.id, h.ad, h.tip, b.bakiye FROM hesaplar h JOIN v_hesap_bakiye b ON b.id = h.id WHERE h.aktif ORDER BY h.id'),
      db.query(`SELECT coalesce(sum(ara_toplam), 0) AS ciro, coalesce(sum(ara_toplam - maliyet_toplam), 0) AS kar, count(*)::int AS fis
                FROM satis_fisleri WHERE durum = 'onaylandi' AND date_trunc('month', tarih) = date_trunc('month', current_date)`),
      db.query(`SELECT
          (SELECT coalesce(sum(bakiye), 0) FROM v_cari_bakiye WHERE bakiye > 0) AS toplam_alacak,
          (SELECT coalesce(sum(-bakiye), 0) FROM v_cari_bakiye WHERE bakiye < 0) AS toplam_borc,
          (SELECT coalesce(sum(gecikmis_tutar), 0) FROM v_vadesi_gecen) AS vadesi_gecen,
          (SELECT count(*)::int FROM urunler WHERE onay_bekliyor AND aktif) AS onay_bekleyen_urun,
          (SELECT count(*)::int FROM v_stok_uyari WHERE uyari <> 'onay_bekliyor') AS stok_uyari`),
    ]);
    const bugunIsler = (await db.query(`
      SELECT i.id, i.baslik, i.durum, i.plan_baslangic, e.ad AS ekip_ad, e.renk AS ekip_renk, c.unvan AS cari_unvan
      FROM isler i LEFT JOIN ekipler e ON e.id = i.ekip_id LEFT JOIN cariler c ON c.id = i.cari_id
      WHERE i.plan_baslangic::date = current_date AND i.durum <> 'iptal' ORDER BY i.plan_baslangic`)).rows;
    const [yarin, havuz, fiyat, tahsilat, vade, sahada] = await Promise.all([
      db.query(`SELECT i.id, i.baslik, i.durum, i.plan_baslangic, e.ad AS ekip_ad, e.renk AS ekip_renk, c.unvan AS cari_unvan
        FROM isler i LEFT JOIN ekipler e ON e.id = i.ekip_id LEFT JOIN cariler c ON c.id = i.cari_id
        WHERE i.plan_baslangic::date = current_date + 1 AND i.durum <> 'iptal' ORDER BY i.plan_baslangic`),
      db.query('SELECT id, baslik, unvan, oncelik, extract(epoch FROM bekleme)::int AS bekleme_sn FROM v_is_havuzu LIMIT 6'),
      db.query('SELECT id, baslik, unvan, ekip, ekip_renk, bitis_zamani, malzeme_maliyeti, taslak_fis_id FROM v_fiyatlandirma_bekleyen ORDER BY bitis_zamani LIMIT 6'),
      db.query(`SELECT f.id, f.tarih, f.tutar, c.unvan, c.id AS cari_id, h.ad AS hesap FROM finans_hareketleri f
        JOIN cariler c ON c.id = f.cari_id JOIN hesaplar h ON h.id = f.hesap_id
        WHERE f.tip = 'tahsilat' AND NOT f.iptal ORDER BY f.tarih DESC, f.id DESC LIMIT 6`),
      db.query('SELECT cari_id, unvan, telefon, gecikmis_tutar, gecikme_gun FROM v_vadesi_gecen ORDER BY gecikmis_tutar DESC LIMIT 6'),
      db.query(`SELECT i.id, i.baslik, i.baslama_zamani, e.ad AS ekip_ad, e.renk AS ekip_renk, c.unvan AS cari_unvan
        FROM isler i LEFT JOIN ekipler e ON e.id = i.ekip_id LEFT JOIN cariler c ON c.id = i.cari_id
        WHERE i.durum = 'sahada' ORDER BY i.baslama_zamani`),
    ]);
    return { ...sayilar.rows[0], hesaplar: hesaplar.rows, bu_ay: ay.rows[0], ...uyari.rows[0], bugun_isler: bugunIsler,
      yarin_isler: yarin.rows, havuz_isler: havuz.rows, fiyat_bekleyen: fiyat.rows, son_tahsilatlar: tahsilat.rows,
      vadesi_gecenler: vade.rows, sahada_isler: sahada.rows };
  });

  r.get('/rapor/cari-bakiye', Y, async (req) => (await db.query(`
    SELECT b.*, c.il, c.ilce FROM v_cari_bakiye b JOIN cariler c ON c.id = b.id
    WHERE c.aktif AND ($1::text IS NULL OR c.tip = $1::cari_tip OR c.tip = 'her_ikisi')
      AND ($2 = '0' OR b.bakiye <> 0)
    ORDER BY b.bakiye DESC`, [req.query.tip || null, req.query.tumu === '1' ? '0' : '1'])).rows);

  r.get('/rapor/vadesi-gecen', Y, async () => (await db.query(
    'SELECT * FROM v_vadesi_gecen ORDER BY gecikme_gun DESC')).rows);

  r.get('/rapor/yillik', Y, async (req) => (await db.query(
    'SELECT * FROM v_yillik_cari_ozet WHERE yil = $1 ORDER BY ciro_kdv_haric DESC',
    [Number(req.query.yil) || new Date().getFullYear()])).rows);

  r.get('/rapor/is-karlilik', Y, async (req) => {
    const yil = new Date().getFullYear();
    return (await db.query(`
      SELECT * FROM v_is_karlilik
      WHERE durum IN ('tamamlandi', 'fis_kesildi')
        AND coalesce(bitis_zamani, plan_baslangic)::date BETWEEN $1 AND $2
      ORDER BY coalesce(bitis_zamani, plan_baslangic) DESC`,
    [tarih(req.query.bas) || `${yil}-01-01`, tarih(req.query.bit) || `${yil}-12-31`])).rows;
  });

  r.get('/rapor/ekip-aylik', Y, async (req) => (await db.query(
    'SELECT * FROM v_ekip_aylik WHERE extract(year FROM ay) = $1 ORDER BY ay DESC, ekip',
    [Number(req.query.yil) || new Date().getFullYear()])).rows);

  r.get('/rapor/stok-uyari', Y, async () => (await db.query('SELECT * FROM v_stok_uyari ORDER BY uyari, ad')).rows);

  r.get('/rapor/aylik-satis', Y, async (req) => (await db.query(`
    SELECT to_char(tarih, 'YYYY-MM') AS ay, count(*)::int AS fis, sum(ara_toplam) AS ciro, sum(maliyet_toplam) AS maliyet,
           sum(ara_toplam - maliyet_toplam) AS kar, sum(genel_toplam) AS kdv_dahil
    FROM satis_fisleri WHERE durum = 'onaylandi' AND extract(year FROM tarih) = $1
    GROUP BY 1 ORDER BY 1`, [Number(req.query.yil) || new Date().getFullYear()])).rows);
};
