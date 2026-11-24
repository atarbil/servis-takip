-- =====================================================================
-- Servis Takip (15): Tüm kalemler stok kartlı
-- Satış fişi ve teklif/proforma satırları bir stok kartına bağlı olmak zorunda (serbest açıklama satırı yok).
-- İşçilik / hizmet de kart olarak açılır: urunler.tur = 'hizmet' → stok miktarı tutulmaz, stok hareketi oluşmaz.
-- Eski kayıtlara dokunulmaz: kural yalnız yeni eklenen ya da ürünü değiştirilen satırlarda çalışır.
-- =====================================================================

ALTER TABLE urunler ADD COLUMN tur text NOT NULL DEFAULT 'urun' CHECK (tur IN ('urun', 'hizmet'));

-- Hizmet kartında stok miktarı değişmez, hareket kaydı oluşmaz (alışta son alış fiyatı maliyet olur)
CREATE OR REPLACE FUNCTION stok_hareket(p_urun_id bigint, p_miktar numeric, p_birim_maliyet numeric,
                             p_kaynak stok_kaynak, p_kaynak_id bigint, p_aciklama text DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    u urunler;
    v_id bigint;
    yeni_stok numeric;
BEGIN
    SELECT * INTO u FROM urunler WHERE id = p_urun_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('URUN_YOK', 'Ürün bulunamadı: ' || p_urun_id); END IF;

    IF u.tur = 'hizmet' THEN
        IF p_miktar > 0 AND p_kaynak = 'alis' THEN
            UPDATE urunler SET ort_maliyet = p_birim_maliyet WHERE id = p_urun_id;
        END IF;
        RETURN NULL;
    END IF;

    yeni_stok := u.stok_miktari + p_miktar;

    IF p_miktar > 0 AND p_kaynak IN ('alis', 'sayim', 'duzeltme') THEN
        UPDATE urunler SET
            stok_miktari = yeni_stok,
            ort_maliyet = CASE
                WHEN u.stok_miktari <= 0 OR u.ort_maliyet = 0 THEN p_birim_maliyet
                ELSE round((u.stok_miktari * u.ort_maliyet + p_miktar * p_birim_maliyet) / yeni_stok, 4)
            END
        WHERE id = p_urun_id;
    ELSE
        UPDATE urunler SET stok_miktari = yeni_stok WHERE id = p_urun_id;
    END IF;

    INSERT INTO stok_hareketleri (urun_id, miktar, birim_maliyet, kaynak, kaynak_id, aciklama, kullanici_id)
    VALUES (p_urun_id, p_miktar, p_birim_maliyet, p_kaynak, p_kaynak_id, p_aciklama, aktif_kullanici())
    RETURNING id INTO v_id;
    RETURN v_id;
END $$;

-- Satırın stok kartı zorunlu; satır tipi (ürün / hizmet) karttan gelir; satır adı kartın adıdır.
-- Tetikleyici adı "a_" ile başlar: aynı tablodaki diğer tetikleyicilerden önce çalışsın.
CREATE FUNCTION trg_satir_kart_zorunlu() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    k urunler;
BEGIN
    IF NEW.urun_id IS NULL THEN
        PERFORM hata('KART_YOK', '"' || coalesce(nullif(trim(NEW.aciklama), ''), 'Boş satır')
            || '" bir stok kartına bağlı değil. Her kalem için stok kartı seçin ya da yeni kart açın.');
    END IF;
    SELECT * INTO k FROM urunler WHERE id = NEW.urun_id;
    IF NOT FOUND THEN PERFORM hata('URUN_YOK', 'Ürün bulunamadı.'); END IF;
    NEW.aciklama := k.ad;
    IF TG_TABLE_NAME = 'satis_fisi_satirlari' THEN
        NEW.tip := CASE WHEN k.tur = 'hizmet' THEN 'hizmet' ELSE 'urun' END::satir_tip;
        -- hizmet satırı stok düşmez; kâr hesabı için maliyeti karttan (son alış) alınır
        IF k.tur = 'hizmet' AND coalesce(NEW.birim_maliyet, 0) = 0 THEN NEW.birim_maliyet := k.ort_maliyet; END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER a_satir_kart_zorunlu BEFORE INSERT OR UPDATE OF urun_id ON satis_fisi_satirlari
    FOR EACH ROW EXECUTE FUNCTION trg_satir_kart_zorunlu();
CREATE TRIGGER a_satir_kart_zorunlu BEFORE INSERT OR UPDATE OF urun_id ON teklif_satirlari
    FOR EACH ROW EXECUTE FUNCTION trg_satir_kart_zorunlu();
