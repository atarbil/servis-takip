-- =====================================================================
-- Servis Takip (8): Stok kartında marka, model, ana grup, alt grup
-- Eski tek "kategori" alanındaki değerler ana gruba taşınır.
-- =====================================================================

ALTER TABLE urunler ADD COLUMN marka text;
ALTER TABLE urunler ADD COLUMN model text;
ALTER TABLE urunler ADD COLUMN ana_grup text;
ALTER TABLE urunler ADD COLUMN alt_grup text;

UPDATE urunler SET ana_grup = kategori WHERE kategori IS NOT NULL AND ana_grup IS NULL;

CREATE INDEX ON urunler (lower(marka));
CREATE INDEX ON urunler (ana_grup, alt_grup);

-- Türkçe büyük/küçük harf ve aksan farkını yok sayarak arama için yardımcı
-- ("İ/ı/I/i", "Ş/ş" vb. — ILIKE Türkçe İ/ı'yı eşleştirmez)
CREATE FUNCTION arama_metni(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT lower(translate(coalesce(t, ''), 'İIıŞşĞğÜüÖöÇç', 'iiissgguuoocc'))
$$;

-- Ürünün aranabilir tüm metni: ad, kod, marka, model, gruplar
CREATE FUNCTION urun_arama_metni(u urunler) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT arama_metni(concat_ws(' ', u.ad, u.kod, u.marka, u.model, u.ana_grup, u.alt_grup))
$$;
