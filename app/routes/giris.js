'use strict';
const { zorunlu, metin } = require('../lib/yardim');

module.exports = (r, { db, web, oturum, AYAR, G }) => {
  const kullaniciSayisi = async () => (await db.query('SELECT count(*)::int AS n FROM kullanicilar')).rows[0].n;

  r.get('/durum', async (req) => ({
    kurulum_gerekli: (await kullaniciSayisi()) === 0,
    kullanici: req.kullanici,
    firma_adi: (await db.query("SELECT deger FROM ayarlar WHERE anahtar = 'firma_adi'")).rows[0]?.deger || null,
  }));

  // İlk açılış: yönetici hesabı + varsayılan ekipler ve kasa
  r.post('/ilk-kurulum', async (req, res) => {
    const b = req.body;
    zorunlu(b, { ad_soyad: 'Ad soyad', kullanici_adi: 'Kullanıcı adı', sifre: 'Şifre' });
    if (String(b.sifre).length < 8) throw web.hata(400, 'Şifre en az 8 karakter olmalı.');
    const id = await db.islem(null, async (q) => {
      await q('LOCK TABLE kullanicilar IN EXCLUSIVE MODE');
      if ((await q.bir('SELECT count(*)::int AS n FROM kullanicilar')).n > 0) throw web.hata(400, 'Kurulum zaten yapılmış.');
      const k = await q.bir(`INSERT INTO kullanicilar (ad_soyad, kullanici_adi, sifre_hash, rol)
        VALUES ($1, lower($2), $3, 'yonetici') RETURNING id`,
        [metin(b.ad_soyad), metin(b.kullanici_adi), oturum.sifreOzet(String(b.sifre))]);
      await q(`INSERT INTO ekipler (ad, renk) VALUES ('1. Ekip', '#2563eb'), ('2. Ekip', '#16a34a') ON CONFLICT DO NOTHING`);
      await q(`INSERT INTO hesaplar (ad, tip) VALUES ('Merkez Kasa', 'kasa'), ('Banka', 'banka'), ('POS', 'pos') ON CONFLICT DO NOTHING`);
      if (metin(b.firma_adi)) await q(`UPDATE ayarlar SET deger = $1 WHERE anahtar = 'firma_adi'`, [metin(b.firma_adi)]);
      return k.id;
    });
    oturum.cerezYaz(res, await oturum.oturumAc(db, id, req.ip, req.headers['user-agent']), AYAR.guvenliCerez);
    return { tamam: true };
  });

  r.post('/giris', async (req, res) => {
    const kadi = String(req.body.kullanici_adi || '').trim().toLowerCase();
    const sifre = String(req.body.sifre || '');
    const anahtar = `${req.ip}|${kadi}`;
    if (oturum.girisEngelli(anahtar)) throw web.hata(429, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
    const k = (await db.query('SELECT id, sifre_hash FROM kullanicilar WHERE kullanici_adi = $1 AND aktif', [kadi])).rows[0];
    if (!k || !oturum.sifreDogru(sifre, k.sifre_hash)) {
      oturum.hataliGiris(anahtar);
      throw web.hata(401, 'Kullanıcı adı veya şifre hatalı.');
    }
    oturum.basariliGiris(anahtar);
    const token = await oturum.oturumAc(db, k.id, req.ip, req.headers['user-agent']);
    oturum.cerezYaz(res, token, AYAR.guvenliCerez);
    return { kullanici: await oturum.oturumBul(db, token), tamam: true };
  });

  r.post('/cikis', async (req, res) => {
    await oturum.oturumKapat(db, req.token);
    oturum.cerezYaz(res, null, AYAR.guvenliCerez);
    return { tamam: true };
  });

  r.get('/ben', G, async (req) => req.kullanici);

  r.post('/sifre-degistir', G, async (req, res) => {
    const { eski, yeni } = req.body;
    if (String(yeni || '').length < 8) throw web.hata(400, 'Yeni şifre en az 8 karakter olmalı.');
    const k = (await db.query('SELECT sifre_hash FROM kullanicilar WHERE id = $1', [req.kullanici.id])).rows[0];
    if (!oturum.sifreDogru(String(eski || ''), k.sifre_hash)) throw web.hata(400, 'Mevcut şifre hatalı.');
    await db.islem(req.kullanici.id, async (q) => {
      await q('UPDATE kullanicilar SET sifre_hash = $1 WHERE id = $2', [oturum.sifreOzet(String(yeni)), req.kullanici.id]);
      await q('DELETE FROM oturumlar WHERE kullanici_id = $1', [req.kullanici.id]);
    });
    oturum.cerezYaz(res, await oturum.oturumAc(db, req.kullanici.id, req.ip, req.headers['user-agent']), AYAR.guvenliCerez);
    return { tamam: true };
  });
};
