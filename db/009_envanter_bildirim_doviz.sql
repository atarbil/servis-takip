-- =====================================================================
-- Servis Takip (9): Müşteri envanteri, Telegram bildirim tercihleri, dövizli fiyatlandırma
-- =====================================================================

-- ---------- Müşteri envanteri: kurumda hangi cihaz var ----------
CREATE TABLE envanter (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cari_id         bigint NOT NULL REFERENCES cariler(id),
    tur             text NOT NULL,                 -- Kamera, DVR/NVR, Bilgisayar, Yazıcı, POS...
    marka           text,
    model           text,
    seri_no         text,
    konum           text,                          -- "Muhasebe odası", "2. kat koridor"
    ip_adresi       text,
    kurulum_tarihi  date,
    garanti_bitis   date,
    notlar          text,
    erisim_bilgisi  text,                          -- kullanıcı adı / şifre vb. — SADECE yönetici görür
    durum           text NOT NULL DEFAULT 'aktif' CHECK (durum IN ('aktif', 'arizali', 'kaldirildi')),
    urun_id         bigint REFERENCES urunler(id),  -- stok kartıyla eşleşiyorsa
    kaynak_is_id    bigint REFERENCES isler(id),    -- hangi işte kuruldu
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now(),
    guncelleme      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON envanter (cari_id);
CREATE INDEX ON envanter (garanti_bitis);
CREATE INDEX ON envanter (lower(seri_no));

CREATE TRIGGER guncelleme BEFORE UPDATE ON envanter FOR EACH ROW EXECUTE FUNCTION trg_guncelleme_zamani();
CREATE TRIGGER denetim AFTER INSERT OR UPDATE OR DELETE ON envanter FOR EACH ROW EXECUTE FUNCTION trg_denetim();
CREATE TRIGGER silme_engeli BEFORE DELETE ON envanter FOR EACH ROW EXECUTE FUNCTION trg_silme_engeli();

-- İşin ilgili olduğu cihaz (isteğe bağlı)
ALTER TABLE isler ADD COLUMN envanter_id bigint REFERENCES envanter(id);

-- ---------- Telegram bildirim tercihleri ----------
ALTER TABLE kullanicilar ADD COLUMN bildirimler jsonb NOT NULL
    DEFAULT '{"is_tamamlandi": true, "urun_onay": true, "sabah": true, "aksam": true}'::jsonb;

INSERT INTO ayarlar (anahtar, deger) VALUES
    ('bildirim_sabah_saat', '08:30'), ('bildirim_aksam_saat', '19:00'),
    ('telegram_sabah_son', ''), ('telegram_aksam_son', '')
ON CONFLICT (anahtar) DO NOTHING;

-- ---------- Dövizli fiyatlandırma ----------
-- Ürünün satış fiyatı hangi para biriminde (onerilen_satis bu para birimindeki tutardır)
ALTER TABLE urunler ADD COLUMN satis_doviz text NOT NULL DEFAULT 'TRY' CHECK (satis_doviz IN ('TRY', 'USD', 'EUR'));

-- Satış fişi satırı: TL fiyat (birim_fiyat) dövizden hesaplandıysa kaynak bilgisi
ALTER TABLE satis_fisi_satirlari ADD COLUMN doviz text CHECK (doviz IN ('USD', 'EUR'));
ALTER TABLE satis_fisi_satirlari ADD COLUMN doviz_fiyat numeric(14,4);
ALTER TABLE satis_fisi_satirlari ADD COLUMN kur numeric(12,4);

-- Alış faturası: dövizli girilebilir; satırların TL fiyatı (birim_fiyat) fatura kuruyla hesaplanır
ALTER TABLE alis_faturalari ADD COLUMN doviz text NOT NULL DEFAULT 'TRY' CHECK (doviz IN ('TRY', 'USD', 'EUR'));
ALTER TABLE alis_faturalari ADD COLUMN kur numeric(12,4);
ALTER TABLE alis_faturasi_satirlari ADD COLUMN doviz_fiyat numeric(14,4);

-- Teklif / proforma: belge para birimi (fiyatlar ve toplamlar bu para biriminde)
ALTER TABLE teklifler ADD COLUMN doviz text NOT NULL DEFAULT 'TRY' CHECK (doviz IN ('TRY', 'USD', 'EUR'));
ALTER TABLE teklifler ADD COLUMN kur numeric(12,4);                       -- 1 birim döviz = ? TL (bilgi ve dönüşüm için)
ALTER TABLE teklifler ADD COLUMN tl_karsilik_goster boolean NOT NULL DEFAULT false;

-- Dövizli teklif/proforma fişe dönüştürülürken seçilen kurla TL'ye çevrilir (cari her zaman TL)
DROP FUNCTION teklifi_fise_donustur(bigint);
CREATE FUNCTION teklifi_fise_donustur(p_id bigint, p_kur numeric DEFAULT NULL) RETURNS bigint
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
    SELECT v_fis, s.sira, CASE WHEN s.urun_id IS NULL THEN 'hizmet' ELSE 'urun' END::satir_tip, s.urun_id, s.aciklama, s.notu,
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

-- Teklif kopyalanınca para birimi ve kur da kopyalanır
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
    INSERT INTO teklif_satirlari (teklif_id, sira, urun_id, aciklama, notu, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani)
    SELECT v_id, sira, urun_id, aciklama, notu, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani
    FROM teklif_satirlari WHERE teklif_id = p_id ORDER BY sira, id;
    RETURN v_id;
END $$;

-- Taslak fişlerde dövizli ürün satırlarını TL'ye çevirir.
-- Sadece fiyatı otomatik gelmiş (0 veya ürünün döviz tutarına eşit) ve henüz kuru yazılmamış satırlar etkilenir.
-- Kur yoksa fiyat 0 bırakılır, döviz tutarı satırda saklanır (fiyatlandırmada görünür).
CREATE FUNCTION fis_doviz_uygula(p_fis_id bigint, p_usd numeric, p_eur numeric, p_urun_id bigint DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE v_adet integer;
BEGIN
    UPDATE satis_fisi_satirlari s SET
        doviz = u.satis_doviz,
        doviz_fiyat = u.onerilen_satis,
        kur = k.kur,
        birim_fiyat = CASE WHEN k.kur IS NULL THEN 0 ELSE round(u.onerilen_satis * k.kur, 2) END
    FROM urunler u, satis_fisleri f,
         LATERAL (SELECT CASE u.satis_doviz WHEN 'USD' THEN nullif(p_usd, 0) WHEN 'EUR' THEN nullif(p_eur, 0) END AS kur) k
    WHERE s.urun_id = u.id AND f.id = s.fis_id AND f.durum = 'taslak'
      AND (p_fis_id IS NULL OR s.fis_id = p_fis_id) AND (p_urun_id IS NULL OR s.urun_id = p_urun_id)
      AND u.satis_doviz <> 'TRY' AND u.onerilen_satis IS NOT NULL
      AND s.doviz IS NULL AND (s.birim_fiyat = 0 OR s.birim_fiyat = u.onerilen_satis);
    GET DIAGNOSTICS v_adet = ROW_COUNT;
    RETURN v_adet;
END $$;
