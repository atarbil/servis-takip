// Resmi fatura / e-Fatura stok eşleştirme kalitesi (veritabanısız)
const { eslestirici } = require('../lib/efaturaEslestir');
const urunler = [
  { id: 1, kod: 'TN2456', ad: 'Brother Toner Kartuş', marka: 'Brother', model: 'TN-2456' },
  { id: 2, kod: 'KBL-01', ad: 'Cat6 Kablo Makara 305m', marka: '', model: '' },
  { id: 3, kod: 'K4', ad: 'Hikvision 4MP Dome Kamera', marka: 'Hikvision', model: 'DS-2CD1143G0-I' },
  { id: 4, kod: 'K2', ad: 'Hikvision 2MP Dome Kamera', marka: 'Hikvision', model: 'DS-2CD1123G0E-I' },
  { id: 5, kod: 'ADP', ad: '12V 2A Adaptör', marka: '', model: '' },
  { id: 6, kod: 'HDD1', ad: 'Western Digital Purple 1TB Disk', marka: 'WD', model: 'WD10PURZ' },
  { id: 7, kod: 'TEL1', ad: 'Panasonic KX-TS500 Masa Telefonu', marka: 'Panasonic', model: '' },
].map((u) => ({ birim: 'adet', tur: 'urun', stok_miktari: 1, ort_maliyet: 1, barkodlar: '', ...u }));
let hata = 0;
const kontrol = (ad, ok, d) => { console.log(`${ok ? 'OK  ' : 'HATA'} ${ad}`, ok ? '' : JSON.stringify(d)); if (!ok) hata++; };
(async () => {
  const db = { query: async (q) => (/FROM urunler/.test(q) ? { rows: urunler.map((u) => ({ ...u })) } : { rows: [] }) };
  const e = eslestirici(db); const st = await e.urunleriYukle();
  const es = (ad, ek = {}) => e.eslestir({ ad, marka: '', model: '', satici_kodu: '', alici_kodu: '', uretici_kodu: '', ek_kodlar: [], ...ek }, st, new Map());
  let r = es('BROTHER TN-2456 SİYAH TONER'); kontrol('Model kodu tireli/tiresiz eşleşir', r.oneri?.urun_id === 1 && r.oneri.guven >= 95, r);
  r = es('PANASONIC KXTS500 TELEFON'); kontrol('Model kodu adın içinde', r.oneri?.urun_id === 7, r);
  r = es('HIKVISION DS-2CD1123G0E-I 2MP DOME KAMERA'); kontrol('Benzer iki kameradan doğru model', r.oneri?.urun_id === 4 && r.adaylar.some((a) => a.urun_id === 3), r);
  r = es('Hikvision 4 MP Dome'); kontrol('"4 MP" = "4MP", sayı farkı (2MP) geride', r.oneri?.urun_id === 3 && r.oneri.guven >= 85, r);
  r = es('CAT 6 UTP KABLO 305MT'); kontrol('"CAT 6" = "Cat6"', r.oneri?.urun_id === 2, r);
  r = es('12 V 2 Amper Adaptor'); kontrol('Türkçe harf (Adaptör/Adaptor)', r.oneri?.urun_id === 5, r);
  r = es('Samsung Telefon A15'); kontrol('İlgisiz ürün seçilmez', !r.oneri, r);
  r = es('Hikvision 2MP Bullet Kamera'); kontrol('Kısmi benzerlik turuncu (%60–85)', r.oneri && r.oneri.guven < 85, r);
  r = es('Ürün X', { satici_kodu: 'WD10PURZ' }); kontrol('Tedarikçi kodundaki model', r.oneri?.urun_id === 6, r);
  console.log(hata ? `\n${hata} KONTROL BAŞARISIZ` : '\nTÜM KONTROLLER BAŞARILI'); process.exit(hata ? 1 : 0);
})();
