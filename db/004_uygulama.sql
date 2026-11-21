-- =====================================================================
-- Servis Takip (4): Uygulama ekleri - firma ayarları, stok sayımı, telefonla cari bulma
-- =====================================================================

CREATE TABLE ayarlar (
    anahtar     text PRIMARY KEY,
    deger       text
);
INSERT INTO ayarlar (anahtar, deger) VALUES
    ('firma_adi', 'Firma Adı'),
    ('firma_adres', ''),
    ('firma_telefon', ''),
    ('firma_eposta', ''),
    ('firma_vergi', ''),
    ('teslim_metni', 'Yukarıda belirtilen hizmet/ürünleri eksiksiz ve çalışır durumda teslim aldım.'),
    ('fis_notu', '');

-- Telefonu sadece rakamlara indirger, son 10 haneyi alır (0532..., +90532..., 532... aynı olur)
CREATE FUNCTION telefon_sade(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT nullif(right(regexp_replace(coalesce(t, ''), '\D', '', 'g'), 10), '')
$$;
CREATE INDEX cariler_tel_sade ON cariler (telefon_sade(telefon));
CREATE INDEX cariler_tel2_sade ON cariler (telefon_sade(telefon2));

CREATE FUNCTION cari_telefonla_bul(p_tel text) RETURNS bigint
LANGUAGE sql STABLE AS $$
    SELECT id FROM cariler
    WHERE aktif AND telefon_sade(p_tel) IS NOT NULL
      AND (telefon_sade(telefon) = telefon_sade(p_tel) OR telefon_sade(telefon2) = telefon_sade(p_tel))
    ORDER BY id LIMIT 1
$$;

-- Sayım: ürünün stoğunu sayılan miktara eşitler, farkı stok hareketi olarak yazar
CREATE FUNCTION stok_sayim(p_urun_id bigint, p_sayilan numeric, p_aciklama text DEFAULT 'Sayım')
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE u urunler;
BEGIN
    SELECT * INTO u FROM urunler WHERE id = p_urun_id;
    IF NOT FOUND THEN PERFORM hata('URUN_YOK', 'Ürün bulunamadı.'); END IF;
    IF p_sayilan <> u.stok_miktari THEN
        -- Sayım farkı mevcut ortalama maliyetten yazılır, ortalamayı bozmaz
        UPDATE urunler SET stok_miktari = p_sayilan WHERE id = p_urun_id;
        INSERT INTO stok_hareketleri (urun_id, miktar, birim_maliyet, kaynak, aciklama, kullanici_id)
        VALUES (p_urun_id, p_sayilan - u.stok_miktari, u.ort_maliyet, 'sayim', p_aciklama, aktif_kullanici());
    END IF;
END $$;

CREATE INDEX ON satis_fisleri (tarih);
CREATE INDEX ON finans_hareketleri (tarih);
CREATE INDEX ON isler (olusturma);

-- Takvim beslemesine açıklama sütunu (not detayında gösterilir)
CREATE OR REPLACE VIEW v_takvim AS
SELECT 'is' AS tur, i.id, i.baslik, i.plan_baslangic AS baslangic, i.plan_bitis AS bitis, false AS tum_gun,
       coalesce(e.renk, '#64748b') AS renk, i.durum::text AS durum, i.ekip_id, c.unvan, i.adres, i.aciklama
FROM isler i
LEFT JOIN ekipler e ON e.id = i.ekip_id
LEFT JOIN cariler c ON c.id = i.cari_id
WHERE i.plan_baslangic IS NOT NULL AND i.durum <> 'iptal'
UNION ALL
SELECT 'not', n.id, n.baslik, n.baslangic, n.bitis, n.tum_gun, n.renk,
       CASE WHEN n.tamamlandi THEN 'tamamlandi' ELSE 'acik' END, NULL, NULL, NULL, n.aciklama
FROM takvim_notlari n;

-- Sahadan gelen ürün onaylanırken girilen satış fiyatı, taslak fişlerdeki fiyatı 0 olan satırlara da yazılır
CREATE OR REPLACE FUNCTION urun_onayla(p_urun_id bigint, p_birim_maliyet numeric, p_ad text DEFAULT NULL,
                                       p_kod text DEFAULT NULL, p_onerilen_satis numeric DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE urunler SET onay_bekliyor = false,
        ort_maliyet = p_birim_maliyet,
        ad = coalesce(p_ad, ad), kod = coalesce(p_kod, kod),
        onerilen_satis = coalesce(p_onerilen_satis, onerilen_satis)
    WHERE id = p_urun_id;

    UPDATE is_malzemeleri m SET birim_maliyet = p_birim_maliyet
    FROM isler i
    WHERE m.is_id = i.id AND m.urun_id = p_urun_id AND m.birim_maliyet = 0 AND i.durum <> 'fis_kesildi';

    UPDATE stok_hareketleri SET birim_maliyet = p_birim_maliyet
    WHERE urun_id = p_urun_id AND birim_maliyet = 0 AND kaynak = 'is_malzeme';

    UPDATE satis_fisi_satirlari s SET
        birim_maliyet = CASE WHEN s.birim_maliyet = 0 THEN p_birim_maliyet ELSE s.birim_maliyet END,
        birim_fiyat = CASE WHEN s.birim_fiyat = 0 AND p_onerilen_satis IS NOT NULL THEN p_onerilen_satis ELSE s.birim_fiyat END,
        aciklama = coalesce(p_ad, s.aciklama)
    FROM satis_fisleri f
    WHERE s.fis_id = f.id AND f.durum = 'taslak' AND s.urun_id = p_urun_id;
END $$;
