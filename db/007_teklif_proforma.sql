-- =====================================================================
-- Servis Takip (7): Teklif ve proforma fatura
-- Teklif/proforma stoğu ve cariyi ETKİLEMEZ. Kabul edilince satış fişine dönüştürülür.
-- =====================================================================

CREATE TYPE teklif_tur   AS ENUM ('teklif', 'proforma');
CREATE TYPE teklif_durum AS ENUM ('taslak', 'gonderildi', 'kabul', 'red', 'iptal');

CREATE SEQUENCE teklif_no_seq;
CREATE SEQUENCE proforma_no_seq;

CREATE TABLE teklifler (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tur             teklif_tur NOT NULL DEFAULT 'teklif',
    belge_no        text UNIQUE,
    cari_id         bigint NOT NULL REFERENCES cariler(id),
    tarih           date NOT NULL DEFAULT current_date,
    gecerlilik      date,                       -- teklifin geçerlilik tarihi (isteğe bağlı)
    durum           teklif_durum NOT NULL DEFAULT 'taslak',
    giris_metni     text,
    kapanis_metni   text,
    aciklama        text,                       -- sadece içeride görünen not
    kase_imza       boolean NOT NULL DEFAULT true,
    ara_toplam      numeric(14,2) NOT NULL DEFAULT 0,
    kdv_toplam      numeric(14,2) NOT NULL DEFAULT 0,
    genel_toplam    numeric(14,2) NOT NULL DEFAULT 0,
    kaynak_teklif_id bigint REFERENCES teklifler(id),   -- tekliften kopyalanan proforma
    fis_id          bigint REFERENCES satis_fisleri(id), -- dönüştürülen satış fişi
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON teklifler (cari_id, tarih);
CREATE INDEX ON teklifler (tur, tarih);

CREATE TABLE teklif_satirlari (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    teklif_id       bigint NOT NULL REFERENCES teklifler(id),
    sira            int NOT NULL DEFAULT 0,
    urun_id         bigint REFERENCES urunler(id),       -- boşsa serbest metin (hizmet vb.)
    aciklama        text NOT NULL,
    notu            text,
    miktar          numeric(14,3) NOT NULL DEFAULT 1 CHECK (miktar > 0),
    birim           text NOT NULL DEFAULT 'adet',
    birim_fiyat     numeric(14,2) NOT NULL DEFAULT 0 CHECK (birim_fiyat >= 0),  -- KDV hariç
    iskonto_orani   numeric(5,2) NOT NULL DEFAULT 0 CHECK (iskonto_orani BETWEEN 0 AND 100),
    kdv_orani       numeric(5,2) NOT NULL DEFAULT 20
);
CREATE INDEX ON teklif_satirlari (teklif_id);

-- Belge numarası: TK-2026-0001 / PF-2026-0001
CREATE FUNCTION trg_teklif_no() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.belge_no IS NULL THEN
        NEW.belge_no := CASE NEW.tur WHEN 'teklif' THEN 'TK-' ELSE 'PF-' END
            || to_char(NEW.tarih, 'YYYY') || '-'
            || lpad((CASE NEW.tur WHEN 'teklif' THEN nextval('teklif_no_seq') ELSE nextval('proforma_no_seq') END)::text, 4, '0');
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER teklif_no BEFORE INSERT ON teklifler FOR EACH ROW EXECUTE FUNCTION trg_teklif_no();

-- Ürün satırında ad stok kartından gelir (fişteki kuralla aynı)
CREATE FUNCTION trg_teklif_satir_urun_adi() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.urun_id IS NOT NULL THEN
        SELECT ad INTO NEW.aciklama FROM urunler WHERE id = NEW.urun_id;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER satir_urun_adi BEFORE INSERT OR UPDATE ON teklif_satirlari
    FOR EACH ROW EXECUTE FUNCTION trg_teklif_satir_urun_adi();

CREATE FUNCTION teklif_toplam(p_id bigint) RETURNS void
LANGUAGE sql AS $$
    WITH s AS (
        SELECT round(miktar * birim_fiyat * (1 - iskonto_orani / 100), 2) AS net, kdv_orani
        FROM teklif_satirlari WHERE teklif_id = p_id
    ), t AS (
        SELECT coalesce(sum(net), 0) AS ara, coalesce(sum(round(net * kdv_orani / 100, 2)), 0) AS kdv FROM s
    )
    UPDATE teklifler x SET ara_toplam = t.ara, kdv_toplam = t.kdv, genel_toplam = t.ara + t.kdv FROM t WHERE x.id = p_id
$$;

CREATE FUNCTION trg_teklif_satir() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM teklif_toplam(coalesce(NEW.teklif_id, OLD.teklif_id));
    RETURN NULL;
END $$;
CREATE TRIGGER satir_degisti AFTER INSERT OR UPDATE OR DELETE ON teklif_satirlari
    FOR EACH ROW EXECUTE FUNCTION trg_teklif_satir();

-- Kabul edilen teklif/proformadan taslak satış fişi
CREATE FUNCTION teklifi_fise_donustur(p_id bigint) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    t teklifler;
    v_fis bigint;
BEGIN
    SELECT * INTO t FROM teklifler WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Teklif bulunamadı.'); END IF;
    IF t.durum = 'iptal' THEN PERFORM hata('DURUM', 'İptal edilmiş belge dönüştürülemez.'); END IF;
    IF t.fis_id IS NOT NULL AND EXISTS (SELECT 1 FROM satis_fisleri WHERE id = t.fis_id AND durum <> 'iptal') THEN
        RETURN t.fis_id;   -- zaten dönüştürülmüş
    END IF;
    IF NOT EXISTS (SELECT 1 FROM teklif_satirlari WHERE teklif_id = p_id) THEN
        PERFORM hata('BOS', 'Belgede satır yok.');
    END IF;

    INSERT INTO satis_fisleri (cari_id, aciklama, olusturan_id)
    VALUES (t.cari_id, t.belge_no || ' numaralı ' || CASE t.tur WHEN 'teklif' THEN 'tekliften' ELSE 'proformadan' END, aktif_kullanici())
    RETURNING id INTO v_fis;

    INSERT INTO satis_fisi_satirlari (fis_id, sira, tip, urun_id, aciklama, notu, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani, stoktan_dus)
    SELECT v_fis, s.sira, CASE WHEN s.urun_id IS NULL THEN 'hizmet' ELSE 'urun' END::satir_tip, s.urun_id, s.aciklama, s.notu,
           s.miktar, s.birim, s.birim_fiyat, s.iskonto_orani, s.kdv_orani, true
    FROM teklif_satirlari s WHERE s.teklif_id = p_id ORDER BY s.sira, s.id;

    UPDATE teklifler SET fis_id = v_fis, durum = 'kabul' WHERE id = p_id;
    RETURN v_fis;
END $$;

-- Teklifi proformaya (veya tersi) kopyala
CREATE FUNCTION teklif_kopyala(p_id bigint, p_tur teklif_tur) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    t teklifler;
    v_id bigint;
BEGIN
    SELECT * INTO t FROM teklifler WHERE id = p_id;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Teklif bulunamadı.'); END IF;
    INSERT INTO teklifler (tur, cari_id, giris_metni, kapanis_metni, aciklama, kase_imza, kaynak_teklif_id, olusturan_id)
    VALUES (p_tur, t.cari_id,
            CASE WHEN p_tur = t.tur THEN t.giris_metni END, CASE WHEN p_tur = t.tur THEN t.kapanis_metni END,
            t.aciklama, t.kase_imza, p_id, aktif_kullanici())
    RETURNING id INTO v_id;
    INSERT INTO teklif_satirlari (teklif_id, sira, urun_id, aciklama, notu, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani)
    SELECT v_id, sira, urun_id, aciklama, notu, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani
    FROM teklif_satirlari WHERE teklif_id = p_id ORDER BY sira, id;
    RETURN v_id;
END $$;

-- Denetim kaydı ve silme engeli
CREATE TRIGGER denetim AFTER INSERT OR UPDATE OR DELETE ON teklifler FOR EACH ROW EXECUTE FUNCTION trg_denetim();
CREATE TRIGGER denetim AFTER INSERT OR UPDATE OR DELETE ON teklif_satirlari FOR EACH ROW EXECUTE FUNCTION trg_denetim();
CREATE TRIGGER silme_engeli BEFORE DELETE ON teklifler FOR EACH ROW EXECUTE FUNCTION trg_silme_engeli();

-- Fiyatlandırma bekleyen işler: tamamlanmış ama onaylı fişi olmayan
CREATE VIEW v_fiyatlandirma_bekleyen AS
SELECT i.id, i.baslik, i.cari_id, c.unvan, i.ekip_id, e.ad AS ekip, e.renk AS ekip_renk,
       i.bitis_zamani, now() - i.bitis_zamani AS bekleme,
       coalesce(m.kalem, 0) AS malzeme_kalem, coalesce(m.maliyet, 0) AS malzeme_maliyeti, coalesce(m.onaysiz, 0) AS onaysiz_urun,
       f.id AS taslak_fis_id, f.fis_no AS taslak_fis_no, f.genel_toplam AS taslak_toplam
FROM isler i
LEFT JOIN cariler c ON c.id = i.cari_id
LEFT JOIN ekipler e ON e.id = i.ekip_id
LEFT JOIN LATERAL (
    SELECT count(*) AS kalem, round(sum(mz.miktar * mz.birim_maliyet), 2) AS maliyet, count(*) FILTER (WHERE u.onay_bekliyor) AS onaysiz
    FROM is_malzemeleri mz JOIN urunler u ON u.id = mz.urun_id WHERE mz.is_id = i.id
) m ON true
LEFT JOIN LATERAL (
    SELECT id, fis_no, genel_toplam FROM satis_fisleri WHERE is_id = i.id AND durum = 'taslak' ORDER BY id DESC LIMIT 1
) f ON true
WHERE i.durum = 'tamamlandi';

-- Firma ayarlarına yeni alanlar
INSERT INTO ayarlar (anahtar, deger) VALUES
    ('firma_web', ''), ('firma_gsm', ''), ('firma_vergi_dairesi', ''), ('firma_vergi_no', ''), ('firma_logo', ''), ('kase_imza', ''), ('teklif_serit', ''),
    ('teklif_giris', 'Yapmış olduğumuz görüşmeler sonrasında hazırlamış olduğumuz fiyat teklifimizi değerlendirmenize sunarız.'),
    ('teklif_kapanis', 'Teklifimiz ile ilgili sorularınızı cevaplandırmaya hazır olduğumuzu belirtir, çalışmalarınızda başarılar dileriz.')
ON CONFLICT (anahtar) DO NOTHING;
