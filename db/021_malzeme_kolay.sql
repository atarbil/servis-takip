-- 31. derleme: Malzeme ekleme kolaylığı
-- Aramada boşluk / tire / nokta farkı yok sayılır: "cat6" = "Cat 6", "4mp" = "4 MP", "DS-2CD" = "ds2cd"
CREATE OR REPLACE FUNCTION arama_sikisik(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(arama_metni(t), '[^0-9a-z]', '', 'g')
$$;

-- İşteki malzemenin miktarı değiştirilir; fark stoktan düşülür / stoğa iade edilir. 0 ya da altı → malzeme çıkarılır.
CREATE OR REPLACE FUNCTION is_malzeme_miktar(p_malzeme_id bigint, p_miktar numeric) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    m is_malzemeleri;
    r isler;
    v_fark numeric;
BEGIN
    SELECT * INTO m FROM is_malzemeleri WHERE id = p_malzeme_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Malzeme kaydı bulunamadı.'); END IF;
    r := is_getir_kilitli(m.is_id);
    IF r.durum NOT IN ('havuz', 'planlandi', 'sahada', 'tamamlandi') THEN
        PERFORM hata('DURUM', 'Fişi kesilmiş işte malzeme değiştirilemez.');
    END IF;
    IF p_miktar IS NULL OR p_miktar <= 0 THEN
        PERFORM is_malzeme_cikar(p_malzeme_id);
        RETURN;
    END IF;
    v_fark := p_miktar - m.miktar;
    IF v_fark = 0 THEN RETURN; END IF;
    PERFORM stok_hareket(m.urun_id, -v_fark, m.birim_maliyet,
                         (CASE WHEN v_fark > 0 THEN 'is_malzeme' ELSE 'duzeltme' END)::stok_kaynak, m.is_id,
                         'İş #' || m.is_id || ' malzeme miktarı ' || m.miktar || ' → ' || p_miktar);
    UPDATE is_malzemeleri SET miktar = p_miktar WHERE id = p_malzeme_id;
END $$;
