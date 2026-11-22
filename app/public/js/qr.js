// Bağımlılıksız QR kod üretici (bayt kipi, hata düzeltme M, sürüm 1–20). Belgelere IBAN / belge bilgisi basmak için.
// qrSvg(metin) → SVG metni (siyah kareler). Algoritma QR standardı (ISO/IEC 18004) ile aynıdır.

// Sürüm başına: [toplam kod sözcüğü, blok başına EC sözcüğü (M), blok sayısı (M)]
const TABLO_M = [null,
  [26, 10, 1], [44, 16, 1], [70, 26, 1], [100, 18, 2], [134, 24, 2], [172, 16, 4], [196, 18, 4], [242, 22, 4], [292, 22, 5], [346, 26, 5],
  [404, 30, 5], [466, 22, 8], [532, 22, 9], [581, 24, 9], [655, 24, 10], [733, 28, 10], [815, 28, 11], [901, 26, 13], [991, 26, 14], [1085, 26, 16]];

// GF(256) çarpımı (polinom 0x11D)
function carp(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z & 0xFF;
}
function rsBolen(derece) {
  const r = new Array(derece).fill(0); r[derece - 1] = 1;
  let kok = 1;
  for (let i = 0; i < derece; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = carp(r[j], kok); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    kok = carp(kok, 0x02);
  }
  return r;
}
function rsKalan(veri, bolen) {
  const r = new Array(bolen.length).fill(0);
  for (const b of veri) {
    const f = b ^ r.shift(); r.push(0);
    bolen.forEach((c, i) => { r[i] ^= carp(c, f); });
  }
  return r;
}

const hizalamaKonumlari = (v) => {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const adim = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const s = [6];
  for (let p = v * 4 + 10; s.length < n; p -= adim) s.splice(1, 0, p);
  return s;
};

export function qrMatris(metin, { maske = null } = {}) {
  const bayt = [...new TextEncoder().encode(String(metin))];
  let surum = 1;
  for (; surum <= 20; surum++) {
    const [top, ec, blok] = TABLO_M[surum];
    const kapasiteBit = (top - ec * blok) * 8;
    const gerek = 4 + (surum < 10 ? 8 : 16) + bayt.length * 8;
    if (gerek <= kapasiteBit) break;
  }
  if (surum > 20) throw new Error('QR için metin çok uzun');
  const [top, ec, blokSayisi] = TABLO_M[surum];
  const veriSozcuk = top - ec * blokSayisi;
  // Bit akışı
  const bitler = [];
  const ekle = (deger, uzunluk) => { for (let i = uzunluk - 1; i >= 0; i--) bitler.push((deger >>> i) & 1); };
  ekle(0b0100, 4); ekle(bayt.length, surum < 10 ? 8 : 16); bayt.forEach((b) => ekle(b, 8));
  ekle(0, Math.min(4, veriSozcuk * 8 - bitler.length));
  ekle(0, (8 - (bitler.length % 8)) % 8);
  for (let p = 0xEC; bitler.length < veriSozcuk * 8; p ^= 0xEC ^ 0x11) ekle(p, 8);
  const veri = [];
  for (let i = 0; i < bitler.length; i += 8) veri.push(bitler.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  // Bloklar ve hata düzeltme
  const kisaBlokSayisi = blokSayisi - (top % blokSayisi);
  const kisaBlokUzun = Math.floor(top / blokSayisi);
  const bolen = rsBolen(ec);
  const bloklar = [];
  for (let i = 0, k = 0; i < blokSayisi; i++) {
    const v = veri.slice(k, k + kisaBlokUzun - ec + (i < kisaBlokSayisi ? 0 : 1));
    k += v.length;
    const e = rsKalan(v, bolen);
    if (i < kisaBlokSayisi) v.push(0);
    bloklar.push(v.concat(e));
  }
  const son = [];
  for (let i = 0; i < bloklar[0].length; i++) {
    bloklar.forEach((b, j) => { if (i !== kisaBlokUzun - ec || j >= kisaBlokSayisi) son.push(b[i]); });
  }
  // Matris
  const n = surum * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const islev = Array.from({ length: n }, () => new Array(n).fill(false));
  const koy = (x, y, d) => { m[y][x] = d; islev[y][x] = true; };
  for (let i = 0; i < n; i++) { koy(6, i, i % 2 === 0); koy(i, 6, i % 2 === 0); }
  const bulucu = (x, y) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)); const xx = x + dx; const yy = y + dy;
      if (xx >= 0 && xx < n && yy >= 0 && yy < n) koy(xx, yy, d !== 2 && d !== 4);
    }
  };
  bulucu(3, 3); bulucu(n - 4, 3); bulucu(3, n - 4);
  const hz = hizalamaKonumlari(surum);
  for (let i = 0; i < hz.length; i++) for (let j = 0; j < hz.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === hz.length - 1) || (i === hz.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) koy(hz[i] + dx, hz[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const bicimKoy = (maske) => {
    const veriB = (0 << 3) | maske; // M = 00
    let r = veriB;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((veriB << 10) | r) ^ 0x5412;
    const bit = (i) => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) koy(8, i, bit(i));
    koy(8, 7, bit(6)); koy(8, 8, bit(7)); koy(7, 8, bit(8));
    for (let i = 9; i < 15; i++) koy(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) koy(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) koy(8, n - 15 + i, bit(i));
    koy(8, n - 8, true);
  };
  bicimKoy(0);
  if (surum >= 7) {
    let r = surum;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const b = (surum << 12) | r;
    for (let i = 0; i < 18; i++) {
      const bit = ((b >>> i) & 1) !== 0; const a = n - 11 + (i % 3); const c = Math.floor(i / 3);
      koy(a, c, bit); koy(c, a, bit);
    }
  }
  // Veri yerleştirme (zikzak)
  let i = 0;
  for (let sag = n - 1; sag >= 1; sag -= 2) {
    if (sag === 6) sag = 5;
    for (let dik = 0; dik < n; dik++) for (let j = 0; j < 2; j++) {
      const x = sag - j; const yukari = ((sag + 1) & 2) === 0; const y = yukari ? n - 1 - dik : dik;
      if (!islev[y][x] && i < son.length * 8) { m[y][x] = ((son[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
    }
  }
  // Maske seçimi (ceza puanı en düşük)
  const MASKE = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const maskeUygula = (k) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!islev[y][x] && MASKE[k](x, y)) m[y][x] = !m[y][x]; };
  const ceza = () => {
    let p = 0;
    const satirCeza = (al) => {
      for (let a = 0; a < n; a++) {
        let renk = al(a, 0); let uzun = 1;
        for (let b = 1; b < n; b++) {
          if (al(a, b) === renk) { uzun++; if (uzun === 5) p += 3; else if (uzun > 5) p++; } else { renk = al(a, b); uzun = 1; }
        }
        for (let b = 0; b + 10 < n + 4; b++) {
          // 1:1:3:1:1 deseni (4 açık bölge ile)
          const d = (k) => (b + k - 4 >= 0 && b + k - 4 < n ? al(a, b + k - 4) : false);
          const desen = [false, false, false, false, true, false, true, true, true, false, true];
          const desen2 = [true, false, true, true, true, false, true, false, false, false, false];
          if (desen.every((v, k) => d(k) === v) || desen2.every((v, k) => d(k) === v)) p += 40;
        }
      }
    };
    satirCeza((a, b) => m[a][b]); satirCeza((a, b) => m[b][a]);
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
      const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
    let koyu = 0; for (const r of m) for (const c of r) if (c) koyu++;
    const top2 = n * n;
    p += (Math.ceil(Math.abs(koyu * 20 - top2 * 10) / top2) - 1) * 10;
    return p;
  };
  let enIyi = 0; let enAz = Infinity;
  for (let k = 0; k < 8; k++) {
    maskeUygula(k); bicimKoy(k);
    const c = ceza(); if (c < enAz) { enAz = c; enIyi = k; }
    maskeUygula(k);
  }
  if (maske !== null) enIyi = maske;
  maskeUygula(enIyi); bicimKoy(enIyi);
  return m;
}

export function qrSvg(metin, { bosluk = 4 } = {}) {
  const m = qrMatris(metin);
  const n = m.length; const t = n + bosluk * 2;
  let yol = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) yol += `M${x + bosluk} ${y + bosluk}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${yol}" fill="#000"/></svg>`;
}
