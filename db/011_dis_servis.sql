-- =====================================================================
-- Dış servis: müşteriden alınıp tamire (dış servise) gönderilen cihazlar. Sade takip.
-- Durum: dis_serviste -> geldi -> teslim_edildi. Cari/stok etkisi yoktur; ücret bilgi amaçlıdır.
-- =====================================================================

CREATE TABLE dis_servis (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cari_id         bigint NOT NULL REFERENCES cariler(id),
    cihaz           text NOT NULL,             -- tür: Dizüstü, NVR, Yazıcı…
    marka_model     text,
    seri_no         text,
    ariza           text,
    aksesuar        text,                      -- yanında verilenler
    servis_yeri     text NOT NULL,             -- gönderilen dış servis
    gonderim_tarihi date NOT NULL DEFAULT current_date,
    gelis_tarihi    date,
    teslim_tarihi   date,
    durum           text NOT NULL DEFAULT 'dis_serviste' CHECK (durum IN ('dis_serviste', 'geldi', 'teslim_edildi')),
    ucret           numeric(14, 2),
    notlar          text,
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now(),
    guncelleme      timestamptz NOT NULL DEFAULT now(),
    silindi         timestamptz,
    CHECK (gelis_tarihi IS NULL OR gelis_tarihi >= gonderim_tarihi),
    CHECK (teslim_tarihi IS NULL OR teslim_tarihi >= coalesce(gelis_tarihi, gonderim_tarihi))
);
CREATE INDEX ON dis_servis (durum, gonderim_tarihi);
CREATE INDEX ON dis_servis (cari_id);
CREATE TRIGGER guncelleme BEFORE UPDATE ON dis_servis FOR EACH ROW EXECUTE FUNCTION trg_guncelleme_zamani();
CREATE TRIGGER denetim AFTER INSERT OR UPDATE OR DELETE ON dis_servis FOR EACH ROW EXECUTE FUNCTION trg_denetim();
ALTER TABLE dis_servis ENABLE ROW LEVEL SECURITY;
CREATE POLICY silinmemis ON dis_servis FOR ALL
    USING (silindi IS NULL OR current_setting('app.silinen_goster', true) = '1') WITH CHECK (true);

-- Durum değişimi: tarihler kendiliğinden yazılır, geri adım tarihleri temizler
CREATE FUNCTION dis_servis_durum(p_id bigint, p_durum text, p_tarih date DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE d dis_servis; v_t date := coalesce(p_tarih, current_date);
BEGIN
    SELECT * INTO d FROM dis_servis WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM hata('YOK', 'Kayıt bulunamadı.'); END IF;
    IF p_durum = 'dis_serviste' THEN
        UPDATE dis_servis SET durum = p_durum, gelis_tarihi = NULL, teslim_tarihi = NULL WHERE id = p_id;
    ELSIF p_durum = 'geldi' THEN
        IF v_t < d.gonderim_tarihi THEN PERFORM hata('TARIH', 'Geliş tarihi gönderim tarihinden önce olamaz.'); END IF;
        UPDATE dis_servis SET durum = p_durum, gelis_tarihi = v_t, teslim_tarihi = NULL WHERE id = p_id;
    ELSIF p_durum = 'teslim_edildi' THEN
        IF v_t < coalesce(d.gelis_tarihi, d.gonderim_tarihi) THEN PERFORM hata('TARIH', 'Teslim tarihi gelişten önce olamaz.'); END IF;
        UPDATE dis_servis SET durum = p_durum, gelis_tarihi = coalesce(d.gelis_tarihi, v_t), teslim_tarihi = v_t WHERE id = p_id;
    ELSE
        PERFORM hata('DURUM', 'Geçersiz durum.');
    END IF;
END $$;

-- ---------- Silme / geri alma: mevcut fonksiyonlar sarmalanır ----------
-- sil_ic içindeki özyinelemeli çağrılar ada göre çözüldüğü için yeni sarmalayıcıdan geçer.
ALTER FUNCTION sil_ic(text, bigint, jsonb) RENAME TO sil_ic_temel;
ALTER FUNCTION geri_al_ic(jsonb) RENAME TO geri_al_ic_temel;

CREATE FUNCTION sil_ic(p_tur text, p_id bigint, p_liste jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE l jsonb := p_liste; d dis_servis; v_unvan text; v_baslik text; x bigint;
BEGIN
    IF p_tur = 'dis_servis' THEN
        SELECT * INTO d FROM dis_servis WHERE id = p_id;
        IF NOT FOUND THEN PERFORM hata('YOK', 'Kayıt bulunamadı.'); END IF;
        IF d.silindi IS NOT NULL THEN RETURN l; END IF;
        SELECT unvan INTO v_unvan FROM cariler WHERE id = d.cari_id;
        UPDATE dis_servis SET silindi = now() WHERE id = p_id;
        v_baslik := 'Dış servis: ' || concat_ws(' ', d.cihaz, d.marka_model) || ' (' || v_unvan || ')';
        RETURN l || jsonb_build_object('tur', p_tur, 'id', p_id, 'baslik', v_baslik, 'mesaj', v_baslik || ' → ' || d.servis_yeri);
    END IF;
    IF p_tur = 'cari' AND EXISTS (SELECT 1 FROM cariler WHERE id = p_id AND silindi IS NULL) THEN
        FOR x IN SELECT id FROM dis_servis WHERE cari_id = p_id AND silindi IS NULL ORDER BY id LOOP
            l := sil_ic('dis_servis', x, l);
        END LOOP;
    END IF;
    RETURN sil_ic_temel(p_tur, p_id, l);
END $$;

CREATE FUNCTION geri_al_ic(x jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF x ->> 'tur' = 'dis_servis' THEN
        PERFORM cari_silinmis_mi((SELECT cari_id FROM dis_servis WHERE id = (x ->> 'id')::bigint));
        UPDATE dis_servis SET silindi = NULL WHERE id = (x ->> 'id')::bigint;
    ELSE
        PERFORM geri_al_ic_temel(x);
    END IF;
END $$;
