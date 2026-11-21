'use strict';
// TCMB günlük döviz kurları (USD, EUR). 30 dakika önbellekte tutulur.
// TCMB hafta sonu ve tatillerde son iş gününün kurunu yayınlar.
const KAYNAK = process.env.KUR_URL || 'https://www.tcmb.gov.tr/kurlar/today.xml';
const SURE = 30 * 60 * 1000;
let onbellek = null; let zaman = 0; let istek = null;

function coz(xml) {
  const tarih = (xml.match(/Tarih="([\d.]+)"/) || [])[1] || null;
  const kur = (kod) => {
    const blok = (xml.match(new RegExp(`<Currency[^>]*Kod="${kod}"[\\s\\S]*?</Currency>`)) || [])[0];
    if (!blok) return null;
    const al = Number((blok.match(/<ForexBuying>([\d.]+)</) || [])[1]);
    const sat = Number((blok.match(/<ForexSelling>([\d.]+)</) || [])[1]);
    return Number.isFinite(sat) && sat > 0 ? { alis: al || null, satis: sat } : null;
  };
  const usd = kur('USD'); const eur = kur('EUR');
  if (!usd && !eur) throw new Error('Kur bilgisi okunamadı');
  return { tarih, usd, eur, kaynak: 'TCMB' };
}

async function kurGetir() {
  if (onbellek && Date.now() - zaman < SURE) return onbellek;
  if (!istek) {
    istek = (async () => {
      try {
        const r = await fetch(KAYNAK, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'servis-takip' } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        onbellek = coz(await r.text());
        zaman = Date.now();
      } catch (e) {
        console.error('[kur] alınamadı:', e.message);
        // Eski değer varsa onu göstermeye devam et; 5 dk sonra tekrar dene
        if (onbellek) zaman = Date.now() - SURE + 5 * 60 * 1000;
      } finally { istek = null; }
      return onbellek;
    })();
  }
  return istek;
}

module.exports = { kurGetir, coz };
