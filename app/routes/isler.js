'use strict';
const { zorunlu, metin, sayi, pozitif, gorselKaydet, mesajCoz, sec, setIfadesi } = require('../lib/yardim');

module.exports = (r, { db, web, AYAR, G, Y }) => {
  const yon = (req) => req.kullanici.rol === 'yonetici';

  // Teknisyen sadece kendi ekibinin işlerini görebilir ve sadece planlı/sahadaki işte işlem yapabilir
  async function isErisim(req, id, islemIcin = false) {
    const is = (await db.query('SELECT id, ekip_id, durum FROM isler WHERE id = $1', [id])).rows[0];
    if (!is) throw web.hata(404, 'İş bulunamadı.');
    if (yon(req)) return is;
    if (!req.kullanici.ekip_id || is.ekip_id !== req.kullanici.ekip_id) throw web.hata(403, 'Bu iş sizin ekibinize ait değil.');
    if (islemIcin && !['planlandi', 'sahada'].includes(is.durum)) throw web.hata(400, 'Bu iş üzerinde artık işlem yapılamaz.');
    return is;
  }

  const LISTE_SQL = `
    SELECT i.id, i.baslik, i.durum, i.oncelik, i.adres, i.iletisim_ad, i.iletisim_tel, i.plan_baslangic, i.plan_bitis,
           i.ekip_id, e.ad AS ekip_ad, e.renk AS ekip_renk, i.cari_id, c.unvan AS cari_unvan, c.telefon AS cari_telefon,
           i.olusturma, i.bitis_zamani, i.ham_mesaj
    FROM isler i LEFT JOIN cariler c ON c.id = i.cari_id LEFT JOIN ekipler e ON e.id = i.ekip_id`;

  // ---------- Listeler ----------
  r.get('/isler', Y, async (req) => {
    const k = []; const p = [];
    const ekle = (sql, v) => { p.push(v); k.push(sql.replace('?', '$' + p.length)); };
    if (req.query.durum) ekle('i.durum = ANY(string_to_array(?, \',\')::is_durum[])', req.query.durum);
    if (req.query.cari_id) ekle('i.cari_id = ?', req.query.cari_id);
    if (req.query.ekip_id) ekle('i.ekip_id = ?', req.query.ekip_id);
    if (req.query.bas) ekle('coalesce(i.plan_baslangic, i.olusturma) >= ?::date', req.query.bas);
    if (req.query.bit) ekle('coalesce(i.plan_baslangic, i.olusturma) < ?::date + 1', req.query.bit);
    if (req.query.q) {
      p.push(req.query.q); const n = '$' + p.length;
      k.push(`(i.baslik ILIKE '%' || ${n} || '%' OR c.unvan ILIKE '%' || ${n} || '%' OR i.adres ILIKE '%' || ${n} || '%' OR i.id::text = ${n})`);
    }
    const sql = `${LISTE_SQL} ${k.length ? 'WHERE ' + k.join(' AND ') : ''}
      ORDER BY coalesce(i.plan_baslangic, i.olusturma) DESC LIMIT ${Math.min(Number(req.query.limit) || 200, 1000)}`;
    return (await db.query(sql, p)).rows;
  });

  r.get('/havuz', Y, async () => (await db.query(`
    SELECT h.*, extract(epoch FROM h.bekleme)::int AS bekleme_sn FROM v_is_havuzu h`)).rows);

  // Teknisyen ana ekranı: ekibin planlı/sahadaki işleri + bugün tamamlananlar
  r.get('/islerim', G, async (req) => {
    const ekip = yon(req) ? (req.query.ekip_id || null) : req.kullanici.ekip_id;
    if (!ekip && !yon(req)) return [];
    return (await db.query(`${LISTE_SQL}
      WHERE ($1::bigint IS NULL OR i.ekip_id = $1)
        AND (i.durum IN ('planlandi', 'sahada')
             OR (i.durum IN ('tamamlandi', 'fis_kesildi') AND i.bitis_zamani >= current_date))
      ORDER BY (i.durum = 'sahada') DESC, i.plan_baslangic`, [ekip])).rows;
  });

  // ---------- Detay ----------
  r.get('/isler/:id', G, async (req) => {
    await isErisim(req, req.params.id);
    const id = req.params.id;
    const is = (await db.query(`
      SELECT i.*, c.unvan AS cari_unvan, c.telefon AS cari_telefon, c.adres AS cari_adres, c.yetkili AS cari_yetkili,
             e.ad AS ekip_ad, e.renk AS ekip_renk, ko.ad_soyad AS olusturan
      FROM isler i LEFT JOIN cariler c ON c.id = i.cari_id LEFT JOIN ekipler e ON e.id = i.ekip_id
      LEFT JOIN kullanicilar ko ON ko.id = i.olusturan_id WHERE i.id = $1`, [id])).rows[0];
    const maliyetAlani = yon(req) ? ', m.birim_maliyet, round(m.miktar * m.birim_maliyet, 2) AS tutar' : '';
    const [gecmis, malzemeler, fotolar, teslim] = await Promise.all([
      db.query(`SELECT g.zaman, g.eski_durum, g.yeni_durum, g.aciklama, k.ad_soyad
                FROM is_gecmisi g LEFT JOIN kullanicilar k ON k.id = g.kullanici_id WHERE g.is_id = $1 ORDER BY g.zaman`, [id]),
      db.query(`SELECT m.id, m.urun_id, u.ad, u.kod, u.birim, m.miktar, m.sahada_eklendi, m.barkodla_eklendi, u.onay_bekliyor,
                       m.zaman, k.ad_soyad AS ekleyen ${maliyetAlani}
                FROM is_malzemeleri m JOIN urunler u ON u.id = m.urun_id LEFT JOIN kullanicilar k ON k.id = m.ekleyen_id
                WHERE m.is_id = $1 ORDER BY m.zaman`, [id]),
      db.query(`SELECT f.id, f.dosya_yolu, f.aciklama, f.zaman, k.ad_soyad FROM is_fotograflari f
                LEFT JOIN kullanicilar k ON k.id = f.ekleyen_id WHERE f.is_id = $1 ORDER BY f.zaman`, [id]),
      db.query(`SELECT t.*, k.ad_soyad AS teknisyen FROM teslim_onaylari t LEFT JOIN kullanicilar k ON k.id = t.teknisyen_id
                WHERE t.is_id = $1`, [id]),
    ]);
    const sonuc = { ...is, gecmis: gecmis.rows, malzemeler: malzemeler.rows, fotograflar: fotolar.rows, teslim: teslim.rows[0] || null };
    if (yon(req)) {
      sonuc.fisler = (await db.query(`SELECT id, fis_no, durum, genel_toplam, tarih FROM satis_fisleri WHERE is_id = $1 ORDER BY id`, [id])).rows;
      sonuc.karlilik = (await db.query('SELECT malzeme_maliyeti, satis_kdv_haric, kar, kar_orani, maliyetsiz_kalem FROM v_is_karlilik WHERE is_id = $1', [id])).rows[0];
    } else {
      delete sonuc.ham_mesaj;
    }
    return sonuc;
  });

  // ---------- Oluşturma ----------
  r.post('/isler', Y, async (req) => {
    const b = req.body;
    zorunlu(b, { baslik: 'İş başlığı' });
    if (b.plan_baslangic && !b.ekip_id) throw web.hata(400, 'Takvime eklemek için ekip seçin.');
    return db.islem(req.kullanici.id, async (q) => {
      const { id } = await q.bir(`SELECT is_olustur($1, $2, $3, $4, $5, $6, $7::smallint, $8, $9, $10, $11) AS id`, [
        metin(b.baslik), metin(b.ham_mesaj), b.cari_id || null, metin(b.adres), metin(b.iletisim_ad), metin(b.iletisim_tel),
        b.oncelik || 2, b.plan_baslangic || null, b.plan_bitis || null, b.ekip_id || null, metin(b.aciklama)]);
      return { id };
    });
  });

  // Telefonla gelen işi tek mesajla havuza ekleme: telefon numarasından müşteri otomatik bulunur
  r.post('/isler/hizli', Y, async (req) => {
    const mesaj = metin(req.body.mesaj);
    if (!mesaj) throw web.hata(400, 'Mesaj boş olamaz.');
    const { telefon, baslik } = mesajCoz(mesaj);
    return db.islem(req.kullanici.id, async (q) => {
      const cari = telefon ? await q.bir(`SELECT id, unvan, adres FROM cariler WHERE id = cari_telefonla_bul($1)`, [telefon]) : null;
      const { id } = await q.bir(`SELECT is_olustur($1, $2, $3, $4, NULL, $5, $6::smallint, $7, NULL, $8) AS id`, [
        baslik, mesaj, cari?.id || null, cari?.adres || null, telefon, req.body.oncelik || 2,
        req.body.plan_baslangic || null, req.body.ekip_id || null]);
      return { id, baslik, telefon, cari: cari ? { id: cari.id, unvan: cari.unvan } : null };
    });
  });

  r.put('/isler/:id', Y, async (req) => {
    const alanlar = sec(req.body, ['baslik', 'aciklama', 'adres', 'iletisim_ad', 'iletisim_tel', 'oncelik', 'cari_id', 'ham_mesaj', 'plan_bitis', 'teknisyen_notu']);
    if ('baslik' in alanlar && !metin(alanlar.baslik)) throw web.hata(400, 'İş başlığı boş olamaz.');
    if (!Object.keys(alanlar).length) return { tamam: true };
    await db.islem(req.kullanici.id, async (q) => {
      const { ifade, degerler } = setIfadesi(alanlar, 2);
      const s = await q(`UPDATE isler SET ${ifade} WHERE id = $1 AND durum NOT IN ('fis_kesildi')`, [req.params.id, ...degerler]);
      if (!s.rowCount) throw web.hata(400, 'Fişi kesilmiş iş düzenlenemez.');
    });
    return { tamam: true };
  });

  // ---------- Durum geçişleri ----------
  const fonk = (ad, ...argF) => async (req) => {
    await db.islem(req.kullanici.id, async (q) => {
      const args = [req.params.id, ...argF.map((f) => f(req.body))];
      await q(`SELECT ${ad}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);
    });
    return { tamam: true };
  };

  r.post('/isler/:id/planla', Y, async (req, res) => {
    zorunlu(req.body, { ekip_id: 'Ekip', baslangic: 'Başlangıç' });
    return fonk('is_planla', (b) => b.ekip_id, (b) => b.baslangic, (b) => b.bitis || null)(req, res);
  });
  r.post('/isler/:id/havuza-al', Y, fonk('is_havuza_al', (b) => metin(b.neden)));
  r.post('/isler/:id/iptal', Y, async (req, res) => {
    zorunlu(req.body, { neden: 'İptal nedeni' });
    return fonk('is_iptal', (b) => metin(b.neden))(req, res);
  });
  r.post('/isler/:id/baslat', G, async (req, res) => { await isErisim(req, req.params.id, true); return fonk('is_baslat')(req, res); });
  r.post('/isler/:id/tamamla', G, async (req, res) => {
    await isErisim(req, req.params.id, true);
    return fonk('is_tamamla', (b) => metin(b.not))(req, res);
  });

  // ---------- Saha: malzeme ----------
  r.post('/isler/:id/malzeme', G, async (req) => {
    const is = await isErisim(req, req.params.id, true);
    const miktar = pozitif(req.body.miktar ?? 1, 'Miktar');
    return db.islem(req.kullanici.id, async (q) => {
      if (metin(req.body.barkod)) {
        return q.bir('SELECT is_malzeme_ekle_barkod($1, $2, $3) AS id', [is.id, metin(req.body.barkod), miktar]);
      }
      zorunlu(req.body, { urun_id: 'Ürün' });
      return q.bir('SELECT is_malzeme_ekle($1, $2, $3, false, $4) AS id', [is.id, req.body.urun_id, miktar, is.durum !== 'planlandi' || !yon(req)]);
    });
  });

  r.post('/isler/:id/tanimsiz-urun', G, async (req) => {
    const is = await isErisim(req, req.params.id, true);
    zorunlu(req.body, { ad: 'Ürün açıklaması' });
    const miktar = pozitif(req.body.miktar ?? 1, 'Miktar');
    return db.islem(req.kullanici.id, (q) => q.bir('SELECT sahada_urun_tanimla($1, $2, $3, $4, $5) AS id',
      [is.id, metin(req.body.ad), miktar, metin(req.body.barkod), metin(req.body.not)]));
  });

  r.delete('/malzeme/:id', G, async (req) => {
    const m = (await db.query('SELECT is_id FROM is_malzemeleri WHERE id = $1', [req.params.id])).rows[0];
    if (!m) throw web.hata(404, 'Malzeme bulunamadı.');
    await isErisim(req, m.is_id, !yon(req));
    await db.islem(req.kullanici.id, (q) => q('SELECT is_malzeme_cikar($1)', [req.params.id]));
    return { tamam: true };
  });

  // ---------- Saha: fotoğraf ve teslim onayı ----------
  r.post('/isler/:id/foto', G, async (req) => {
    const is = await isErisim(req, req.params.id, !yon(req));
    const yol = gorselKaydet(AYAR.dosyaKlasor, req.body.veri, 'fotograflar');
    return db.islem(req.kullanici.id, (q) => q.bir(
      'INSERT INTO is_fotograflari (is_id, dosya_yolu, aciklama, ekleyen_id) VALUES ($1, $2, $3, $4) RETURNING id, dosya_yolu',
      [is.id, yol, metin(req.body.aciklama), req.kullanici.id]));
  });

  r.post('/isler/:id/teslim', G, async (req) => {
    const is = await isErisim(req, req.params.id, true);
    if (is.durum !== 'sahada') throw web.hata(400, 'Teslim onayı için önce işi başlatın.');
    zorunlu(req.body, { teslim_alan_ad: 'Teslim alan kişinin adı', imza: 'Müşteri imzası' });
    const yol = gorselKaydet(AYAR.dosyaKlasor, req.body.imza, 'imzalar');
    await db.islem(req.kullanici.id, async (q) => {
      const var_ = await q.bir('SELECT 1 FROM teslim_onaylari WHERE is_id = $1', [is.id]);
      if (var_) throw web.hata(400, 'Bu iş için teslim onayı zaten alınmış.');
      await q(`INSERT INTO teslim_onaylari (is_id, teslim_alan_ad, teslim_alan_tel, imza_dosya, musteri_notu, enlem, boylam, teknisyen_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [is.id, metin(req.body.teslim_alan_ad), metin(req.body.teslim_alan_tel), yol, metin(req.body.musteri_notu),
          sayi(req.body.enlem), sayi(req.body.boylam), req.kullanici.id]);
    });
    return { tamam: true };
  });

  // ---------- Fiş ----------
  r.post('/isler/:id/fis', Y, async (req) => db.islem(req.kullanici.id,
    (q) => q.bir('SELECT satis_fisi_isten_olustur($1) AS id', [req.params.id])));
};
