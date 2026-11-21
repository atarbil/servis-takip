'use strict';
const crypto = require('node:crypto');

const OTURUM_GUN = 30;

function sifreOzet(sifre) {
  const tuz = crypto.randomBytes(16);
  const ozet = crypto.scryptSync(sifre, tuz, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${tuz.toString('base64')}$${ozet.toString('base64')}`;
}

function sifreDogru(sifre, kayit) {
  const [tur, tuz, ozet] = String(kayit || '').split('$');
  if (tur !== 'scrypt' || !tuz || !ozet) return false;
  const beklenen = Buffer.from(ozet, 'base64');
  const gelen = crypto.scryptSync(sifre, Buffer.from(tuz, 'base64'), beklenen.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(beklenen, gelen);
}

const tokenOzet = (t) => crypto.createHash('sha256').update(t).digest('hex');

// Kaba kuvvet denemesine karşı: aynı IP + kullanıcı adı için 15 dakikada 8 hatalı deneme
const denemeler = new Map();
function girisEngelli(anahtar) {
  const d = denemeler.get(anahtar);
  if (!d) return false;
  if (Date.now() - d.ilk > 15 * 60 * 1000) { denemeler.delete(anahtar); return false; }
  return d.sayi >= 8;
}
function hataliGiris(anahtar) {
  const d = denemeler.get(anahtar);
  if (!d || Date.now() - d.ilk > 15 * 60 * 1000) denemeler.set(anahtar, { ilk: Date.now(), sayi: 1 });
  else d.sayi++;
}
function basariliGiris(anahtar) { denemeler.delete(anahtar); }

async function oturumAc(db, kullaniciId, ip, tarayici) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO oturumlar (token_hash, kullanici_id, son_kullanma, ip, tarayici)
     VALUES ($1, $2, now() + make_interval(days => $3), $4, $5)`,
    [tokenOzet(token), kullaniciId, OTURUM_GUN, ip || null, (tarayici || '').slice(0, 300)]);
  await db.query('UPDATE kullanicilar SET son_giris = now() WHERE id = $1', [kullaniciId]);
  await db.query('DELETE FROM oturumlar WHERE son_kullanma < now()');
  return token;
}

async function oturumBul(db, token) {
  if (!token) return null;
  const r = await db.query(
    `SELECT k.id, k.ad_soyad, k.kullanici_adi, k.rol, k.ekip_id, e.ad AS ekip_ad
     FROM oturumlar o JOIN kullanicilar k ON k.id = o.kullanici_id
     LEFT JOIN ekipler e ON e.id = k.ekip_id
     WHERE o.token_hash = $1 AND o.son_kullanma > now() AND k.aktif`, [tokenOzet(token)]);
  return r.rows[0] || null;
}

async function oturumKapat(db, token) {
  if (token) await db.query('DELETE FROM oturumlar WHERE token_hash = $1', [tokenOzet(token)]);
}

function cerezYaz(res, token, guvenli) {
  const parcalar = [`oturum=${token || ''}`, 'Path=/', 'HttpOnly', 'SameSite=Lax',
    token ? `Max-Age=${OTURUM_GUN * 86400}` : 'Max-Age=0'];
  if (guvenli) parcalar.push('Secure');
  res.setHeader('set-cookie', parcalar.join('; '));
}

module.exports = { sifreOzet, sifreDogru, oturumAc, oturumBul, oturumKapat, cerezYaz,
  girisEngelli, hataliGiris, basariliGiris };
