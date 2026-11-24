'use strict';
// KDV durumu: o ayın alış (indirilecek) ve satış (hesaplanan) faturaları, fatura fatura.
// Alış: onaylı alış faturaları (stoklu) + resmi alış kayıtları (yalnız KDV / gider). Satış: resmi satış faturaları.
const ayKontrol = (ay, web) => { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(ay || ''))) throw web.hata(400, 'Ay seçin.'); return `${ay}-01`; };

module.exports = (r, { db, web, Y }) => {
  r.get('/kdv/ozet', Y, async (req) => {
    const bas = ayKontrol(req.query.ay, web);
    const AY = "tarih >= $1::date AND tarih < ($1::date + interval '1 month')";
    const stoklu = (await db.query(`SELECT a.id, 'stoklu' AS tur, a.tarih, a.belge_no, a.cari_id, c.unvan AS cari_unvan, c.vergi_no AS vkn,
        a.ara_toplam AS matrah, a.kdv_toplam AS kdv, a.genel_toplam AS toplam, 0 AS tevkifat, NULL AS gider_turu, NULL AS kaynak
      FROM alis_faturalari a JOIN cariler c ON c.id = a.cari_id WHERE a.durum = 'onaylandi' AND a.${AY}`, [bas])).rows;
    const gider = (await db.query(`SELECT r.id, 'gider' AS tur, r.tarih, r.belge_no, r.cari_id, coalesce(c.unvan, r.karsi_unvan) AS cari_unvan, r.karsi_vkn AS vkn,
        r.matrah, r.kdv, r.toplam, r.tevkifat, r.gider_turu, r.kaynak
      FROM resmi_faturalar r LEFT JOIN cariler c ON c.id = r.cari_id WHERE r.yon = 'alis' AND r.${AY}`, [bas])).rows;
    const satis = (await db.query(`SELECT r.id, r.tarih, r.belge_no, r.tip, r.cari_id, c.unvan AS cari_unvan, r.karsi_unvan, r.karsi_vkn AS vkn,
        r.matrah, r.kdv, r.toplam, r.tevkifat, r.kaynak
      FROM resmi_faturalar r LEFT JOIN cariler c ON c.id = r.cari_id WHERE r.yon = 'satis' AND r.${AY} ORDER BY r.tarih, r.id`, [bas])).rows;
    const taslaklar = (await db.query(`SELECT a.id, a.belge_no, a.tarih, c.unvan AS cari_unvan, a.genel_toplam, a.kdv_toplam
      FROM alis_faturalari a JOIN cariler c ON c.id = a.cari_id WHERE a.durum = 'taslak' AND a.${AY} ORDER BY a.tarih, a.id`, [bas])).rows;
    const sayi = (x) => ({ ...x, matrah: Number(x.matrah), kdv: Number(x.kdv), toplam: Number(x.toplam), tevkifat: Number(x.tevkifat || 0) });
    const alis = [...stoklu, ...gider].map(sayi).sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : a.id - b.id));
    const son = (await db.query("SELECT max(tarih) AS t FROM resmi_faturalar WHERE yon = 'satis'")).rows[0]?.t || null;
    return { ay: req.query.ay, alis, satis: satis.map(sayi), taslaklar, son_satis_tarihi: son };
  });
};
