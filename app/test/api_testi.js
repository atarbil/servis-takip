// API uçtan uca testi. Çalışan sunucuya karşı: node test/api_testi.js http://127.0.0.1:3100
'use strict';
const TABAN = process.argv[2] || 'http://127.0.0.1:3100';
let basarisiz = 0;

function istemci() {
  let cerez = '';
  return async (yontem, yol, govde) => {
    const r = await fetch(TABAN + '/api' + yol, {
      method: yontem,
      headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez },
      body: govde ? JSON.stringify(govde) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cerez = sc.split(';')[0];
    const veri = await r.json().catch(() => null);
    return { durum: r.status, veri };
  };
}
function kontrol(ad, kosul, ek) {
  if (kosul) console.log('OK  ', ad);
  else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek) : ''); }
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

(async () => {
  const y = istemci();
  const t = istemci();
  let x;

  x = await y('GET', '/durum');
  kontrol('İlk açılışta kurulum gerekli', x.veri.kurulum_gerekli === true);
  x = await y('POST', '/ilk-kurulum', { ad_soyad: 'Patron', kullanici_adi: 'Patron', sifre: '12345678', firma_adi: 'Deneme Teknoloji' });
  kontrol('İlk kurulum', x.durum === 200, x.veri);
  x = await y('POST', '/ilk-kurulum', { ad_soyad: 'X', kullanici_adi: 'x', sifre: '12345678' });
  kontrol('İkinci kurulum engellendi', x.durum === 400);
  x = await y('GET', '/ben');
  kontrol('Yönetici oturumu', x.veri.rol === 'yonetici' && x.veri.kullanici_adi === 'patron', x.veri);

  // CSRF
  const ham = await fetch(TABAN + '/api/cikis', { method: 'POST' });
  kontrol('Özel başlıksız istek reddedildi', ham.status === 403);

  // Ekip, teknisyen
  const ekipler = (await y('GET', '/ekipler')).veri;
  kontrol('Varsayılan 2 ekip', ekipler.length === 2);
  x = await y('POST', '/kullanicilar', { ad_soyad: 'Mehmet Usta', kullanici_adi: 'mehmet', sifre: 'usta1234', rol: 'teknisyen', ekip_id: ekipler[0].id });
  kontrol('Teknisyen eklendi', x.durum === 200, x.veri);
  x = await t('POST', '/giris', { kullanici_adi: 'mehmet', sifre: 'yanlis' });
  kontrol('Hatalı şifre reddedildi', x.durum === 401);
  x = await t('POST', '/giris', { kullanici_adi: 'Mehmet', sifre: 'usta1234' });
  kontrol('Teknisyen girişi', x.durum === 200 && x.veri.kullanici.rol === 'teknisyen', x.veri);

  // Cari, ürün, alış
  const musteri = (await y('POST', '/cariler', { unvan: 'Ahmet Market', telefon: '0532 111 22 33', adres: 'Kadıköy', devir_bakiye: 1000 })).veri;
  const tedarikci = (await y('POST', '/cariler', { unvan: 'Güvenlik Dağıtım', tip: 'tedarikci' })).veri;
  kontrol('Cariler eklendi', musteri.id && tedarikci.id);
  const kamera = (await y('POST', '/urunler', { ad: 'IP Kamera 4MP', kod: 'KAM-01', onerilen_satis: 2000, barkodlar: ['8690000000011'] })).veri;
  const kablo = (await y('POST', '/urunler', { ad: 'CAT6 Kablo', birim: 'metre', onerilen_satis: 25, barkodlar: ['8690000000028'] })).veri;
  x = await y('POST', '/urunler', { ad: 'Başka', barkodlar: ['8690000000011'] });
  kontrol('Aynı barkod ikinci ürüne verilemez', x.durum === 409, x.veri);
  x = await y('POST', '/alislar', { cari_id: tedarikci.id, belge_no: 'A-1', satirlar: [
    { urun_id: kamera.id, miktar: 10, birim_fiyat: 1000 }, { urun_id: kablo.id, miktar: 100, birim_fiyat: '10,00' }] });
  kontrol('Alış faturası taslak', x.veri.durum === 'taslak' && x.veri.genel_toplam === 13200, x.veri);
  x = await y('POST', `/alislar/${x.veri.id}/onayla`);
  kontrol('Alış onaylandı', x.veri.durum === 'onaylandi');

  // Hızlı iş: telefondan müşteri bulunur
  x = await y('POST', '/isler/hizli', { mesaj: 'Ahmet bey 4 kamera görüntü yok +90 532 111 22 33\nakşam 5ten sonra' });
  kontrol('Hızlı iş müşteriyi telefondan buldu', x.veri.cari?.id === musteri.id && x.veri.baslik === 'Ahmet bey 4 kamera görüntü yok', x.veri);
  const isId = x.veri.id;
  x = await y('GET', '/havuz');
  kontrol('İş havuzda', x.veri.length === 1 && x.veri[0].id === isId);

  // Teknisyen yetkisizlikleri
  kontrol('Teknisyen havuzu göremez', (await t('GET', '/havuz')).durum === 403);
  kontrol('Teknisyen cari göremez', (await t('GET', '/cariler')).durum === 403);
  kontrol('Teknisyen raporu göremez', (await t('GET', '/ozet')).durum === 403);
  kontrol('Teknisyen havuzdaki işi göremez', (await t('GET', `/isler/${isId}`)).durum === 403);

  // Planla -> havuza al -> planla
  const yarin = new Date(Date.now() + 86400000); yarin.setHours(10, 0, 0, 0);
  x = await y('POST', `/isler/${isId}/planla`, { ekip_id: ekipler[0].id, baslangic: yarin.toISOString() });
  kontrol('Planlandı', x.durum === 200, x.veri);
  x = await y('POST', `/isler/${isId}/havuza-al`, { neden: 'Müşteri erteledi' });
  kontrol('Havuza geri alındı', x.durum === 200 && (await y('GET', '/havuz')).veri.length === 1);
  await y('POST', `/isler/${isId}/planla`, { ekip_id: ekipler[0].id, baslangic: yarin.toISOString() });
  const bas = new Date(Date.now() - 86400000).toISOString(); const bit = new Date(Date.now() + 7 * 86400000).toISOString();
  x = await y('GET', `/takvim?bas=${bas}&bit=${bit}`);
  kontrol('Takvimde görünüyor', x.veri.some((e) => e.tur === 'is' && e.id === isId), x.veri);
  x = await t('GET', `/takvim?bas=${bas}&bit=${bit}`);
  kontrol('Teknisyen takviminde kendi işi', x.veri.length === 1);

  // Takvimden doğrudan iş, 2. ekip -> teknisyen görmez
  x = await y('POST', '/isler', { baslik: 'DVR kurulum', cari_id: musteri.id, plan_baslangic: yarin.toISOString(), ekip_id: ekipler[1].id });
  const is2 = x.veri.id;
  kontrol('Başka ekibin işine teknisyen erişemez', (await t('GET', `/isler/${is2}`)).durum === 403);
  x = await y('POST', '/notlar', { baslik: 'Faturaları kontrol et', baslangic: yarin.toISOString() });
  kontrol('Takvim notu', x.durum === 200);

  // Saha
  x = await t('GET', '/islerim');
  kontrol('İşlerim listesi', x.veri.length === 1 && x.veri[0].id === isId, x.veri);
  kontrol('Teknisyen başlattı', (await t('POST', `/isler/${isId}/baslat`)).durum === 200);
  x = await t('POST', `/isler/${isId}/malzeme`, { barkod: '8690000000011', miktar: 4 });
  kontrol('Barkodla malzeme', x.durum === 200, x.veri);
  x = await t('POST', `/isler/${isId}/malzeme`, { urun_id: kablo.id, miktar: '30' });
  kontrol('Aramayla malzeme', x.durum === 200, x.veri);
  x = await t('POST', `/isler/${isId}/malzeme`, { barkod: '999', miktar: 1 });
  kontrol('Tanımsız barkod kodu döndü', x.veri.kod === 'BARKOD_TANIMSIZ', x.veri);
  x = await t('POST', `/isler/${isId}/tanimsiz-urun`, { ad: 'RJ45 konnektör', miktar: 8, barkod: '999' });
  kontrol('Tanımsız ürün eklendi', x.durum === 200, x.veri);
  x = await t('GET', `/urunler?q=kamera`);
  kontrol('Teknisyen ürün aramasında maliyet yok', x.veri.length && x.veri[0].ort_maliyet === undefined && x.veri[0].onerilen_satis === undefined, x.veri[0]);
  x = await t('GET', `/isler/${isId}`);
  kontrol('Teknisyen iş detayında maliyet yok', x.veri.malzemeler.length === 3 && x.veri.malzemeler.every((m) => m.birim_maliyet === undefined) && x.veri.karlilik === undefined, x.veri.malzemeler[0]);
  x = await t('POST', `/isler/${isId}/foto`, { veri: PNG, aciklama: 'Önce' });
  kontrol('Fotoğraf yüklendi', x.durum === 200 && x.veri.dosya_yolu, x.veri);
  const fotoYol = x.veri.dosya_yolu;
  kontrol('İmzasız tamamlama engellendi', (await t('POST', `/isler/${isId}/tamamla`)).veri.kod === 'IMZA_YOK');
  x = await t('POST', `/isler/${isId}/teslim`, { teslim_alan_ad: 'Ahmet Yılmaz', imza: PNG });
  kontrol('İmza alındı', x.durum === 200, x.veri);
  x = await t('POST', `/isler/${isId}/teslim`, { teslim_alan_ad: 'Başka', imza: PNG });
  kontrol('İkinci imza engellendi', x.durum === 400);
  kontrol('Tamamlandı', (await t('POST', `/isler/${isId}/tamamla`, { not: 'Kameralar değişti' })).durum === 200);
  kontrol('Tamamlanan işe teknisyen malzeme ekleyemez', (await t('POST', `/isler/${isId}/malzeme`, { urun_id: kablo.id, miktar: 1 })).durum === 400);

  // Dosya erişimi
  const dYok = await fetch(`${TABAN}/dosya/${fotoYol}`);
  kontrol('Oturumsuz dosya erişimi engellendi', dYok.status === 401);
  const { guvenliYol } = require('../lib/web');
  kontrol('Klasör dışına çıkış engellendi', guvenliYol('/data/d', '../../etc/passwd') === '/data/d/etc/passwd' && guvenliYol('/data/d', '%2e%2e') !== '/data');

  // Fiş
  x = await y('POST', `/isler/${isId}/fis`);
  const fisId = x.veri.id;
  x = await y('GET', `/fisler/${fisId}`);
  kontrol('Fiş taslağı 3 satır', x.veri.satirlar.length === 3, x.veri.satirlar);
  const satirlar = x.veri.satirlar.map((s) => ({ ...s, birim_fiyat: s.urun_id === kamera.id ? 2000 : s.urun_id === kablo.id ? 25 : 15 }));
  satirlar.push({ tip: 'iscilik', aciklama: 'Montaj işçiliği', miktar: 1, birim_fiyat: 1500, kdv_orani: 20 });
  x = await y('PUT', `/fisler/${fisId}`, { satirlar, vade: new Date().toISOString().slice(0, 10) });
  kontrol('Fiş kaydedildi', x.veri.ara_toplam === 10370 && x.veri.genel_toplam === 12444, x.veri);
  x = await y('POST', `/fisler/${fisId}/onayla`);
  kontrol('Onaysız ürünle fiş onaylanmadı', x.veri.kod === 'URUN_ONAYSIZ', x.veri);
  const onayBekleyen = (await y('GET', '/urunler?onay_bekliyor=1')).veri;
  kontrol('Onay bekleyen ürün listesi', onayBekleyen.length === 1);
  await y('POST', `/urunler/${onayBekleyen[0].id}/onayla`, { birim_maliyet: 5, kod: 'KON-01' });
  x = await y('POST', `/fisler/${fisId}/onayla`);
  kontrol('Fiş onaylandı, maliyet 4x1000+30x10+8x5=4340', x.veri.durum === 'onaylandi' && x.veri.maliyet_toplam === 4340 && x.veri.kar === 6030, x.veri);
  x = await y('GET', `/isler/${isId}`);
  kontrol('İş kârlılığı', x.veri.karlilik.kar === 6030 && x.veri.durum === 'fis_kesildi', x.veri.karlilik);

  // Tahsilat, ekstre, raporlar
  const hesaplar = (await y('GET', '/hesaplar')).veri;
  x = await y('POST', '/finans/tahsilat', { cari_id: musteri.id, hesap_id: hesaplar[0].id, tutar: '5.000', aciklama: 'Nakit' });
  kontrol('"5.000" yazımı', x.durum === 200, x.veri);
  kontrol('"5.000" beş bin olarak okundu', (await y('GET', '/finans')).veri[0].tutar === 5000);
  await y('POST', `/finans/${x.veri.id}/iptal`);
  x = await y('POST', '/finans/tahsilat', { cari_id: musteri.id, hesap_id: hesaplar[0].id, tutar: 5000, aciklama: 'Nakit' });
  kontrol('Tahsilat', x.durum === 200);
  x = await y('GET', `/cariler/${musteri.id}`);
  kontrol('Cari bakiye 8444', x.veri.bakiye === 8444, x.veri.bakiye);
  x = await y('GET', `/cariler/${musteri.id}/ekstre`);
  kontrol('Ekstre', x.veri.satirlar.at(-1).bakiye === 8444, x.veri.satirlar);
  x = await y('GET', '/ozet');
  kontrol('Panel özeti', x.durum === 200 && x.veri.hesaplar[0].bakiye === 5000 && x.veri.bu_ay.kar === 6030, x.veri);
  for (const rp of ['/rapor/cari-bakiye', '/rapor/vadesi-gecen', '/rapor/yillik', '/rapor/is-karlilik', '/rapor/ekip-aylik', '/rapor/stok-uyari', '/rapor/aylik-satis', '/denetim']) {
    x = await y('GET', rp);
    kontrol('Rapor ' + rp, x.durum === 200 && Array.isArray(x.veri), x.veri);
  }
  x = await y('GET', '/isler?q=ahmet');
  kontrol('İş arama', x.durum === 200 && x.veri.length >= 1, x.veri);

  // Doğrudan satış fişi
  x = await y('POST', '/fisler', { cari_id: musteri.id });
  x = await y('PUT', `/fisler/${x.veri.id}`, { satirlar: [{ tip: 'urun', urun_id: kamera.id, aciklama: 'IP Kamera', miktar: 1, birim_fiyat: 2100 }] });
  x = await y('POST', `/fisler/${x.veri.id}/onayla`);
  kontrol('Doğrudan satış', x.veri.durum === 'onaylandi' && x.veri.maliyet_toplam === 1000, x.veri);
  x = await y('GET', `/urunler/${kamera.id}`);
  kontrol('Kamera stok 10-4-1=5', x.veri.stok_miktari === 5, x.veri.stok_miktari);

  // Fişte ürün adı değiştirilemez, not kaydedilir
  x = await y('POST', '/fisler', { cari_id: musteri.id });
  x = await y('PUT', `/fisler/${x.veri.id}`, { satirlar: [{ tip: 'urun', urun_id: kamera.id, aciklama: 'Başka bir şey', notu: 'Seri: AB123, 2 yıl garanti', miktar: 1, birim_fiyat: 100 },
    { tip: 'hizmet', aciklama: 'Kurulum ve ayar', miktar: 1, birim_fiyat: 50 }] });
  kontrol('Ürün satırı adı stok kartından geldi', x.veri.satirlar[0].aciklama === 'IP Kamera 4MP', x.veri.satirlar[0].aciklama);
  kontrol('Satır notu kaydedildi', x.veri.satirlar[0].notu === 'Seri: AB123, 2 yıl garanti', x.veri.satirlar[0].notu);
  kontrol('Hizmet açıklaması serbest', x.veri.satirlar[1].aciklama === 'Kurulum ve ayar');
  await y('POST', `/fisler/${x.veri.id}/iptal`);

  // Şifre değiştir, çıkış
  x = await t('POST', '/sifre-degistir', { eski: 'usta1234', yeni: 'yeniSifre9' });
  kontrol('Şifre değişti', x.durum === 200);
  await t('POST', '/cikis');
  kontrol('Çıkış sonrası erişim yok', (await t('GET', '/ben')).durum === 401);

  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nTÜM API TESTLERİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
