'use strict';
// Tek mesajdan havuza iş ekleme (panel ve Telegram ortak kullanır)
const { mesajCoz } = require('./yardim');
const web = require('./web');

// "acil", "ACİL:", "!acil" ile başlayan mesajlar acil öncelikli olur
const ACIL_RX = /^\s*!?\s*ac[iİı]l\b[\s:,.-]*/i;

async function hizliIsEkle(db, kullaniciId, mesaj, { oncelik, kaynak = 'panel', planBaslangic = null, ekipId = null, cariId = null, q: disQ = null } = {}) {
  let metin = String(mesaj || '').trim();
  let onc = oncelik || 2;
  if (ACIL_RX.test(metin)) { onc = 1; metin = metin.replace(ACIL_RX, '').trim(); }
  const { telefon, baslik } = mesajCoz(metin);
  const calis = async (q) => {
    // Elle seçilen cari önce gelir; yoksa mesajdaki telefondan bulunur
    const cari = cariId ? await q.bir('SELECT id, unvan, adres FROM cariler WHERE id = $1', [cariId])
      : telefon ? await q.bir('SELECT id, unvan, adres FROM cariler WHERE id = cari_telefonla_bul($1)', [telefon]) : null;
    if (cariId && !cari) throw web.hata(400, 'Cari bulunamadı.');
    const { id } = await q.bir('SELECT is_olustur($1, $2, $3, $4, NULL, $5, $6::smallint, $7, NULL, $8) AS id', [
      baslik, String(mesaj).trim(), cari?.id || null, cari?.adres || null, telefon, onc, planBaslangic, ekipId]);
    if (kaynak !== 'panel') await q('UPDATE isler SET kaynak = $2 WHERE id = $1', [id, kaynak]);
    return { id, baslik, telefon, oncelik: onc, cari: cari ? { id: cari.id, unvan: cari.unvan } : null };
  };
  return disQ ? calis(disQ) : db.islem(kullaniciId, calis);
}

module.exports = { hizliIsEkle };
