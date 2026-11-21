'use strict';
const { zorunlu, metin, sayi, sec, setIfadesi } = require('../lib/yardim');

const ALANLAR = ['kod', 'ad', 'marka', 'model', 'ana_grup', 'alt_grup', 'birim', 'onerilen_satis', 'kdv_orani', 'kritik_stok', 'aktif'];

module.exports = (r, { db, web, G, Y }) => {
  const yon = (req) => req.kullanici.rol === 'yonetici';

  // Ürün arama. Her kelime ad, kod, marka, model veya gruplardan birinde geçmeli (Türkçe harf farkı yok sayılır).
  // Barkod tam eşleşirse o ürün de gelir. Teknisyen fiyat/maliyet görmez.
  r.get('/urunler', G, async (req) => {
    const p = []; const k = ['u.aktif'];
    const q = String(req.query.q || '').trim();
    if (q) {
      const kelimeler = q.split(/\s+/).filter(Boolean).slice(0, 6);
      const kosul = kelimeler.map((w) => { p.push(w); return `urun_arama_metni(u) LIKE '%' || arama_metni($${p.length}) || '%'`; });
      p.push(q);
      k.push(`((${kosul.join(' AND ')}) OR EXISTS (SELECT 1 FROM urun_barkodlari b WHERE b.urun_id = u.id AND b.barkod = $${p.length}))`);
    }
    if (req.query.onay_bekliyor === '1') k.push('u.onay_bekliyor');
    for (const alan of ['marka', 'ana_grup', 'alt_grup']) {
      if (req.query[alan]) { p.push(req.query[alan]); k.push(`u.${alan} = $${p.length}`); }
    }
    if (req.query.kategori) { p.push(req.query.kategori); k.push(`u.ana_grup = $${p.length}`); }
    if (req.query.stokta === '1') k.push('u.stok_miktari > 0');
    const alan = yon(req)
      ? 'u.*, (SELECT string_agg(barkod, \', \') FROM urun_barkodlari b WHERE b.urun_id = u.id) AS barkodlar'
      : 'u.id, u.kod, u.ad, u.marka, u.model, u.ana_grup, u.alt_grup, u.birim, u.onay_bekliyor';
    // Aramada adı yazılanla başlayanlar üstte; aramasız listede teknisyen için sık kullanılanlar üstte
    let sira = 'u.ad';
    if (q) { p.push(q); sira = `(arama_metni(u.ad) LIKE arama_metni($${p.length}) || '%') DESC, u.ad`; }
    else if (!yon(req)) sira = '(SELECT count(*) FROM is_malzemeleri m WHERE m.urun_id = u.id AND m.zaman > now() - interval \'90 days\') DESC, u.ad';
    return (await db.query(`SELECT ${alan} FROM urunler u WHERE ${k.join(' AND ')} ORDER BY ${sira}
      LIMIT ${Math.min(Number(req.query.limit) || 300, 2000)}`, p)).rows;
  });

  // Filtre seçenekleri: markalar ve ana grup -> alt gruplar
  r.get('/urun-gruplari', G, async () => {
    const markalar = (await db.query("SELECT DISTINCT marka FROM urunler WHERE aktif AND coalesce(marka, '') <> '' ORDER BY 1")).rows.map((x) => x.marka);
    const satir = (await db.query(`SELECT ana_grup,
        coalesce(jsonb_agg(DISTINCT alt_grup) FILTER (WHERE coalesce(alt_grup, '') <> ''), '[]'::jsonb) AS altlar
      FROM urunler WHERE aktif AND coalesce(ana_grup, '') <> '' GROUP BY ana_grup ORDER BY ana_grup`)).rows;
    return { markalar, gruplar: satir.map((g) => ({ ana: g.ana_grup, altlar: (g.altlar || []).filter(Boolean).sort((a, b) => a.localeCompare(b, 'tr')) })) };
  });

  r.get('/urunler/barkod/:barkod', G, async (req) => {
    const u = (await db.query(`SELECT u.id, u.kod, u.ad, u.birim, u.onay_bekliyor ${yon(req) ? ', u.ort_maliyet, u.onerilen_satis, u.kdv_orani, u.stok_miktari' : ''}
      FROM urunler u WHERE u.id = barkod_bul($1)`, [req.params.barkod])).rows[0];
    if (!u) throw web.hata(404, 'Bu barkod tanımlı değil.', 'BARKOD_TANIMSIZ');
    return u;
  });

  r.get('/urun-kategorileri', Y, async () => (await db.query(
    "SELECT DISTINCT ana_grup FROM urunler WHERE coalesce(ana_grup, '') <> '' ORDER BY 1")).rows.map((x) => x.ana_grup));

  r.get('/urunler/:id', Y, async (req) => {
    const u = (await db.query('SELECT * FROM urunler WHERE id = $1', [req.params.id])).rows[0];
    if (!u) throw web.hata(404, 'Ürün bulunamadı.');
    const [barkodlar, hareketler] = await Promise.all([
      db.query('SELECT barkod FROM urun_barkodlari WHERE urun_id = $1 ORDER BY barkod', [u.id]),
      db.query(`SELECT s.zaman, s.miktar, s.birim_maliyet, s.kaynak, s.kaynak_id, s.aciklama, k.ad_soyad
                FROM stok_hareketleri s LEFT JOIN kullanicilar k ON k.id = s.kullanici_id
                WHERE s.urun_id = $1 ORDER BY s.zaman DESC LIMIT 200`, [u.id]),
    ]);
    return { ...u, barkodlar: barkodlar.rows.map((b) => b.barkod), hareketler: hareketler.rows };
  });

  async function barkodlariYaz(q, urunId, liste) {
    if (!Array.isArray(liste)) return;
    const temiz = [...new Set(liste.map((b) => String(b).trim()).filter(Boolean))];
    await q('DELETE FROM urun_barkodlari WHERE urun_id = $1', [urunId]);
    for (const b of temiz) {
      const var_ = await q.bir('SELECT u.ad FROM urun_barkodlari x JOIN urunler u ON u.id = x.urun_id WHERE x.barkod = $1', [b]);
      if (var_) throw web.hata(409, `"${b}" barkodu başka bir ürüne (${var_.ad}) tanımlı.`, 'BARKOD_TEKRAR');
      await q('INSERT INTO urun_barkodlari (barkod, urun_id) VALUES ($1, $2)', [b, urunId]);
    }
  }

  r.post('/urunler', Y, async (req) => {
    zorunlu(req.body, { ad: 'Ürün adı' });
    const a = sec(req.body, ALANLAR);
    for (const s of ['onerilen_satis', 'kdv_orani', 'kritik_stok']) if (s in a) a[s] = sayi(a[s]);
    if (a.kdv_orani === null) delete a.kdv_orani;
    if (!a.birim) delete a.birim;
    const maliyet = sayi(req.body.ort_maliyet) || 0;
    return db.islem(req.kullanici.id, async (q) => {
      const anahtarlar = Object.keys(a);
      const u = await q.bir(`INSERT INTO urunler (${anahtarlar.join(', ')}, ort_maliyet, olusturan_id)
        VALUES (${anahtarlar.map((_, i) => '$' + (i + 1)).join(', ')}, $${anahtarlar.length + 1}, $${anahtarlar.length + 2}) RETURNING id, ad`,
      [...anahtarlar.map((x) => a[x]), maliyet, req.kullanici.id]);
      await barkodlariYaz(q, u.id, req.body.barkodlar);
      const acilis = sayi(req.body.acilis_stok);
      if (acilis) await q(`SELECT stok_hareket($1, $2, $3, 'sayim', NULL, 'Açılış stoğu')`, [u.id, acilis, maliyet]);
      return u;
    });
  });

  r.put('/urunler/:id', Y, async (req) => {
    const a = sec(req.body, ALANLAR);
    for (const s of ['onerilen_satis', 'kdv_orani', 'kritik_stok']) if (s in a) a[s] = sayi(a[s]);
    if ('ad' in a && !metin(a.ad)) throw web.hata(400, 'Ürün adı boş olamaz.');
    if (a.kdv_orani === null) delete a.kdv_orani;
    await db.islem(req.kullanici.id, async (q) => {
      if (Object.keys(a).length) {
        const { ifade, degerler } = setIfadesi(a, 2);
        await q(`UPDATE urunler SET ${ifade} WHERE id = $1`, [req.params.id, ...degerler]);
      }
      await barkodlariYaz(q, req.params.id, req.body.barkodlar);
    });
    return { tamam: true };
  });

  // Sahadan gelen ürünü onayla (maliyet girilir)
  r.post('/urunler/:id/onayla', Y, async (req) => {
    const maliyet = sayi(req.body.birim_maliyet, 'Maliyet');
    if (maliyet === null || maliyet < 0) throw web.hata(400, 'Birim maliyet girin.');
    await db.islem(req.kullanici.id, async (q) => {
      await q('SELECT urun_onayla($1, $2, $3, $4, $5)', [req.params.id, maliyet, metin(req.body.ad), metin(req.body.kod), sayi(req.body.onerilen_satis)]);
      if (Array.isArray(req.body.barkodlar)) await barkodlariYaz(q, req.params.id, req.body.barkodlar);
    });
    return { tamam: true };
  });

  // Sahadan gelen ürün aslında var olan bir ürünse: kayıtları o ürüne aktar
  r.post('/urunler/:id/birlestir', Y, async (req) => {
    zorunlu(req.body, { hedef_id: 'Hedef ürün' });
    await db.islem(req.kullanici.id, async (q) => {
      const kaynak = await q.bir('SELECT * FROM urunler WHERE id = $1 AND onay_bekliyor', [req.params.id]);
      if (!kaynak) throw web.hata(400, 'Sadece onay bekleyen ürünler birleştirilebilir.');
      const hedef = await q.bir('SELECT * FROM urunler WHERE id = $1 AND NOT onay_bekliyor', [req.body.hedef_id]);
      if (!hedef) throw web.hata(400, 'Hedef ürün bulunamadı.');
      const acik = await q.hepsi(`SELECT m.id FROM is_malzemeleri m JOIN isler i ON i.id = m.is_id
                                  WHERE m.urun_id = $1 AND i.durum = 'fis_kesildi'`, [kaynak.id]);
      if (acik.length) throw web.hata(400, 'Bu ürün fişi kesilmiş bir işte kullanılmış, birleştirilemez.');
      // Stok: kaynağın hareketlerini tersle, hedefe yaz
      const malz = await q.hepsi('SELECT * FROM is_malzemeleri WHERE urun_id = $1', [kaynak.id]);
      for (const m of malz) {
        await q(`SELECT stok_hareket($1, $2, 0, 'duzeltme', $3, 'Birleştirme')`, [kaynak.id, m.miktar, m.is_id]);
        const h = await q.bir(`SELECT stok_hareket($1, $2, $3, 'is_malzeme', $4, $5) AS id`,
          [hedef.id, -m.miktar, hedef.ort_maliyet, m.is_id, 'İş #' + m.is_id]);
        await q('UPDATE is_malzemeleri SET urun_id = $2, birim_maliyet = $3, stok_hareket_id = $4 WHERE id = $1',
          [m.id, hedef.id, hedef.ort_maliyet, h.id]);
      }
      await q(`UPDATE satis_fisi_satirlari s SET urun_id = $2, birim_maliyet = $3, aciklama = $4
               FROM satis_fisleri f WHERE s.fis_id = f.id AND f.durum = 'taslak' AND s.urun_id = $1`,
      [kaynak.id, hedef.id, hedef.ort_maliyet, hedef.ad]);
      await q('UPDATE urun_barkodlari SET urun_id = $2 WHERE urun_id = $1', [kaynak.id, hedef.id]);
      await q('UPDATE urunler SET aktif = false, onay_bekliyor = false, ad = ad || \' (birleştirildi)\' WHERE id = $1', [kaynak.id]);
    });
    return { tamam: true };
  });

  r.post('/urunler/:id/sayim', Y, async (req) => {
    const m = sayi(req.body.miktar, 'Sayılan miktar');
    if (m === null) throw web.hata(400, 'Sayılan miktarı girin.');
    await db.islem(req.kullanici.id, (q) => q('SELECT stok_sayim($1, $2, $3)', [req.params.id, m, metin(req.body.aciklama) || 'Sayım']));
    return { tamam: true };
  });
};
