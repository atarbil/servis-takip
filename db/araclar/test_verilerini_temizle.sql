-- Test verilerini temizler. Kalanlar: ayarlar (firma bilgileri), kullanıcılar, ekipler,
-- oturumlar, belge şablonları, kasa / banka hesap tanımları, şema geçmişi.
BEGIN;
TRUNCATE
  satis_fisi_satirlari, satis_fisleri, teklif_satirlari, teklifler,
  alis_faturasi_satirlari, alis_faturalari, resmi_faturalar,
  is_malzemeleri, is_fotograflari, is_gecmisi, teslim_onaylari, dis_servis, isler, envanter,
  stok_hareketleri, urun_barkodlari, tedarikci_urun_eslesme, tedarikci_tercih, urunler,
  cari_hareketler, finans_hareketleri, cariler,
  takvim_notlari, kullanici_konum, denetim_kaydi, silinenler
  RESTART IDENTITY;
ALTER SEQUENCE satis_fis_no_seq RESTART;
ALTER SEQUENCE teklif_no_seq RESTART;
ALTER SEQUENCE proforma_no_seq RESTART;
COMMIT;
