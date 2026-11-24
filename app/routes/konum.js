'use strict';
// Sahadaki ekiplerin konumu: teknisyen programı açtığında telefonun konumu (yalnız son konum, üzerine yazılır).
module.exports = (r, { db, web, G, Y }) => {
  r.post('/konum', G, async (req) => {
    const b = req.body || {};
    const izin = ['yok', 'desteklenmiyor'].includes(b.izin) ? b.izin : 'var';
    if (izin === 'var') {
      const en = Number(b.enlem); const boy = Number(b.boylam);
      if (!Number.isFinite(en) || !Number.isFinite(boy) || Math.abs(en) > 90 || Math.abs(boy) > 180) throw web.hata(400, 'Geçersiz konum.');
      await db.query(`INSERT INTO kullanici_konum (kullanici_id, enlem, boylam, dogruluk, izin, zaman) VALUES ($1, $2, $3, $4, 'var', now())
        ON CONFLICT (kullanici_id) DO UPDATE SET enlem = excluded.enlem, boylam = excluded.boylam, dogruluk = excluded.dogruluk, izin = 'var', zaman = now()`,
      [req.kullanici.id, en, boy, Number.isFinite(Number(b.dogruluk)) ? Math.round(Number(b.dogruluk)) : null]);
    } else {
      // İzin yoksa eski konum silinmez; yalnız durum işaretlenir
      await db.query(`INSERT INTO kullanici_konum (kullanici_id, izin, zaman) VALUES ($1, $2, now())
        ON CONFLICT (kullanici_id) DO UPDATE SET izin = excluded.izin`, [req.kullanici.id, izin]);
    }
    return { tamam: true };
  });

  r.get('/konumlar', Y, async () => (await db.query(`
    SELECT k.id, k.ad_soyad, k.rol, k.telefon, e.ad AS ekip_ad, k.ekip_id,
           kk.enlem, kk.boylam, kk.dogruluk, kk.izin, kk.zaman,
           (SELECT json_build_object('id', i.id, 'baslik', i.baslik, 'durum', i.durum, 'adres', coalesce(i.adres, c.adres), 'cari', c.unvan)
              FROM isler i LEFT JOIN cariler c ON c.id = i.cari_id
             WHERE i.ekip_id = k.ekip_id AND k.ekip_id IS NOT NULL AND i.durum IN ('sahada', 'planlandi')
               AND (i.durum = 'sahada' OR i.plan_baslangic::date = current_date)
             ORDER BY (i.durum = 'sahada') DESC, i.plan_baslangic LIMIT 1) AS is
    FROM kullanicilar k LEFT JOIN ekipler e ON e.id = k.ekip_id LEFT JOIN kullanici_konum kk ON kk.kullanici_id = k.id
    WHERE k.aktif AND (k.rol <> 'yonetici' OR kk.kullanici_id IS NOT NULL)
    ORDER BY kk.zaman DESC NULLS LAST, k.ad_soyad`)).rows);
};
