'use strict';
const { bugun, zorunlu, metin, sayi, tarih, sec, setIfadesi } = require('../lib/yardim');

const ALANLAR = ['kod', 'tip', 'unvan', 'yetkili', 'telefon', 'telefon2', 'eposta', 'adres', 'il', 'ilce',
  'vergi_dairesi', 'vergi_no', 'notlar', 'aktif'];

module.exports = (r, { db, web, Y, G }) => {
  // Teknisyen iş eklerken: cari arama (yalnız ad / telefon / konum) ve yeni cari açma (ünvan zorunlu, telefon isteğe bağlı)
  r.get('/cariler/ara', G, async (req) => {
    const q = String(req.query.q || '').trim();
    const p = []; let kosul = 'aktif';
    if (q) { p.push(q); kosul += ` AND (arama_metni(concat_ws(' ', unvan, kod, telefon, telefon2, yetkili)) LIKE '%' || arama_metni($1) || '%'
      OR regexp_replace(concat_ws(' ', telefon, telefon2), '\\D', '', 'g') LIKE '%' || nullif(regexp_replace($1, '\\D', '', 'g'), '') || '%')`; }
    return (await db.query(`SELECT id, unvan, telefon, il, ilce, adres FROM cariler WHERE ${kosul} ORDER BY unvan LIMIT 20`, p)).rows;
  });
  r.post('/cariler/hizli', G, async (req) => {
    const unvan = metin(req.body.unvan);
    if (!unvan) throw web.hata(400, 'Ünvan / ad soyad yazın.');
    return db.islem(req.kullanici.id, (q) => q.bir(`INSERT INTO cariler (unvan, telefon, adres, tip) VALUES ($1, $2, $3, 'musteri') RETURNING id, unvan, telefon, adres`,
      [unvan, metin(req.body.telefon), metin(req.body.adres)]));
  });
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

  // Detaylı ekstre: devir + hareketler (borç / alacak / yürüyen bakiye) + satış fişi ve alış faturası kalemleri + ödeme şekli. Vade yok.
  r.get('/cariler/:id/detayli-ekstre', Y, async (req) => {
    const yil = new Date().getFullYear();
    const bas = tarih(req.query.bas) || `${yil}-01-01`;
    const bit = tarih(req.query.bit) || `${yil}-12-31`;
    const cari = (await db.query('SELECT id, kod, unvan, tip, telefon, eposta, adres, il, ilce, vergi_dairesi, vergi_no FROM cariler WHERE id = $1', [req.params.id])).rows[0];
    if (!cari) throw web.hata(404, 'Cari bulunamadı.');
    const devir = Number((await db.query(`SELECT coalesce(sum(borc - alacak), 0) AS b FROM cari_hareketler
      WHERE cari_id = $1 AND NOT iptal AND tarih < $2::date`, [cari.id, bas])).rows[0].b);
    const hareket = (await db.query(`SELECT h.id, h.tarih, h.belge_tip::text AS belge_tip, h.belge_id, h.belge_no, h.aciklama, h.borc, h.alacak
      FROM cari_hareketler h WHERE h.cari_id = $1 AND NOT h.iptal AND h.tarih BETWEEN $2::date AND $3::date ORDER BY h.tarih, h.id`, [cari.id, bas, bit])).rows;
    const idler = (t) => hareket.filter((h) => h.belge_tip === t && h.belge_id).map((h) => Number(h.belge_id));
    const grupla = (rows, k) => rows.reduce((m, x) => { (m[x[k]] ||= []).push(x); return m; }, {});
    const fisK = idler('satis_fisi').length ? grupla((await db.query(`SELECT s.fis_id, s.aciklama AS ad, s.miktar, s.birim, s.birim_fiyat, s.iskonto_orani, s.kdv_orani,
        round(s.miktar * s.birim_fiyat * (1 - s.iskonto_orani / 100), 2) AS tutar
      FROM satis_fisi_satirlari s WHERE s.fis_id = ANY(string_to_array($1, ',')::bigint[]) ORDER BY s.fis_id, s.sira, s.id`, [idler('satis_fisi').join(',')])).rows, 'fis_id') : {};
    const alisK = idler('alis_faturasi').length ? grupla((await db.query(`SELECT s.fatura_id, u.ad, s.miktar, u.birim, s.birim_fiyat, 0 AS iskonto_orani, s.kdv_orani,
        round(s.miktar * s.birim_fiyat, 2) AS tutar
      FROM alis_faturasi_satirlari s JOIN urunler u ON u.id = s.urun_id WHERE s.fatura_id = ANY(string_to_array($1, ',')::bigint[]) ORDER BY s.fatura_id, s.id`, [idler('alis_faturasi').join(',')])).rows, 'fatura_id') : {};
    // İşten kesilen fişte açıklama işin başlığıdır; detaylı ekstrede gösterilmez (kalemler zaten yazılı)
    const isBasliklari = idler('satis_fisi').length ? Object.fromEntries((await db.query(`SELECT f.id, i.baslik FROM satis_fisleri f JOIN isler i ON i.id = f.is_id
      WHERE f.id = ANY(string_to_array($1, ',')::bigint[])`, [idler('satis_fisi').join(',')])).rows.map((x) => [x.id, x.baslik])) : {};
    const finIdler = [...idler('tahsilat'), ...idler('odeme')];
    const fin = finIdler.length ? Object.fromEntries((await db.query(`SELECT f.id, h.ad AS hesap, h.tip::text AS hesap_tip FROM finans_hareketleri f JOIN hesaplar h ON h.id = f.hesap_id
      WHERE f.id = ANY(string_to_array($1, ',')::bigint[])`, [finIdler.join(',')])).rows.map((x) => [x.id, x])) : {};
    let bakiye = devir; let borc = 0; let alacak = 0;
    const satirlar = hareket.map((h) => {
      const b = Number(h.borc); const a = Number(h.alacak);
      bakiye += b - a; borc += b; alacak += a;
      const kalemler = (h.belge_tip === 'satis_fisi' ? fisK[h.belge_id] : h.belge_tip === 'alis_faturasi' ? alisK[h.belge_id] : null) || [];
      return {
        tarih: h.tarih, belge_tip: h.belge_tip, belge_id: h.belge_id, belge_no: h.belge_no,
        aciklama: h.belge_tip === 'satis_fisi' && isBasliklari[h.belge_id] != null
          && (String(h.aciklama || '').includes(String(isBasliklari[h.belge_id]).trim()) || /^İş #\d+/.test(String(h.aciklama || ''))) ? 'Satış fişi' : h.aciklama,
        borc: b, alacak: a,
        bakiye: Math.round(bakiye * 100) / 100,
        odeme: fin[h.belge_id] && ['tahsilat', 'odeme'].includes(h.belge_tip) ? fin[h.belge_id] : null,
        kalemler: kalemler.map((k) => {
          const net = Number(k.tutar);
          return { ad: k.ad, miktar: Number(k.miktar), birim: k.birim, birim_fiyat: Number(k.birim_fiyat), iskonto_orani: Number(k.iskonto_orani), kdv_orani: Number(k.kdv_orani),
            tutar: net, kdvli: Math.round(net * (1 + Number(k.kdv_orani) / 100) * 100) / 100 };
        }),
      };
    });
    const r2 = (n) => Math.round(n * 100) / 100;
    return { cari, bas, bit, devir: r2(devir), satirlar, toplam: { borc: r2(borc), alacak: r2(alacak), bakiye: r2(bakiye) } };
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
