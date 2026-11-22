-- Barkod arama: UPC-A (12 hane) ile EAN-13 (başında 0) aynı ürünü bulsun.
-- Kameralar/okuyucular aynı barkodu bazen 12, bazen 13 hane verir.
CREATE OR REPLACE FUNCTION barkod_bul(p_barkod text) RETURNS bigint
LANGUAGE sql STABLE AS $$
    WITH a AS (SELECT trim(p_barkod) AS b)
    SELECT x.urun_id FROM (
        SELECT b.urun_id, 1 AS sira FROM urun_barkodlari b JOIN urunler u ON u.id = b.urun_id, a
        WHERE b.barkod = a.b AND u.aktif
        UNION ALL
        SELECT b.urun_id, 2 FROM urun_barkodlari b JOIN urunler u ON u.id = b.urun_id, a
        WHERE u.aktif AND a.b ~ '^[0-9]{12,13}$' AND (
            (length(a.b) = 12 AND b.barkod = '0' || a.b) OR
            (length(a.b) = 13 AND a.b LIKE '0%' AND b.barkod = substr(a.b, 2)))
    ) x ORDER BY x.sira LIMIT 1
$$;
