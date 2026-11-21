-- =====================================================================
-- Yöneticinin silme yetkisi ve "Silinenler" kutusu (30 gün geri alınabilir)
--
-- Kayıtlar fiziksel olarak silinmez; "silindi" zamanı yazılır ve satır güvenliği (RLS)
-- ile programın her yerinden (liste, rapor, görünüm) gizlenir. Silerken etkiler mevcut iptal
-- fonksiyonlarıyla geri alınır (cari, stok, kasa); geri alınınca yeniden uygulanır.
-- Uygulama sorguları "servis_uyg" rolüyle çalışır (sunucu her açılışta hazırlar, bkz. lib/sema.js);
-- şema dosyalarını uygulayan sahip rol RLS'den etkilenmez.
-- =====================================================================

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['isler', 'cariler', 'urunler', 'satis_fisleri', 'alis_faturalari', 'teklifler',
                             'finans_hareketleri', 'envanter', 'takvim_notlari', 'kullanicilar']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN silindi timestamptz', t);
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        -- Silinmiş satır sadece silme / geri alma işlemi sırasında görünür
        EXECUTE format($p$CREATE POLICY silinmemis ON %I FOR ALL
            USING (silindi IS NULL OR current_setting('app.silinen_goster', true) = '1')
            WITH CHECK (true)$p$, t);
    END LOOP;
END $$;

CREATE TABLE silinenler (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tur             text NOT NULL,
    kayit_id        bigint NOT NULL,
    baslik          text NOT NULL,
    ozet            jsonb NOT NULL DEFAULT '[]',   -- etkiler, insan okur
    bagli           jsonb NOT NULL DEFAULT '[]',   -- silinen kayıtlar (sırayla), geri almada tersten işlenir
    durum           text NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor', 'geri_alindi', 'kalici')),
    silen_id        bigint REFERENCES kullanicilar(id),
    zaman           timestamptz NOT NULL DEFAULT now(),
    islem_yapan_id  bigint REFERENCES kullanicilar(id),
    islem_zamani    timestamptz
);
CREATE INDEX ON silinenler (durum, zaman DESC);

CREATE FUNCTION tl_metin(n numeric) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT translate(to_char(coalesce(n, 0), 'FM999,999,999,990.00'), ',.', '.,') || ' ₺'
$$;

-- ---------- Tek kaydı sil (bağlı kayıtlarla birlikte); listeye ekleyip döndürür ----------
CREATE FUNCTION sil_ic(p_tur text, p_id bigint, p_liste jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    l jsonb := p_liste;
    v_mesaj text; v_baslik text; v_ek jsonb := '{}';
    n int; x bigint; v_bakiye numeric;
    f satis_fisleri; a alis_faturalari; t teklifler; fh finans_hareketleri; r isler; c cariler; u urunler;
    e envanter; tn takvim_notlari; k kullanicilar; m record;
    v_unvan text;
BEGIN
    IF p_tur = 'satis_fisi' THEN
        SELECT * INTO f FROM satis_fisleri WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Fiş bulunamadı.'); END IF;
        IF f.silindi IS NOT NULL THEN RETURN l; END IF;
        SELECT unvan INTO v_unvan FROM cariler WHERE id = f.cari_id;
        v_baslik := f.fis_no || ' satış fişi';
        IF f.durum = 'onaylandi' THEN
            SELECT count(*) INTO n FROM satis_fisi_satirlari WHERE fis_id = p_id AND tip = 'urun' AND stoktan_dus;
            v_mesaj := v_baslik || ' (onaylı): ' || v_unvan || ' carisinden ' || tl_metin(f.genel_toplam) || ' borç düşer'
                       || CASE WHEN n > 0 THEN ', ' || n || ' kalem stoğa döner' ELSE '' END;
        ELSE
            v_mesaj := v_baslik || CASE WHEN f.durum = 'taslak' THEN ' (taslak)' ELSE ' (iptal edilmiş)' END;
        END IF;
        IF f.durum <> 'iptal' THEN PERFORM satis_fisi_iptal(p_id); END IF;
        UPDATE satis_fisleri SET silindi = now() WHERE id = p_id;
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'onceki', f.durum::text, 'baslik', v_baslik, 'mesaj', v_mesaj);

    ELSIF p_tur = 'alis_faturasi' THEN
        SELECT * INTO a FROM alis_faturalari WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Fatura bulunamadı.'); END IF;
        IF a.silindi IS NOT NULL THEN RETURN l; END IF;
        SELECT unvan INTO v_unvan FROM cariler WHERE id = a.cari_id;
        v_baslik := a.belge_no || ' alış faturası';
        IF a.durum = 'onaylandi' THEN
            SELECT count(*) INTO n FROM alis_faturasi_satirlari WHERE fatura_id = p_id;
            v_mesaj := v_baslik || ' (onaylı): ' || v_unvan || ' alacağından ' || tl_metin(a.genel_toplam) || ' düşer, '
                       || n || ' kalem stoktan çıkar';
        ELSE
            v_mesaj := v_baslik || CASE WHEN a.durum = 'taslak' THEN ' (taslak)' ELSE ' (iptal edilmiş)' END;
        END IF;
        IF a.durum <> 'iptal' THEN PERFORM alis_faturasi_iptal(p_id); END IF;
        UPDATE alis_faturalari SET silindi = now() WHERE id = p_id;
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'onceki', a.durum::text, 'baslik', v_baslik, 'mesaj', v_mesaj);

    ELSIF p_tur = 'teklif' THEN
        SELECT * INTO t FROM teklifler WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Belge bulunamadı.'); END IF;
        IF t.silindi IS NOT NULL THEN RETURN l; END IF;
        v_baslik := t.belge_no || CASE WHEN t.tur = 'teklif' THEN ' teklif' ELSE ' proforma' END;
        UPDATE teklifler SET silindi = now() WHERE id = p_id;
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'baslik', v_baslik, 'mesaj', v_baslik);

    ELSIF p_tur = 'finans' THEN
        SELECT * INTO fh FROM finans_hareketleri WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Kayıt bulunamadı.'); END IF;
        IF fh.silindi IS NOT NULL THEN RETURN l; END IF;
        SELECT unvan INTO v_unvan FROM cariler WHERE id = fh.cari_id;
        v_baslik := CASE fh.tip WHEN 'tahsilat' THEN 'Tahsilat' WHEN 'odeme' THEN 'Ödeme' WHEN 'masraf' THEN 'Masraf' ELSE 'Virman' END
                    || ' ' || tl_metin(fh.tutar) || coalesce(' · ' || v_unvan, '') || ' (' || to_char(fh.tarih, 'DD.MM.YYYY') || ')';
        v_mesaj := v_baslik || CASE WHEN fh.iptal THEN ' (iptal edilmiş)'
                    WHEN fh.tip IN ('tahsilat', 'odeme') THEN ': kasa/banka ve cari bakiyesi düzelir'
                    ELSE ': kasa/banka bakiyesi düzelir' END;
        PERFORM finans_iptal(p_id);
        UPDATE finans_hareketleri SET silindi = now() WHERE id = p_id;
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'onceki', CASE WHEN fh.iptal THEN 'iptal' ELSE 'aktif' END,
                                     'baslik', v_baslik, 'mesaj', v_mesaj);
        -- Virmanın diğer bacağı da silinir
        IF fh.tip IN ('virman_giris', 'virman_cikis') THEN
            SELECT id INTO x FROM finans_hareketleri
            WHERE id <> p_id AND silindi IS NULL AND tutar = fh.tutar AND tarih = fh.tarih AND olusturma = fh.olusturma
              AND tip = CASE WHEN fh.tip = 'virman_giris' THEN 'virman_cikis'::finans_tip ELSE 'virman_giris'::finans_tip END
            LIMIT 1;
            IF x IS NOT NULL THEN
                SELECT * INTO fh FROM finans_hareketleri WHERE id = x;
                PERFORM finans_iptal(x);
                UPDATE finans_hareketleri SET silindi = now() WHERE id = x;
                l := l || jsonb_build_object('tur', 'finans', 'id', x, 'onceki', CASE WHEN fh.iptal THEN 'iptal' ELSE 'aktif' END, 'baslik', 'Virman karşı hesap');
            END IF;
        END IF;

    ELSIF p_tur = 'is' THEN
        SELECT * INTO r FROM isler WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'İş bulunamadı.'); END IF;
        IF r.silindi IS NOT NULL THEN RETURN l; END IF;
        FOR x IN SELECT id FROM satis_fisleri WHERE is_id = p_id AND silindi IS NULL ORDER BY id LOOP
            l := sil_ic('satis_fisi', x, l);
        END LOOP;
        SELECT * INTO r FROM isler WHERE id = p_id;
        n := 0;
        FOR m IN SELECT * FROM is_malzemeleri WHERE is_id = p_id ORDER BY id LOOP
            PERFORM stok_hareket(m.urun_id, m.miktar, m.birim_maliyet, 'duzeltme', p_id, 'İş #' || p_id || ' silindi');
            n := n + 1;
        END LOOP;
        v_baslik := 'İş #' || p_id || ' ' || r.baslik;
        v_mesaj := v_baslik || CASE WHEN n > 0 THEN ': sahada kullanılan ' || n || ' kalem malzeme stoğa döner' ELSE '' END;
        PERFORM set_config('app.gecmis_notu', 'Silindi', true);
        UPDATE isler SET durum = 'iptal', silindi = now() WHERE id = p_id;
        PERFORM set_config('app.gecmis_notu', '', true);
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'onceki', r.durum::text, 'baslik', v_baslik, 'mesaj', v_mesaj);

    ELSIF p_tur = 'cari' THEN
        SELECT * INTO c FROM cariler WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Cari bulunamadı.'); END IF;
        IF c.silindi IS NOT NULL THEN RETURN l; END IF;
        SELECT coalesce(sum(borc - alacak), 0) INTO v_bakiye FROM cari_hareketler WHERE cari_id = p_id AND NOT iptal;
        FOR x IN SELECT id FROM isler WHERE cari_id = p_id AND silindi IS NULL ORDER BY id LOOP l := sil_ic('is', x, l); END LOOP;
        FOR x IN SELECT id FROM satis_fisleri WHERE cari_id = p_id AND silindi IS NULL ORDER BY id LOOP l := sil_ic('satis_fisi', x, l); END LOOP;
        FOR x IN SELECT id FROM alis_faturalari WHERE cari_id = p_id AND silindi IS NULL ORDER BY id LOOP l := sil_ic('alis_faturasi', x, l); END LOOP;
        FOR x IN SELECT id FROM finans_hareketleri WHERE cari_id = p_id AND silindi IS NULL ORDER BY id LOOP l := sil_ic('finans', x, l); END LOOP;
        FOR x IN SELECT id FROM teklifler WHERE cari_id = p_id AND silindi IS NULL ORDER BY id LOOP l := sil_ic('teklif', x, l); END LOOP;
        FOR x IN SELECT id FROM envanter WHERE cari_id = p_id AND silindi IS NULL ORDER BY id LOOP l := sil_ic('envanter', x, l); END LOOP;
        -- Devir (açılış) bakiyesi
        SELECT coalesce(jsonb_agg(id), '[]'), count(*) INTO v_ek, n FROM cari_hareketler WHERE cari_id = p_id AND belge_tip = 'devir' AND NOT iptal;
        UPDATE cari_hareketler SET iptal = true, iptal_zamani = now() WHERE cari_id = p_id AND belge_tip = 'devir' AND NOT iptal;
        UPDATE cariler SET silindi = now() WHERE id = p_id;
        v_baslik := c.unvan || ' carisi';
        v_mesaj := v_baslik || CASE WHEN abs(v_bakiye) > 0.004 THEN ' (bakiye ' || tl_metin(abs(v_bakiye)) || CASE WHEN v_bakiye > 0 THEN ' borçlu' ELSE ' alacaklı' END || ')' ELSE '' END
                   || CASE WHEN n > 0 THEN ': devir bakiyesi kaldırılır' ELSE '' END;
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'baslik', v_baslik, 'mesaj', v_mesaj, 'devir', v_ek);

    ELSIF p_tur = 'urun' THEN
        SELECT * INTO u FROM urunler WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Ürün bulunamadı.'); END IF;
        IF u.silindi IS NOT NULL THEN RETURN l; END IF;
        -- Barkodlar boşa çıkar (başka ürüne verilebilsin); geri alınınca boştaysa geri gelir
        SELECT coalesce(jsonb_agg(barkod), '[]') INTO v_ek FROM urun_barkodlari WHERE urun_id = p_id;
        DELETE FROM urun_barkodlari WHERE urun_id = p_id;
        UPDATE urunler SET aktif = false, silindi = now() WHERE id = p_id;
        v_baslik := u.ad || ' ürünü';
        v_mesaj := v_baslik || CASE WHEN u.stok_miktari <> 0 THEN ' (stokta ' || trim(to_char(u.stok_miktari, 'FM999999990.##')) || ' ' || u.birim || ' görünüyordu)' ELSE '' END
                   || ': listelerden kalkar, eski belgelerde adı kalır';
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'onceki_aktif', u.aktif, 'barkodlar', v_ek, 'baslik', v_baslik, 'mesaj', v_mesaj);

    ELSIF p_tur = 'envanter' THEN
        SELECT * INTO e FROM envanter WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Kayıt bulunamadı.'); END IF;
        IF e.silindi IS NOT NULL THEN RETURN l; END IF;
        SELECT unvan INTO v_unvan FROM cariler WHERE id = e.cari_id;
        UPDATE isler SET envanter_id = NULL WHERE envanter_id = p_id;
        UPDATE envanter SET silindi = now() WHERE id = p_id;
        v_baslik := concat_ws(' ', e.tur, e.marka, e.model) || ' (' || v_unvan || ')';
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'baslik', v_baslik, 'mesaj', v_baslik || ' cihaz kaydı');

    ELSIF p_tur = 'takvim_notu' THEN
        SELECT * INTO tn FROM takvim_notlari WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Not bulunamadı.'); END IF;
        IF tn.silindi IS NOT NULL THEN RETURN l; END IF;
        UPDATE takvim_notlari SET silindi = now() WHERE id = p_id;
        v_baslik := 'Takvim notu: ' || tn.baslik;
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'baslik', v_baslik, 'mesaj', v_baslik);

    ELSIF p_tur = 'kullanici' THEN
        SELECT * INTO k FROM kullanicilar WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Kullanıcı bulunamadı.'); END IF;
        IF k.silindi IS NOT NULL THEN RETURN l; END IF;
        IF p_id = aktif_kullanici() THEN PERFORM hata('KENDINI_SILEMEZ', 'Kendi hesabınızı silemezsiniz.'); END IF;
        IF k.rol = 'yonetici' AND NOT EXISTS (SELECT 1 FROM kullanicilar WHERE id <> p_id AND rol = 'yonetici' AND aktif AND silindi IS NULL) THEN
            PERFORM hata('SON_YONETICI', 'Son yönetici silinemez.');
        END IF;
        DELETE FROM oturumlar WHERE kullanici_id = p_id;
        UPDATE kullanicilar SET aktif = false, silindi = now() WHERE id = p_id;
        v_baslik := k.ad_soyad || ' kullanıcısı';
        l := l || jsonb_build_object('tur', p_tur, 'id', p_id, 'onceki_aktif', k.aktif, 'baslik', v_baslik,
                                     'mesaj', v_baslik || ': programa giremez, açık oturumları kapanır');
    ELSE
        PERFORM hata('TUR', 'Bilinmeyen kayıt türü: ' || p_tur);
    END IF;
    RETURN l;
END $$;

-- ---------- Silme: Silinenler kutusuna yazar ----------
CREATE FUNCTION kayit_sil(p_tur text, p_id bigint) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE l jsonb; ana jsonb; v_id bigint; v_ozet jsonb;
BEGIN
    PERFORM set_config('app.silinen_goster', '1', true);
    l := sil_ic(p_tur, p_id, '[]'::jsonb);
    IF jsonb_array_length(l) = 0 THEN PERFORM hata('ZATEN_SILINDI', 'Bu kayıt zaten silinmiş.'); END IF;
    ana := l -> -1;
    SELECT coalesce(jsonb_agg(x -> 'mesaj' ORDER BY o DESC), '[]') INTO v_ozet
    FROM jsonb_array_elements(l) WITH ORDINALITY AS z(x, o) WHERE x ? 'mesaj';
    INSERT INTO silinenler (tur, kayit_id, baslik, ozet, bagli, silen_id)
    VALUES (p_tur, p_id, ana ->> 'baslik', v_ozet, l, aktif_kullanici()) RETURNING id INTO v_id;
    PERFORM set_config('app.silinen_goster', '', true);
    RETURN jsonb_build_object('silinen_id', v_id, 'baslik', ana ->> 'baslik', 'ozet', v_ozet, 'adet', jsonb_array_length(l));
END $$;

-- ---------- Geri alma ----------
CREATE FUNCTION cari_silinmis_mi(p_cari_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
    SELECT unvan INTO v FROM cariler WHERE id = p_cari_id AND silindi IS NOT NULL;
    IF FOUND THEN PERFORM hata('ONCE_CARI', 'Önce "' || v || '" carisini Silinenler''den geri alın.'); END IF;
END $$;

CREATE FUNCTION geri_al_ic(x jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_tur text := x ->> 'tur'; v_id bigint := (x ->> 'id')::bigint; v_onceki text := x ->> 'onceki';
    f satis_fisleri; a alis_faturalari; fh finans_hareketleri; r isler; m record; b text; v text;
BEGIN
    IF v_tur = 'satis_fisi' THEN
        SELECT * INTO f FROM satis_fisleri WHERE id = v_id;
        PERFORM cari_silinmis_mi(f.cari_id);
        IF f.is_id IS NOT NULL AND EXISTS (SELECT 1 FROM isler WHERE id = f.is_id AND silindi IS NOT NULL) THEN
            PERFORM hata('ONCE_IS', 'Önce iş #' || f.is_id || ' kaydını Silinenler''den geri alın.');
        END IF;
        UPDATE satis_fisleri SET silindi = NULL WHERE id = v_id;
        IF v_onceki IN ('onaylandi', 'taslak') THEN
            UPDATE satis_fisleri SET durum = 'taslak', iptal_zamani = NULL WHERE id = v_id;
            IF v_onceki = 'onaylandi' THEN PERFORM satis_fisi_onayla(v_id); END IF;
        END IF;
    ELSIF v_tur = 'alis_faturasi' THEN
        SELECT * INTO a FROM alis_faturalari WHERE id = v_id;
        PERFORM cari_silinmis_mi(a.cari_id);
        UPDATE alis_faturalari SET silindi = NULL WHERE id = v_id;
        IF v_onceki IN ('onaylandi', 'taslak') THEN
            UPDATE alis_faturalari SET durum = 'taslak', iptal_zamani = NULL WHERE id = v_id;
            IF v_onceki = 'onaylandi' THEN PERFORM alis_faturasi_onayla(v_id); END IF;
        END IF;
    ELSIF v_tur = 'teklif' THEN
        PERFORM cari_silinmis_mi((SELECT cari_id FROM teklifler WHERE id = v_id));
        UPDATE teklifler SET silindi = NULL WHERE id = v_id;
    ELSIF v_tur = 'finans' THEN
        SELECT * INTO fh FROM finans_hareketleri WHERE id = v_id;
        IF fh.cari_id IS NOT NULL THEN PERFORM cari_silinmis_mi(fh.cari_id); END IF;
        UPDATE finans_hareketleri SET silindi = NULL WHERE id = v_id;
        IF v_onceki = 'aktif' THEN
            UPDATE finans_hareketleri SET iptal = false, iptal_zamani = NULL WHERE id = v_id;
            IF fh.tip IN ('tahsilat', 'odeme') THEN
                UPDATE cari_hareketler SET iptal = false, iptal_zamani = NULL
                WHERE id = (SELECT id FROM cari_hareketler WHERE belge_tip = fh.tip::text::cari_belge AND belge_id = v_id AND iptal
                            ORDER BY id DESC LIMIT 1);
            END IF;
        END IF;
    ELSIF v_tur = 'is' THEN
        SELECT * INTO r FROM isler WHERE id = v_id;
        IF r.cari_id IS NOT NULL THEN PERFORM cari_silinmis_mi(r.cari_id); END IF;
        PERFORM set_config('app.gecmis_notu', 'Silinenlerden geri alındı', true);
        UPDATE isler SET durum = v_onceki::is_durum, silindi = NULL WHERE id = v_id;
        PERFORM set_config('app.gecmis_notu', '', true);
        FOR m IN SELECT * FROM is_malzemeleri WHERE is_id = v_id ORDER BY id LOOP
            PERFORM stok_hareket(m.urun_id, -m.miktar, m.birim_maliyet, 'duzeltme', v_id, 'İş #' || v_id || ' geri alındı');
        END LOOP;
    ELSIF v_tur = 'cari' THEN
        UPDATE cariler SET silindi = NULL WHERE id = v_id;
        UPDATE cari_hareketler SET iptal = false, iptal_zamani = NULL
        WHERE id IN (SELECT (j #>> '{}')::bigint FROM jsonb_array_elements(coalesce(x -> 'devir', '[]')) j);
    ELSIF v_tur = 'urun' THEN
        UPDATE urunler SET silindi = NULL, aktif = coalesce((x ->> 'onceki_aktif')::boolean, true) WHERE id = v_id;
        FOR b IN SELECT jsonb_array_elements_text(coalesce(x -> 'barkodlar', '[]')) LOOP
            INSERT INTO urun_barkodlari (barkod, urun_id) VALUES (b, v_id) ON CONFLICT DO NOTHING;
        END LOOP;
    ELSIF v_tur = 'envanter' THEN
        PERFORM cari_silinmis_mi((SELECT cari_id FROM envanter WHERE id = v_id));
        UPDATE envanter SET silindi = NULL WHERE id = v_id;
    ELSIF v_tur = 'takvim_notu' THEN
        UPDATE takvim_notlari SET silindi = NULL WHERE id = v_id;
    ELSIF v_tur = 'kullanici' THEN
        SELECT kullanici_adi INTO v FROM kullanicilar k WHERE id <> v_id AND silindi IS NULL
            AND lower(kullanici_adi) = (SELECT lower(kullanici_adi) FROM kullanicilar WHERE id = v_id);
        IF FOUND THEN PERFORM hata('AD_KULLANIMDA', '"' || v || '" kullanıcı adı başka bir hesapta kullanılıyor.'); END IF;
        UPDATE kullanicilar SET silindi = NULL, aktif = coalesce((x ->> 'onceki_aktif')::boolean, true) WHERE id = v_id;
    END IF;
END $$;

CREATE FUNCTION kayit_geri_al(p_silinen_id bigint) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE s silinenler; x jsonb;
BEGIN
    SELECT * INTO s FROM silinenler WHERE id = p_silinen_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Kayıt bulunamadı.'); END IF;
    IF s.durum <> 'bekliyor' THEN PERFORM hata('DURUM', 'Bu kayıt artık geri alınamaz.'); END IF;
    PERFORM set_config('app.silinen_goster', '1', true);
    FOR x IN SELECT z.x FROM jsonb_array_elements(s.bagli) WITH ORDINALITY AS z(x, o) ORDER BY z.o DESC LOOP
        PERFORM geri_al_ic(x);
    END LOOP;
    UPDATE silinenler SET durum = 'geri_alindi', islem_zamani = now(), islem_yapan_id = aktif_kullanici() WHERE id = p_silinen_id;
    PERFORM set_config('app.silinen_goster', '', true);
    RETURN s.baslik;
END $$;

-- Kalıcı silme: Silinenler'den de kalkar, geri alınamaz.
-- (Satırlar muhasebe bütünlüğü için veritabanında gizli kalır; programın hiçbir yerinde görünmez.)
CREATE FUNCTION kayit_kalici_sil(p_silinen_id bigint) RETURNS void
LANGUAGE sql AS $$
    UPDATE silinenler SET durum = 'kalici', islem_zamani = now(), islem_yapan_id = aktif_kullanici()
    WHERE id = p_silinen_id AND durum = 'bekliyor'
$$;

-- 30 günü dolanlar kalıcı olur (sunucu düzenli çağırır)
CREATE FUNCTION silinenleri_temizle() RETURNS integer
LANGUAGE sql AS $$
    WITH g AS (UPDATE silinenler SET durum = 'kalici', islem_zamani = now()
               WHERE durum = 'bekliyor' AND zaman < now() - interval '30 days' RETURNING 1)
    SELECT count(*)::int FROM g
$$;
