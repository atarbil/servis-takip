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
  // Marka, model, ana grup, alt grup ve çok alanlı arama
  const hik = (await y('POST', '/urunler', { ad: 'Dome Kamera 2MP', marka: 'Hikvision', model: 'DS-2CD1123G0E-I', ana_grup: 'Güvenlik Kamerası', alt_grup: 'IP Kamera', onerilen_satis: 1500 })).veri;
  await y('POST', '/urunler', { ad: 'NVR 8 Kanal', marka: 'Dahua', model: 'NVR4108HS', ana_grup: 'Güvenlik Kamerası', alt_grup: 'Kayıt Cihazı' });
  await y('POST', '/urunler', { ad: 'Lazer Yazıcı', marka: 'Brother', model: 'HL-L2350DW', ana_grup: 'Yazıcı', alt_grup: 'Lazer' });
  const ara = async (q, ek = '') => (await y('GET', `/urunler?q=${encodeURIComponent(q)}${ek}`)).veri.map((u) => u.ad);
  kontrol('Modelden arama', (await ara('2cd1123')).includes('Dome Kamera 2MP'));
  kontrol('Birden fazla kelime farklı alanlarda (marka + ad)', JSON.stringify(await ara('hikvision dome')) === '["Dome Kamera 2MP"]', await ara('hikvision dome'));
  kontrol('Türkçe büyük harf / İ farkı yok sayılıyor', (await ara('GÜVENLİK KAYIT')).includes('NVR 8 Kanal') && (await ara('guvenlik')).length === 2, await ara('GÜVENLİK KAYIT'));
  kontrol('Grup adından arama', (await ara('lazer')).includes('Lazer Yazıcı'));
  kontrol('Marka filtresi', JSON.stringify((await y('GET', '/urunler?marka=Dahua')).veri.map((u) => u.ad)) === '["NVR 8 Kanal"]');
  kontrol('Ana + alt grup filtresi', JSON.stringify((await y('GET', '/urunler?ana_grup=' + encodeURIComponent('Güvenlik Kamerası') + '&alt_grup=' + encodeURIComponent('IP Kamera'))).veri.map((u) => u.ad)) === '["Dome Kamera 2MP"]');
  x = await y('GET', '/urun-gruplari');
  kontrol('Marka ve grup listesi', x.veri.markalar.join(',') === 'Brother,Dahua,Hikvision'
    && JSON.stringify(x.veri.gruplar.find((g) => g.ana === 'Güvenlik Kamerası').altlar) === '["IP Kamera","Kayıt Cihazı"]', x.veri);
  const tekAra = (await t('GET', '/urunler?q=hikvision')).veri[0];
  kontrol('Teknisyen aramasında marka/model var, fiyat yok', tekAra?.model === 'DS-2CD1123G0E-I' && tekAra.onerilen_satis === undefined, tekAra);
  void hik;
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

  // Kur, sayaçlar, fiyatlandırma
  x = await y('GET', '/kur');
  kontrol('TCMB kuru okundu', x.veri.usd?.satis === 41.9578 && x.veri.eur?.satis === 48.6387 && x.veri.tarih === '20.11.2026', x.veri);
  kontrol('Teknisyen de kuru görebilir', (await t('GET', '/kur')).durum === 200);
  x = await y('GET', '/sayaclar');
  kontrol('Menü sayaçları', x.durum === 200 && typeof x.veri.fiyatlandirma === 'number', x.veri);
  x = await y('GET', '/ozet');
  kontrol('Genişletilmiş panel özeti', Array.isArray(x.veri.havuz_isler) && Array.isArray(x.veri.son_tahsilatlar) && Array.isArray(x.veri.fiyat_bekleyen), Object.keys(x.veri));
  kontrol('Panelde son tahsilat görünüyor', x.veri.son_tahsilatlar.some((s) => s.tutar === 5000));
  x = await y('GET', '/fiyatlandirma');
  kontrol('Fiyatlandırma listesi', x.durum === 200 && Array.isArray(x.veri), x.veri);

  // Makbuz
  const sonT = (await y('GET', '/finans')).veri.find((f) => f.tip === 'tahsilat' && !f.iptal);
  x = await y('GET', `/finans/${sonT.id}/makbuz`);
  kontrol('Makbuz verisi ve kalan bakiye', x.durum === 200 && x.veri.unvan === 'Ahmet Market' && x.veri.kalan_bakiye === 1000 + 12444 - 5000, x.veri.kalan_bakiye);
  const masraf = (await y('POST', '/finans/masraf', { hesap_id: hesaplar[0].id, tutar: 50, aciklama: 'Yakıt' })).veri;
  kontrol('Masraf için makbuz yazdırılmaz', (await y('GET', `/finans/${masraf.id}/makbuz`)).durum === 400);

  // Teklif / proforma
  x = await y('POST', '/teklifler', { tur: 'teklif', cari_id: musteri.id, satirlar: [{ urun_id: kamera.id, aciklama: 'x', miktar: 80, birim_fiyat: '6.670', kdv_orani: 20, notu: '2 yıl garanti' }] });
  kontrol('Teklif oluştu, numara ve toplam doğru', /^TK-\d{4}-0001$/.test(x.veri.belge_no) && x.veri.genel_toplam === 640320 && x.veri.satirlar[0].aciklama === 'IP Kamera 4MP', x.veri);
  kontrol('Teklife varsayılan giriş/kapanış metni geldi', /görüşmeler sonrasında/.test(x.veri.giris_metni) && /başarılar dileriz/.test(x.veri.kapanis_metni));
  const teklifId = x.veri.id;
  const once = (await y('GET', `/cariler/${musteri.id}`)).veri.bakiye;
  const stokOnce = (await y('GET', `/urunler/${kamera.id}`)).veri.stok_miktari;
  x = await y('POST', `/teklifler/${teklifId}/kopyala`, { tur: 'proforma' });
  const pf = (await y('GET', `/teklifler/${x.veri.id}`)).veri;
  kontrol('Proformaya kopyalandı', pf.tur === 'proforma' && /^PF-/.test(pf.belge_no) && pf.genel_toplam === 640320 && pf.giris_metni === null, pf.belge_no);
  kontrol('Teklif cariyi ve stoğu etkilemedi', (await y('GET', `/cariler/${musteri.id}`)).veri.bakiye === once && (await y('GET', `/urunler/${kamera.id}`)).veri.stok_miktari === stokOnce);
  x = await y('POST', `/teklifler/${teklifId}/durum`, { durum: 'gonderildi' });
  kontrol('Durum gönderildi', x.veri.durum === 'gonderildi');
  x = await y('POST', `/teklifler/${teklifId}/fise-donustur`);
  const donFis = (await y('GET', `/fisler/${x.veri.id}`)).veri;
  kontrol('Teklif taslak satış fişine dönüştü', donFis.durum === 'taslak' && donFis.genel_toplam === 640320 && donFis.satirlar[0].notu === '2 yıl garanti', donFis);
  x = await y('GET', `/teklifler/${teklifId}`);
  kontrol('Teklif kabul edildi ve fişe bağlandı', x.veri.durum === 'kabul' && x.veri.fis_id === donFis.id);
  x = await y('PUT', `/teklifler/${teklifId}`, { satirlar: [] });
  kontrol('Dönüşmüş teklifin satırları değiştirilemez', x.durum === 400, x.veri);
  await y('POST', `/fisler/${donFis.id}/iptal`);
  kontrol('Teklif listesi', (await y('GET', '/teklifler?tur=teklif')).veri.length === 1);
  kontrol('Teknisyen teklif göremez', (await t('GET', '/teklifler')).durum === 403);

  // Görsel yükleme ve herkese açık logo
  kontrol('Logo yokken /logo 404', (await fetch(TABAN + '/logo')).status === 404);
  x = await y('POST', '/ayarlar/gorsel', { tur: 'logo', veri: PNG });
  kontrol('Logo yüklendi', x.durum === 200 && /^ayarlar\//.test(x.veri.yol), x.veri);
  const lg = await fetch(TABAN + '/logo');
  kontrol('Logo oturumsuz görülebiliyor', lg.status === 200 && lg.headers.get('content-type') === 'image/png');
  x = await y('POST', '/ayarlar/gorsel', { tur: 'kase', veri: PNG });
  const ay = (await y('GET', '/ayarlar')).veri;
  kontrol('Kaşe yolu ayarlarda, sadece oturumla erişilir', !!ay.kase_imza && (await fetch(`${TABAN}/dosya/${ay.kase_imza}`)).status === 401);
  await y('PUT', '/ayarlar', { kase_imza: '../../etc/passwd', firma_web: 'www.atarbilisim.com' });
  const ay2 = (await y('GET', '/ayarlar')).veri;
  kontrol('Görsel yolu ayarlar formundan değiştirilemez', ay2.kase_imza === ay.kase_imza && ay2.firma_web === 'www.atarbilisim.com');
  kontrol('Telegram iç ayarı dışarı verilmiyor', !('telegram_offset' in ay2));
  kontrol('Teknisyen görsel yükleyemez', (await t('POST', '/ayarlar/gorsel', { tur: 'logo', veri: PNG })).durum === 403);

  // Şifre değiştir, çıkış
  x = await t('POST', '/sifre-degistir', { eski: 'usta1234', yeni: 'yeniSifre9' });
  kontrol('Şifre değişti', x.durum === 200);
  await t('POST', '/cikis');
  kontrol('Çıkış sonrası erişim yok', (await t('GET', '/ben')).durum === 401);

  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nTÜM API TESTLERİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
