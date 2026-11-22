-- Form tasarımı: belge yazdırma şablonları.
-- Her belge türünün bir "Standart" (sistem) şablonu vardır: değiştirilemez, silinemez; ayarı boş = programdaki varsayılan.
-- Kullanıcı şablonları kopyalanarak/yeni oluşturularak düzenlenir. Her tür için tek varsayılan.
CREATE TABLE belge_sablonlari (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tur         text NOT NULL CHECK (tur IN ('teklif', 'proforma', 'satis_fisi', 'makbuz', 'teslim', 'dis_servis', 'ekstre')),
    ad          text NOT NULL CHECK (length(ad) BETWEEN 1 AND 60),
    ayar        jsonb NOT NULL DEFAULT '{}'::jsonb,
    sistem      boolean NOT NULL DEFAULT false,
    varsayilan  boolean NOT NULL DEFAULT false,
    olusturan_id bigint REFERENCES kullanicilar(id),
    olusturma   timestamptz NOT NULL DEFAULT now(),
    guncelleme  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX belge_sablonlari_tek_varsayilan ON belge_sablonlari (tur) WHERE varsayilan;
CREATE UNIQUE INDEX belge_sablonlari_tek_sistem ON belge_sablonlari (tur) WHERE sistem;

-- Her kayıtta önceki hali saklanır (son 10 sürüm)
CREATE TABLE belge_sablon_surumleri (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sablon_id   bigint NOT NULL REFERENCES belge_sablonlari(id) ON DELETE CASCADE,
    ad          text NOT NULL,
    ayar        jsonb NOT NULL,
    kullanici_id bigint REFERENCES kullanicilar(id),
    zaman       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON belge_sablon_surumleri (sablon_id, zaman DESC);

INSERT INTO belge_sablonlari (tur, ad, sistem, varsayilan)
SELECT t, 'Standart', true, true FROM unnest(ARRAY['teklif', 'proforma', 'satis_fisi', 'makbuz', 'teslim', 'dis_servis', 'ekstre']) t;

-- Şablonlarda kullanılan ürün bilgileri
ALTER TABLE urunler ADD COLUMN resim text;
ALTER TABLE urunler ADD COLUMN raf_yeri text;
