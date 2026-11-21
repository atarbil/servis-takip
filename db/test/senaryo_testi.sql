-- =====================================================================
-- Uçtan uca senaryo testi. Boş bir veritabanında çalıştırılır:
--   psql -v ON_ERROR_STOP=1 -f db/test/senaryo_testi.sql
-- Her kontrol başarısız olursa hata verir ve durur.
-- =====================================================================
\set QUIET on
SET client_min_messages = notice;

CREATE FUNCTION pg_temp.esit(ad text, beklenen numeric, gercek numeric) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF beklenen IS DISTINCT FROM gercek THEN
        RAISE EXCEPTION 'BAŞARISIZ: % -> beklenen %, gelen %', ad, beklenen, gercek;
    END IF;
    RAISE NOTICE 'OK  %: %', ad, gercek;
END $$;

-- Hata vermesi gereken işlemi dener, verilen hata kodunu bekler
CREATE FUNCTION pg_temp.hata_bekle(ad text, sorgu text, kod text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE gelen text;
BEGIN
    BEGIN
        EXECUTE sorgu;
    EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS gelen = PG_EXCEPTION_HINT;
        IF gelen = kod THEN
            RAISE NOTICE 'OK  % engellendi (%)', ad, kod;
            RETURN;
        END IF;
        RAISE EXCEPTION 'BAŞARISIZ: % -> beklenen hata %, gelen %', ad, kod, gelen;
    END;
    RAISE EXCEPTION 'BAŞARISIZ: % hata vermeliydi', ad;
END $$;

-- ---------- Temel tanımlar ----------
INSERT INTO ekipler (ad, renk) VALUES ('Ekip 1', '#2563eb'), ('Ekip 2', '#16a34a');
INSERT INTO kullanicilar (ad_soyad, kullanici_adi, sifre_hash, rol) VALUES ('Patron', 'patron', 'x', 'yonetici');
INSERT INTO kullanicilar (ad_soyad, kullanici_adi, sifre_hash, rol, ekip_id) VALUES ('Mehmet', 'mehmet', 'x', 'teknisyen', 1);
SELECT set_config('app.kullanici_id', '1', false);

INSERT INTO cariler (kod, tip, unvan, telefon) VALUES
    ('M001', 'musteri', 'Ahmet Market', '05321112233'),
    ('T001', 'tedarikci', 'Güvenlik Dağıtım A.Ş.', '02125556677');
INSERT INTO hesaplar (ad, tip) VALUES ('Merkez Kasa', 'kasa'), ('Banka', 'banka');

INSERT INTO urunler (kod, ad, birim, onerilen_satis) VALUES
    ('KAM-01', 'IP Kamera 4MP', 'adet', 2000),
    ('KBL-01', 'CAT6 Kablo', 'metre', 25);
INSERT INTO urun_barkodlari VALUES ('8690000000011', 1), ('8690000000012', 1), ('8690000000028', 2);

-- Eski programdan açılış bakiyesi
SELECT cari_devir_ekle(1, 1000, '2026-01-01');

-- ---------- Alış faturaları: maliyetin oluşması ----------
INSERT INTO alis_faturalari (belge_no, cari_id, tarih) VALUES ('A-100', 2, '2026-11-01');
INSERT INTO alis_faturasi_satirlari (fatura_id, urun_id, miktar, birim_fiyat) VALUES (1, 1, 10, 1000), (1, 2, 100, 10);
SELECT alis_faturasi_onayla(1);
INSERT INTO alis_faturalari (belge_no, cari_id, tarih) VALUES ('A-101', 2, '2026-11-10');
INSERT INTO alis_faturasi_satirlari (fatura_id, urun_id, miktar, birim_fiyat) VALUES (2, 1, 10, 1200);
SELECT alis_faturasi_onayla(2);

SELECT pg_temp.esit('Kamera ortalama maliyet (10x1000 + 10x1200)', 1100, (SELECT ort_maliyet FROM urunler WHERE id = 1));
SELECT pg_temp.esit('Kamera stok', 20, (SELECT stok_miktari FROM urunler WHERE id = 1));
SELECT pg_temp.esit('Tedarikçi bakiyesi (biz borçluyuz)', -27600, (SELECT bakiye FROM v_cari_bakiye WHERE id = 2));
SELECT pg_temp.hata_bekle('Onaylı fatura satırı değiştirme',
    'UPDATE alis_faturasi_satirlari SET miktar = 1 WHERE id = 1', 'FATURA_KILITLI');

-- ---------- İş akışı: havuz -> takvim -> havuza geri -> tekrar takvim ----------
SELECT is_olustur('4 kamera arızalı', 'Ahmet Bey Kadıköy 4 kamera arızalı 0532 111 22 33', 1, 'Kadıköy');
SELECT pg_temp.esit('Yeni iş havuzda', 1, (SELECT count(*) FROM v_is_havuzu));
SELECT is_planla(1, 1, '2026-11-22 10:00+03');
SELECT is_havuza_al(1, 'Müşteri ertelemek istedi');
SELECT pg_temp.esit('Havuza dönüş sayısı', 1, (SELECT havuza_donus_sayisi FROM v_is_havuzu WHERE id = 1));
SELECT pg_temp.esit('Havuza alınınca tarih silindi', 1, (SELECT count(*) FROM isler WHERE id = 1 AND plan_baslangic IS NULL));
SELECT is_planla(1, 1, '2026-11-24 14:00+03');

-- Takvimden doğrudan iş (havuza uğramadan)
SELECT is_olustur('Yeni DVR kurulumu', NULL, 1, NULL, NULL, NULL, 2::smallint, '2026-11-25 09:00+03', NULL, 2);
SELECT pg_temp.esit('Takvimden açılan iş planlı', 1, (SELECT count(*) FROM isler WHERE id = 2 AND durum = 'planlandi'));
SELECT pg_temp.esit('Takvimde 2 iş', 2, (SELECT count(*) FROM v_takvim WHERE tur = 'is'));

-- ---------- Saha: teknisyen ----------
SELECT set_config('app.kullanici_id', '2', false);
SELECT is_baslat(1);
SELECT is_malzeme_ekle_barkod(1, '8690000000012', 4);   -- kamera, ikinci barkoduyla
SELECT is_malzeme_ekle_barkod(1, '8690000000028', 30);  -- kablo
SELECT pg_temp.hata_bekle('Tanımsız barkod', $$SELECT is_malzeme_ekle_barkod(1, '1234567890', 1)$$, 'BARKOD_TANIMSIZ');
SELECT sahada_urun_tanimla(1, 'RJ45 Konnektör', 8, '1234567890', 'Mavi poşette');
SELECT pg_temp.esit('Konnektör onay bekliyor', 1, (SELECT count(*) FROM v_stok_uyari WHERE uyari = 'onay_bekliyor'));

SELECT pg_temp.hata_bekle('İmzasız tamamlama', 'SELECT is_tamamla(1)', 'IMZA_YOK');
SELECT pg_temp.hata_bekle('Malzemeli işi iptal', $$SELECT is_iptal(1, 'deneme')$$, 'MALZEME_VAR');
INSERT INTO teslim_onaylari (is_id, teslim_alan_ad, imza_dosya, teknisyen_id) VALUES (1, 'Ahmet Yılmaz', 'imzalar/1.png', 2);
SELECT pg_temp.hata_bekle('İmzayı sonradan değiştirme',
    $$UPDATE teslim_onaylari SET teslim_alan_ad = 'Başkası' WHERE is_id = 1$$, 'TESLIM_KILITLI');
SELECT is_tamamla(1, 'Kameralar değişti, kayıt kontrol edildi');

-- ---------- Satış fişi ----------
SELECT set_config('app.kullanici_id', '1', false);
SELECT satis_fisi_isten_olustur(1);
SELECT pg_temp.hata_bekle('Onaysız ürünle fiş onayı', 'SELECT satis_fisi_onayla(1)', 'URUN_ONAYSIZ');
SELECT urun_onayla(3, 5, NULL, 'KON-01', 15);
SELECT pg_temp.esit('Taslak fişe maliyet yansıdı', 4740, (SELECT maliyet_toplam FROM satis_fisleri WHERE id = 1));

UPDATE satis_fisi_satirlari SET birim_fiyat = 15 WHERE fis_id = 1 AND urun_id = 3;
INSERT INTO satis_fisi_satirlari (fis_id, sira, tip, aciklama, miktar, birim_fiyat) VALUES (1, 9, 'iscilik', 'Montaj işçiliği', 1, 1500);
UPDATE satis_fisleri SET tarih = '2026-11-05', vade = '2026-11-15' WHERE id = 1;  -- vadesi geçmiş olsun
SELECT satis_fisi_onayla(1);

SELECT pg_temp.esit('Fiş ara toplam (8000+750+120+1500)', 10370, (SELECT ara_toplam FROM satis_fisleri WHERE id = 1));
SELECT pg_temp.esit('Fiş genel toplam (KDV %20)', 12444, (SELECT genel_toplam FROM satis_fisleri WHERE id = 1));
SELECT pg_temp.esit('İş maliyeti (4x1100 + 30x10 + 8x5)', 4740, (SELECT malzeme_maliyeti FROM v_is_karlilik WHERE is_id = 1));
SELECT pg_temp.esit('İş kârı', 5630, (SELECT kar FROM v_is_karlilik WHERE is_id = 1));
SELECT pg_temp.esit('İş durumu fiş kesildi', 1, (SELECT count(*) FROM isler WHERE id = 1 AND durum = 'fis_kesildi'));
SELECT pg_temp.esit('Müşteri bakiye (1000 devir + 12444)', 13444, (SELECT bakiye FROM v_cari_bakiye WHERE id = 1));
SELECT pg_temp.esit('Kamera stok (20-4)', 16, (SELECT stok_miktari FROM urunler WHERE id = 1));
SELECT pg_temp.esit('Konnektör eksi stok', -8, (SELECT stok_miktari FROM urunler WHERE id = 3));

-- ---------- Tahsilat / ödeme ----------
SELECT tahsilat_ekle(1, 1, 5000, '2026-11-25', 'Nakit');
SELECT odeme_ekle(2, 2, 10000, '2026-11-26', 'Havale');
SELECT pg_temp.esit('Müşteri bakiye tahsilat sonrası', 8444, (SELECT bakiye FROM v_cari_bakiye WHERE id = 1));
SELECT pg_temp.esit('Tedarikçi bakiye ödeme sonrası', -17600, (SELECT bakiye FROM v_cari_bakiye WHERE id = 2));
SELECT pg_temp.esit('Kasa', 5000, (SELECT bakiye FROM v_hesap_bakiye WHERE id = 1));
SELECT pg_temp.esit('Banka', -10000, (SELECT bakiye FROM v_hesap_bakiye WHERE id = 2));

-- ---------- Raporlar ----------
SELECT pg_temp.esit('Ekstre satır sayısı (önceki bakiye + fiş + tahsilat)', 3,
    (SELECT count(*) FROM cari_ekstre(1, '2026-11-01', '2026-11-30')));
SELECT pg_temp.esit('Ekstre önceki bakiye', 1000,
    (SELECT bakiye FROM cari_ekstre(1, '2026-11-01', '2026-11-30') WHERE belge_tip = 'devir'));
SELECT pg_temp.esit('Ekstre son bakiye', 8444,
    (SELECT bakiye FROM cari_ekstre(1, '2026-11-01', '2026-11-30') ORDER BY tarih DESC, bakiye LIMIT 1));
SELECT pg_temp.esit('Yıllık özet ciro', 10370, (SELECT ciro_kdv_haric FROM v_yillik_cari_ozet WHERE cari_id = 1 AND yil = 2026));
SELECT pg_temp.esit('Yıllık özet tahsilat', 5000, (SELECT tahsilat FROM v_yillik_cari_ozet WHERE cari_id = 1 AND yil = 2026));
SELECT pg_temp.esit('Vadesi geçen (devir 1000 + fiş, eksi 5000 tahsilat)', 8444,
    (SELECT gecikmis_tutar FROM v_vadesi_gecen WHERE cari_id = 1));

-- ---------- Silme engeli ve denetim ----------
SELECT pg_temp.hata_bekle('Cari hareket silme', 'DELETE FROM cari_hareketler WHERE id = 1', 'SILINEMEZ');
SELECT pg_temp.hata_bekle('Fiş silme', 'DELETE FROM satis_fisleri WHERE id = 1', 'SILINEMEZ');
SELECT pg_temp.hata_bekle('Onaylı fiş satırı değiştirme',
    'UPDATE satis_fisi_satirlari SET birim_fiyat = 1 WHERE fis_id = 1', 'FIS_KILITLI');
SELECT pg_temp.esit('Denetim kaydında teknisyenin işlemleri var', 1,
    (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END FROM denetim_kaydi WHERE kullanici_id = 2));

-- ---------- Fiş iptali ve yeniden kesme ----------
SELECT satis_fisi_iptal(1);
SELECT pg_temp.esit('İptal sonrası müşteri bakiye', -4000, (SELECT bakiye FROM v_cari_bakiye WHERE id = 1));
SELECT pg_temp.esit('İş tamamlandıya döndü', 1, (SELECT count(*) FROM isler WHERE id = 1 AND durum = 'tamamlandi'));
SELECT satis_fisi_isten_olustur(1);
SELECT pg_temp.esit('Aynı işe yeni fiş açılabildi', 2, (SELECT count(*) FROM satis_fisleri WHERE is_id = 1));

-- ---------- Tahsilat iptali ----------
SELECT finans_iptal(1);
SELECT pg_temp.esit('Tahsilat iptali sonrası bakiye', 1000, (SELECT bakiye FROM v_cari_bakiye WHERE id = 1));
SELECT pg_temp.esit('Kasa tahsilat iptali sonrası', 0, (SELECT bakiye FROM v_hesap_bakiye WHERE id = 1));

-- ---------- Doğrudan (işsiz) satış: stok fişte düşer ----------
INSERT INTO satis_fisleri (cari_id) VALUES (1);
INSERT INTO satis_fisi_satirlari (fis_id, tip, urun_id, aciklama, miktar, birim_fiyat) VALUES (3, 'urun', 1, 'IP Kamera 4MP', 2, 2100);
SELECT satis_fisi_onayla(3);
SELECT pg_temp.esit('Doğrudan satışta stok düştü (16-2)', 14, (SELECT stok_miktari FROM urunler WHERE id = 1));
SELECT pg_temp.esit('Doğrudan satış maliyeti', 2200, (SELECT maliyet_toplam FROM satis_fisleri WHERE id = 3));

-- ---------- Alış iptali ----------
SELECT alis_faturasi_iptal(2);
SELECT pg_temp.esit('Alış iptali sonrası kamera stok (14-10)', 4, (SELECT stok_miktari FROM urunler WHERE id = 1));
SELECT pg_temp.esit('Alış iptali sonrası tedarikçi bakiye', -3200, (SELECT bakiye FROM v_cari_bakiye WHERE id = 2));

\echo
\echo 'TÜM TESTLER BAŞARILI'
