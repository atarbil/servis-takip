-- =====================================================================
-- Servis Takip (5): Fiş satırı notu
-- Ürün satırlarında açıklama her zaman stok kartındaki ürün adıdır (değiştirilemez).
-- Seri no, garanti, marka gibi ek bilgiler ayrı "not" alanına yazılır ve fişte adın altında çıkar.
-- =====================================================================

ALTER TABLE satis_fisi_satirlari ADD COLUMN notu text;

-- Ürün satırının açıklamasını her durumda stok kartındaki ada eşitler
CREATE FUNCTION trg_satir_urun_adi() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.tip = 'urun' AND NEW.urun_id IS NOT NULL THEN
        SELECT ad INTO NEW.aciklama FROM urunler WHERE id = NEW.urun_id;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER satir_urun_adi BEFORE INSERT OR UPDATE ON satis_fisi_satirlari
    FOR EACH ROW EXECUTE FUNCTION trg_satir_urun_adi();
