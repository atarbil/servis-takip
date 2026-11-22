// Bağımlılıksız 1B barkod çözücü: EAN-13, EAN-8, UPC-A (EAN-13 olarak), Code 128.
// Kamera karesinden (ImageData: { width, height, data RGBA }) yatay ve dikey tarama çizgileriyle okur.
// Kenarlar alt piksel hassasiyetle bulunur; her sembol kendi genişliğine göre ölçeklenir (eğik/uzak barkod için).

// ---------- EAN / UPC ----------
// Sol yarı L kodları (boşluk, çubuk, boşluk, çubuk genişlikleri); G = L'nin tersi; sağ yarı R = L genişlikleri (çubukla başlar)
const L = [[3, 2, 1, 1], [2, 2, 2, 1], [2, 1, 2, 2], [1, 4, 1, 1], [1, 1, 3, 2], [1, 2, 3, 1], [1, 1, 1, 4], [1, 3, 1, 2], [1, 2, 1, 3], [3, 1, 1, 2]];
const G = L.map((p) => [...p].reverse());
const ILK_HANE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// ---------- Code 128 (çubuk, boşluk, ... genişlikleri; her biri 11 modül) ----------
const C128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 '
  + '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 '
  + '111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 '
  + '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 '
  + '141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 '
  + '124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 '
  + '311141 411131 211412 211214 211232').split(' ').map((s) => [...s].map(Number));
const C128_DUR = [2, 3, 3, 1, 1, 1, 2];

// Normalize edilmiş genişliklerin desene uzaklığı (karesel)
function uzaklik(runs, i, n, modul, desen) {
  let t = 0;
  for (let k = 0; k < n; k++) t += runs[i + k];
  const olcek = modul / t;
  let d = 0;
  for (let k = 0; k < n; k++) { const f = runs[i + k] * olcek - desen[k]; d += f * f; }
  return d;
}
function enYakin(runs, i, n, modul, desenler) {
  let en = -1; let ed = Infinity; let ikinci = Infinity;
  for (let k = 0; k < desenler.length; k++) {
    const d = uzaklik(runs, i, n, modul, desenler[k]);
    if (d < ed) { ikinci = ed; ed = d; en = k; } else if (d < ikinci) ikinci = d;
  }
  return { k: en, d: ed, ikinci };
}

// Kenardan benzer kenara ölçüm (UPC standardı): çubuk+boşluk toplamları bulanıklıktan etkilenmez.
// 1/7 ve 2/8 aynı (t1,t2) değerine sahip; aralarında ham genişlikle karar verilir.
function enYakinKenar(runs, i, desenler) {
  const t = runs[i] + runs[i + 1] + runs[i + 2] + runs[i + 3];
  const t1 = (runs[i] + runs[i + 1]) * 7 / t; const t2 = (runs[i + 1] + runs[i + 2]) * 7 / t;
  let en = -1; let ed = Infinity;
  for (let k = 0; k < desenler.length; k++) {
    const p = desenler[k]; const a = t1 - p[0] - p[1]; const b = t2 - p[1] - p[2];
    const d = a * a + b * b;
    if (d < ed - 1e-9) { ed = d; en = k; } else if (Math.abs(d - ed) < 1e-9) {
      if (uzaklik(runs, i, 4, 7, p) < uzaklik(runs, i, 4, 7, desenler[en])) en = k;
    }
  }
  return { k: en, d: ed };
}

export const eanGecerli = (s) => {
  if (!/^\d{8}$|^\d{12,13}$/.test(s)) return false;
  const d = [...s].map(Number); const c = d.pop();
  const t = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (t % 10)) % 10 === c;
};

// runs: [çubuk, boşluk, çubuk, ...] (0. eleman çubuk); quiet: önceki boşluk genişliği
function ean13(runs, i, onceki, kenarli = false) {
  const yakin = kenarli ? enYakinKenar : (r, j, n, mo, d) => enYakin(r, j, n, mo, d);
  const sinir = kenarli ? 0.6 : 1.1;
  if (i + 59 > runs.length) return null;
  let top = 0; for (let k = 0; k < 59; k++) top += runs[i + k];
  const m = top / 95;
  const kilavuz = (j) => runs[j] > 0.45 * m && runs[j] < 1.75 * m;
  for (const j of [0, 1, 2, 27, 28, 29, 30, 31, 56, 57, 58]) if (!kilavuz(i + j)) return null;
  if (onceki < 5 * m) return null;
  const haneOk = (j) => { const t = runs[j] + runs[j + 1] + runs[j + 2] + runs[j + 3]; return t > 5.6 * m && t < 8.4 * m; };
  let parite = ''; let hane = '';
  for (let h = 0; h < 6; h++) {
    const j = i + 3 + h * 4;
    if (!haneOk(j)) return null;
    const a = kenarli ? yakin(runs, j, L) : yakin(runs, j, 4, 7, L); const b = kenarli ? yakin(runs, j, G) : yakin(runs, j, 4, 7, G);
    const s = a.d <= b.d ? a : b;
    if (s.d > sinir) return null;
    parite += a.d <= b.d ? 'L' : 'G'; hane += s.k;
  }
  for (let h = 0; h < 6; h++) {
    if (!haneOk(i + 32 + h * 4)) return null;
    const s = kenarli ? yakin(runs, i + 32 + h * 4, L) : yakin(runs, i + 32 + h * 4, 4, 7, L);
    if (s.d > sinir) return null;
    hane += s.k;
  }
  const ilk = ILK_HANE.indexOf(parite);
  if (ilk < 0) return null;
  const kod = ilk + hane;
  return eanGecerli(kod) ? { metin: kod, bicim: ilk === 0 ? 'upc_a' : 'ean_13', son: i + 59, m } : null;
}

function ean8(runs, i, onceki, kenarli = false) {
  const yakin = kenarli ? enYakinKenar : (r, j, n, mo, d) => enYakin(r, j, n, mo, d);
  const sinir = kenarli ? 0.6 : 1.1;
  if (i + 43 > runs.length) return null;
  let top = 0; for (let k = 0; k < 43; k++) top += runs[i + k];
  const m = top / 67;
  const kilavuz = (j) => runs[j] > 0.45 * m && runs[j] < 1.75 * m;
  for (const j of [0, 1, 2, 19, 20, 21, 22, 23, 40, 41, 42]) if (!kilavuz(i + j)) return null;
  if (onceki < 5 * m) return null;
  const haneOk = (j) => { const t = runs[j] + runs[j + 1] + runs[j + 2] + runs[j + 3]; return t > 5.6 * m && t < 8.4 * m; };
  let hane = '';
  for (let h = 0; h < 4; h++) { const j = i + 3 + h * 4; if (!haneOk(j)) return null; const s = kenarli ? yakin(runs, j, L) : yakin(runs, j, 4, 7, L); if (s.d > sinir) return null; hane += s.k; }
  for (let h = 0; h < 4; h++) { const j = i + 24 + h * 4; if (!haneOk(j)) return null; const s = kenarli ? yakin(runs, j, L) : yakin(runs, j, 4, 7, L); if (s.d > sinir) return null; hane += s.k; }
  return eanGecerli(hane) ? { metin: hane, bicim: 'ean_8', son: i + 43, m } : null;
}

function code128(runs, i, onceki) {
  if (i + 6 + 6 + 7 > runs.length) return null;
  const bas = enYakin(runs, i, 6, 11, C128);
  if (bas.k < 103 || bas.d > 1.4) return null;
  let m = 0; for (let k = 0; k < 6; k++) m += runs[i + k]; m /= 11;
  if (onceki < 5 * m) return null;
  const degerler = [bas.k];
  let j = i + 6;
  for (let say = 0; say < 80; say++) {
    if (j + 7 <= runs.length && uzaklik(runs, j, 7, 13, C128_DUR) < 1.6) {
      // Durdurma deseni: önceki simge sağlamadır
      let toplam = degerler[0];
      for (let k = 1; k < degerler.length - 1; k++) toplam += k * degerler[k];
      if (degerler.length < 3 || toplam % 103 !== degerler[degerler.length - 1]) return null;
      const metin = c128Metin(degerler.slice(0, -1));
      return metin ? { metin, bicim: 'code_128', son: j + 7, m } : null;
    }
    if (j + 6 > runs.length) return null;
    const s = enYakin(runs, j, 6, 11, C128.slice(0, 106));
    if (s.d > 1.4) return null;
    degerler.push(s.k); j += 6;
  }
  return null;
}
function c128Metin(d) {
  let kume = d[0] === 103 ? 'A' : d[0] === 104 ? 'B' : 'C';
  let s = ''; let kaydir = false;
  for (let k = 1; k < d.length; k++) {
    const v = d[k]; const aktif = kaydir ? (kume === 'A' ? 'B' : 'A') : kume; kaydir = false;
    if (aktif === 'C') {
      if (v < 100) s += String(v).padStart(2, '0');
      else if (v === 100) kume = 'B'; else if (v === 101) kume = 'A';
    } else if (v < 96) {
      s += aktif === 'A' ? String.fromCharCode(v < 64 ? v + 32 : v - 64) : String.fromCharCode(v + 32);
    } else if (v === 98) kaydir = true;
    else if (v === 99) kume = 'C';
    else if (v === 100 && aktif === 'A') kume = 'B';
    else if (v === 101 && aktif === 'B') kume = 'A';
    // FNC1-4 yok sayılır
  }
  return s.replace(/[\x00-\x1f]/g, '').trim() || null;
}

// ---------- Tarama çizgisi → çubuk genişlikleri ----------
// Uyarlamalı eşik + alt piksel kenarlar. Dönen dizi koyu (çubuk) ile başlar; onunla birlikte ilk boşluğun genişliği.
function calismalar(v, n) {
  // Yumuşatma yok: 2 piksellik ince boşluklar kaybolmasın (gürültüyü 3 satırın ortalaması azaltır)
  const s = v;
  const w = Math.max(8, Math.round(n / 14));
  // kayan pencerede min/max (basit, n küçük)
  const esik = new Float32Array(n); const fark = new Float32Array(n);
  for (let x = 0; x < n; x++) {
    let mn = 255; let mx = 0;
    const a = Math.max(0, x - w); const b = Math.min(n - 1, x + w);
    for (let k = a; k <= b; k += 2) { const t = s[k]; if (t < mn) mn = t; if (t > mx) mx = t; }
    esik[x] = (mn + mx) / 2; fark[x] = mx - mn;
  }
  const kenar = []; // [konum, koyu mu (sonrası)]
  let onceki = s[0] < esik[0] && fark[0] > 24;
  for (let x = 1; x < n; x++) {
    const koyu = fark[x] > 24 ? s[x] < esik[x] : onceki;
    if (koyu !== onceki) {
      const a = s[x - 1] - esik[x - 1]; const b = s[x] - esik[x];
      const t = a === b ? 0.5 : a / (a - b);
      kenar.push(x - 1 + Math.min(1, Math.max(0, t)));
      onceki = koyu;
    }
  }
  return { kenar, ilkKoyu: s[0] < esik[0] && fark[0] > 24 };
}

// Bulanık görüntü için: parlaklığın tepe/çukur noktalarından kenar bulma. Odak tam değilken ince boşluk
// eşiğin altında kalsa da küçük bir tepe olarak görünür.
function calismalarUc(v, n) {
  const w = Math.max(8, Math.round(n / 14));
  const aralik = new Float32Array(n);
  for (let x = 0; x < n; x++) {
    let mn = 255; let mx = 0;
    const a = Math.max(0, x - w); const b = Math.min(n - 1, x + w);
    for (let k = a; k <= b; k += 2) { const t = v[k]; if (t < mn) mn = t; if (t > mx) mx = t; }
    aralik[x] = mx - mn;
  }
  // Histerezisli uç noktası bulma: başta hem en küçük hem en büyük izlenir, ilk belirgin değişimle yön belli olur
  const uc = []; // [x, değer, tepe mi]
  let yon = 0; let mn = v[0]; let mnX = 0; let mx = v[0]; let mxX = 0;
  for (let x = 1; x < n; x++) {
    const delta = Math.max(7, aralik[x] * 0.06);
    const t = v[x];
    if (yon === 0) {
      if (t < mn) { mn = t; mnX = x; }
      if (t > mx) { mx = t; mxX = x; }
      if (t - mn > delta) { uc.push([mnX, mn, false]); yon = 1; mx = t; mxX = x; }
      else if (mx - t > delta) { uc.push([mxX, mx, true]); yon = -1; mn = t; mnX = x; }
    } else if (yon === 1) {
      if (t > mx) { mx = t; mxX = x; } else if (mx - t > delta) { uc.push([mxX, mx, true]); yon = -1; mn = t; mnX = x; }
    } else if (t < mn) { mn = t; mnX = x; } else if (t - mn > delta) { uc.push([mnX, mn, false]); yon = 1; mx = t; mxX = x; }
  }
  if (uc.length < 20) return { kenar: [], ilkKoyu: false };
  const kenar = [];
  for (let i = 0; i + 1 < uc.length; i++) {
    // Kenar = iki uç arasında eğimin en dik olduğu yer (bulanıklıkta seviye kesişiminden daha tarafsız)
    const xa = uc[i][0]; const xb = uc[i + 1][0];
    let en = xa; let eg = -1;
    for (let x = xa; x < xb; x++) { const g = Math.abs(v[x + 1] - v[x]); if (g > eg) { eg = g; en = x; } }
    const g0 = en > xa ? Math.abs(v[en] - v[en - 1]) : 0;
    const g2 = en + 1 < xb ? Math.abs(v[en + 2] - v[en + 1]) : 0;
    const pay = g0 - 2 * eg + g2;
    const ofs = pay < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (g0 - g2) / pay)) : 0;
    kenar.push(en + 0.5 + ofs);
  }
  // ilk uç tepe ise ilk kenardan sonrası koyu: ilkKoyu = ilk bölge koyu mu → ilk uç çukursa
  return { kenar, ilkKoyu: !uc[0][2] };
}


// ---------- Bulanık EAN/UPC için şablon eşleme ----------
// Kenarlar kaybolduğunda (odak tam değil) ince boşluklar eşiği geçmez. Bunun yerine sembolün iki ucundan
// modül ızgarası kurulur ve her hanenin parlaklık eğrisi, bulanıklaştırılmış ideal desenlerle karşılaştırılır.
const SIGMALAR = [0.3, 0.5, 0.7, 0.9];
const ALT = 4; // modül başına örnek
function sablon(desen, solKoyu, sagKoyu, sigma) {
  // 1 modül sol/sağ dolgu ile ikili dizi; Gauss ile yumuşat; ortadaki 7*ALT örneği döndür
  const ikili = [];
  for (let k = 0; k < ALT; k++) ikili.push(solKoyu ? 1 : 0);
  let koyu = !solKoyu;
  for (const w of desen) { for (let k = 0; k < w * ALT; k++) ikili.push(koyu ? 1 : 0); koyu = !koyu; }
  for (let k = 0; k < ALT; k++) ikili.push(sagKoyu ? 1 : 0);
  const sg = sigma * ALT; const r = Math.ceil(sg * 2.5); const cek = [];
  let top = 0; for (let k = -r; k <= r; k++) { const a = Math.exp(-(k * k) / (2 * sg * sg)); cek.push(a); top += a; }
  const sonuc = [];
  for (let x = ALT; x < ALT + 7 * ALT; x++) {
    let t = 0; for (let k = -r; k <= r; k++) t += cek[k + r] * ikili[Math.min(ikili.length - 1, Math.max(0, x + k))];
    sonuc.push(t / top);
  }
  return sonuc;
}
const SABLONLAR = SIGMALAR.map((sg) => ({
  L: L.map((d) => sablon(d, true, false, sg)), // sol yarı: önceki hane çubukla biter, sonraki boşlukla başlar
  G: G.map((d) => sablon(d, true, false, sg)),
  R: L.map((d) => sablon(d, false, true, sg)), // sağ yarı: çubukla başlar, boşlukla biter
}));
function korelasyon(a, b) {
  const n = a.length; let ma = 0; let mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0; let saa = 0; let sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma; const y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}
function eanSablon(v, x0, x1, moduller) {
  const mw = (x1 - x0) / moduller;
  if (mw < 0.9) return null;
  // karanlık: 0 açık … 1 koyu (sembol içindeki uç değerlere göre)
  let lo = 255; let hi = 0;
  for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(v.length - 1, Math.ceil(x1)); x++) { if (v[x] < lo) lo = v[x]; if (v[x] > hi) hi = v[x]; }
  if (hi - lo < 25) return null;
  const ornek = (m) => {
    const x = x0 + m * mw - 0.5; const i = Math.floor(x); const f = x - i;
    const a = v[Math.max(0, Math.min(v.length - 1, i))]; const b = v[Math.max(0, Math.min(v.length - 1, i + 1))];
    return (hi - (a * (1 - f) + b * f)) / (hi - lo);
  };
  const hane = (bas) => {
    // birkaç küçük kaymayla örnekle
    const diziler = [];
    for (const kay of [-0.3, -0.15, 0, 0.15, 0.3]) {
      const d = []; for (let k = 0; k < 7 * ALT; k++) d.push(ornek(bas + kay + (k + 0.5) / ALT)); diziler.push(d);
    }
    return diziler;
  };
  const sol = moduller === 95 ? 6 : 4;
  const haneler = [];
  for (let h = 0; h < sol; h++) haneler.push({ taraf: 'sol', d: hane(3 + h * 7) });
  const sagBas = 3 + sol * 7 + 5;
  for (let h = 0; h < sol; h++) haneler.push({ taraf: 'sag', d: hane(sagBas + h * 7) });
  let enIyi = null;
  for (const S of SABLONLAR) {
    let toplam = 0; let kod = ''; let parite = ''; let zayif = false;
    for (const hn of haneler) {
      const adaylar = [];
      const tablolar = hn.taraf === 'sol' ? (moduller === 95 ? [['L', S.L], ['G', S.G]] : [['L', S.L]]) : [['R', S.R]];
      for (const [ad, tablo] of tablolar) {
        tablo.forEach((t, k) => { let en = -1; for (const d of hn.d) en = Math.max(en, korelasyon(d, t)); adaylar.push({ ad, k, r: en }); });
      }
      adaylar.sort((a, b) => b.r - a.r);
      const [b1, b2] = adaylar;
      if (b1.r < 0.72 || b1.r - b2.r < 0.04) zayif = true;
      toplam += b1.r; kod += b1.k; if (hn.taraf === 'sol') parite += b1.ad;
    }
    if (zayif) continue;
    if (!enIyi || toplam > enIyi.toplam) enIyi = { toplam, kod, parite };
  }
  if (!enIyi) return null;
  if (moduller === 67) return eanGecerli(enIyi.kod) ? { metin: enIyi.kod, bicim: 'ean_8' } : null;
  const ilk = ILK_HANE.indexOf(enIyi.parite);
  if (ilk < 0) return null;
  const kod = ilk + enIyi.kod;
  return eanGecerli(kod) ? { metin: kod, bicim: ilk === 0 ? 'upc_a' : 'ean_13' } : null;
}

// Kılavuz çizgisiyle başlayan (sessiz bölgeli) yer için ızgara uçlarını bulup şablonla çöz
function sablonDene(v, g, pos, i) {
  const mg = (g[i] + g[i + 1] + g[i + 2]) / 3;
  if (g[i - 1] < 5 * mg) return null;
  for (const c of [g[i], g[i + 1], g[i + 2]]) if (c < 0.4 * mg || c > 2 * mg) return null;
  const x0 = pos[i];
  for (let j = i + 20; j < g.length - 1; j++) {
    const x1 = pos[j + 1]; const gen = x1 - x0;
    if (gen > 140 * mg) break;
    if ((j - i) % 2 !== 0) continue; // çubukla bitmeli
    if (g[j + 1] < 4 * mg) continue; // ardından sessiz bölge
    for (const mod of [95, 67]) {
      const m = gen / mod;
      if (m < 0.6 * mg || m > 1.6 * mg) continue;
      // son çubuk çok kalın olmamalı (bulanıkta bitiş kılavuzu birleşebilir, o yüzden gevşek)
      if (g[j] > 3.5 * m) continue;
      const r = eanSablon(v, x0, x1, mod);
      if (r) return r;
    }
  }
  return null;
}

function satirCoz(v, n) {
  return satirCozKenar(calismalar(v, n), n) || satirCozKenar(calismalarUc(v, n), n) || satirCozKenar(calismalar(v, n), n, v);
}

function satirCozKenar({ kenar, ilkKoyu }, n, v = null) {
  if (kenar.length < 20) return null;
  // genişlikler; renk: kenarın sonrası
  const gen = []; const koyu = [];
  let renk = ilkKoyu; let son = 0;
  for (const k of kenar) { gen.push(k - son); koyu.push(renk); renk = !renk; son = k; }
  gen.push(n - son); koyu.push(renk);
  for (const yon of [1, -1]) {
    const g = yon === 1 ? gen : [...gen].reverse(); const c = yon === 1 ? koyu : [...koyu].reverse();
    if (v) {
      // Şablon modu: yalnız EAN/UPC, bulanık görüntü için
      const vv = yon === 1 ? v : Float32Array.from(v).reverse();
      const pos = [0]; for (const w of g) pos.push(pos[pos.length - 1] + w);
      for (let i = 1; i < g.length - 20; i++) {
        if (!c[i]) continue;
        const r = sablonDene(vv, g, pos, i);
        if (r) return r;
      }
      continue;
    }
    for (let i = 1; i < g.length - 18; i++) {
      if (!c[i]) continue; // çubukla başlamalı
      const runs = g.slice(i, i + 500);
      const onceki = g[i - 1];
      let r = ean13(runs, 0, onceki) || ean8(runs, 0, onceki) || code128(runs, 0, onceki);
      if (!r) r = ean13(runs, 0, onceki, true) || ean8(runs, 0, onceki, true);
      // Sağ sessiz bölge de olmalı (satır sonu sayılır)
      if (r && (r.son >= runs.length || runs[r.son] >= 5 * r.m)) return r;
    }
  }
  return null;
}

// ImageData'dan gri satır / sütun (3 komşunun ortalaması)
function griSatir(img, y, tampon) {
  const { width: w, data: d } = img;
  for (let x = 0; x < w; x++) {
    let t = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = Math.min(img.height - 1, Math.max(0, y + dy)); const o = (yy * w + x) * 4;
      t += d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114;
    }
    tampon[x] = t / 3;
  }
  return tampon;
}
function griSutun(img, x, tampon) {
  const { width: w, height: h, data: d } = img;
  for (let y = 0; y < h; y++) {
    let t = 0;
    for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.min(w - 1, Math.max(0, x + dx)); const o = (y * w + xx) * 4;
      t += d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114;
    }
    tampon[y] = t / 3;
  }
  return tampon;
}

// Aynı sonucu en az iki farklı tarama çizgisi vermeli: rastgele desenlerden yanlış okumayı önler
const ORANLAR = [0.5, 0.44, 0.56, 0.38, 0.62, 0.32, 0.68, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86];
export function barkodCoz(img, { dikey = true, oy = 2 } = {}) {
  const sayac = new Map();
  const say = (r) => {
    if (!r) return null;
    const k = r.bicim + '|' + r.metin; const n = (sayac.get(k) || 0) + 1; sayac.set(k, n);
    return n >= oy ? { metin: r.metin, bicim: r.bicim } : null;
  };
  const satir = new Float32Array(img.width);
  for (const o of ORANLAR) {
    const r = say(satirCoz(griSatir(img, Math.round(img.height * o), satir), img.width));
    if (r) return r;
  }
  if (dikey) {
    const sutun = new Float32Array(img.height);
    for (const o of ORANLAR) {
      const r = say(satirCoz(griSutun(img, Math.round(img.width * o), sutun), img.height));
      if (r) return r;
    }
  }
  return null;
}
