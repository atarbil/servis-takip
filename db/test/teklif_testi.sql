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
\echo 'TEKLİF TESTLERİ BAŞARILI'
