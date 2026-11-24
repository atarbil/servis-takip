'use strict';
// Küçük, bağımlılıksız XML okuyucu (e-Fatura UBL için yeterli).
// Düğüm: { ad: 'ID' (önek atılmış yerel ad), tam: 'cbc:ID', oz: {…}, cocuk: [düğüm], metin: '…' }

const VARLIK = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
function cevir(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, v) => {
    if (v[0] === '#') {
      const n = v[1] === 'x' || v[1] === 'X' ? parseInt(v.slice(2), 16) : parseInt(v.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return VARLIK[v] ?? m;
  });
}
const yerel = (ad) => { const i = ad.indexOf(':'); return i >= 0 ? ad.slice(i + 1) : ad; };

function xmlOku(metin) {
  const s = String(metin).replace(/^﻿/, '');
  const kok = { ad: '#belge', tam: '#belge', oz: {}, cocuk: [], metin: '' };
  const yigin = [kok];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const lt = s.indexOf('<', i);
    const ust = yigin[yigin.length - 1];
    if (lt < 0) { ust.metin += cevir(s.slice(i)); break; }
    if (lt > i) ust.metin += cevir(s.slice(i, lt));
    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); if (e < 0) throw new Error('XML: kapanmayan yorum'); i = e + 3; continue; }
    if (s.startsWith('<![CDATA[', lt)) { const e = s.indexOf(']]>', lt + 9); if (e < 0) throw new Error('XML: kapanmayan CDATA'); ust.metin += s.slice(lt + 9, e); i = e + 3; continue; }
    if (s.startsWith('<?', lt)) { const e = s.indexOf('?>', lt + 2); if (e < 0) throw new Error('XML: kapanmayan işlem komutu'); i = e + 2; continue; }
    if (s.startsWith('<!', lt)) {
      // DOCTYPE (iç alt küme olabilir)
      let d = 0; let j = lt + 2;
      for (; j < n; j++) { if (s[j] === '[') d++; else if (s[j] === ']') d--; else if (s[j] === '>' && d <= 0) break; }
      i = j + 1; continue;
    }
    if (s[lt + 1] === '/') {
      const e = s.indexOf('>', lt);
      if (e < 0) throw new Error('XML: bozuk kapanış etiketi');
      const ad = s.slice(lt + 2, e).trim();
      const ac = yigin.pop();
      if (!ac || ac.tam !== ad) throw new Error(`XML: </${ad}> beklenmiyordu`);
      i = e + 1; continue;
    }
    // Açılış etiketi: tırnak içindeki > karakterlerini atla
    let j = lt + 1; let tirnak = null;
    for (; j < n; j++) {
      const c = s[j];
      if (tirnak) { if (c === tirnak) tirnak = null; } else if (c === '"' || c === "'") tirnak = c; else if (c === '>') break;
    }
    if (j >= n) throw new Error('XML: kapanmayan etiket');
    let ic = s.slice(lt + 1, j);
    const kendiKapanan = ic.endsWith('/');
    if (kendiKapanan) ic = ic.slice(0, -1);
    const m = /^([^\s/>]+)/.exec(ic);
    if (!m) throw new Error('XML: bozuk etiket');
    const tam = m[1];
    const oz = {};
    const ozRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let o;
    while ((o = ozRe.exec(ic.slice(tam.length)))) oz[yerel(o[1])] = cevir(o[3] ?? o[4]);
    const dugum = { ad: yerel(tam), tam, oz, cocuk: [], metin: '' };
    ust.cocuk.push(dugum);
    if (!kendiKapanan) yigin.push(dugum);
    i = j + 1;
  }
  if (yigin.length !== 1) throw new Error(`XML: <${yigin[yigin.length - 1].tam}> kapanmadı`);
  return kok.cocuk.find((c) => c) || null;
}

// Yol: 'AccountingSupplierParty/Party/PartyName/Name' (yerel adlarla, doğrudan çocuklar)
function bul(d, yol) {
  let x = d;
  for (const p of yol.split('/')) { if (!x) return null; x = x.cocuk.find((c) => c.ad === p) || null; }
  return x;
}
function hepsi(d, yol) {
  const p = yol.split('/'); const son = p.pop();
  const u = p.length ? bul(d, p.join('/')) : d;
  return u ? u.cocuk.filter((c) => c.ad === son) : [];
}
const yazi = (d, yol) => { const x = yol ? bul(d, yol) : d; return x ? x.metin.trim() : ''; };

module.exports = { xmlOku, bul, hepsi, yazi };
