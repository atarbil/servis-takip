// Silme yetkisi ve Silinenler kutusu: etkiler geri alınıyor mu, geri alınca geri geliyor mu?
//   node test/silme_testi.js http://127.0.0.1:3100   (api_testi.js sonrası, aynı veritabanıyla)
'use strict';
const TABAN = process.argv[2] || 'http://127.0.0.1:3100';
let basarisiz = 0;
const kontrol = (ad, kosul, ek) => { if (kosul) console.log('OK  ', ad); else { basarisiz++; console.log('HATA', ad, ek !== undefined ? JSON.stringify(ek) : ''); } };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function istemci() {
  let cerez = '';
  return async (yontem, yol, govde) => {
    const r = await fetch(TABAN + '/api' + yol, { method: yontem, headers: { 'content-type': 'application/json', 'x-istek': '1', cookie: cerez }, body: govde ? JSON.stringify(govde) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cerez = sc.split(';')[0];
    return { durum: r.status, veri: await r.json().catch(() => null) };
  };
}

(async () => {
  const y = istemci(); const t = istemci();
  await y('POST', '/giris', { kullanici_adi: 'patron', sifre: '12345678' });
  const ekip = (await y('GET', '/ekipler')).veri[0];
  await y('POST', '/kullanicilar', { ad_soyad: 'Silme Usta', kullanici_adi: 'silusta', sifre: 'usta1234', rol: 'teknisyen', ekip_id: ekip.id });
  await t('POST', '/giris', { kullanici_adi: 'silusta', sifre: 'usta1234' });
  const kasa = (await y('GET', '/hesaplar')).veri[0];
  const kasaBakiye = async () => Number((await y('GET', '/hesaplar')).veri.find((h) => h.id === kasa.id).bakiye);
  const cariBakiye = async (id) => Number((await y('GET', `/cariler/${id}`)).veri.bakiye);
  const stok = async (id) => Number((await y('GET', `/urunler/${id}`)).veri.stok_miktari);

  // Hazırlık: cari (devirli), ürün (stoklu, barkodlu), iş (malzemeli) -> fiş onaylı, tahsilat
  const cari = (await y('POST', '/cariler', { unvan: 'Silinecek Ltd', telefon: '0555 000 11 22', devir_bakiye: 1000 })).veri;
  const urun = (await y('POST', '/urunler', { ad: 'Silme Test Kamerası', onerilen_satis: 500, barkodlar: ['8691111111111'], acilis_stok: 10, ort_maliyet: 200 })).veri;
  kontrol('Hazırlık: stok 10, cari 1000 borçlu', await stok(urun.id) === 10 && await cariBakiye(cari.id) === 1000);
  const is = (await y('POST', '/isler', { baslik: 'Silme deneme işi', cari_id: cari.id })).veri;
  await y('POST', `/isler/${is.id}/planla`, { ekip_id: ekip.id, baslangic: new Date().toISOString() });
  await t('POST', `/isler/${is.id}/baslat`);
  await t('POST', `/isler/${is.id}/malzeme`, { urun_id: urun.id, miktar: 3 });
  await t('POST', `/isler/${is.id}/teslim`, { teslim_alan_ad: 'Ali', imza: PNG });
  await t('POST', `/isler/${is.id}/tamamla`);
  const fisId = (await y('POST', `/isler/${is.id}/fis`)).veri.id;
  await y('POST', `/fisler/${fisId}/onayla`);
  const tah = (await y('POST', '/finans/tahsilat', { cari_id: cari.id, hesap_id: kasa.id, tutar: 400 })).veri;
  const kasa0 = await kasaBakiye();
  kontrol('Hazırlık: iş fişi onaylı, stok 7, cari 1000+1800-400', await stok(urun.id) === 7 && await cariBakiye(cari.id) === 2400, { s: await stok(urun.id), b: await cariBakiye(cari.id) });

  // Yetki
  kontrol('Teknisyen silemez', (await t('POST', '/sil', { tur: 'is', id: is.id })).durum === 403);
  kontrol('Teknisyen Silinenler\'i göremez', (await t('GET', '/silinenler')).durum === 403);
  const ben = (await y('GET', '/ben')).veri;
  kontrol('Kendi hesabını silemez', (await y('POST', '/sil', { tur: 'kullanici', id: ben.id })).veri?.kod === 'KENDINI_SILEMEZ');

  // 1) Tahsilat sil -> kasa ve cari düzelir; geri al
  let x = await y('POST', '/sil/onizleme', { tur: 'finans', id: tah.id });
  kontrol('Önizleme etkiyi söylüyor', /Tahsilat 400,00 ₺ · Silinecek Ltd.*kasa\/banka ve cari bakiyesi düzelir/.test(x.veri.ozet.join('|')), x.veri);
  kontrol('Önizleme hiçbir şeyi değiştirmedi', await kasaBakiye() === kasa0 && await cariBakiye(cari.id) === 2400);
  x = await y('POST', '/sil', { tur: 'finans', id: tah.id });
  kontrol('Tahsilat silindi', x.durum === 200 && x.veri.silinen_id, x.veri);
  kontrol('Kasa 400 azaldı, cari 400 arttı', await kasaBakiye() === kasa0 - 400 && await cariBakiye(cari.id) === 2800);
  kontrol('Tahsilat kasa listesinde yok', !(await y('GET', '/finans')).veri.some((f) => f.id === tah.id));
  const tahSil = x.veri.silinen_id;
  x = await y('POST', `/silinenler/${tahSil}/geri-al`);
  kontrol('Tahsilat geri alındı', x.durum === 200 && await kasaBakiye() === kasa0 && await cariBakiye(cari.id) === 2400, x.veri);
  kontrol('Geri alınan tekrar listede', (await y('GET', '/finans')).veri.some((f) => f.id === tah.id));
  kontrol('Aynı kayıt ikinci kez geri alınamaz', (await y('POST', `/silinenler/${tahSil}/geri-al`)).durum === 400);

  // 2) Onaylı fiş sil -> borç düşer; iş tamamlandıya döner
  x = await y('POST', '/sil', { tur: 'satis_fisi', id: fisId });
  kontrol('Onaylı fiş silindi, cariden 1800 düştü', x.durum === 200 && await cariBakiye(cari.id) === 600 && /borç düşer/.test(x.veri.ozet[0]), x.veri);
  kontrol('Silinen fiş açılamaz', (await y('GET', `/fisler/${fisId}`)).durum === 404);
  kontrol('İş fiyatlandırma bekliyor durumuna döndü', (await y('GET', `/isler/${is.id}`)).veri.durum === 'tamamlandi');
  const fisSil = x.veri.silinen_id;

  // 3) Cariyi sil -> iş (malzeme stoğa), tahsilat, devir hepsi gider
  x = await y('POST', '/sil/onizleme', { tur: 'cari', id: cari.id });
  const oz = x.veri.ozet.join(' | ');
  kontrol('Cari önizlemesi bağlı kayıtları sayıyor', x.veri.adet === 3 && /malzeme stoğa döner/.test(oz) && /devir bakiyesi kaldırılır/.test(oz) && /Tahsilat/.test(oz), x.veri);
  x = await y('POST', '/sil', { tur: 'cari', id: cari.id });
  const cariSil = x.veri.silinen_id;
  kontrol('Cari silindi: listede yok, açılmıyor', !(await y('GET', '/cariler')).veri.some((c) => c.id === cari.id) && (await y('GET', `/cariler/${cari.id}`)).durum === 404);
  kontrol('İş silindi, malzeme stoğa döndü (10)', (await y('GET', `/isler/${is.id}`)).durum === 404 && await stok(urun.id) === 10, await stok(urun.id));
  kontrol('Kasa tahsilat kadar azaldı', await kasaBakiye() === kasa0 - 400);
  kontrol('Cari seçicide çıkmıyor', !(await y('GET', '/cariler?q=Silinecek')).veri.length);
  x = await y('POST', `/silinenler/${fisSil}/geri-al`);
  kontrol('Carisi silinmiş fiş geri alınamaz, neden söylenir', x.durum === 400 && /Silinecek Ltd/.test(x.veri.hata || x.veri.mesaj || JSON.stringify(x.veri)), x.veri);

  // 4) Ürünü sil -> barkod boşa çıkar
  x = await y('POST', '/sil', { tur: 'urun', id: urun.id });
  const urunSil = x.veri.silinen_id;
  kontrol('Ürün silindi, listede yok', x.durum === 200 && !(await y('GET', '/urunler?q=Silme Test')).veri.length);
  kontrol('Barkodu artık tanımsız', (await y('GET', '/urunler/barkod/8691111111111')).durum === 404);

  x = await y('GET', '/silinenler');
  kontrol('Silinenler listesi', x.veri.length >= 3 && x.veri[0].kalan_gun === 30 && x.veri[0].silen, x.veri.map((s) => s.baslik));

  // Geri al: cari -> iş, devir, tahsilat geri; sonra fiş
  x = await y('POST', `/silinenler/${cariSil}/geri-al`);
  kontrol('Cari geri alındı', x.durum === 200, x.veri);
  kontrol('Cari bakiyesi geri: devir 1000 - tahsilat 400 = 600', await cariBakiye(cari.id) === 600, await cariBakiye(cari.id));
  kontrol('Kasa geri', await kasaBakiye() === kasa0);
  x = await y('POST', `/silinenler/${urunSil}/geri-al`);
  kontrol('Ürün ve barkodu geri', x.durum === 200 && (await y('GET', '/urunler/barkod/8691111111111')).durum === 200);
  kontrol('İş geri, malzeme tekrar düştü (7)', (await y('GET', `/isler/${is.id}`)).veri.durum === 'tamamlandi' && await stok(urun.id) === 7, await stok(urun.id));
  x = await y('POST', `/silinenler/${fisSil}/geri-al`);
  kontrol('Fiş geri alındı ve yeniden onaylandı', x.durum === 200 && (await y('GET', `/fisler/${fisId}`)).veri.durum === 'onaylandi' && await cariBakiye(cari.id) === 2400, x.veri);
  kontrol('İş yine fiş kesildi', (await y('GET', `/isler/${is.id}`)).veri.durum === 'fis_kesildi');

  // 5) Diğer türler
  const ted = (await y('POST', '/cariler', { unvan: 'Silme Tedarik', tip: 'tedarikci' })).veri;
  const al = (await y('POST', '/alislar', { cari_id: ted.id, belge_no: 'SIL-1', satirlar: [{ urun_id: urun.id, miktar: 5, birim_fiyat: 100 }] })).veri;
  await y('POST', `/alislar/${al.id}/onayla`);
  kontrol('Alış onaylı: stok 12', await stok(urun.id) === 12);
  x = await y('POST', '/sil', { tur: 'alis_faturasi', id: al.id });
  kontrol('Alış silindi: stok 7, tedarikçi bakiyesi 0', x.durum === 200 && await stok(urun.id) === 7 && await cariBakiye(ted.id) === 0, x.veri);
  await y('POST', `/silinenler/${x.veri.silinen_id}/geri-al`);
  kontrol('Alış geri: stok 12, tedarikçiye borç', await stok(urun.id) === 12 && await cariBakiye(ted.id) === -600, await cariBakiye(ted.id));

  await y('POST', '/finans/virman', { kaynak_id: kasa.id, hedef_id: (await y('GET', '/hesaplar')).veri[1].id, tutar: 50 });
  const vir = (await y('GET', '/finans')).veri.find((f) => f.tip === 'virman_cikis' && Number(f.tutar) === 50);
  if (vir) {
    const ikinci = (await y('GET', '/hesaplar')).veri[1];
    x = await y('POST', '/sil', { tur: 'finans', id: vir.id });
    const h = (await y('GET', '/hesaplar')).veri;
    kontrol('Virman silinince iki bacağı da gider', x.veri.adet === 2 && Number(h.find((a) => a.id === kasa.id).bakiye) === kasa0 && Number(h[1].bakiye) === Number(ikinci.bakiye) - 50, x.veri);
  }

  const kartId = (await y('POST', '/urunler', { ad: 'Silme testi hizmeti', tur: 'hizmet' })).veri.id;
  const tk = (await y('POST', '/teklifler', { tur: 'teklif', cari_id: cari.id, satirlar: [{ urun_id: kartId, miktar: 1, birim_fiyat: 1 }] })).veri;
  x = await y('POST', '/sil', { tur: 'teklif', id: tk.id });
  kontrol('Teklif silindi, listede yok', x.durum === 200 && !(await y('GET', '/teklifler')).veri.some((a) => a.id === tk.id));
  const env = (await y('POST', '/envanter', { cari_id: cari.id, tur: 'NVR' })).veri;
  kontrol('Envanter silindi', (await y('POST', '/sil', { tur: 'envanter', id: env.id })).durum === 200 && (await y('GET', `/envanter/${env.id}`)).durum === 404);
  const not = (await y('POST', '/notlar', { baslik: 'Silinecek not', baslangic: new Date().toISOString() })).veri;
  if (not?.id) kontrol('Takvim notu silindi', (await y('POST', '/sil', { tur: 'takvim_notu', id: not.id })).durum === 200);

  // Kullanıcı silinince giremez ve oturumu kapanır
  const usta = (await y('GET', '/kullanicilar')).veri.find((k) => k.kullanici_adi === 'silusta');
  x = await y('POST', '/sil', { tur: 'kullanici', id: usta.id });
  kontrol('Kullanıcı silindi, oturumu kapandı', x.durum === 200 && (await t('GET', '/ben')).durum === 401);
  kontrol('Silinen kullanıcı giriş yapamaz', (await t('POST', '/giris', { kullanici_adi: 'silusta', sifre: 'usta1234' })).durum === 401);
  await y('POST', `/silinenler/${x.veri.silinen_id}/geri-al`);
  kontrol('Geri alınan kullanıcı girebilir', (await t('POST', '/giris', { kullanici_adi: 'silusta', sifre: 'usta1234' })).durum === 200);

  // Kalıcı silme
  x = await y('POST', '/sil', { tur: 'teklif', id: (await y('POST', '/teklifler', { tur: 'teklif', cari_id: cari.id, satirlar: [{ urun_id: kartId, miktar: 1, birim_fiyat: 1 }] })).veri.id });
  await y('POST', `/silinenler/${x.veri.silinen_id}/kalici`);
  kontrol('Kalıcı silinen geri alınamaz ve kutuda görünmez', (await y('POST', `/silinenler/${x.veri.silinen_id}/geri-al`)).durum === 400
    && !(await y('GET', '/silinenler')).veri.some((s) => s.id === x.veri.silinen_id));
  kontrol('Zaten silinmiş kayıt tekrar silinemez', (await y('POST', '/sil', { tur: 'teklif', id: tk.id })).durum >= 400);
  kontrol('Raporlar çalışıyor', (await y('GET', '/ozet')).durum === 200);

  // ---------- Dış servis ----------
  const yerelGun = (ms) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(ms));
  const gecen = yerelGun(Date.now() - 20 * 86400000);
  x = await y('POST', '/dis-servis', { cari_id: cari.id, cihaz: 'Dizüstü', marka_model: 'Lenovo ThinkPad E14', seri_no: 'PF-ABC123', ariza: 'Ekran yok', aksesuar: 'Adaptör', servis_yeri: 'Lenovo Yetkili Servis', gonderim_tarihi: gecen, ucret: '1.250' });
  kontrol('Dış servis kaydı açıldı', x.durum === 200 && x.veri.id, x.veri);
  const ds = x.veri.id;
  kontrol('Zorunlu alanlar', (await y('POST', '/dis-servis', { cari_id: cari.id, cihaz: 'X' })).durum === 400);
  kontrol('Teknisyen dış servise erişemez', (await t('GET', '/dis-servis')).durum === 403);
  x = await y('GET', `/dis-servis/${ds}`);
  kontrol('Kayıt: 20 gündür dışarıda, ücret 1250', x.veri.dis_gun === 20 && Number(x.veri.ucret) === 1250 && x.veri.durum === 'dis_serviste', x.veri);
  x = await y('GET', '/dis-servis?durum=acik&q=thinkpad%20silinecek');
  kontrol('Arama ve açık filtre', x.veri.length === 1 && x.veri[0].id === ds, x.veri.length);
  kontrol('Sayılar: 1 dışarıda, 1 geciken', (await y('GET', '/dis-servis/sayilar')).veri.geciken === 1);
  kontrol('Menü sayacı', (await y('GET', '/sayaclar')).veri.dis_servis >= 1);
  await y('POST', `/dis-servis/${ds}/durum`, { durum: 'geldi' });
  x = await y('GET', `/dis-servis/${ds}`);
  kontrol('Geldi: geliş tarihi bugün, gün sayısı durdu', x.veri.durum === 'geldi' && x.veri.gelis_tarihi === yerelGun(Date.now()) && x.veri.dis_gun === 20, x.veri);
  kontrol('Geçmiş tarihli geliş reddedilir', (await y('POST', `/dis-servis/${ds}/durum`, { durum: 'geldi', tarih: '2000-01-01' })).durum === 400);
  await y('POST', `/dis-servis/${ds}/durum`, { durum: 'teslim_edildi' });
  x = await y('GET', `/dis-servis/${ds}`);
  kontrol('Müşteriye teslim edildi', x.veri.durum === 'teslim_edildi' && x.veri.teslim_tarihi, x.veri);
  kontrol('Teslim edilen açık listede yok', !(await y('GET', '/dis-servis?durum=acik')).veri.some((d) => d.id === ds));
  await y('POST', `/dis-servis/${ds}/durum`, { durum: 'dis_serviste' });
  kontrol('Geri adım tarihleri temizler', (await y('GET', `/dis-servis/${ds}`)).veri.gelis_tarihi === null);
  await y('PUT', `/dis-servis/${ds}`, { servis_yeri: 'Başka servis', notlar: 'Anakart değişecek' });
  kontrol('Düzenlendi', (await y('GET', `/dis-servis/${ds}`)).veri.servis_yeri === 'Başka servis');
  x = await y('POST', '/sil', { tur: 'dis_servis', id: ds });
  kontrol('Dış servis kaydı silindi', x.durum === 200 && (await y('GET', `/dis-servis/${ds}`)).durum === 404, x.veri);
  await y('POST', `/silinenler/${x.veri.silinen_id}/geri-al`);
  kontrol('Dış servis kaydı geri alındı', (await y('GET', `/dis-servis/${ds}`)).durum === 200);
  x = await y('POST', '/sil/onizleme', { tur: 'cari', id: cari.id });
  kontrol('Cari silinirken dış servis kaydı da listede', x.veri.ozet.some((m) => /Dış servis: Dizüstü/.test(m)), x.veri.ozet);

  console.log(basarisiz ? `\n${basarisiz} KONTROL BAŞARISIZ` : '\nSİLME TESTLERİ BAŞARILI');
  process.exit(basarisiz ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
