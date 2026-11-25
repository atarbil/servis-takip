'use strict';
// e-Fatura alış eşleştirme: tedarikçi (cari) ve ürün (stok kartı) önerileri, uyarılar, mükerrer kontrolü.
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const DOVIZ = ['TRY', 'USD', 'EUR'];

// Türkçe küçük harf, noktalama atılır
const sade = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[^0-9a-zçğıöşü]+/g, ' ').replace(/\s+/g, ' ').trim();
const kodSade = (s) => String(s || '').toLocaleUpperCase('tr').replace(/[\s-]+/g, '');
const barkodMu = (s) => /^\d{8,14}$/.test(String(s || '').trim());

// ---------- Eşleştirme yardımcıları ----------
// Türkçe harfler sadeleştirilir (ı→i, ş→s…), küçük harf, noktalama boşluk
const TR = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u', â: 'a', î: 'i', û: 'u' };
const katla = (s) => String(s || '').replace(/[ıİşŞçÇğĞöÖüÜâîû]/g, (c) => TR[c]).toLowerCase();
// Eşleştirmede anlamı olmayan sözcükler
const GEREKSIZ = new Set(['adet', 'ad', 'pcs', 'pc', 'ea', 'kdv', 'dahil', 'haric', 'urun', 'urunu', 've', 'ile', 'icin', 'li', 'lu', 'lik', 'luk', 'tl', 'usd', 'eur', 'no', 'nolu', 'model', 'kod', 'orijinal', 'original', 'yeni', 'the']);
// Sözcükler: harf / rakam sınırından da bölünür ("4MP" → 4 mp, "CAT6" → cat 6)
function sozcukler(s) {
  return katla(s).replace(/[^0-9a-z]+/g, ' ').replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
    .split(' ').filter((t) => t && !GEREKSIZ.has(t) && (t.length > 1 || /\d/.test(t)));
}
// Model / parça kodları: harf + rakam karışık en az 4 karakter (DS-2CD1123G0E-I → DS2CD1123G0EI), ya da 5–7 haneli parça no
function modelKodlari(...metinler) {
  const k = new Set();
  for (const m of metinler.filter(Boolean)) {
    for (const p of katla(m).toUpperCase().split(/[\s,;()\[\]{}"'*+]+/)) {
      const c = p.replace(/[-_./\\]/g, '');
      if (c.length >= 5 && /[A-Z]/.test(c) && /\d/.test(c)) k.add(c);
      else if (/^\d{5,7}$/.test(c)) k.add(c);
    }
  }
  return [...k];
}
// Sözcük karşılaştırmasında uzun model kodları çıkarılır (onlar ayrıca karşılaştırılır)
const kodsuz = (s) => String(s || '').split(/\s+/).filter((p) => { const c = p.replace(/[-_./\\]/g, ''); return !(c.length >= 6 && /[A-Za-z]/.test(c) && /\d/.test(c)); }).join(' ');
const uclu = (s) => { const t = ` ${s} `; const r = new Set(); for (let i = 0; i < t.length - 2; i++) r.add(t.slice(i, i + 3)); return r; };
function benzerlik(aSoz, bSoz) {
  const A = new Set(aSoz); const B = new Set(bSoz);
  if (!A.size || !B.size) return 0;
  let ortak = 0; for (const t of A) if (B.has(t)) ortak++;
  const dice = (2 * ortak) / (A.size + B.size);
  const kapsama = ortak / A.size; // faturadaki sözcüklerin kartta bulunma oranı
  const ta = uclu(aSoz.join(' ')); const tb = uclu(bSoz.join(' '));
  let o3 = 0; for (const x of ta) if (tb.has(x)) o3++;
  const tri = o3 / (ta.size + tb.size - o3 || 1);
  // Sayılar farklıysa (4 MP ↔ 2 MP, 305 m ↔ 100 m) ceza
  const sa = [...A].filter((t) => /^\d+$/.test(t)); const sb = [...B].filter((t) => /^\d+$/.test(t));
  const farkSayi = sa.length && sb.length ? sa.filter((n) => !sb.includes(n)).length : 0;
  return Math.max(0, 0.4 * dice + 0.3 * kapsama + 0.3 * tri - 0.15 * farkSayi);
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
      SELECT u.id, u.kod, u.ad, u.marka, u.model, u.birim, u.kdv_orani, u.tur, u.ort_maliyet, u.stok_miktari,
             coalesce(string_agg(b.barkod, chr(9)), '') AS barkodlar
      FROM urunler u LEFT JOIN urun_barkodlari b ON b.urun_id = u.id
      WHERE u.aktif GROUP BY u.id`)).rows;
    const kodla = new Map(); const barkodla = new Map(); const idle = new Map(); const modelle = new Map();
    for (const u of urunler) {
      idle.set(String(u.id), u);
      if (u.kod) kodla.set(kodSade(u.kod), u);
      for (const b of String(u.barkodlar || '').split('\t').filter(Boolean)) barkodla.set(b.trim(), u);
      u._soz = sozcukler(kodsuz([u.marka, u.ad].filter(Boolean).join(' ')));
      u._marka = katla(u.marka || '').trim();
      u._kodlar = modelKodlari(u.kod, u.model, u.ad);
      for (const k of u._kodlar) if (!modelle.has(k)) modelle.set(k, u);
    }
    // Daha önce onaylanmış model kodu eşleşmeleri (tedarikçiden bağımsız)
    const modelHafiza = new Map((await db.query("SELECT DISTINCT ON (anahtar) anahtar, urun_id FROM tedarikci_urun_eslesme WHERE anahtar LIKE 'model:%' ORDER BY anahtar, guncelleme DESC")).rows
      .map((x) => [x.anahtar.slice(6), x.urun_id]));
    return { urunler, kodla, barkodla, idle, modelle, modelHafiza };
  }

  // Satır için en iyi öneri (güvenle) + en iyi 3 aday
  function eslestir(s, st, hafiza) {
    const ozet = (u, neden, guven) => ({ urun_id: u.id, ad: u.ad, kod: u.kod, marka: u.marka, birim: u.birim, tur: u.tur, stok: Number(u.stok_miktari), ort_maliyet: Number(u.ort_maliyet), neden, guven });
    const kodlar = [s.alici_kodu, s.satici_kodu, s.uretici_kodu, ...s.ek_kodlar].filter(Boolean);
    const modeller = modelKodlari(s.ad, s.model, s.satici_kodu, s.uretici_kodu, s.alici_kodu, ...s.ek_kodlar.filter((k) => !barkodMu(k)));
    const sonuc = (u, neden, guven, adaylar = []) => ({ oneri: ozet(u, neden, guven), adaylar: adaylar.filter((a) => a.urun_id !== u.id).slice(0, 3), modeller });
    // Puanla tüm kartlar (aday listesi için de)
    const fSoz = sozcukler(kodsuz([s.marka, s.ad].filter(Boolean).join(' ')));
    const fMarka = katla(s.marka || '').trim();
    const fKatli = ` ${katla([s.marka, s.ad].join(' '))} `;
    const puanli = [];
    for (const u of st.urunler) {
      let p = benzerlik(fSoz, u._soz);
      // Model kodu: tam eşit çok güçlü; biri diğerini içeriyorsa güçlü
      for (const k of modeller) {
        if (u._kodlar.includes(k)) { p = Math.max(p, 0.97); break; }
        if (k.length >= 5 && u._kodlar.some((x) => x.length >= 5 && (x.includes(k) || k.includes(x)))) p = Math.max(p, 0.88);
      }
      if (u._marka) {
        if ((fMarka && fMarka === u._marka) || fKatli.includes(` ${u._marka} `)) p += 0.06;
        else if (fMarka && fMarka !== u._marka) p -= 0.12;
      }
      if (p >= 0.3) puanli.push({ u, p: Math.min(1, p) });
    }
    puanli.sort((a, b) => b.p - a.p);
    const adaylar = puanli.slice(0, 4).map(({ u, p }) => ozet(u, p >= 0.95 ? 'model' : 'ad', Math.round(p * 100)));
    // Kesin yollar: barkod → bu tedarikçide hatırlanan → bizim kodumuz → model kodu hafızası → tedarikçi kodu = bizim kod
    for (const k of kodlar) { if (barkodMu(k) && st.barkodla.has(k.trim())) return sonuc(st.barkodla.get(k.trim()), 'barkod', 100, adaylar); }
    const h = hafiza.get(anahtar(s)) || hafiza.get(`ad:${sade(s.ad)}`);
    if (h && st.idle.has(String(h))) return sonuc(st.idle.get(String(h)), 'hafiza', 100, adaylar);
    if (s.alici_kodu && st.kodla.has(kodSade(s.alici_kodu))) return sonuc(st.kodla.get(kodSade(s.alici_kodu)), 'kod', 95, adaylar);
    for (const k of modeller) { const mh = st.modelHafiza.get(k); if (mh && st.idle.has(String(mh))) return sonuc(st.idle.get(String(mh)), 'hafiza', 98, adaylar); }
    for (const k of [s.satici_kodu, s.uretici_kodu]) { if (k && st.kodla.has(kodSade(k))) return sonuc(st.kodla.get(kodSade(k)), 'kod', 90, adaylar); }
    // Benzerlik: %60 ve üstü öneri olarak seçili gelir
    if (puanli.length && puanli[0].p >= 0.6) return sonuc(puanli[0].u, puanli[0].p >= 0.95 ? 'model' : 'ad', Math.round(puanli[0].p * 100), adaylar);
    return { oneri: null, adaylar: adaylar.slice(0, 3), modeller };
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
      satirlar: f.satirlar.map((s) => ({ ...s, anahtar: anahtar(s), ...eslestir(s, st, hafiza), barkod: [s.alici_kodu, s.satici_kodu, s.uretici_kodu, ...s.ek_kodlar].find(barkodMu) || '' })),
    };
  }

  return { urunleriYukle, eslestir, onizle };
}

module.exports = { eslestirici, sade, kodSade, barkodMu, anahtar, dosyaMetni, r2, r4, DOVIZ };
