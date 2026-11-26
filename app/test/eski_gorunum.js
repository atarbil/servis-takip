// Bu testler telefon boyutunda da "bilgisayar görünümü"nü (eski telefon düzeni) sınar.
// Yeni telefon arayüzü test/mobil_kabuk_testi.js ile ayrı sınanır.
module.exports = function eskiGorunum(tarayici) {
  const asil = tarayici.newContext.bind(tarayici);
  tarayici.newContext = async (secenek = {}) => {
    const { yeniMobil, ...s } = secenek;
    const c = await asil(s);
    if (!yeniMobil) await c.addInitScript(() => { try { if (!localStorage.getItem('gorunum')) localStorage.setItem('gorunum', 'masa'); } catch { /* */ } });
    return c;
  };
  return tarayici;
};
