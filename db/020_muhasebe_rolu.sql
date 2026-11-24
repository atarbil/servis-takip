-- 26. derleme: Muhasebe rolü (yönetici ekranları; ayarlar / kullanıcılar / iş planlama / konum yok; kârlılık bilgisi gönderilmez)
ALTER TYPE kullanici_rol ADD VALUE IF NOT EXISTS 'muhasebe';

-- İşe malzeme, iş tanımlanırken (havuzdayken) de eklenebilir: ofisin eklediği "verildi", teknisyenin eklediği "ilave"
CREATE OR REPLACE FUNCTION is_malzeme_ekle(p_is_id bigint, p_urun_id bigint, p_miktar numeric,
                                           p_barkodla boolean DEFAULT false, p_sahada boolean DEFAULT true)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    r isler := is_getir_kilitli(p_is_id);
    v_maliyet numeric;
    v_hareket bigint;
    v_id bigint;
BEGIN
    IF r.durum NOT IN ('havuz', 'planlandi', 'sahada', 'tamamlandi') THEN
        PERFORM hata('DURUM', 'Bu işe malzeme eklenemez (şu an: ' || r.durum || ').');
    END IF;
    SELECT ort_maliyet INTO v_maliyet FROM urunler WHERE id = p_urun_id;
    v_hareket := stok_hareket(p_urun_id, -p_miktar, v_maliyet, 'is_malzeme', p_is_id, 'İş #' || p_is_id);
    INSERT INTO is_malzemeleri (is_id, urun_id, miktar, birim_maliyet, sahada_eklendi, barkodla_eklendi,
                                stok_hareket_id, ekleyen_id)
    VALUES (p_is_id, p_urun_id, p_miktar, v_maliyet, p_sahada, p_barkodla, v_hareket, aktif_kullanici())
    RETURNING id INTO v_id;
    RETURN v_id;
END $$;

-- Teslim formunda malzeme listesi müşteriye gösterilmez (form tasarımından yeniden açılabilir)
UPDATE belge_sablonlari SET ayar = jsonb_set(ayar, '{bolumler}', (
    SELECT jsonb_agg(CASE WHEN b->>'id' = 'malzeme' THEN b || '{"goster": false}'::jsonb ELSE b END ORDER BY o)
    FROM jsonb_array_elements(ayar->'bolumler') WITH ORDINALITY x(b, o)))
WHERE tur = 'teslim' AND jsonb_typeof(ayar->'bolumler') = 'array';

-- Havuzdaki işten de malzeme çıkarılabilir (stoğa iade)
CREATE OR REPLACE FUNCTION is_malzeme_cikar(p_malzeme_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    m is_malzemeleri;
    r isler;
BEGIN
    SELECT * INTO m FROM is_malzemeleri WHERE id = p_malzeme_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Malzeme kaydı bulunamadı.'); END IF;
    r := is_getir_kilitli(m.is_id);
    IF r.durum NOT IN ('havuz', 'planlandi', 'sahada', 'tamamlandi') THEN
        PERFORM hata('DURUM', 'Fişi kesilmiş işten malzeme çıkarılamaz.');
    END IF;
    PERFORM stok_hareket(m.urun_id, m.miktar, m.birim_maliyet, 'duzeltme', m.is_id,
                         'İş #' || m.is_id || ' malzeme iadesi');
    DELETE FROM is_malzemeleri WHERE id = p_malzeme_id;
END $$;
