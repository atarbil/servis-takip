-- 20. derleme: e-Fatura XML'den alış faturası
-- * alis_faturalari.ettn: faturanın GİB evrensel numarası (UUID) — aynı fatura iki kez girilmesin
-- * Fatura no tekilliği yalnız silinmemiş kayıtlar için (silinen fatura yeniden aktarılabilsin)
-- * tedarikci_urun_eslesme: tedarikçinin ürün kodu / adı → bizim stok kartı (bir kez eşleştirilir, sonra hatırlanır)

ALTER TABLE alis_faturalari ADD COLUMN IF NOT EXISTS ettn text;

ALTER TABLE alis_faturalari DROP CONSTRAINT IF EXISTS alis_faturalari_cari_id_belge_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS alis_fatura_no_tekil ON alis_faturalari (cari_id, belge_no) WHERE silindi IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS alis_fatura_ettn_tekil ON alis_faturalari (lower(ettn)) WHERE ettn IS NOT NULL AND silindi IS NULL;

CREATE TABLE IF NOT EXISTS tedarikci_urun_eslesme (
    cari_id     bigint NOT NULL REFERENCES cariler(id),
    anahtar     text NOT NULL,            -- 'kod:<satıcı kodu>' ya da 'ad:<sadeleştirilmiş ad>'
    urun_id     bigint NOT NULL REFERENCES urunler(id),
    guncelleme  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (cari_id, anahtar)
);
CREATE INDEX IF NOT EXISTS tedarikci_urun_eslesme_urun ON tedarikci_urun_eslesme (urun_id);
