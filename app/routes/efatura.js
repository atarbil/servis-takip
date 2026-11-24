'use strict';
// e-Fatura XML (UBL-TR) → taslak alış faturası. Yüklenen dosya hiçbir yere yazılmaz; yalnız bellekte okunur.
const { efaturaOku } = require('../lib/efatura');
const { zipAc } = require('../lib/zip');
const { metin, sayi, tarih } = require('../lib/yardim');

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const DOVIZ = ['TRY', 'USD', 'EUR'];

// Türkçe küçük harf, noktalama atılır
const sade = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[^0-9a-zçğıöşü]+/g, ' ').replace(/\s+/g, ' ').trim();
const kodSade = (s) => String(s || '').toLocaleUpperCase('tr').replace(/[\s-]+/g, '');
const barkodMu = (s) => /^\d{8,14}$/.test(String(s || '').trim());

function benzerlik(a, b) {
  const A = new Set(sade(a).split(' ').filter((t) => t.length > 1));
  const B = new Set(sade(b).split(' ').filter((t) => t.length > 1));
  if (!A.size || !B.size) return 0;
  let ortak = 0; let kodOrtak = 0;
  for (const t of A) if (B.has(t)) { ortak++; if (/\d/.test(t) && /[a-zçğıöşü]/.test(t)) kodOrtak++; }
  // Model kodu gibi harf+rakam karışık bir parça tutuyorsa güçlü işaret
  return Math.min(1, (2 * ortak) / (A.size + B.size) + kodOrtak * 0.25);
}

// Satır anahtarı: tedarikçinin ürün kodu varsa o, yoksa sadeleştirilmiş ad
const anahtar = (s) => (s.satici_kodu ? `kod:${kodSade(s.satici_kodu)}` : `ad:${sade(s.ad)}`);

function dosyaMetni(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  return buf.toString('utf8');
}

module.exports = (r, { db, web, Y }) => {
  async function urunleriYukle() {
    const urunler = (await db.query(`
      SELECT u.id, u.kod, u.ad, u.birim, u.kdv_orani, u.tur, u.ort_maliyet, u.stok_miktari,
             coalesce(string_agg(b.barkod, chr(9)), '') AS barkodlar
      FROM urunler u LEFT JOIN urun_barkodlari b ON b.urun_id = u.id
      WHERE u.aktif GROUP BY u.id`)).rows;
    const kodla = new Map(); const barkodla = new Map(); const idle = new Map();
    for (const u of urunler) {
      idle.set(String(u.id), u);
      if (u.kod) kodla.set(kodSade(u.kod), u);
      for (const b of String(u.barkodlar || '').split('\t').filter(Boolean)) barkodla.set(b.trim(), u);
    }
    return { urunler, kodla, barkodla, idle };
  }

  function eslestir(s, st, hafiza) {
    const ozet = (u, neden, guven) => ({ urun_id: u.id, ad: u.ad, kod: u.kod, birim: u.birim, tur: u.tur, stok: Number(u.stok_miktari), ort_maliyet: Number(u.ort_maliyet), neden, guven });
    const kodlar = [s.alici_kodu, s.satici_kodu, s.uretici_kodu, ...s.ek_kodlar].filter(Boolean);
    for (const k of kodlar) { if (barkodMu(k) && st.barkodla.has(k.trim())) return ozet(st.barkodla.get(k.trim()), 'barkod', 100); }
    const h = hafiza.get(anahtar(s)) || hafiza.get(`ad:${sade(s.ad)}`);
    if (h && st.idle.has(String(h))) return ozet(st.idle.get(String(h)), 'hafiza', 100);
    if (s.alici_kodu && st.kodla.has(kodSade(s.alici_kodu))) return ozet(st.kodla.get(kodSade(s.alici_kodu)), 'kod', 95);
    for (const k of [s.satici_kodu, s.uretici_kodu]) { if (k && st.kodla.has(kodSade(k))) return ozet(st.kodla.get(kodSade(k)), 'kod', 85); }
    let en = null; let puan = 0;
    const aranan = [s.ad, s.marka, s.model].filter(Boolean).join(' ');
    for (const u of st.urunler) { const p = benzerlik(aranan, u.ad); if (p > puan) { puan = p; en = u; } }
    if (en && puan >= 0.55) return ozet(en, 'ad', Math.round(puan * 100));
    return null;
  }

  async function onizle(f, st) {
    const t = f.tedarikci || {};
    const vkn = (t.vkn || t.tckn || '').replace(/\D/g, '');
    let cari = null;
    if (vkn) cari = (await db.query(`SELECT id, unvan, tip, vergi_no FROM cariler WHERE regexp_replace(coalesce(vergi_no, ''), '\\D', '', 'g') = $1 ORDER BY aktif DESC, id LIMIT 1`, [vkn])).rows[0];
    if (!cari && t.unvan) cari = (await db.query('SELECT id, unvan, tip, vergi_no FROM cariler WHERE lower(unvan) = lower($1) ORDER BY aktif DESC, id LIMIT 1', [t.unvan])).rows[0];
    if (cari) cari.bakiye = (await db.query('SELECT bakiye FROM v_cari_bakiye WHERE id = $1', [cari.id])).rows[0]?.bakiye ?? 0;
    const hafiza = new Map(cari ? (await db.query('SELECT anahtar, urun_id FROM tedarikci_urun_eslesme WHERE cari_id = $1', [cari.id])).rows.map((x) => [x.anahtar, x.urun_id]) : []);
    const uyarilar = [...f.uyarilar];
    const mukerrer = (await db.query(`SELECT id, belge_no, durum FROM alis_faturalari
      WHERE (ettn IS NOT NULL AND lower(ettn) = $1) OR (cari_id = $2 AND belge_no = $3) LIMIT 1`, [f.ettn || '-', cari?.id || 0, f.no])).rows[0] || null;
    const firmaVkn = ((await db.query("SELECT deger FROM ayarlar WHERE anahtar = 'firma_vergi_no'")).rows[0]?.deger || '').replace(/\D/g, '');
    const aliciVkn = (f.alici?.vkn || f.alici?.tckn || '').replace(/\D/g, '');
    if (firmaVkn && aliciVkn && firmaVkn !== aliciVkn) uyarilar.push(`Faturadaki alıcı vergi no (${aliciVkn}) firmanızınkiyle (${firmaVkn}) aynı değil; bu fatura size kesilmemiş olabilir.`);
    if (!DOVIZ.includes(f.doviz)) uyarilar.push(`Fatura ${f.doviz} cinsinden; program yalnız TL, USD ve EUR destekliyor.`);
    const satirToplam = r2(f.satirlar.reduce((a, s) => a + s.tutar, 0));
    if (f.toplam.satir && Math.abs(satirToplam - f.toplam.satir) > 0.05) uyarilar.push(`Kalemlerin toplamı (${satirToplam}) faturadaki mal/hizmet toplamıyla (${f.toplam.satir}) tutmuyor.`);
    const kdvHesap = r2(f.satirlar.reduce((a, s) => a + s.tutar * s.kdv_orani / 100, 0));
    if (f.toplam.kdv && Math.abs(kdvHesap - f.toplam.kdv) > Math.max(0.1, f.satirlar.length * 0.02)) uyarilar.push(`Satırlardan hesaplanan KDV (${kdvHesap}) faturadaki KDV'den (${f.toplam.kdv}) farklı.`);
    return {
      ...f,
      cari: cari || null,
      mukerrer,
      uyarilar,
      satirlar: f.satirlar.map((s) => ({ ...s, anahtar: anahtar(s), oneri: eslestir(s, st, hafiza), barkod: [s.alici_kodu, s.satici_kodu, s.uretici_kodu, ...s.ek_kodlar].find(barkodMu) || '' })),
    };
  }

  r.post('/efatura/oku', Y, async (req) => {
    const liste = Array.isArray(req.body.dosyalar) ? req.body.dosyalar : [];
    if (!liste.length) throw web.hata(400, 'Dosya seçin.');
    const okunanlar = []; const hatalar = [];
    for (const d of liste.slice(0, 50)) {
      const ad = String(d.ad || 'dosya');
      let buf;
      try { buf = Buffer.from(String(d.veri || '').replace(/^data:[^,]*,/, ''), 'base64'); } catch { hatalar.push({ dosya: ad, hata: 'Dosya okunamadı.' }); continue; }
      let xmller = [];
      try {
        if (buf[0] === 0x50 && buf[1] === 0x4b) xmller = zipAc(buf).filter((x) => /\.xml$/i.test(x.ad)).map((x) => ({ ad: `${ad} › ${x.ad}`, icerik: x.icerik }));
        else xmller = [{ ad, icerik: buf }];
        if (!xmller.length) hatalar.push({ dosya: ad, hata: 'Zip içinde XML dosyası yok.' });
      } catch (e) { hatalar.push({ dosya: ad, hata: e.message }); continue; }
      for (const x of xmller) {
        try { okunanlar.push({ dosya: x.ad, ...efaturaOku(dosyaMetni(x.icerik)) }); } catch (e) { hatalar.push({ dosya: x.ad, hata: /XML:|e-Fatura/.test(e.message) ? e.message : 'XML okunamadı.' }); }
      }
    }
    // Aynı fatura birden çok dosyada geldiyse bir kez
    const gorulen = new Set();
    const tekil = okunanlar.filter((f) => { const k = f.ettn || `${f.tedarikci?.vkn}|${f.no}`; if (gorulen.has(k)) return false; gorulen.add(k); return true; });
    const st = await urunleriYukle();
    const faturalar = [];
    for (const f of tekil) faturalar.push(await onizle(f, st));
    return { faturalar, hatalar };
  });

  r.post('/efatura/kaydet', Y, async (req) => {
    const b = req.body; const f = b.fatura || {};
    const no = metin(f.no); if (!no) throw web.hata(400, 'Fatura numarası yok.');
    const doviz = DOVIZ.includes(f.doviz) ? f.doviz : null;
    if (!doviz) throw web.hata(400, 'Para birimi desteklenmiyor (TL, USD, EUR).');
    const kur = doviz === 'TRY' ? null : sayi(f.kur, 'Kur');
    if (doviz !== 'TRY' && !(kur > 0)) throw web.hata(400, `${doviz} kurunu girin.`, 'KUR_YOK');
    const satirlar = Array.isArray(b.satirlar) ? b.satirlar : [];
    if (!satirlar.length) throw web.hata(400, 'Aktarılacak kalem yok.');
    const id = await db.islem(req.kullanici.id, async (q) => {
      // Tedarikçi
      let cariId = b.cari_id ? Number(b.cari_id) : null;
      if (cariId) {
        const c = await q.bir('SELECT id, tip FROM cariler WHERE id = $1', [cariId]);
        if (!c) throw web.hata(400, 'Tedarikçi bulunamadı.');
        if (c.tip === 'musteri') await q("UPDATE cariler SET tip = 'her_ikisi' WHERE id = $1", [cariId]);
      } else {
        const y = b.yeni_cari || {};
        if (!metin(y.unvan)) throw web.hata(400, 'Tedarikçi ünvanı yok.');
        cariId = (await q.bir(`INSERT INTO cariler (tip, unvan, vergi_no, vergi_dairesi, adres, il, ilce, telefon, eposta, olusturan_id)
          VALUES ('tedarikci', $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [metin(y.unvan), metin(y.vergi_no), metin(y.vergi_dairesi), metin(y.adres), metin(y.il), metin(y.ilce), metin(y.telefon), metin(y.eposta), req.kullanici.id])).id;
      }
      // Mükerrer
      const ettn = metin(f.ettn)?.toLowerCase() || null;
      const var_ = await q.bir(`SELECT id, belge_no FROM alis_faturalari WHERE (ettn IS NOT NULL AND lower(ettn) = $1) OR (cari_id = $2 AND belge_no = $3) LIMIT 1`, [ettn || '-', cariId, no]);
      if (var_) throw web.hata(409, `Bu fatura (${var_.belge_no}) daha önce girilmiş.`, 'MUKERRER');
      const a = await q.bir(`INSERT INTO alis_faturalari (belge_no, cari_id, tarih, vade, aciklama, olusturan_id, doviz, kur, ettn)
        VALUES ($1, $2, coalesce($3::date, current_date), $4, $5, $6, $7, $8, $9) RETURNING id`,
      [no, cariId, tarih(f.tarih), tarih(f.vade), metin(f.aciklama) || 'e-Fatura XML\'den aktarıldı', req.kullanici.id, doviz, kur, ettn]);
      for (const s of satirlar) {
        let urunId = s.urun_id ? Number(s.urun_id) : null;
        if (!urunId) {
          const y = s.yeni_urun || {};
          if (!metin(y.ad)) throw web.hata(400, 'Yeni stok kartının adı boş.');
          const kdv = sayi(y.kdv_orani) ?? 20;
          urunId = (await q.bir(`INSERT INTO urunler (ad, birim, kdv_orani, tur, olusturan_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [metin(y.ad), metin(y.birim) || 'adet', kdv, y.tur === 'hizmet' ? 'hizmet' : 'urun', req.kullanici.id])).id;
          const bk = metin(y.barkod);
          if (bk && !(await q.bir('SELECT 1 AS v FROM urun_barkodlari WHERE barkod = $1', [bk]))) await q('INSERT INTO urun_barkodlari (barkod, urun_id) VALUES ($1, $2)', [bk, urunId]);
        }
        const miktar = sayi(s.miktar, 'Miktar');
        if (!(miktar > 0)) throw web.hata(400, 'Miktar sıfırdan büyük olmalı.');
        const fiyat = sayi(s.birim_fiyat, 'Fiyat') || 0;
        await q(`INSERT INTO alis_faturasi_satirlari (fatura_id, urun_id, miktar, birim_fiyat, kdv_orani, doviz_fiyat) VALUES ($1, $2, $3, $4, $5, $6)`,
          [a.id, urunId, miktar, doviz === 'TRY' ? fiyat : r4(fiyat * kur), sayi(s.kdv_orani, 'KDV') ?? 20, doviz === 'TRY' ? null : fiyat]);
        if (metin(s.anahtar)) {
          await q(`INSERT INTO tedarikci_urun_eslesme (cari_id, anahtar, urun_id) VALUES ($1, $2, $3)
            ON CONFLICT (cari_id, anahtar) DO UPDATE SET urun_id = excluded.urun_id, guncelleme = now()`, [cariId, metin(s.anahtar), urunId]);
        }
      }
      return a.id;
    });
    return { id };
  });
};
