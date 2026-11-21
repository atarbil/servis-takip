-- =====================================================================
-- Servis Takip - Veritabanı Şeması (3/3): Rapor görünümleri
-- =====================================================================

-- Cari bakiye listesi (+ cari bize borçlu, - biz borçluyuz)
CREATE VIEW v_cari_bakiye AS
SELECT c.id, c.kod, c.unvan, c.tip, c.telefon,
       coalesce(sum(h.borc), 0)                 AS toplam_borc,
       coalesce(sum(h.alacak), 0)               AS toplam_alacak,
       coalesce(sum(h.borc - h.alacak), 0)      AS bakiye,
       max(h.tarih) FILTER (WHERE h.belge_tip = 'tahsilat') AS son_tahsilat,
       max(h.tarih)                              AS son_hareket
FROM cariler c
LEFT JOIN cari_hareketler h ON h.cari_id = c.id AND NOT h.iptal
GROUP BY c.id;

-- Cari ekstre: yürüyen bakiyeli. Kullanım:
--   SELECT * FROM v_cari_ekstre WHERE cari_id = 5 AND tarih BETWEEN '2026-01-01' AND '2026-12-31';
-- (Tarih aralığı öncesindeki bakiye için cari_ekstre() fonksiyonunu kullanın.)
CREATE VIEW v_cari_ekstre AS
SELECT h.id, h.cari_id, h.tarih, h.vade, h.belge_tip, h.belge_no, h.aciklama, h.borc, h.alacak,
       sum(h.borc - h.alacak) OVER (PARTITION BY h.cari_id ORDER BY h.tarih, h.id) AS bakiye
FROM cari_hareketler h
WHERE NOT h.iptal;

-- Tarih aralıklı ekstre: ilk satır "Önceki bakiye" olarak devreden tutarı gösterir
CREATE FUNCTION cari_ekstre(p_cari_id bigint, p_bas date, p_bit date)
RETURNS TABLE (tarih date, vade date, belge_tip text, belge_no text, aciklama text,
               borc numeric, alacak numeric, bakiye numeric)
LANGUAGE sql STABLE AS $$
    WITH onceki AS (
        SELECT coalesce(sum(borc - alacak), 0) AS b
        FROM cari_hareketler WHERE cari_id = p_cari_id AND NOT iptal AND tarih < p_bas
    )
    SELECT p_bas, NULL::date, 'devir', NULL, 'Önceki bakiye',
           greatest(b, 0), greatest(-b, 0), b
    FROM onceki
    UNION ALL
    SELECT * FROM (
        SELECT h.tarih, h.vade, h.belge_tip::text, h.belge_no, h.aciklama, h.borc, h.alacak,
               (SELECT b FROM onceki) + sum(h.borc - h.alacak) OVER (ORDER BY h.tarih, h.id)
        FROM cari_hareketler h
        WHERE h.cari_id = p_cari_id AND NOT h.iptal AND h.tarih BETWEEN p_bas AND p_bit
        ORDER BY h.tarih, h.id
    ) x
$$;

-- Vadesi geçmiş alacaklar (FIFO: tahsilatlar en eski borçtan düşülür)
CREATE VIEW v_vadesi_gecen AS
WITH borclar AS (
    SELECT cari_id, id, coalesce(vade, tarih) AS vade, borc,
           sum(borc) OVER (PARTITION BY cari_id ORDER BY coalesce(vade, tarih), id) AS kumulatif
    FROM cari_hareketler WHERE NOT iptal AND borc > 0
), odenen AS (
    SELECT cari_id, sum(alacak) AS toplam FROM cari_hareketler WHERE NOT iptal GROUP BY cari_id
)
SELECT b.cari_id, c.unvan, c.telefon,
       sum(least(b.borc, b.kumulatif - coalesce(o.toplam, 0))) AS gecikmis_tutar,
       min(b.vade) AS en_eski_vade,
       current_date - min(b.vade) AS gecikme_gun
FROM borclar b
JOIN cariler c ON c.id = b.cari_id
LEFT JOIN odenen o ON o.cari_id = b.cari_id
WHERE b.kumulatif > coalesce(o.toplam, 0) AND b.vade < current_date
GROUP BY b.cari_id, c.unvan, c.telefon;

-- İş maliyeti ve kârlılık
CREATE VIEW v_is_karlilik AS
SELECT i.id AS is_id, i.baslik, i.durum, i.cari_id, c.unvan, i.ekip_id, e.ad AS ekip,
       i.plan_baslangic, i.bitis_zamani,
       coalesce(m.maliyet, 0)                           AS malzeme_maliyeti,
       m.maliyetsiz_kalem,
       f.id AS fis_id, f.fis_no, f.ara_toplam           AS satis_kdv_haric,
       f.ara_toplam - coalesce(m.maliyet, 0)            AS kar,
       CASE WHEN f.ara_toplam > 0
            THEN round((f.ara_toplam - coalesce(m.maliyet, 0)) * 100 / f.ara_toplam, 1) END AS kar_orani
FROM isler i
LEFT JOIN cariler c ON c.id = i.cari_id
LEFT JOIN ekipler e ON e.id = i.ekip_id
LEFT JOIN LATERAL (
    SELECT round(sum(miktar * birim_maliyet), 2) AS maliyet,
           count(*) FILTER (WHERE birim_maliyet = 0) AS maliyetsiz_kalem
    FROM is_malzemeleri WHERE is_id = i.id
) m ON true
LEFT JOIN satis_fisleri f ON f.is_id = i.id AND f.durum = 'onaylandi';

-- Yıllık müşteri özeti: iş sayısı, ciro, maliyet, kâr, tahsilat, yıl sonu bakiye
CREATE VIEW v_yillik_cari_ozet AS
WITH yil_fis AS (
    SELECT cari_id, extract(year FROM tarih)::int AS yil,
           count(*) AS fis_sayisi, count(is_id) AS is_sayisi,
           sum(ara_toplam) AS ciro_kdv_haric, sum(genel_toplam) AS ciro_kdv_dahil,
           sum(maliyet_toplam) AS maliyet
    FROM satis_fisleri WHERE durum = 'onaylandi'
    GROUP BY 1, 2
), yil_tahsilat AS (
    SELECT cari_id, extract(year FROM tarih)::int AS yil, sum(alacak) AS tahsilat
    FROM cari_hareketler WHERE NOT iptal AND belge_tip = 'tahsilat'
    GROUP BY 1, 2
)
, anahtar AS (
    SELECT cari_id, yil FROM yil_fis UNION SELECT cari_id, yil FROM yil_tahsilat
)
SELECT c.id AS cari_id, c.unvan, k.yil,
       coalesce(f.is_sayisi, 0) AS is_sayisi, coalesce(f.fis_sayisi, 0) AS fis_sayisi,
       coalesce(f.ciro_kdv_haric, 0) AS ciro_kdv_haric, coalesce(f.ciro_kdv_dahil, 0) AS ciro_kdv_dahil,
       coalesce(f.maliyet, 0) AS maliyet,
       coalesce(f.ciro_kdv_haric, 0) - coalesce(f.maliyet, 0) AS kar,
       coalesce(t.tahsilat, 0) AS tahsilat,
       (SELECT coalesce(sum(borc - alacak), 0) FROM cari_hareketler h
        WHERE h.cari_id = c.id AND NOT h.iptal AND h.tarih <= make_date(k.yil, 12, 31)) AS yil_sonu_bakiye
FROM anahtar k
JOIN cariler c ON c.id = k.cari_id
LEFT JOIN yil_fis f ON f.cari_id = k.cari_id AND f.yil = k.yil
LEFT JOIN yil_tahsilat t ON t.cari_id = k.cari_id AND t.yil = k.yil;

-- Ekip performansı (aylık)
CREATE VIEW v_ekip_aylik AS
SELECT e.id AS ekip_id, e.ad AS ekip, date_trunc('month', i.bitis_zamani)::date AS ay,
       count(*) AS tamamlanan_is,
       round(avg(extract(epoch FROM i.bitis_zamani - i.baslama_zamani) / 3600)::numeric, 1) AS ort_sure_saat,
       coalesce(sum(k.satis_kdv_haric), 0) AS ciro,
       coalesce(sum(k.kar), 0) AS kar
FROM isler i
JOIN ekipler e ON e.id = i.ekip_id
LEFT JOIN v_is_karlilik k ON k.is_id = i.id
WHERE i.durum IN ('tamamlandi', 'fis_kesildi') AND i.bitis_zamani IS NOT NULL
GROUP BY 1, 2, 3;

-- Kasa/banka bakiyeleri
CREATE VIEW v_hesap_bakiye AS
SELECT h.id, h.ad, h.tip,
       coalesce(sum(CASE WHEN f.tip IN ('tahsilat', 'virman_giris') THEN f.tutar ELSE -f.tutar END), 0) AS bakiye
FROM hesaplar h
LEFT JOIN finans_hareketleri f ON f.hesap_id = h.id AND NOT f.iptal
GROUP BY h.id;

-- Kritik stok ve eksi stok uyarıları
CREATE VIEW v_stok_uyari AS
SELECT id, kod, ad, birim, stok_miktari, kritik_stok, ort_maliyet,
       CASE WHEN onay_bekliyor THEN 'onay_bekliyor'
            WHEN stok_miktari < 0 THEN 'eksi_stok'
            ELSE 'kritik' END AS uyari
FROM urunler
WHERE aktif AND (stok_miktari < 0 OR onay_bekliyor
                 OR (kritik_stok IS NOT NULL AND stok_miktari <= kritik_stok));

-- Takvim beslemesi: işler + notlar tek listede
CREATE VIEW v_takvim AS
SELECT 'is' AS tur, i.id, i.baslik, i.plan_baslangic AS baslangic, i.plan_bitis AS bitis, false AS tum_gun,
       coalesce(e.renk, '#64748b') AS renk, i.durum::text AS durum, i.ekip_id, c.unvan, i.adres
FROM isler i
LEFT JOIN ekipler e ON e.id = i.ekip_id
LEFT JOIN cariler c ON c.id = i.cari_id
WHERE i.plan_baslangic IS NOT NULL AND i.durum <> 'iptal'
UNION ALL
SELECT 'not', n.id, n.baslik, n.baslangic, n.bitis, n.tum_gun, n.renk,
       CASE WHEN n.tamamlandi THEN 'tamamlandi' ELSE 'acik' END, NULL, NULL, NULL
FROM takvim_notlari n;

-- İş havuzu: önceliğe ve bekleme süresine göre
CREATE VIEW v_is_havuzu AS
SELECT i.id, i.baslik, i.ham_mesaj, i.oncelik, i.adres, i.iletisim_ad, i.iletisim_tel,
       c.unvan, i.olusturma, now() - i.olusturma AS bekleme,
       (SELECT count(*) FROM is_gecmisi g WHERE g.is_id = i.id AND g.yeni_durum = 'havuz' AND g.eski_durum IS NOT NULL)
           AS havuza_donus_sayisi
FROM isler i
LEFT JOIN cariler c ON c.id = i.cari_id
WHERE i.durum = 'havuz'
ORDER BY i.oncelik, i.olusturma;
