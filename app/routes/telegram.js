'use strict';
// Ayarlar → Telegram: bot durumu, hesap bağlama kodu, bağlantıyı kaldırma
module.exports = (r, { db, web, Y, telegram }) => {
  r.get('/telegram', Y, async (req) => {
    const k = (await db.query('SELECT telegram_id, telegram_ad FROM kullanicilar WHERE id = $1', [req.kullanici.id])).rows[0];
    const bagli = (await db.query(
      'SELECT id, ad_soyad, rol, telegram_ad FROM kullanicilar WHERE telegram_id IS NOT NULL AND aktif ORDER BY ad_soyad')).rows;
    const t = Object.fromEntries((await db.query(`SELECT anahtar, deger FROM ayarlar WHERE anahtar IN ('bildirim_sabah_saat', 'bildirim_aksam_saat')`)).rows.map((x) => [x.anahtar, x.deger]));
    const tercih = (await db.query('SELECT bildirimler FROM kullanicilar WHERE id = $1', [req.kullanici.id])).rows[0].bildirimler;
    return {
      bildirimler: tercih, sabah_saat: t.bildirim_sabah_saat || '08:30', aksam_saat: t.bildirim_aksam_saat || '19:00',
      yapilandirildi: !!telegram,
      bot: telegram ? telegram.durum() : null,
      benim: k.telegram_id ? { ad: k.telegram_ad } : null,
      bagli_hesaplar: bagli,
    };
  });

  r.post('/telegram/kod', Y, async (req) => {
    if (!telegram) throw web.hata(400, 'Telegram botu kurulmamış. Önce sunucuda TELEGRAM_TOKEN ayarlanmalı.');
    const kod = await telegram.kodUret(req.kullanici.id);
    return { kod, bot: telegram.durum().kullanici_adi, gecerlilik_dk: 15 };
  });

  r.put('/telegram/bildirimler', Y, async (req) => {
    const b = req.body.bildirimler || {};
    const temiz = Object.fromEntries(['is_tamamlandi', 'urun_onay', 'sabah', 'aksam'].map((k) => [k, b[k] !== false]));
    const saatGecerli = (x) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x || ''));
    await db.islem(req.kullanici.id, async (q) => {
      await q('UPDATE kullanicilar SET bildirimler = $2 WHERE id = $1', [req.kullanici.id, temiz]);
      for (const [anahtar, deger] of [['bildirim_sabah_saat', req.body.sabah_saat], ['bildirim_aksam_saat', req.body.aksam_saat]]) {
        if (deger !== undefined) {
          if (!saatGecerli(deger)) throw web.hata(400, 'Saat SS:DD biçiminde olmalı (ör. 08:30).');
          await q("UPDATE ayarlar SET deger = $2 WHERE anahtar = $1", [anahtar, deger]);
        }
      }
    });
    return { tamam: true };
  });

  // Sabah planı / akşam özetini şimdi gönder (deneme için)
  r.post('/telegram/ozet', Y, async (req) => {
    if (!telegram) throw web.hata(400, 'Telegram botu kurulmamış.');
    const tur = req.body.tur === 'aksam' ? 'aksam' : 'sabah';
    const k = (await db.query('SELECT telegram_id FROM kullanicilar WHERE id = $1', [req.kullanici.id])).rows[0];
    if (!k?.telegram_id) throw web.hata(400, 'Önce kendi Telegram hesabınızı bağlayın.');
    await telegram.gonder(k.telegram_id, tur === 'sabah' ? await telegram.sabahMetni() : await telegram.aksamMetni());
    return { tamam: true };
  });

  // Kendi bağlantısını veya (id verilirse) başka bir kullanıcının bağlantısını kaldırır
  r.post('/telegram/kaldir', Y, async (req) => {
    const id = req.body.kullanici_id || req.kullanici.id;
    await db.islem(req.kullanici.id, (q) => q('UPDATE kullanicilar SET telegram_id = NULL, telegram_ad = NULL WHERE id = $1', [id]));
    return { tamam: true };
  });
};
