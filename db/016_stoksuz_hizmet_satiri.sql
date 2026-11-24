-- =====================================================================
-- Servis Takip (16): Stoksuz İşçilik / Eğitim / Hizmet satırları
-- Ürün satırları stok kartlı olmak zorunda kalır; "+ İşçilik / + Eğitim / + Hizmet" düğmeleriyle açılan satırlar
-- stok kartı gerektirmez (stoktan düşmez, maliyeti yoktur). Satış fişi ve teklif / proformada geçerli.
-- =====================================================================

ALTER TYPE satir_tip ADD VALUE IF NOT EXISTS 'egitim';

-- Teklif satırına da tip (fişe dönüşürken ve kopyalanırken korunur)
ALTER TABLE teklif_satirlari ADD COLUMN tip text NOT NULL DEFAULT 'urun' CHECK (tip IN ('urun', 'hizmet', 'iscilik', 'egitim'));

CREATE OR REPLACE FUNCTION trg_satir_kart_zorunlu() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    k urunler;
BEGIN
    IF NEW.urun_id IS NULL THEN
        -- Stoksuz satır yalnız işçilik / eğitim / hizmet tipinde, açıklaması dolu
        IF NEW.tip::text IN ('iscilik', 'egitim', 'hizmet') THEN
            IF coalesce(trim(NEW.aciklama), '') = '' THEN
                PERFORM hata('ACIKLAMA_YOK', 'İşçilik / eğitim / hizmet satırının açıklaması boş olamaz.');
            END IF;
            IF TG_TABLE_NAME = 'satis_fisi_satirlari' THEN NEW.birim_maliyet := 0; NEW.stoktan_dus := false; END IF;
            RETURN NEW;
        END IF;
        PERFORM hata('KART_YOK', '"' || coalesce(nullif(trim(NEW.aciklama), ''), 'Boş satır')
            || '" bir stok kartına bağlı değil. Listeden ürün seçin ya da yeni stok kartı açın.');
    END IF;
    SELECT * INTO k FROM urunler WHERE id = NEW.urun_id;
    IF NOT FOUND THEN PERFORM hata('URUN_YOK', 'Ürün bulunamadı.'); END IF;
    NEW.aciklama := k.ad;
    IF TG_TABLE_NAME = 'satis_fisi_satirlari' THEN
        NEW.tip := CASE WHEN k.tur = 'hizmet' THEN 'hizmet' ELSE 'urun' END::satir_tip;
        IF k.tur = 'hizmet' AND coalesce(NEW.birim_maliyet, 0) = 0 THEN NEW.birim_maliyet := k.ort_maliyet; END IF;
    ELSE
        NEW.tip := CASE WHEN k.tur = 'hizmet' THEN 'hizmet' ELSE 'urun' END;
    END IF;
    RETURN NEW;
END $$;

-- Teklif → fiş: stoksuz satırların tipi korunur
CREATE OR REPLACE FUNCTION teklifi_fise_donustur(p_id bigint, p_kur numeric DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    t teklifler;
    v_fis bigint;
    v_kur numeric;
BEGIN
    SELECT * INTO t FROM teklifler WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Teklif bulunamadı.'); END IF;
    IF t.durum = 'iptal' THEN PERFORM hata('DURUM', 'İptal edilmiş belge dönüştürülemez.'); END IF;
    IF t.fis_id IS NOT NULL AND EXISTS (SELECT 1 FROM satis_fisleri WHERE id = t.fis_id AND durum <> 'iptal') THEN
        RETURN t.fis_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM teklif_satirlari WHERE teklif_id = p_id) THEN
        PERFORM hata('BOS', 'Belgede satır yok.');
    END IF;
    IF t.doviz <> 'TRY' THEN
        v_kur := coalesce(p_kur, t.kur);
        IF v_kur IS NULL OR v_kur <= 0 THEN PERFORM hata('KUR_YOK', 'Dövizli belgeyi fişe dönüştürmek için kur girin.'); END IF;
    END IF;

    INSERT INTO satis_fisleri (cari_id, aciklama, olusturan_id)
    VALUES (t.cari_id, t.belge_no || ' numaralı ' || CASE t.tur WHEN 'teklif' THEN 'tekliften' ELSE 'proformadan' END
            || CASE WHEN t.doviz <> 'TRY' THEN ' (' || t.doviz || ' kuru ' || to_char(v_kur, 'FM999990.0000') || ')' ELSE '' END,
            aktif_kullanici())
    RETURNING id INTO v_fis;

    INSERT INTO satis_fisi_satirlari (fis_id, sira, tip, urun_id, aciklama, notu, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani,
                                      stoktan_dus, doviz, doviz_fiyat, kur)
    SELECT v_fis, s.sira, (CASE WHEN s.urun_id IS NULL THEN coalesce(nullif(s.tip, 'urun'), 'hizmet') ELSE 'urun' END)::satir_tip, s.urun_id, s.aciklama, s.notu,
           s.miktar, s.birim,
           CASE WHEN t.doviz = 'TRY' THEN s.birim_fiyat ELSE round(s.birim_fiyat * v_kur, 2) END,
           s.iskonto_orani, s.kdv_orani, true,
           CASE WHEN t.doviz <> 'TRY' THEN t.doviz END,
           CASE WHEN t.doviz <> 'TRY' THEN s.birim_fiyat END,
           CASE WHEN t.doviz <> 'TRY' THEN v_kur END
    FROM teklif_satirlari s WHERE s.teklif_id = p_id ORDER BY s.sira, s.id;

    UPDATE teklifler SET fis_id = v_fis, durum = 'kabul', kur = coalesce(v_kur, kur) WHERE id = p_id;
    RETURN v_fis;
END $$;


CREATE OR REPLACE FUNCTION teklif_kopyala(p_id bigint, p_tur teklif_tur) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    t teklifler;
    v_id bigint;
BEGIN
    SELECT * INTO t FROM teklifler WHERE id = p_id;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Teklif bulunamadı.'); END IF;
    INSERT INTO teklifler (tur, cari_id, giris_metni, kapanis_metni, aciklama, kase_imza, kaynak_teklif_id, olusturan_id,
                           doviz, kur, tl_karsilik_goster)
    VALUES (p_tur, t.cari_id,
            CASE WHEN p_tur = t.tur THEN t.giris_metni END, CASE WHEN p_tur = t.tur THEN t.kapanis_metni END,
            t.aciklama, t.kase_imza, p_id, aktif_kullanici(), t.doviz, t.kur, t.tl_karsilik_goster)
    RETURNING id INTO v_id;
    INSERT INTO teklif_satirlari (teklif_id, sira, tip, urun_id, aciklama, notu, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani)
    SELECT v_id, sira, tip, urun_id, aciklama, notu, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani
    FROM teklif_satirlari WHERE teklif_id = p_id ORDER BY sira, id;
    RETURN v_id;
END $$;

