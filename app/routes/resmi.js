'use strict';
// Resmi faturalar: tek yükleme ekranı (alış / satış ayrımı vergi numarasından), kesilen satış faturaları, yalnız KDV (gider) alışlar,
// elle KDV kaydı. Bu kayıtlar cari bakiyesini / stoğu / kasayı etkilemez; yalnız KDV durumunda kullanılır. Dosya saklanmaz.
const { efaturaOku } = require('../lib/efatura');
const { zipAc } = require('../lib/zip');
const { metin, sayi, tarih } = require('../lib/yardim');
const { eslestirici, dosyaMetni, r2 } = require('../lib/efaturaEslestir');

const GIDER_TURLERI = ['Akaryakıt', 'Telefon / internet', 'Kira', 'Kargo', 'Yemek', 'Elektrik / su / doğalgaz', 'Kırtasiye', 'Diğer'];
const vknSade = (v) => String(v || '').replace(/\D/g, '');

// Faturanın TL tutarları ve oran bazında KDV dökümü
function tutarlar(f) {
  const kur = f.doviz === 'TRY' ? 1 : Number(f.kur) || 0;
  const dokum = (f.kdvDokum?.length ? f.kdvDokum
    : [...f.satirlar.reduce((m, s) => { const y = m.get(s.kdv_orani) || { oran: s.kdv_orani, matrah: 0, kdv: 0 }; y.matrah += s.tutar; y.kdv += s.tutar * s.kdv_orani / 100; return m.set(s.kdv_orani, y); }, new Map()).values()])
    .map((o) => ({ oran: o.oran, matrah: r2(o.matrah * kur), kdv: r2(o.kdv * kur) }));
  const matrah = r2(dokum.reduce((t, o) => t + o.matrah, 0));
  const kdv = r2(dokum.reduce((t, o) => t + o.kdv, 0));
  return { kur, dokum, matrah, kdv, tevkifat: r2((f.tevkifat || 0) * kur), toplam: r2(matrah + kdv) };
}
const kalemOzet = (f) => f.satirlar.map((s) => ({ ad: s.ad, miktar: s.miktar, birim: s.birim, birim_fiyat: s.birim_fiyat, iskonto_orani: s.iskonto_orani, kdv_orani: s.kdv_orani, tutar: s.tutar }));

module.exports = (r, { db, web, Y }) => {
  const { urunleriYukle, onizle } = eslestirici(db);
  const firmaVkn = async () => vknSade((await db.query("SELECT deger FROM ayarlar WHERE anahtar = 'firma_vergi_no'")).rows[0]?.deger);

  async function cariBul(q, vkn, unvan) {
    let c = null;
    if (vkn) c = await q.bir(`SELECT id, unvan FROM cariler WHERE regexp_replace(coalesce(vergi_no, ''), '\\D', '', 'g') = $1 ORDER BY aktif DESC, id LIMIT 1`, [vkn]);
    if (!c && unvan) c = await q.bir('SELECT id, unvan FROM cariler WHERE lower(unvan) = lower($1) ORDER BY aktif DESC, id LIMIT 1', [unvan]);
    return c;
  }

  async function resmiEkle(q, { yon, kaynak = 'xml', f, kullanici, gider_turu = null, aciklama = null, cari_id }) {
    const t = tutarlar(f);
    const karsi = (yon === 'satis' ? f.alici : f.tedarikci) || {};
    const vkn = vknSade(karsi.vkn || karsi.tckn);
    // Satışta vergi no / ünvan, alışta (gider) yalnız vergi no ile programdaki cariye bağlanır (bakiye oluşmaz)
    const cari = cari_id !== undefined ? (cari_id ? { id: cari_id } : null) : await cariBul(q, vkn, yon === 'satis' ? karsi.unvan : null);
    const x = await q.bir(`INSERT INTO resmi_faturalar (yon, kaynak, ettn, belge_no, tarih, tip, profil, karsi_unvan, karsi_vkn, karsi_vergi_dairesi,
        karsi_adres, karsi_il, karsi_ilce, karsi_telefon, karsi_eposta, cari_id, doviz, kur, matrah, kdv, tevkifat, toplam, kdv_dokum, kalemler,
        gider_turu, aciklama, olusturan_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24::jsonb,$25,$26,$27) RETURNING id`,
    [yon, kaynak, f.ettn || null, f.no || null, f.tarih, f.tip || null, f.profil || null, karsi.unvan || '—', vkn || null, karsi.vergi_dairesi || null,
      karsi.adres || null, karsi.il || null, karsi.ilce || null, karsi.telefon || null, karsi.eposta || null, cari?.id || null,
      f.doviz || 'TRY', f.doviz === 'TRY' ? null : t.kur, t.matrah, t.kdv, t.tevkifat, t.toplam, JSON.stringify(t.dokum), JSON.stringify(kalemOzet(f)),
      gider_turu, aciklama, kullanici]);
    return { id: x.id, cari };
  }

  // ---------- Tek yükleme: yönü vergi numarası belirler ----------
  r.post('/resmi/yukle', Y, async (req) => {
    const fv = await firmaVkn();
    if (!fv) throw web.hata(400, 'Önce firmanızın vergi numarasını girin (alış / satış ayrımı buna göre yapılır).', 'FIRMA_VKN_YOK');
    const liste = Array.isArray(req.body.dosyalar) ? req.body.dosyalar.slice(0, 500) : [];
    if (!liste.length) throw web.hata(400, 'Dosya seçin.');
    const hatalar = []; const okunan = [];
    for (const d of liste) {
      const ad = String(d.ad || 'dosya');
      let buf;
      try { buf = Buffer.from(String(d.veri || '').replace(/^data:[^,]*,/, ''), 'base64'); } catch { hatalar.push({ dosya: ad, hata: 'Dosya okunamadı.' }); continue; }
      let xmller;
      try {
        xmller = buf[0] === 0x50 && buf[1] === 0x4b ? zipAc(buf).filter((x) => /\.xml$/i.test(x.ad)).map((x) => ({ ad: `${ad} › ${x.ad}`, icerik: x.icerik })) : [{ ad, icerik: buf }];
        if (!xmller.length) hatalar.push({ dosya: ad, hata: 'Zip içinde XML yok.' });
      } catch (e) { hatalar.push({ dosya: ad, hata: e.message }); continue; }
      for (const x of xmller) {
        try { okunan.push({ dosya: x.ad, ...efaturaOku(dosyaMetni(x.icerik)) }); } catch (e) { hatalar.push({ dosya: x.ad, hata: /XML:|e-Fatura/.test(e.message) ? e.message : 'XML okunamadı.' }); }
      }
    }
    const gorulen = new Set();
    const satis = { eklenen: [], tekrar: [] }; const alisHam = []; const reddedilen = [];
    for (const f of okunan) {
      const k = f.ettn || `${vknSade(f.tedarikci?.vkn)}|${f.no}`;
      if (gorulen.has(k)) continue;
      gorulen.add(k);
      const satici = vknSade(f.tedarikci?.vkn || f.tedarikci?.tckn);
      const alici = vknSade(f.alici?.vkn || f.alici?.tckn);
      if (satici === fv) {
        if (f.doviz !== 'TRY' && !f.kur) { hatalar.push({ dosya: f.dosya, hata: `${f.no}: ${f.doviz} faturada kur yok.` }); continue; }
        const var_ = f.ettn && (await db.query('SELECT id FROM resmi_faturalar WHERE ettn IS NOT NULL AND lower(ettn) = $1', [f.ettn])).rows[0];
        if (var_) { satis.tekrar.push({ no: f.no, id: var_.id }); continue; }
        const e = await db.islem(req.kullanici.id, (q) => resmiEkle(q, { yon: 'satis', f, kullanici: req.kullanici.id }));
        satis.eklenen.push({ id: e.id, no: f.no, tarih: f.tarih, musteri: f.alici?.unvan || '', vkn: vknSade(f.alici?.vkn || f.alici?.tckn), cari: e.cari, tip: f.tip, toplam: tutarlar(f).toplam });
      } else if (alici === fv) alisHam.push(f);
      else reddedilen.push({ dosya: f.dosya, no: f.no, satici: f.tedarikci?.unvan || '', neden: 'Satıcı da alıcı da firmanız değil.' });
    }
    const st = alisHam.length ? await urunleriYukle() : null;
    const alis = [];
    for (const f of alisHam) alis.push(await onizle(f, st));
    return { satis, alis, reddedilen, hatalar, gider_turleri: GIDER_TURLERI };
  });

  // Alış faturasını "yalnız KDV (gider)" olarak kaydet
  r.post('/resmi/gider', Y, async (req) => {
    const f = req.body.fatura || {};
    if (!f.no || !f.tarih) throw web.hata(400, 'Fatura bilgisi eksik.');
    if (!Array.isArray(f.satirlar)) f.satirlar = [];
    if (!Array.isArray(f.kdvDokum)) f.kdvDokum = [];
    if (f.doviz !== 'TRY' && !(Number(f.kur) > 0)) throw web.hata(400, `${f.doviz} kurunu girin.`, 'KUR_YOK');
    const ettn = metin(f.ettn)?.toLowerCase() || null;
    const id = await db.islem(req.kullanici.id, async (q) => {
      if (ettn && await q.bir('SELECT 1 AS v FROM resmi_faturalar WHERE ettn IS NOT NULL AND lower(ettn) = $1', [ettn])) throw web.hata(409, 'Bu fatura daha önce kaydedilmiş.', 'MUKERRER');
      if (ettn && await q.bir('SELECT 1 AS v FROM alis_faturalari WHERE ettn IS NOT NULL AND lower(ettn) = $1', [ettn])) throw web.hata(409, 'Bu fatura stoklu alış faturası olarak girilmiş.', 'MUKERRER');
      f.ettn = ettn;
      const gt = GIDER_TURLERI.includes(req.body.gider_turu) ? req.body.gider_turu : null;
      const e = await resmiEkle(q, { yon: 'alis', f, kullanici: req.kullanici.id, gider_turu: gt, cari_id: req.body.cari_id ? Number(req.body.cari_id) : undefined });
      const vkn = vknSade(f.tedarikci?.vkn || f.tedarikci?.tckn);
      if (vkn) await q(`INSERT INTO tedarikci_tercih (vkn, secim, gider_turu) VALUES ($1, 'gider', $2)
        ON CONFLICT (vkn) DO UPDATE SET secim = 'gider', gider_turu = excluded.gider_turu, guncelleme = now()`, [vkn, gt]);
      return e.id;
    });
    return { id };
  });

  // Elle KDV kaydı (e-Fatura olmayan belge)
  r.post('/resmi/elle', Y, async (req) => {
    const b = req.body;
    const yon = b.yon === 'satis' ? 'satis' : 'alis';
    const unvan = metin(b.karsi_unvan); if (!unvan) throw web.hata(400, 'Firma / kişi adı girin.');
    const t = tarih(b.tarih); if (!t) throw web.hata(400, 'Tarih girin.');
    const matrah = sayi(b.matrah, 'Tutar'); if (!(matrah > 0)) throw web.hata(400, 'KDV hariç tutarı girin.');
    const oran = sayi(b.kdv_orani, 'KDV oranı') ?? 20;
    const kdv = b.kdv !== undefined && b.kdv !== '' && b.kdv !== null ? r2(sayi(b.kdv, 'KDV')) : r2(matrah * oran / 100);
    const id = await db.islem(req.kullanici.id, async (q) => (await q.bir(`INSERT INTO resmi_faturalar (yon, kaynak, belge_no, tarih, karsi_unvan, karsi_vkn,
        cari_id, matrah, kdv, toplam, kdv_dokum, gider_turu, aciklama, olusturan_id)
      VALUES ($1, 'elle', $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13) RETURNING id`,
    [yon, metin(b.belge_no), t, unvan, vknSade(b.karsi_vkn) || null, b.cari_id ? Number(b.cari_id) : null, r2(matrah), kdv, r2(matrah + kdv),
      JSON.stringify([{ oran, matrah: r2(matrah), kdv }]), yon === 'alis' && GIDER_TURLERI.includes(b.gider_turu) ? b.gider_turu : null, metin(b.aciklama), req.kullanici.id])).id);
    return { id };
  });

  r.get('/resmi', Y, async (req) => {
    const p = []; const k = [];
    const ekle = (sql, v) => { p.push(v); k.push(sql.replaceAll('?', '$' + p.length)); };
    if (req.query.yon) ekle('r.yon = ?', req.query.yon === 'satis' ? 'satis' : 'alis');
    if (req.query.cari_id) ekle('r.cari_id = ?', Number(req.query.cari_id));
    if (req.query.ay && /^\d{4}-\d{2}$/.test(req.query.ay)) ekle("r.tarih >= (? || '-01')::date AND r.tarih < ((? || '-01')::date + interval '1 month')", req.query.ay);
    if (req.query.yil && /^\d{4}$/.test(req.query.yil)) ekle("extract(year FROM r.tarih) = ?::int", req.query.yil);
    if (req.query.q) ekle("(r.belge_no ILIKE '%' || ? || '%' OR r.karsi_unvan ILIKE '%' || ? || '%' OR c.unvan ILIKE '%' || ? || '%')", req.query.q);
    if (req.query.eslesmeyen === '1') k.push('r.cari_id IS NULL');
    return (await db.query(`SELECT r.id, r.yon, r.kaynak, r.belge_no, r.tarih, r.tip, r.karsi_unvan, r.karsi_vkn, r.cari_id, c.unvan AS cari_unvan,
        r.doviz, r.matrah, r.kdv, r.tevkifat, r.toplam, r.gider_turu
      FROM resmi_faturalar r LEFT JOIN cariler c ON c.id = r.cari_id
      ${k.length ? 'WHERE ' + k.join(' AND ') : ''} ORDER BY r.tarih DESC, r.id DESC LIMIT 2000`, p)).rows;
  });

  // Cari → Resmi faturalar: resmi satış + gider kayıtları + XML'den aktarılmış stoklu alış faturaları (işlem tipiyle)
  r.get('/resmi/cari/:id', Y, async (req) => {
    const cari = Number(req.params.id);
    const yil = /^\d{4}$/.test(String(req.query.yil || '')) ? Number(req.query.yil) : null;
    const yk = yil ? 'AND extract(year FROM tarih) = $2' : '';
    const p = yil ? [cari, yil] : [cari];
    const resmi = (await db.query(`SELECT id, yon, kaynak, belge_no, tarih, tip, matrah, kdv, tevkifat, toplam, gider_turu,
        CASE yon WHEN 'satis' THEN 'satis' ELSE 'gider' END AS tur
      FROM resmi_faturalar WHERE cari_id = $1 ${yk}`, p)).rows;
    const stoklu = (await db.query(`SELECT id, 'alis' AS yon, 'xml' AS kaynak, belge_no, tarih, NULL AS tip, ara_toplam AS matrah, kdv_toplam AS kdv,
        0 AS tevkifat, genel_toplam AS toplam, NULL AS gider_turu, 'stoklu' AS tur, durum
      FROM alis_faturalari WHERE cari_id = $1 AND ettn IS NOT NULL ${yk}`, p)).rows;
    return [...resmi, ...stoklu].map((x) => ({ ...x, matrah: Number(x.matrah), kdv: Number(x.kdv), toplam: Number(x.toplam), tevkifat: Number(x.tevkifat || 0) }))
      .sort((a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : b.id - a.id));
  });

  r.get('/resmi/:id', Y, async (req) => {
    const x = (await db.query(`SELECT r.*, c.unvan AS cari_unvan FROM resmi_faturalar r LEFT JOIN cariler c ON c.id = r.cari_id WHERE r.id = $1`, [req.params.id])).rows[0];
    if (!x) throw web.hata(404, 'Fatura bulunamadı.');
    return x;
  });

  // Cari bağla / yeni cari aç / bağı kaldır
  r.put('/resmi/:id/cari', Y, async (req) => db.islem(req.kullanici.id, async (q) => {
    const x = await q.bir('SELECT * FROM resmi_faturalar WHERE id = $1', [req.params.id]);
    if (!x) throw web.hata(404, 'Fatura bulunamadı.');
    let cariId = req.body.cari_id ? Number(req.body.cari_id) : null;
    if (req.body.yeni_cari) {
      cariId = (await q.bir(`INSERT INTO cariler (tip, unvan, vergi_no, vergi_dairesi, adres, il, ilce, telefon, eposta, olusturan_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [x.yon === 'satis' ? 'musteri' : 'tedarikci', x.karsi_unvan, x.karsi_vkn, x.karsi_vergi_dairesi, x.karsi_adres, x.karsi_il, x.karsi_ilce, x.karsi_telefon, x.karsi_eposta, req.kullanici.id])).id;
    }
    await q('UPDATE resmi_faturalar SET cari_id = $2 WHERE id = $1', [x.id, cariId]);
    // Aynı vergi numaralı diğer eşleşmeyen faturalar da bu cariye bağlanır
    let digerleri = 0;
    if (cariId && x.karsi_vkn) {
      digerleri = (await q('UPDATE resmi_faturalar SET cari_id = $2 WHERE karsi_vkn = $1 AND cari_id IS NULL AND yon = $3', [x.karsi_vkn, cariId, x.yon])).rowCount || 0;
      if (req.body.yeni_cari === undefined && !(await q.bir("SELECT 1 AS v FROM cariler WHERE id = $1 AND coalesce(vergi_no, '') <> ''", [cariId]))) {
        await q('UPDATE cariler SET vergi_no = $2 WHERE id = $1', [cariId, x.karsi_vkn]);
      }
    }
    return { cari_id: cariId, digerleri };
  }));

  r.delete('/resmi/:id', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('DELETE FROM resmi_faturalar WHERE id = $1', [req.params.id]));
    return { tamam: true };
  });

  // Yalnız KDV kaydını stoklu alışa çevirmek: kayıt silinir, tedarikçi tercihi "stoklu" olur; XML yeniden yüklenir
  r.post('/resmi/:id/stokluya', Y, async (req) => db.islem(req.kullanici.id, async (q) => {
    const x = await q.bir("SELECT id, karsi_vkn FROM resmi_faturalar WHERE id = $1 AND yon = 'alis'", [req.params.id]);
    if (!x) throw web.hata(404, 'Fatura bulunamadı.');
    await q('DELETE FROM resmi_faturalar WHERE id = $1', [x.id]);
    if (x.karsi_vkn) await q(`INSERT INTO tedarikci_tercih (vkn, secim) VALUES ($1, 'stoklu') ON CONFLICT (vkn) DO UPDATE SET secim = 'stoklu', guncelleme = now()`, [x.karsi_vkn]);
    return { tamam: true };
  }));

  r.get('/resmi-gider-turleri', Y, async () => GIDER_TURLERI);
};
