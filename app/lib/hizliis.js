'use strict';
// Tek mesajdan havuza iş ekleme (panel ve Telegram ortak kullanır)
const { mesajCoz } = require('./yardim');
const web = require('./web');

// "acil", "ACİL:", "!acil" ile başlayan mesajlar acil öncelikli olur
const ACIL_RX = /^\s*!?\s*ac[iİı]l\b[\s:,.-]*/i;

// cariZorunlu: programdan eklenen işler cariye bağlı olmalı (Telegram'dan carisiz açılabilir)
async function hizliIsEkle(db, kullaniciId, mesaj, { oncelik, kaynak = 'panel', planBaslangic = null, ekipId = null, cariId = null, cariZorunlu = false, q: disQ = null } = {}) {
  let metin = String(mesaj || '').trim();
  let onc = oncelik || 2;
  if (ACIL_RX.test(metin)) { onc = 1; metin = metin.replace(ACIL_RX, '').trim(); }
  const { telefon, baslik } = mesajCoz(metin);
  const calis = async (q) => {
    // Elle seçilen cari önce gelir; yoksa mesajdaki telefondan bulunur
    let cari = cariId ? await q.bir('SELECT id, unvan, adres FROM cariler WHERE id = $1', [cariId])
      : telefon ? await q.bir('SELECT id, unvan, adres FROM cariler WHERE id = cari_telefonla_bul($1)', [telefon]) : null;
    if (cariId && !cari) throw web.hata(400, 'Cari bulunamadı.');
    // Telefon yoksa / eşleşmediyse: mesajda kayıtlı bir carinin ünvanı geçiyorsa (tek eşleşme) o cari
    if (!cari && !cariId) {
      const u = (await q(`SELECT id, unvan, adres FROM cariler WHERE aktif AND length(unvan) >= 4
          AND ' ' || arama_metni($1) || ' ' LIKE '% ' || arama_metni(unvan) || ' %' LIMIT 2`, [metin])).rows;
      if (u.length === 1) cari = u[0];
    }
    if (cariZorunlu && !cari) throw web.hata(400, telefon ? 'Mesajdaki telefon kayıtlı bir cariyle eşleşmedi; cari seçin ya da yeni cari açın.' : 'Cari seçin (yoksa "Yeni cari" ile açın).');
    const { id } = await q.bir('SELECT is_olustur($1, $2, $3, $4, NULL, $5, $6::smallint, $7, NULL, $8) AS id', [
      baslik, String(mesaj).trim(), cari?.id || null, cari?.adres || null, telefon, onc, planBaslangic, ekipId]);
    if (kaynak !== 'panel') await q('UPDATE isler SET kaynak = $2 WHERE id = $1', [id, kaynak]);
    return { id, baslik, telefon, oncelik: onc, cari: cari ? { id: cari.id, unvan: cari.unvan } : null };
  };
  return disQ ? calis(disQ) : db.islem(kullaniciId, calis);
}

module.exports = { hizliIsEkle };
