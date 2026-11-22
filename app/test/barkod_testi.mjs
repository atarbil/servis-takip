// Yerleşik barkod çözücü testi: kodda üretilen EAN-13 / EAN-8 / Code 128 görüntülerini
// bulanıklık, gürültü, ölçek ve döndürmeyle bozar; doğru okunmalı, rastgele desenlerden yanlış okuma çıkmamalı.
// Çalıştırma: node app/test/barkod_testi.mjs
import { barkodCoz, eanGecerli } from '../public/js/barkodCoz.js';

const L = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'];
const ILK = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const C128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 '
  + '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 '
  + '111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 '
  + '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 '
  + '141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 '
  + '124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 '
  + '311141 411131 211412 211214 211232').split(' ');

// Genişlik dizisi (çubukla başlar) → modül dizisi (1 koyu)
const moduller = (gen) => { const m = []; gen.forEach((w, i) => { for (let k = 0; k < w; k++) m.push(i % 2 === 0 ? 1 : 0); }); return m; };
const sagla = (s) => { const d = [...s].map(Number); const t = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0); return s + ((10 - (t % 10)) % 10); };

function ean13(kod12) {
  const kod = sagla(kod12); const p = ILK[kod[0]]; const g = [1, 1, 1];
  for (let i = 1; i <= 6; i++) { let w = [...L[kod[i]]].map(Number); if (p[i - 1] === 'G') w = w.reverse(); g.push(...w); }
  g.push(1, 1, 1, 1, 1);
  for (let i = 7; i <= 12; i++) g.push(...[...L[kod[i]]].map(Number));
  g.push(1, 1, 1);
  // ilk eleman çubuk olmalı: kılavuzdan sonra L kodu boşlukla başlar — genişlik dizisi zaten dönüşümlü
  return { kod, m: moduller(g) };
}
function ean8(kod7) {
  const kod = sagla(kod7); const g = [1, 1, 1];
  for (let i = 0; i < 4; i++) g.push(...[...L[kod[i]]].map(Number));
  g.push(1, 1, 1, 1, 1);
  for (let i = 4; i < 8; i++) g.push(...[...L[kod[i]]].map(Number));
  g.push(1, 1, 1);
  return { kod, m: moduller(g) };
}
function code128(metin) {
  const deg = [104, ...[...metin].map((c) => c.charCodeAt(0) - 32)];
  const sag = deg.reduce((a, d, i) => a + d * (i || 1), 0) % 103;
  const g = []; for (const d of [...deg, sag]) g.push(...[...C128[d]].map(Number));
  g.push(2, 3, 3, 1, 1, 1, 2);
  return { kod: metin, m: moduller(g) };
}

// Modül dizisinden görüntü: modül genişliği, bulanıklık (piksel), gürültü, eğim (derece)
let tohum = 42; const rast = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };
const normal = () => { const u = rast() || 1e-9; const v = rast(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function goruntu(m, { mw = 3, bulanik = 0, gurultu = 0, egim = 0, dikey = false, W = 640, H = 360 } = {}) {
  const sessiz = 12 * mw; const gen = m.length * mw + 2 * sessiz;
  const x0 = (W - gen) / 2; const t = Math.tan(egim * Math.PI / 180);
  const ham = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const yy = y - H / 2;
    const kart = Math.abs(yy) < H * 0.3 && x > x0 - 10 && x < x0 + gen + 10;
    if (!kart) { ham[y * W + x] = 110; continue; }
    // piksel alanı üzerinden ortalama (kamera sensörü gibi; sert örtüşme yok)
    let koyu = 0;
    for (let a = 0; a < 4; a++) {
      const k = Math.floor((x + (a + 0.5) / 4 - x0 - sessiz - yy * t) / mw);
      if (k >= 0 && k < m.length && m[k] && Math.abs(yy) < H * 0.22) koyu++;
    }
    ham[y * W + x] = 235 - (koyu / 4) * 210;
  }
  // kutu bulanıklığı (3 geçiş ≈ Gauss)
  let a = ham;
  if (bulanik > 0) {
    const r = Math.max(1, Math.round(bulanik));
    for (let gecis = 0; gecis < 3; gecis++) {
      const b = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let s = 0; let n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < W) { s += a[y * W + xx]; n++; } }
        b[y * W + x] = s / n;
      }
      a = b;
    }
  }
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = a[y * W + x] + gurultu * normal();
    const [px, py] = dikey ? [y, W - 1 - x] : [x, y];
    const o = dikey ? (py * H + px) * 4 : (py * W + px) * 4;
    d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255;
  }
  return dikey ? { width: H, height: W, data: d } : { width: W, height: H, data: d };
}

let hata = 0; let toplam = 0;
const kontrol = (ad, kosul) => { toplam++; if (!kosul) { hata++; console.log('  ✗', ad); } };

const ornekler = [ean13('869123456789'), ean13('590123412345'), ean13('036000291452'.slice(0, 12).padStart(12, '0')), ean8('9638507'), code128('SN-PF3K2L9X'), code128('DS-2CD1123G0E-I')];
const bozulmalar = [
  ['temiz', {}], ['küçük (1.6 px/modül)', { mw: 1.6 }], ['bulanık (σ≈0.47 modül)', { bulanik: 1 }], ['gürültülü', { gurultu: 22 }],
  ['eğik 7°', { egim: 7 }], ['dikey', { dikey: true }], ['küçük+bulanık+gürültü', { mw: 2.8, bulanik: 1, gurultu: 10 }],
];
for (const o of ornekler) {
  for (const [ad, sec] of bozulmalar) {
    const r = barkodCoz(goruntu(o.m, sec));
    const beklenen = o.kod;
    kontrol(`${beklenen} ${ad} → ${r ? r.metin : 'okunamadı'}`, r && (r.metin === beklenen));
  }
}
kontrol('EAN sağlama hanesi', eanGecerli('8691234567890') && !eanGecerli('8691234567891'));

// Yanlış okuma: rastgele çizgi desenleri ve gürültü
let yanlis = 0;
for (let t = 0; t < 150; t++) {
  const m = []; for (let k = 0; k < 120; k++) m.push(rast() < 0.5 ? 1 : 0);
  const r = barkodCoz(goruntu(m, { mw: 2 + rast() * 3, gurultu: rast() * 20, bulanik: rast() < 0.5 ? 1 : 0 }));
  if (r) { yanlis++; console.log('  yanlış okuma:', r.metin, r.bicim); }
}
kontrol(`rastgele desenlerde yanlış okuma yok (${yanlis})`, yanlis === 0);

console.log(hata ? `Barkod testi: ${hata}/${toplam} BAŞARISIZ` : `Barkod testi: ${toplam} kontrol BAŞARILI`);
process.exit(hata ? 1 : 0);
