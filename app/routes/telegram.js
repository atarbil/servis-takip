'use strict';
// Ayarlar → Telegram: bot durumu, hesap bağlama kodu, bağlantıyı kaldırma
module.exports = (r, { db, web, Y, telegram }) => {
  r.get('/telegram', Y, async (req) => {
    const k = (await db.query('SELECT telegram_id, telegram_ad FROM kullanicilar WHERE id = $1', [req.kullanici.id])).rows[0];
    const bagli = (await db.query(
      'SELECT id, ad_soyad, rol, telegram_ad FROM kullanicilar WHERE telegram_id IS NOT NULL AND aktif ORDER BY ad_soyad')).rows;
    return {
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

  // Kendi bağlantısını veya (id verilirse) başka bir kullanıcının bağlantısını kaldırır
  r.post('/telegram/kaldir', Y, async (req) => {
    const id = req.body.kullanici_id || req.kullanici.id;
    await db.islem(req.kullanici.id, (q) => q('UPDATE kullanicilar SET telegram_id = NULL, telegram_ad = NULL WHERE id = $1', [id]));
    return { tamam: true };
  });
};
