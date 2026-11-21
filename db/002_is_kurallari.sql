-- =====================================================================
-- Servis Takip - Veritabanı Şeması (2/3): İş kuralları
--
-- Para, stok ve cari etkileyen tüm işlemler bu fonksiyonlardan geçer.
-- Böylece uygulamada bir hata olsa bile veriler tutarlı kalır.
-- Uygulama her işlemde: SET LOCAL app.kullanici_id = '<id>';
-- =====================================================================

-- ---------- Yardımcılar ----------
CREATE FUNCTION aktif_kullanici() RETURNS bigint
LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('app.kullanici_id', true), '')::bigint
$$;

CREATE FUNCTION hata(kod text, mesaj text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '%', mesaj USING ERRCODE = 'P0001', HINT = kod;
END $$;

-- ---------- Denetim kaydı ----------
CREATE FUNCTION trg_denetim() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    eski jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) - 'sifre_hash' - 'iki_adim_gizli' END;
    yeni jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) - 'sifre_hash' - 'iki_adim_gizli' END;
BEGIN
    IF TG_OP = 'UPDATE' AND eski = yeni THEN
        RETURN NEW;
    END IF;
    INSERT INTO denetim_kaydi (tablo, kayit_id, islem, eski, yeni, kullanici_id)
    VALUES (TG_TABLE_NAME, coalesce((yeni->>'id')::bigint, (eski->>'id')::bigint), TG_OP, eski, yeni, aktif_kullanici());
    RETURN coalesce(NEW, OLD);
END $$;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['kullanicilar','ekipler','cariler','cari_hareketler','urunler','urun_barkodlari',
        'isler','is_malzemeleri','teslim_onaylari','satis_fisleri','satis_fisi_satirlari',
        'alis_faturalari','alis_faturasi_satirlari','hesaplar','finans_hareketleri','takvim_notlari']
    LOOP
        EXECUTE format('CREATE TRIGGER denetim AFTER INSERT OR UPDATE OR DELETE ON %I
                        FOR EACH ROW EXECUTE FUNCTION trg_denetim()', t);
    END LOOP;
END $$;

-- ---------- Silme engeli: finansal ve tarihsel kayıtlar silinemez ----------
CREATE FUNCTION trg_silme_engeli() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM hata('SILINEMEZ', TG_TABLE_NAME || ' kayıtları silinemez, iptal edilmelidir.');
    RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['cariler','cari_hareketler','isler','is_gecmisi','stok_hareketleri',
        'teslim_onaylari','satis_fisleri','alis_faturalari','finans_hareketleri','denetim_kaydi']
    LOOP
        EXECUTE format('CREATE TRIGGER silme_engeli BEFORE DELETE ON %I
                        FOR EACH ROW EXECUTE FUNCTION trg_silme_engeli()', t);
    END LOOP;
END $$;

-- Teslim onayı sonradan değiştirilemez (yalnızca PDF yolu eklenebilir)
CREATE FUNCTION trg_teslim_kilit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW) - 'pdf_dosya') <> (to_jsonb(OLD) - 'pdf_dosya') THEN
        PERFORM hata('TESLIM_KILITLI', 'Müşteri onayı alındıktan sonra değiştirilemez.');
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER teslim_kilit BEFORE UPDATE ON teslim_onaylari
    FOR EACH ROW EXECUTE FUNCTION trg_teslim_kilit();

-- ---------- İş geçmişi ----------
CREATE FUNCTION trg_is_gecmis() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    not_ text := nullif(current_setting('app.gecmis_notu', true), '');
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO is_gecmisi (is_id, eski_durum, yeni_durum, aciklama, kullanici_id)
        VALUES (NEW.id, NULL, NEW.durum, coalesce(not_, 'İş oluşturuldu'), aktif_kullanici());
    ELSIF NEW.durum IS DISTINCT FROM OLD.durum
       OR NEW.plan_baslangic IS DISTINCT FROM OLD.plan_baslangic
       OR NEW.ekip_id IS DISTINCT FROM OLD.ekip_id THEN
        INSERT INTO is_gecmisi (is_id, eski_durum, yeni_durum, aciklama, kullanici_id)
        VALUES (NEW.id, OLD.durum, NEW.durum,
                coalesce(not_, CASE WHEN NEW.durum = OLD.durum THEN 'Plan değişti' END),
                aktif_kullanici());
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER is_gecmis AFTER INSERT OR UPDATE ON isler
    FOR EACH ROW EXECUTE FUNCTION trg_is_gecmis();

CREATE FUNCTION trg_guncelleme_zamani() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.guncelleme := now();
    RETURN NEW;
END $$;
CREATE TRIGGER guncelleme BEFORE UPDATE ON isler
    FOR EACH ROW EXECUTE FUNCTION trg_guncelleme_zamani();

-- =====================================================================
-- İŞ AKIŞI
-- havuz -> planlandi -> sahada -> tamamlandi -> fis_kesildi
--   planlandi/sahada -> havuz (geri al), havuz/planlandi/sahada -> iptal
-- =====================================================================

CREATE FUNCTION is_getir_kilitli(p_is_id bigint) RETURNS isler
LANGUAGE plpgsql AS $$
DECLARE r isler;
BEGIN
    SELECT * INTO r FROM isler WHERE id = p_is_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('IS_YOK', 'İş bulunamadı: ' || p_is_id); END IF;
    RETURN r;
END $$;

-- Yeni iş. Plan tarihi verilirse doğrudan takvime ("planlandi"), verilmezse havuza düşer.
CREATE FUNCTION is_olustur(
    p_baslik text,
    p_ham_mesaj text DEFAULT NULL,
    p_cari_id bigint DEFAULT NULL,
    p_adres text DEFAULT NULL,
    p_iletisim_ad text DEFAULT NULL,
    p_iletisim_tel text DEFAULT NULL,
    p_oncelik smallint DEFAULT 2,
    p_plan_baslangic timestamptz DEFAULT NULL,
    p_plan_bitis timestamptz DEFAULT NULL,
    p_ekip_id bigint DEFAULT NULL,
    p_aciklama text DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO isler (baslik, ham_mesaj, cari_id, adres, iletisim_ad, iletisim_tel, oncelik,
                       plan_baslangic, plan_bitis, ekip_id, aciklama, durum, olusturan_id)
    VALUES (p_baslik, p_ham_mesaj, p_cari_id, p_adres, p_iletisim_ad, p_iletisim_tel, p_oncelik,
            p_plan_baslangic, coalesce(p_plan_bitis, p_plan_baslangic + interval '2 hours'),
            p_ekip_id, p_aciklama,
            CASE WHEN p_plan_baslangic IS NULL THEN 'havuz' ELSE 'planlandi' END::is_durum,
            aktif_kullanici())
    RETURNING id INTO v_id;
    RETURN v_id;
END $$;

-- Havuzdan takvime yerleştirme veya planlı işi başka güne/ekibe taşıma
CREATE FUNCTION is_planla(p_is_id bigint, p_ekip_id bigint, p_baslangic timestamptz, p_bitis timestamptz DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r isler := is_getir_kilitli(p_is_id);
BEGIN
    IF r.durum NOT IN ('havuz', 'planlandi') THEN
        PERFORM hata('DURUM', 'Sadece havuzdaki veya planlı işler planlanabilir (şu an: ' || r.durum || ').');
    END IF;
    UPDATE isler SET durum = 'planlandi', ekip_id = p_ekip_id,
        plan_baslangic = p_baslangic,
        plan_bitis = coalesce(p_bitis, p_baslangic + coalesce(r.plan_bitis - r.plan_baslangic, interval '2 hours'))
    WHERE id = p_is_id;
END $$;

-- İş iptal oldu/ertelendi: tarihi silinir, iş tüm geçmişi ve notlarıyla havuza döner
CREATE FUNCTION is_havuza_al(p_is_id bigint, p_neden text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r isler := is_getir_kilitli(p_is_id);
BEGIN
    IF r.durum NOT IN ('planlandi', 'sahada', 'iptal') THEN
        PERFORM hata('DURUM', 'Bu iş havuza alınamaz (şu an: ' || r.durum || ').');
    END IF;
    PERFORM set_config('app.gecmis_notu', coalesce('Havuza alındı: ' || p_neden, 'Havuza alındı'), true);
    UPDATE isler SET durum = 'havuz', plan_baslangic = NULL, plan_bitis = NULL, ekip_id = NULL,
        baslama_zamani = NULL, iptal_nedeni = NULL
    WHERE id = p_is_id;
    PERFORM set_config('app.gecmis_notu', '', true);
END $$;

CREATE FUNCTION is_iptal(p_is_id bigint, p_neden text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r isler := is_getir_kilitli(p_is_id);
BEGIN
    IF r.durum NOT IN ('havuz', 'planlandi', 'sahada') THEN
        PERFORM hata('DURUM', 'Bu iş iptal edilemez (şu an: ' || r.durum || ').');
    END IF;
    IF EXISTS (SELECT 1 FROM is_malzemeleri WHERE is_id = p_is_id) THEN
        PERFORM hata('MALZEME_VAR', 'İşte kullanılmış malzeme var. Önce malzemeleri çıkarın veya işi tamamlayın.');
    END IF;
    PERFORM set_config('app.gecmis_notu', 'İptal: ' || coalesce(p_neden, '-'), true);
    UPDATE isler SET durum = 'iptal', iptal_nedeni = p_neden WHERE id = p_is_id;
    PERFORM set_config('app.gecmis_notu', '', true);
END $$;

CREATE FUNCTION is_baslat(p_is_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r isler := is_getir_kilitli(p_is_id);
BEGIN
    IF r.durum <> 'planlandi' THEN
        PERFORM hata('DURUM', 'Sadece planlı işler başlatılabilir (şu an: ' || r.durum || ').');
    END IF;
    UPDATE isler SET durum = 'sahada', baslama_zamani = now() WHERE id = p_is_id;
END $$;

-- Müşteri imzası alınmadan iş tamamlanamaz
CREATE FUNCTION is_tamamla(p_is_id bigint, p_teknisyen_notu text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r isler := is_getir_kilitli(p_is_id);
BEGIN
    IF r.durum <> 'sahada' THEN
        PERFORM hata('DURUM', 'Sadece sahadaki işler tamamlanabilir (şu an: ' || r.durum || ').');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM teslim_onaylari WHERE is_id = p_is_id) THEN
        PERFORM hata('IMZA_YOK', 'İşi tamamlamak için müşteri teslim onayı (imza) gerekli.');
    END IF;
    UPDATE isler SET durum = 'tamamlandi', bitis_zamani = now(),
        teknisyen_notu = coalesce(p_teknisyen_notu, teknisyen_notu)
    WHERE id = p_is_id;
END $$;

-- =====================================================================
-- STOK
-- =====================================================================

-- Stok hareketi yazar, ürün stok miktarını günceller. Girişlerde ortalama maliyeti yeniden hesaplar.
CREATE FUNCTION stok_hareket(p_urun_id bigint, p_miktar numeric, p_birim_maliyet numeric,
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

    yeni_stok := u.stok_miktari + p_miktar;

    IF p_miktar > 0 AND p_kaynak IN ('alis', 'sayim', 'duzeltme') THEN
        -- Ağırlıklı ortalama maliyet. Stok sıfır/eksideyse yeni fiyat geçerli olur.
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

CREATE FUNCTION barkod_bul(p_barkod text) RETURNS bigint
LANGUAGE sql STABLE AS $$
    SELECT b.urun_id FROM urun_barkodlari b JOIN urunler u ON u.id = b.urun_id
    WHERE b.barkod = trim(p_barkod) AND u.aktif
$$;

-- =====================================================================
-- SAHADA MALZEME
-- =====================================================================

CREATE FUNCTION is_malzeme_ekle(p_is_id bigint, p_urun_id bigint, p_miktar numeric,
                                p_barkodla boolean DEFAULT false, p_sahada boolean DEFAULT true)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    r isler := is_getir_kilitli(p_is_id);
    v_maliyet numeric;
    v_hareket bigint;
    v_id bigint;
BEGIN
    IF r.durum NOT IN ('planlandi', 'sahada', 'tamamlandi') THEN
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

-- Teknisyen barkod okuttu. Tanımsızsa uygulama "BARKOD_TANIMSIZ" alır ve tanımsız ürün ekranını açar.
CREATE FUNCTION is_malzeme_ekle_barkod(p_is_id bigint, p_barkod text, p_miktar numeric DEFAULT 1)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE v_urun bigint := barkod_bul(p_barkod);
BEGIN
    IF v_urun IS NULL THEN
        PERFORM hata('BARKOD_TANIMSIZ', 'Bu barkod tanımlı değil: ' || p_barkod);
    END IF;
    RETURN is_malzeme_ekle(p_is_id, v_urun, p_miktar, true, true);
END $$;

-- Sahada tanımsız ürün: onay bekleyen ürün açılır, işe eklenir, yönetici sonra maliyetini girer
CREATE FUNCTION sahada_urun_tanimla(p_is_id bigint, p_ad text, p_miktar numeric,
                                    p_barkod text DEFAULT NULL, p_not text DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE v_urun bigint;
BEGIN
    INSERT INTO urunler (ad, onay_bekliyor, sahadan_not, olusturan_id)
    VALUES (p_ad, true, p_not, aktif_kullanici())
    RETURNING id INTO v_urun;
    IF nullif(trim(p_barkod), '') IS NOT NULL THEN
        INSERT INTO urun_barkodlari (barkod, urun_id) VALUES (trim(p_barkod), v_urun);
    END IF;
    RETURN is_malzeme_ekle(p_is_id, v_urun, p_miktar, p_barkod IS NOT NULL, true);
END $$;

-- Yönetici sahadan gelen ürünü onaylar; maliyeti henüz fişi kesilmemiş işlere de yansır
CREATE FUNCTION urun_onayla(p_urun_id bigint, p_birim_maliyet numeric, p_ad text DEFAULT NULL,
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
    WHERE m.is_id = i.id AND m.urun_id = p_urun_id AND m.birim_maliyet = 0
      AND i.durum <> 'fis_kesildi';

    UPDATE stok_hareketleri SET birim_maliyet = p_birim_maliyet
    WHERE urun_id = p_urun_id AND birim_maliyet = 0 AND kaynak = 'is_malzeme';

    -- Henüz onaylanmamış fişlerdeki satırlar da güncellenir (toplamlar tetikleyiciyle yeniden hesaplanır)
    UPDATE satis_fisi_satirlari s SET birim_maliyet = p_birim_maliyet
    FROM satis_fisleri f
    WHERE s.fis_id = f.id AND f.durum = 'taslak' AND s.urun_id = p_urun_id AND s.birim_maliyet = 0;
END $$;

-- Yanlış eklenen malzemeyi çıkar (fiş kesilmeden önce). Stok geri girer.
CREATE FUNCTION is_malzeme_cikar(p_malzeme_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    m is_malzemeleri;
    r isler;
BEGIN
    SELECT * INTO m FROM is_malzemeleri WHERE id = p_malzeme_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Malzeme kaydı bulunamadı.'); END IF;
    r := is_getir_kilitli(m.is_id);
    IF r.durum NOT IN ('planlandi', 'sahada', 'tamamlandi') THEN
        PERFORM hata('DURUM', 'Fişi kesilmiş işten malzeme çıkarılamaz.');
    END IF;
    PERFORM stok_hareket(m.urun_id, m.miktar, m.birim_maliyet, 'duzeltme', m.is_id,
                         'İş #' || m.is_id || ' malzeme iadesi');
    DELETE FROM is_malzemeleri WHERE id = p_malzeme_id;
END $$;

-- =====================================================================
-- CARİ
-- =====================================================================

CREATE FUNCTION cari_hareket_yaz(p_cari_id bigint, p_tarih date, p_vade date, p_tip cari_belge,
                                 p_belge_id bigint, p_belge_no text, p_aciklama text,
                                 p_borc numeric, p_alacak numeric)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO cari_hareketler (cari_id, tarih, vade, belge_tip, belge_id, belge_no, aciklama,
                                 borc, alacak, olusturan_id)
    VALUES (p_cari_id, p_tarih, p_vade, p_tip, p_belge_id, p_belge_no, p_aciklama,
            coalesce(p_borc, 0), coalesce(p_alacak, 0), aktif_kullanici())
    RETURNING id INTO v_id;
    RETURN v_id;
END $$;

CREATE FUNCTION cari_hareket_iptal(p_tip cari_belge, p_belge_id bigint) RETURNS void
LANGUAGE sql AS $$
    UPDATE cari_hareketler SET iptal = true, iptal_zamani = now()
    WHERE belge_tip = p_tip AND belge_id = p_belge_id AND NOT iptal
$$;

-- Eski programdan açılış bakiyesi aktarmak için.
-- p_tutar > 0: cari bize borçlu, p_tutar < 0: biz cariye borçluyuz
CREATE FUNCTION cari_devir_ekle(p_cari_id bigint, p_tutar numeric, p_tarih date DEFAULT current_date,
                                p_aciklama text DEFAULT 'Devir bakiyesi')
RETURNS bigint
LANGUAGE sql AS $$
    SELECT cari_hareket_yaz(p_cari_id, p_tarih, NULL, 'devir', NULL, NULL, p_aciklama,
                            greatest(p_tutar, 0), greatest(-p_tutar, 0))
$$;

-- =====================================================================
-- SATIŞ FİŞİ
-- =====================================================================

CREATE FUNCTION satis_fisi_toplam(p_fis_id bigint) RETURNS void
LANGUAGE sql AS $$
    WITH s AS (
        SELECT round(miktar * birim_fiyat * (1 - iskonto_orani / 100), 2) AS net,
               kdv_orani, miktar * birim_maliyet AS maliyet
        FROM satis_fisi_satirlari WHERE fis_id = p_fis_id
    ), t AS (
        SELECT coalesce(sum(net), 0) AS ara,
               coalesce(sum(round(net * kdv_orani / 100, 2)), 0) AS kdv,
               coalesce(round(sum(maliyet), 2), 0) AS maliyet
        FROM s
    )
    UPDATE satis_fisleri f SET ara_toplam = t.ara, kdv_toplam = t.kdv,
        genel_toplam = t.ara + t.kdv, maliyet_toplam = t.maliyet
    FROM t WHERE f.id = p_fis_id
$$;

CREATE FUNCTION trg_satis_satir() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_fis bigint := coalesce(NEW.fis_id, OLD.fis_id);
    v_durum belge_durum;
BEGIN
    SELECT durum INTO v_durum FROM satis_fisleri WHERE id = v_fis;
    IF v_durum <> 'taslak' AND coalesce(current_setting('app.sistem', true), '') <> '1' THEN
        PERFORM hata('FIS_KILITLI', 'Onaylanmış veya iptal edilmiş fişin satırları değiştirilemez.');
    END IF;
    PERFORM satis_fisi_toplam(v_fis);
    RETURN NULL;
END $$;
CREATE TRIGGER satir_degisti AFTER INSERT OR UPDATE OR DELETE ON satis_fisi_satirlari
    FOR EACH ROW EXECUTE FUNCTION trg_satis_satir();

-- Tamamlanan işten taslak fiş: kullanılan malzemeler maliyetleriyle gelir, sen satış fiyatını yazarsın
CREATE FUNCTION satis_fisi_isten_olustur(p_is_id bigint) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    r isler := is_getir_kilitli(p_is_id);
    v_fis bigint;
BEGIN
    IF r.durum <> 'tamamlandi' THEN
        PERFORM hata('DURUM', 'Fiş sadece tamamlanmış işten oluşturulabilir (şu an: ' || r.durum || ').');
    END IF;
    IF r.cari_id IS NULL THEN
        PERFORM hata('CARI_YOK', 'Fiş kesmek için işe bir cari (müşteri) bağlanmalı.');
    END IF;
    SELECT id INTO v_fis FROM satis_fisleri WHERE is_id = p_is_id AND durum = 'taslak';
    IF FOUND THEN RETURN v_fis; END IF;   -- zaten taslak varsa onu döndür

    INSERT INTO satis_fisleri (cari_id, is_id, aciklama, olusturan_id)
    VALUES (r.cari_id, p_is_id, 'İş #' || p_is_id || ' - ' || r.baslik, aktif_kullanici())
    RETURNING id INTO v_fis;

    INSERT INTO satis_fisi_satirlari (fis_id, sira, tip, urun_id, aciklama, miktar, birim, birim_fiyat,
                                      kdv_orani, birim_maliyet, stoktan_dus)
    SELECT v_fis, row_number() OVER (ORDER BY min(m.zaman)), 'urun', u.id, u.ad, sum(m.miktar), u.birim,
           coalesce(u.onerilen_satis, 0), u.kdv_orani,
           round(sum(m.miktar * m.birim_maliyet) / sum(m.miktar), 4), false
    FROM is_malzemeleri m JOIN urunler u ON u.id = m.urun_id
    WHERE m.is_id = p_is_id
    GROUP BY u.id;

    RETURN v_fis;
END $$;

CREATE FUNCTION satis_fisi_onayla(p_fis_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    f satis_fisleri;
    s record;
    v_maliyet numeric;
BEGIN
    SELECT * INTO f FROM satis_fisleri WHERE id = p_fis_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Fiş bulunamadı.'); END IF;
    IF f.durum <> 'taslak' THEN PERFORM hata('DURUM', 'Sadece taslak fiş onaylanabilir.'); END IF;
    IF NOT EXISTS (SELECT 1 FROM satis_fisi_satirlari WHERE fis_id = p_fis_id) THEN
        PERFORM hata('BOS_FIS', 'Fişte satır yok.');
    END IF;
    IF EXISTS (SELECT 1 FROM satis_fisi_satirlari sf JOIN urunler u ON u.id = sf.urun_id
               WHERE sf.fis_id = p_fis_id AND u.onay_bekliyor) THEN
        PERFORM hata('URUN_ONAYSIZ', 'Fişte onay bekleyen (maliyeti girilmemiş) ürün var.');
    END IF;

    PERFORM set_config('app.sistem', '1', true);
    -- İşe bağlı olmayan doğrudan satışlarda stok burada düşer
    FOR s IN SELECT * FROM satis_fisi_satirlari
             WHERE fis_id = p_fis_id AND tip = 'urun' AND stoktan_dus LOOP
        SELECT ort_maliyet INTO v_maliyet FROM urunler WHERE id = s.urun_id;
        PERFORM stok_hareket(s.urun_id, -s.miktar, v_maliyet, 'satis', p_fis_id, f.fis_no);
        UPDATE satis_fisi_satirlari SET birim_maliyet = v_maliyet WHERE id = s.id;
    END LOOP;
    PERFORM set_config('app.sistem', '', true);

    PERFORM satis_fisi_toplam(p_fis_id);
    SELECT * INTO f FROM satis_fisleri WHERE id = p_fis_id;

    UPDATE satis_fisleri SET durum = 'onaylandi', onay_zamani = now() WHERE id = p_fis_id;
    IF f.genel_toplam > 0 THEN
        PERFORM cari_hareket_yaz(f.cari_id, f.tarih, f.vade, 'satis_fisi', f.id, f.fis_no,
                                 coalesce(f.aciklama, 'Satış fişi'), f.genel_toplam, 0);
    END IF;
    IF f.is_id IS NOT NULL THEN
        UPDATE isler SET durum = 'fis_kesildi' WHERE id = f.is_id;
    END IF;
END $$;

CREATE FUNCTION satis_fisi_iptal(p_fis_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    f satis_fisleri;
    s record;
BEGIN
    SELECT * INTO f FROM satis_fisleri WHERE id = p_fis_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Fiş bulunamadı.'); END IF;
    IF f.durum = 'iptal' THEN RETURN; END IF;

    IF f.durum = 'onaylandi' THEN
        FOR s IN SELECT * FROM satis_fisi_satirlari
                 WHERE fis_id = p_fis_id AND tip = 'urun' AND stoktan_dus LOOP
            PERFORM stok_hareket(s.urun_id, s.miktar, s.birim_maliyet, 'duzeltme', p_fis_id,
                                 f.fis_no || ' iptal');
        END LOOP;
        PERFORM cari_hareket_iptal('satis_fisi', p_fis_id);
        IF f.is_id IS NOT NULL THEN
            UPDATE isler SET durum = 'tamamlandi' WHERE id = f.is_id;
        END IF;
    END IF;
    UPDATE satis_fisleri SET durum = 'iptal', iptal_zamani = now() WHERE id = p_fis_id;
END $$;

-- =====================================================================
-- ALIŞ FATURASI (maliyetin kaynağı)
-- =====================================================================

CREATE FUNCTION alis_faturasi_toplam(p_id bigint) RETURNS void
LANGUAGE sql AS $$
    WITH s AS (
        SELECT round(miktar * birim_fiyat, 2) AS net, kdv_orani
        FROM alis_faturasi_satirlari WHERE fatura_id = p_id
    ), t AS (
        SELECT coalesce(sum(net), 0) AS ara, coalesce(sum(round(net * kdv_orani / 100, 2)), 0) AS kdv FROM s
    )
    UPDATE alis_faturalari a SET ara_toplam = t.ara, kdv_toplam = t.kdv, genel_toplam = t.ara + t.kdv
    FROM t WHERE a.id = p_id
$$;

CREATE FUNCTION trg_alis_satir() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_id bigint := coalesce(NEW.fatura_id, OLD.fatura_id);
BEGIN
    IF (SELECT durum FROM alis_faturalari WHERE id = v_id) <> 'taslak' THEN
        PERFORM hata('FATURA_KILITLI', 'Onaylanmış faturanın satırları değiştirilemez.');
    END IF;
    PERFORM alis_faturasi_toplam(v_id);
    RETURN NULL;
END $$;
CREATE TRIGGER satir_degisti AFTER INSERT OR UPDATE OR DELETE ON alis_faturasi_satirlari
    FOR EACH ROW EXECUTE FUNCTION trg_alis_satir();

CREATE FUNCTION alis_faturasi_onayla(p_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    a alis_faturalari;
    s record;
BEGIN
    SELECT * INTO a FROM alis_faturalari WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Fatura bulunamadı.'); END IF;
    IF a.durum <> 'taslak' THEN PERFORM hata('DURUM', 'Sadece taslak fatura onaylanabilir.'); END IF;
    IF NOT EXISTS (SELECT 1 FROM alis_faturasi_satirlari WHERE fatura_id = p_id) THEN
        PERFORM hata('BOS_FATURA', 'Faturada satır yok.');
    END IF;

    FOR s IN SELECT * FROM alis_faturasi_satirlari WHERE fatura_id = p_id ORDER BY id LOOP
        PERFORM stok_hareket(s.urun_id, s.miktar, s.birim_fiyat, 'alis', p_id, a.belge_no);
        -- Sahadan gelen, onay bekleyen ürün faturayla netleşmiş olur
        UPDATE urunler SET onay_bekliyor = false WHERE id = s.urun_id AND onay_bekliyor;
    END LOOP;

    PERFORM alis_faturasi_toplam(p_id);
    SELECT * INTO a FROM alis_faturalari WHERE id = p_id;
    UPDATE alis_faturalari SET durum = 'onaylandi', onay_zamani = now() WHERE id = p_id;
    PERFORM cari_hareket_yaz(a.cari_id, a.tarih, a.vade, 'alis_faturasi', a.id, a.belge_no,
                             coalesce(a.aciklama, 'Alış faturası'), 0, a.genel_toplam);
END $$;

CREATE FUNCTION alis_faturasi_iptal(p_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    a alis_faturalari;
    s record;
    u urunler;
    kalan numeric;
BEGIN
    SELECT * INTO a FROM alis_faturalari WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Fatura bulunamadı.'); END IF;
    IF a.durum = 'iptal' THEN RETURN; END IF;

    IF a.durum = 'onaylandi' THEN
        FOR s IN SELECT * FROM alis_faturasi_satirlari WHERE fatura_id = p_id LOOP
            SELECT * INTO u FROM urunler WHERE id = s.urun_id FOR UPDATE;
            kalan := u.stok_miktari - s.miktar;
            -- Ortalama maliyetten bu alışın etkisini geri çıkar
            IF kalan > 0 THEN
                UPDATE urunler SET ort_maliyet =
                    greatest(round((u.stok_miktari * u.ort_maliyet - s.miktar * s.birim_fiyat) / kalan, 4), 0)
                WHERE id = s.urun_id;
            END IF;
            PERFORM stok_hareket(s.urun_id, -s.miktar, s.birim_fiyat, 'duzeltme', p_id, a.belge_no || ' iptal');
        END LOOP;
        PERFORM cari_hareket_iptal('alis_faturasi', p_id);
    END IF;
    UPDATE alis_faturalari SET durum = 'iptal', iptal_zamani = now() WHERE id = p_id;
END $$;

-- =====================================================================
-- KASA / BANKA
-- =====================================================================

-- Müşteriden tahsilat: kasa/banka artar, cari alacaklanır (borcu azalır)
CREATE FUNCTION tahsilat_ekle(p_cari_id bigint, p_hesap_id bigint, p_tutar numeric,
                              p_tarih date DEFAULT current_date, p_aciklama text DEFAULT NULL,
                              p_belge_no text DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO finans_hareketleri (hesap_id, tarih, tip, tutar, cari_id, belge_no, aciklama, olusturan_id)
    VALUES (p_hesap_id, p_tarih, 'tahsilat', p_tutar, p_cari_id, p_belge_no, p_aciklama, aktif_kullanici())
    RETURNING id INTO v_id;
    PERFORM cari_hareket_yaz(p_cari_id, p_tarih, NULL, 'tahsilat', v_id, p_belge_no,
                             coalesce(p_aciklama, 'Tahsilat'), 0, p_tutar);
    RETURN v_id;
END $$;

-- Tedarikçiye ödeme: kasa/banka azalır, cari borçlanır (bizim borcumuz azalır)
CREATE FUNCTION odeme_ekle(p_cari_id bigint, p_hesap_id bigint, p_tutar numeric,
                           p_tarih date DEFAULT current_date, p_aciklama text DEFAULT NULL,
                           p_belge_no text DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO finans_hareketleri (hesap_id, tarih, tip, tutar, cari_id, belge_no, aciklama, olusturan_id)
    VALUES (p_hesap_id, p_tarih, 'odeme', p_tutar, p_cari_id, p_belge_no, p_aciklama, aktif_kullanici())
    RETURNING id INTO v_id;
    PERFORM cari_hareket_yaz(p_cari_id, p_tarih, NULL, 'odeme', v_id, p_belge_no,
                             coalesce(p_aciklama, 'Ödeme'), p_tutar, 0);
    RETURN v_id;
END $$;

CREATE FUNCTION masraf_ekle(p_hesap_id bigint, p_tutar numeric, p_aciklama text,
                            p_tarih date DEFAULT current_date)
RETURNS bigint
LANGUAGE sql AS $$
    INSERT INTO finans_hareketleri (hesap_id, tarih, tip, tutar, aciklama, olusturan_id)
    VALUES (p_hesap_id, p_tarih, 'masraf', p_tutar, p_aciklama, aktif_kullanici())
    RETURNING id
$$;

CREATE FUNCTION virman(p_kaynak bigint, p_hedef bigint, p_tutar numeric,
                       p_tarih date DEFAULT current_date, p_aciklama text DEFAULT 'Virman')
RETURNS void
LANGUAGE sql AS $$
    INSERT INTO finans_hareketleri (hesap_id, tarih, tip, tutar, aciklama, olusturan_id) VALUES
        (p_kaynak, p_tarih, 'virman_cikis', p_tutar, p_aciklama, aktif_kullanici()),
        (p_hedef,  p_tarih, 'virman_giris', p_tutar, p_aciklama, aktif_kullanici())
$$;

CREATE FUNCTION finans_iptal(p_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE f finans_hareketleri;
BEGIN
    SELECT * INTO f FROM finans_hareketleri WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Kayıt bulunamadı.'); END IF;
    IF f.iptal THEN RETURN; END IF;
    UPDATE finans_hareketleri SET iptal = true, iptal_zamani = now() WHERE id = p_id;
    IF f.tip = 'tahsilat' THEN PERFORM cari_hareket_iptal('tahsilat', p_id);
    ELSIF f.tip = 'odeme' THEN PERFORM cari_hareket_iptal('odeme', p_id);
    END IF;
END $$;
