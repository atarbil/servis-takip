-- Teklif / proforma testi (senaryo_testi.sql'den sonra aynı veritabanında çalışır)
\set QUIET on
CREATE FUNCTION pg_temp.esit(ad text, beklenen numeric, gercek numeric) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF beklenen IS DISTINCT FROM gercek THEN RAISE EXCEPTION 'BAŞARISIZ: % -> beklenen %, gelen %', ad, beklenen, gercek; END IF;
RAISE NOTICE 'OK  %: %', ad, gercek; END $$;
SELECT set_config('app.kullanici_id', '1', false);

INSERT INTO teklifler (tur, cari_id, tarih) VALUES ('teklif', 1, '2026-11-19');
INSERT INTO teklif_satirlari (teklif_id, sira, urun_id, aciklama, miktar, birim_fiyat) VALUES (1, 1, 1, 'yanlış ad', 80, 6670);
INSERT INTO teklif_satirlari (teklif_id, sira, aciklama, miktar, birim, birim_fiyat) VALUES (1, 2, 'Kurulum hizmeti', 1, 'adet', 1000);
SELECT pg_temp.esit('Teklif net (80x6670 + 1000)', 534600, (SELECT ara_toplam FROM teklifler WHERE id = 1));
SELECT pg_temp.esit('Teklif toplam (%20 KDV)', 641520, (SELECT genel_toplam FROM teklifler WHERE id = 1));
SELECT pg_temp.esit('Belge no TK-2026-0001', 1, (SELECT count(*) FROM teklifler WHERE belge_no = 'TK-2026-0001'));
SELECT pg_temp.esit('Ürün satırında ad stok kartından', 1, (SELECT count(*) FROM teklif_satirlari WHERE teklif_id = 1 AND sira = 1 AND aciklama = 'IP Kamera 4MP'));
SELECT pg_temp.esit('Teklif cariyi etkilemedi', 0, (SELECT count(*) FROM cari_hareketler WHERE belge_tip = 'satis_fisi' AND belge_id IS NULL));

SELECT teklif_kopyala(1, 'proforma');
SELECT pg_temp.esit('Proforma no PF-...-0001', 1, (SELECT count(*) FROM teklifler WHERE id = 2 AND belge_no LIKE 'PF-%-0001'));
SELECT pg_temp.esit('Proforma aynı toplam', 641520, (SELECT genel_toplam FROM teklifler WHERE id = 2));

SELECT teklifi_fise_donustur(2);
SELECT pg_temp.esit('Dönüşen fiş taslak ve 2 satır', 2, (SELECT count(*) FROM satis_fisi_satirlari s JOIN teklifler t ON t.fis_id = s.fis_id WHERE t.id = 2));
SELECT pg_temp.esit('Hizmet satırı hizmet tipinde', 1, (SELECT count(*) FROM satis_fisi_satirlari s JOIN teklifler t ON t.fis_id = s.fis_id WHERE t.id = 2 AND s.tip = 'hizmet'));
SELECT pg_temp.esit('Fiş toplamı teklifle aynı', 641520, (SELECT f.genel_toplam FROM satis_fisleri f JOIN teklifler t ON t.fis_id = f.id WHERE t.id = 2));
SELECT pg_temp.esit('Proforma durumu kabul', 1, (SELECT count(*) FROM teklifler WHERE id = 2 AND durum = 'kabul'));
SELECT pg_temp.esit('İkinci dönüştürme aynı fişi döndürür', (SELECT fis_id FROM teklifler WHERE id = 2), teklifi_fise_donustur(2));
SELECT pg_temp.esit('Fiyatlandırma bekleyen görünümü çalışıyor', 0, (SELECT count(*) * 0 FROM v_fiyatlandirma_bekleyen));

-- Dövizli teklif (009)
INSERT INTO teklifler (tur, cari_id, doviz) VALUES ('teklif', 1, 'USD');
INSERT INTO teklif_satirlari (teklif_id, sira, aciklama, miktar, birim_fiyat) VALUES (3, 1, 'Sunucu', 2, 1000);
SELECT pg_temp.esit('USD teklif toplamı (2x1000 +%20)', 2400, (SELECT genel_toplam FROM teklifler WHERE id = 3));
DO $$ BEGIN PERFORM teklifi_fise_donustur(3); RAISE EXCEPTION 'kursuz dönüşmemeliydi';
EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE '%kur girin%' THEN RAISE NOTICE 'OK  Kursuz dövizli belge dönüştürülmedi'; ELSE RAISE; END IF; END $$;
SELECT teklifi_fise_donustur(3, 41.9578);
SELECT pg_temp.esit('Fişte TL fiyat = 1000 x 41,9578', 41957.80, (SELECT s.birim_fiyat FROM satis_fisi_satirlari s JOIN teklifler t ON t.fis_id = s.fis_id WHERE t.id = 3));
SELECT pg_temp.esit('Fiş satırında döviz kaynağı saklandı', 1, (SELECT count(*) FROM satis_fisi_satirlari s JOIN teklifler t ON t.fis_id = s.fis_id WHERE t.id = 3 AND s.doviz = 'USD' AND s.doviz_fiyat = 1000 AND s.kur = 41.9578));
SELECT pg_temp.esit('Fiş toplamı TL (41957,80 x 2 x 1,2)', 100698.72, (SELECT f.genel_toplam FROM satis_fisleri f JOIN teklifler t ON t.fis_id = f.id WHERE t.id = 3));
SELECT teklif_kopyala(3, 'proforma') AS kopya_id \gset
SELECT pg_temp.esit('Kopyalanan proforma da USD', 1, (SELECT count(*) FROM teklifler WHERE id = :kopya_id AND doviz = 'USD' AND tur = 'proforma'));

-- Envanter (009)
INSERT INTO envanter (cari_id, tur, marka, model, seri_no, garanti_bitis, erisim_bilgisi) VALUES (1, 'NVR', 'Dahua', 'NVR4108HS', 'SN123', current_date + 20, 'admin / 1234');
SELECT pg_temp.esit('Envanter kaydı', 1, (SELECT count(*) FROM envanter WHERE cari_id = 1));
DO $$ BEGIN DELETE FROM envanter WHERE id = 1; RAISE EXCEPTION 'silinmemeliydi';
EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE '%silinemez%' THEN RAISE NOTICE 'OK  Envanter kaydı silinemez'; ELSE RAISE; END IF; END $$;
UPDATE isler SET envanter_id = 1 WHERE id = 1;
SELECT pg_temp.esit('İşe cihaz bağlandı', 1, (SELECT count(*) FROM isler WHERE envanter_id = 1));

-- Dövizli ürün işten fişe: USD ürün kurla TL'ye çevrilir
DO $$
DECLARE v_cari bigint; v_urun bigint; v_fis bigint; v_fiyat numeric; v_doviz text;
BEGIN
    INSERT INTO cariler (unvan) VALUES ('Döviz Test Ltd') RETURNING id INTO v_cari;
    INSERT INTO urunler (ad, onerilen_satis, satis_doviz) VALUES ('USD Kamera', 100, 'USD') RETURNING id INTO v_urun;
    INSERT INTO satis_fisleri (cari_id) VALUES (v_cari) RETURNING id INTO v_fis;
    INSERT INTO satis_fisi_satirlari (fis_id, tip, urun_id, aciklama, miktar, birim_fiyat) VALUES (v_fis, 'urun', v_urun, 'x', 2, 100);
    PERFORM fis_doviz_uygula(v_fis, 40.5, 45);
    SELECT birim_fiyat, doviz INTO v_fiyat, v_doviz FROM satis_fisi_satirlari WHERE fis_id = v_fis;
    IF v_fiyat <> 4050 OR v_doviz <> 'USD' THEN RAISE EXCEPTION 'Döviz çevrimi hatalı: % %', v_fiyat, v_doviz; END IF;
    -- ikinci çağrı değiştirmez
    PERFORM fis_doviz_uygula(v_fis, 50, 45);
    SELECT birim_fiyat INTO v_fiyat FROM satis_fisi_satirlari WHERE fis_id = v_fis;
    IF v_fiyat <> 4050 THEN RAISE EXCEPTION 'Döviz tekrar uygulandı: %', v_fiyat; END IF;
    RAISE NOTICE 'OK  Dövizli ürün fişte TL: %', v_fiyat;
END $$;

\echo 'TEKLİF TESTLERİ BAŞARILI'
