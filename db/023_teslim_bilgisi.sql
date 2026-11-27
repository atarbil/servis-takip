-- 34. derleme: İş kapatılırken imza isteğe bağlı; kime teslim edildiğine / bilgi verildiğine dair en az bir bilgi (ad ya da telefon) zorunlu
ALTER TABLE teslim_onaylari ALTER COLUMN imza_dosya DROP NOT NULL;
ALTER TABLE teslim_onaylari ALTER COLUMN teslim_alan_ad DROP NOT NULL;
ALTER TABLE teslim_onaylari DROP CONSTRAINT IF EXISTS teslim_bilgisi_var;
ALTER TABLE teslim_onaylari ADD CONSTRAINT teslim_bilgisi_var
    CHECK (coalesce(btrim(teslim_alan_ad), '') <> '' OR coalesce(btrim(teslim_alan_tel), '') <> '');

CREATE OR REPLACE FUNCTION is_tamamla(p_is_id bigint, p_teknisyen_notu text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r isler := is_getir_kilitli(p_is_id);
BEGIN
    IF r.durum <> 'sahada' THEN
        PERFORM hata('DURUM', 'Sadece sahadaki işler tamamlanabilir (şu an: ' || r.durum || ').');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM teslim_onaylari WHERE is_id = p_is_id) THEN
        PERFORM hata('TESLIM_YOK', 'İşi tamamlamak için kime teslim edildiğini / kime bilgi verildiğini (ad ya da telefon) yazın.');
    END IF;
    UPDATE isler SET durum = 'tamamlandi', bitis_zamani = now(),
        teknisyen_notu = coalesce(p_teknisyen_notu, teknisyen_notu)
    WHERE id = p_is_id;
END $$;
