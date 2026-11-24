'use strict';
// e-Fatura alış eşleştirme: tedarikçi (cari) ve ürün (stok kartı) önerileri, uyarılar, mükerrer kontrolü.
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


function eslestirici(db) {
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
      WHERE (ettn IS NOT NULL AND lower(ettn) = $1) OR (cari_id = $2 AND belge_no = $3) LIMIT 1`, [f.ettn || '-', cari?.id || 0, f.no])).rows[0]
      || (await db.query(`SELECT id, belge_no, 'gider' AS durum, true AS resmi FROM resmi_faturalar
        WHERE yon = 'alis' AND ettn IS NOT NULL AND lower(ettn) = $1 LIMIT 1`, [f.ettn || '-'])).rows[0] || null;
    const tercih = vkn ? (await db.query('SELECT secim, gider_turu FROM tedarikci_tercih WHERE vkn = $1', [vkn])).rows[0] || null : null;
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
      tercih,
      uyarilar,
      satirlar: f.satirlar.map((s) => ({ ...s, anahtar: anahtar(s), oneri: eslestir(s, st, hafiza), barkod: [s.alici_kodu, s.satici_kodu, s.uretici_kodu, ...s.ek_kodlar].find(barkodMu) || '' })),
    };
  }

  return { urunleriYukle, eslestir, onizle };
}

module.exports = { eslestirici, sade, kodSade, barkodMu, anahtar, dosyaMetni, r2, r4, DOVIZ };
