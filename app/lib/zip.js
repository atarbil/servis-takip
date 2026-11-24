'use strict';
// Bağımlılıksız zip okuyucu: merkezi dizinden dosyaları çıkarır (yalnız "stored" ve "deflate").
const zlib = require('zlib');

const SINIR = 50 * 1024 * 1024; // açılmış dosya başına üst sınır

function zipAc(buf) {
  // Merkezi dizin sonu kaydını sondan ara
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  }
  if (e < 0) throw new Error('Zip dosyası okunamadı.');
  const adet = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const dosyalar = [];
  for (let k = 0; k < adet; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Zip dizini bozuk.');
    const yontem = buf.readUInt16LE(p + 10);
    const sikisik = buf.readUInt32LE(p + 20);
    const acik = buf.readUInt32LE(p + 24);
    const adUz = buf.readUInt16LE(p + 28);
    const ekUz = buf.readUInt16LE(p + 30);
    const notUz = buf.readUInt16LE(p + 32);
    const yerel = buf.readUInt32LE(p + 42);
    const ad = buf.slice(p + 46, p + 46 + adUz).toString('utf8');
    p += 46 + adUz + ekUz + notUz;
    if (ad.endsWith('/')) continue;
    if (acik > SINIR) throw new Error(`Zip içindeki "${ad}" çok büyük.`);
    if (buf.readUInt32LE(yerel) !== 0x04034b50) throw new Error('Zip dosya başlığı bozuk.');
    const bas = yerel + 30 + buf.readUInt16LE(yerel + 26) + buf.readUInt16LE(yerel + 28);
    const veri = buf.slice(bas, bas + sikisik);
    let icerik;
    if (yontem === 0) icerik = veri;
    else if (yontem === 8) icerik = zlib.inflateRawSync(veri, { maxOutputLength: SINIR });
    else continue; // desteklenmeyen sıkıştırma
    dosyalar.push({ ad, icerik });
  }
  return dosyalar;
}

module.exports = { zipAc };
