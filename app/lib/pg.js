'use strict';
// Bağımlılıksız, küçük PostgreSQL istemcisi.
// Destekler: SCRAM-SHA-256 / MD5 / düz şifre, parametreli sorgu (extended protocol),
// çoklu komut (simple query - şema dosyaları için), bağlantı havuzu, işlem (transaction).
const net = require('node:net');
const crypto = require('node:crypto');

// ---------- Tip dönüşümleri (text format) ----------
const SAYI = new Set([20, 21, 23, 26, 700, 701, 1700]);
function donustur(oid, s) {
  if (s === null) return null;
  if (oid === 16) return s === 't';
  if (SAYI.has(oid)) return Number(s);
  if (oid === 114 || oid === 3802) return JSON.parse(s);
  if (oid === 1184 || oid === 1114) {
    // "2026-11-24 14:00:00+03" -> "2026-11-24T14:00:00+03:00" (tüm tarayıcılar okuyabilsin)
    let t = s.replace(' ', 'T');
    const m = t.match(/([+-]\d{2})(:?(\d{2}))?$/);
    if (m && !m[2]) t = t + ':00';
    return t;
  }
  return s; // date, text, enum, interval...
}

function parametre(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'boolean') return v ? 't' : 'f';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ---------- Mesaj yazma ----------
function cstr(s) { return Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]); }
function mesaj(tip, govde) {
  const b = Buffer.alloc(5);
  b.write(tip, 0, 'ascii');
  b.writeInt32BE(govde.length + 4, 1);
  return Buffer.concat([b, govde]);
}
function i16(n) { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; }
function i32(n) { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; }

class PgHata extends Error {
  constructor(alanlar) {
    super(alanlar.M || 'Veritabanı hatası');
    this.kod = alanlar.C;        // SQLSTATE
    this.ipucu = alanlar.H;      // bizim iş kuralı kodumuz (HINT)
    this.detay = alanlar.D;
    this.kisit = alanlar.n;      // constraint adı
    this.pg = true;
  }
}

class Baglanti {
  constructor(ayar) {
    this.ayar = ayar;
    this.tampon = Buffer.alloc(0);
    this.bekleyen = null;   // aktif sorgunun durumu
    this.sira = Promise.resolve();
    this.kapali = false;
  }

  baglan() {
    return new Promise((coz, reddet) => {
      const { host, port, user, database } = this.ayar;
      this.soket = net.connect({ host, port });
      this.soket.setNoDelay(true);
      this.soket.on('data', (d) => this._veri(d));
      this.soket.on('error', (e) => { this.kapali = true; if (this.bekleyen) this.bekleyen.reddet(e); else if (this._acilis) this._acilis.reddet(e); });
      this.soket.on('close', () => { this.kapali = true; if (this.bekleyen) this.bekleyen.reddet(new Error('Veritabanı bağlantısı kapandı')); });
      this._acilis = { coz, reddet };
      this.soket.on('connect', () => {
        const govde = Buffer.concat([
          i32(196608),
          cstr('user'), cstr(user), cstr('database'), cstr(database),
          cstr('client_encoding'), cstr('UTF8'),
          cstr('TimeZone'), cstr(this.ayar.timezone || 'Europe/Istanbul'),
          cstr('application_name'), cstr('servis-takip'),
          Buffer.from([0]),
        ]);
        const b = Buffer.alloc(4); b.writeInt32BE(govde.length + 4);
        this.soket.write(Buffer.concat([b, govde]));
      });
    });
  }

  _veri(d) {
    this.tampon = this.tampon.length ? Buffer.concat([this.tampon, d]) : d;
    while (this.tampon.length >= 5) {
      const uzun = this.tampon.readInt32BE(1);
      if (this.tampon.length < uzun + 1) break;
      const tip = String.fromCharCode(this.tampon[0]);
      const govde = this.tampon.subarray(5, uzun + 1);
      this.tampon = this.tampon.subarray(uzun + 1);
      try { this._isle(tip, govde); } catch (e) { (this.bekleyen || this._acilis)?.reddet(e); }
    }
  }

  _alanlar(govde) {
    const a = {}; let i = 0;
    while (i < govde.length && govde[i] !== 0) {
      const k = String.fromCharCode(govde[i]); i++;
      const son = govde.indexOf(0, i);
      a[k] = govde.toString('utf8', i, son); i = son + 1;
    }
    return a;
  }

  _isle(tip, g) {
    if (this._acilis) return this._kimlik(tip, g);
    const q = this.bekleyen;
    switch (tip) {
      case 'T': { // RowDescription
        const n = g.readInt16BE(0); let i = 2; const sutun = [];
        for (let k = 0; k < n; k++) {
          const son = g.indexOf(0, i);
          const ad = g.toString('utf8', i, son); i = son + 1;
          const oid = g.readInt32BE(i + 6);
          sutun.push({ ad, oid }); i += 18;
        }
        q.sutun = sutun; break;
      }
      case 'D': { // DataRow
        const n = g.readInt16BE(0); let i = 2; const satir = {};
        for (let k = 0; k < n; k++) {
          const u = g.readInt32BE(i); i += 4;
          const s = u === -1 ? null : g.toString('utf8', i, i + u);
          if (u > 0) i += u;
          const c = q.sutun[k];
          satir[c.ad] = donustur(c.oid, s);
        }
        q.satirlar.push(satir); break;
      }
      case 'C': { // CommandComplete
        const etiket = g.toString('utf8', 0, g.length - 1);
        const m = etiket.match(/(\d+)$/);
        q.etkilenen = m ? Number(m[1]) : 0; break;
      }
      case 'E': q.hata = new PgHata(this._alanlar(g)); break;
      case 'Z': { // ReadyForQuery
        this.bekleyen = null;
        if (q) q.hata ? q.reddet(q.hata) : q.coz({ rows: q.satirlar, rowCount: q.etkilenen });
        break;
      }
      // '1' ParseComplete, '2' BindComplete, 'n' NoData, 'N' Notice, 'S' ParameterStatus, 'I' Empty, 's' Suspended, 'A' Notify
      default: break;
    }
  }

  _kimlik(tip, g) {
    const a = this._acilis;
    if (tip === 'E') { this._acilis = null; return a.reddet(new PgHata(this._alanlar(g))); }
    if (tip === 'Z') { this._acilis = null; return a.coz(this); }
    if (tip !== 'R') return; // S, K
    const kod = g.readInt32BE(0);
    const sifre = this.ayar.password || '';
    if (kod === 0) return;
    if (kod === 3) return this.soket.write(mesaj('p', cstr(sifre)));
    if (kod === 5) {
      const tuz = g.subarray(4, 8);
      const ic = crypto.createHash('md5').update(sifre + this.ayar.user).digest('hex');
      const dis = crypto.createHash('md5').update(Buffer.concat([Buffer.from(ic), tuz])).digest('hex');
      return this.soket.write(mesaj('p', cstr('md5' + dis)));
    }
    if (kod === 10) { // SASL başlangıç
      this._nonce = crypto.randomBytes(18).toString('base64');
      this._ilkCiplak = 'n=*,r=' + this._nonce;
      const veri = Buffer.from('n,,' + this._ilkCiplak);
      return this.soket.write(mesaj('p', Buffer.concat([cstr('SCRAM-SHA-256'), i32(veri.length), veri])));
    }
    if (kod === 11) { // SASL devam
      const sunucuIlk = g.toString('utf8', 4);
      const p = Object.fromEntries(sunucuIlk.split(',').map((x) => [x[0], x.slice(2)]));
      if (!p.r.startsWith(this._nonce)) throw new Error('SCRAM nonce uyuşmuyor');
      const tuzlu = crypto.pbkdf2Sync(sifre, Buffer.from(p.s, 'base64'), Number(p.i), 32, 'sha256');
      const hmac = (k, v) => crypto.createHmac('sha256', k).update(v).digest();
      const istemciAnahtar = hmac(tuzlu, 'Client Key');
      const saklanan = crypto.createHash('sha256').update(istemciAnahtar).digest();
      const sonsuz = 'c=biws,r=' + p.r;
      const authMesaj = this._ilkCiplak + ',' + sunucuIlk + ',' + sonsuz;
      const imza = hmac(saklanan, authMesaj);
      const kanit = Buffer.alloc(32);
      for (let k = 0; k < 32; k++) kanit[k] = istemciAnahtar[k] ^ imza[k];
      this._sunucuImza = hmac(hmac(tuzlu, 'Server Key'), authMesaj).toString('base64');
      return this.soket.write(mesaj('p', Buffer.from(sonsuz + ',p=' + kanit.toString('base64'))));
    }
    if (kod === 12) { // SASL final
      const v = g.toString('utf8', 4).replace(/^v=/, '');
      if (v !== this._sunucuImza) throw new Error('SCRAM sunucu imzası doğrulanamadı');
      return;
    }
    throw new Error('Desteklenmeyen kimlik doğrulama yöntemi: ' + kod);
  }

  // Parametreli tek sorgu
  query(sql, params = []) {
    const is = () => new Promise((coz, reddet) => {
      if (this.kapali) return reddet(new Error('Veritabanı bağlantısı kapalı'));
      this.bekleyen = { coz, reddet, satirlar: [], sutun: [], etkilenen: 0, hata: null };
      const ps = params.map(parametre);
      const bind = [cstr(''), cstr(''), i16(0), i16(ps.length)];
      for (const p of ps) {
        if (p === null) bind.push(i32(-1));
        else { const b = Buffer.from(p, 'utf8'); bind.push(i32(b.length), b); }
      }
      bind.push(i16(0));
      this.soket.write(Buffer.concat([
        mesaj('P', Buffer.concat([cstr(''), cstr(sql), i16(0)])),
        mesaj('B', Buffer.concat(bind)),
        mesaj('D', Buffer.concat([Buffer.from('P'), cstr('')])),
        mesaj('E', Buffer.concat([cstr(''), i32(0)])),
        mesaj('S', Buffer.alloc(0)),
      ]));
    });
    const p = this.sira.then(is, is);
    this.sira = p.catch(() => {});
    return p;
  }

  // Çok komutlu metin (şema dosyaları). Parametre almaz.
  exec(sql) {
    const is = () => new Promise((coz, reddet) => {
      this.bekleyen = { coz, reddet, satirlar: [], sutun: [], etkilenen: 0, hata: null };
      this.soket.write(mesaj('Q', cstr(sql)));
    });
    const p = this.sira.then(is, is);
    this.sira = p.catch(() => {});
    return p;
  }

  kapat() { this.kapali = true; try { this.soket.end(mesaj('X', Buffer.alloc(0))); } catch { /* */ } }
}

function urlCoz(url) {
  const u = new URL(url);
  return {
    host: u.hostname, port: Number(u.port || 5432),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
  };
}

class Havuz {
  constructor(url, boyut = 10) {
    this.ayar = typeof url === 'string' ? urlCoz(url) : url;
    this.boyut = boyut;
    this.bos = [];
    this.toplam = 0;
    this.kuyruk = [];
  }

  async al() {
    while (this.bos.length) {
      const b = this.bos.pop();
      if (!b.kapali) return b;
      this.toplam--;
    }
    if (this.toplam < this.boyut) {
      this.toplam++;
      try { return await new Baglanti(this.ayar).baglan(); } catch (e) { this.toplam--; throw e; }
    }
    return new Promise((coz) => this.kuyruk.push(coz));
  }

  birak(b) {
    if (b.kapali) { this.toplam--; return; }
    const bekleyen = this.kuyruk.shift();
    if (bekleyen) bekleyen(b); else this.bos.push(b);
  }

  async query(sql, params) {
    const b = await this.al();
    try { return await b.query(sql, params); } finally { this.birak(b); }
  }

  // İşlem: hata olursa tümü geri alınır. kullaniciId denetim kaydı için yazılır.
  async islem(kullaniciId, fn) {
    const b = await this.al();
    try {
      await b.query('BEGIN');
      if (kullaniciId) await b.query("SELECT set_config('app.kullanici_id', $1, true)", [kullaniciId]);
      const q = (sql, params) => b.query(sql, params);
      q.bir = async (sql, params) => (await b.query(sql, params)).rows[0] || null;
      q.hepsi = async (sql, params) => (await b.query(sql, params)).rows;
      const sonuc = await fn(q);
      await b.query('COMMIT');
      return sonuc;
    } catch (e) {
      try { await b.query('ROLLBACK'); } catch { b.kapat(); }
      throw e;
    } finally {
      this.birak(b);
    }
  }

  async kapat() { for (const b of this.bos) b.kapat(); this.bos = []; }
}

module.exports = { Havuz, Baglanti, PgHata, urlCoz };
