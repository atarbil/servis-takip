-- =====================================================================
-- Servis Takip - Veritabanı Şeması (1/3): Tablolar
-- PostgreSQL 16
--
-- Kurallar:
--  * Tutarlar numeric(14,2), miktarlar numeric(14,3), maliyetler numeric(14,4).
--  * Finansal kayıtlar SİLİNMEZ, iptal edilir (iptal = true / durum = 'iptal').
--  * Cari bakiye = SUM(borc - alacak). Pozitif => cari bize borçlu,
--    negatif => biz cariye borçluyuz.
-- =====================================================================

SET client_min_messages = warning;

-- ---------- Sabit listeler ----------
CREATE TYPE kullanici_rol AS ENUM ('yonetici', 'teknisyen');
CREATE TYPE cari_tip      AS ENUM ('musteri', 'tedarikci', 'her_ikisi');
CREATE TYPE is_durum      AS ENUM ('havuz', 'planlandi', 'sahada', 'tamamlandi', 'fis_kesildi', 'iptal');
CREATE TYPE belge_durum   AS ENUM ('taslak', 'onaylandi', 'iptal');
CREATE TYPE satir_tip     AS ENUM ('urun', 'iscilik', 'hizmet');
CREATE TYPE hesap_tip     AS ENUM ('kasa', 'banka', 'pos');
CREATE TYPE finans_tip    AS ENUM ('tahsilat', 'odeme', 'masraf', 'virman_giris', 'virman_cikis');
CREATE TYPE cari_belge    AS ENUM ('devir', 'satis_fisi', 'alis_faturasi', 'tahsilat', 'odeme', 'duzeltme');
CREATE TYPE stok_kaynak   AS ENUM ('alis', 'is_malzeme', 'satis', 'sayim', 'duzeltme');

-- ---------- Kullanıcılar ve ekipler ----------
CREATE TABLE ekipler (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad          text NOT NULL UNIQUE,
    renk        text NOT NULL DEFAULT '#2563eb',   -- takvimde görünen renk
    aktif       boolean NOT NULL DEFAULT true
);

CREATE TABLE kullanicilar (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad_soyad        text NOT NULL,
    kullanici_adi   text NOT NULL UNIQUE,
    sifre_hash      text NOT NULL,
    rol             kullanici_rol NOT NULL DEFAULT 'teknisyen',
    ekip_id         bigint REFERENCES ekipler(id),
    telefon         text,
    iki_adim_gizli  text,                -- TOTP anahtarı (opsiyonel)
    aktif           boolean NOT NULL DEFAULT true,
    son_giris       timestamptz,
    olusturma       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oturumlar (
    token_hash      text PRIMARY KEY,    -- tarayıcıdaki token'ın SHA-256 özeti
    kullanici_id    bigint NOT NULL REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now(),
    son_kullanma    timestamptz NOT NULL,
    ip              inet,
    tarayici        text
);
CREATE INDEX ON oturumlar (kullanici_id);

-- ---------- Cariler ----------
CREATE TABLE cariler (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kod             text UNIQUE,
    tip             cari_tip NOT NULL DEFAULT 'musteri',
    unvan           text NOT NULL,
    yetkili         text,
    telefon         text,
    telefon2        text,
    eposta          text,
    adres           text,
    il              text,
    ilce            text,
    vergi_dairesi   text,
    vergi_no        text,
    notlar          text,
    aktif           boolean NOT NULL DEFAULT true,
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON cariler (lower(unvan));
CREATE INDEX ON cariler (telefon);

-- Cari hesabın tüm borç/alacak kayıtları (cari ekstrenin kaynağı)
CREATE TABLE cari_hareketler (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cari_id         bigint NOT NULL REFERENCES cariler(id),
    tarih           date NOT NULL DEFAULT current_date,
    vade            date,
    belge_tip       cari_belge NOT NULL,
    belge_id        bigint,
    belge_no        text,
    aciklama        text,
    borc            numeric(14,2) NOT NULL DEFAULT 0 CHECK (borc >= 0),
    alacak          numeric(14,2) NOT NULL DEFAULT 0 CHECK (alacak >= 0),
    iptal           boolean NOT NULL DEFAULT false,
    iptal_zamani    timestamptz,
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now(),
    CHECK (borc > 0 OR alacak > 0)
);
CREATE INDEX ON cari_hareketler (cari_id, tarih);
CREATE INDEX ON cari_hareketler (belge_tip, belge_id);

-- ---------- Ürünler ve stok ----------
CREATE TABLE urunler (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kod                 text UNIQUE,
    ad                  text NOT NULL,
    kategori            text,
    birim               text NOT NULL DEFAULT 'adet',
    stok_miktari        numeric(14,3) NOT NULL DEFAULT 0,
    ort_maliyet         numeric(14,4) NOT NULL DEFAULT 0,   -- ağırlıklı ortalama, KDV hariç
    onerilen_satis      numeric(14,2),                       -- fişe öneri olarak gelir
    kdv_orani           numeric(5,2) NOT NULL DEFAULT 20,
    kritik_stok         numeric(14,3),
    onay_bekliyor       boolean NOT NULL DEFAULT false,      -- sahada teknisyenin eklediği tanımsız ürün
    sahadan_not         text,
    aktif               boolean NOT NULL DEFAULT true,
    olusturan_id        bigint REFERENCES kullanicilar(id),
    olusturma           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON urunler (lower(ad));

-- Bir ürünün birden fazla barkodu olabilir
CREATE TABLE urun_barkodlari (
    barkod      text PRIMARY KEY,
    urun_id     bigint NOT NULL REFERENCES urunler(id)
);
CREATE INDEX ON urun_barkodlari (urun_id);

CREATE TABLE stok_hareketleri (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    urun_id         bigint NOT NULL REFERENCES urunler(id),
    zaman           timestamptz NOT NULL DEFAULT now(),
    miktar          numeric(14,3) NOT NULL CHECK (miktar <> 0),  -- + giriş, - çıkış
    birim_maliyet   numeric(14,4) NOT NULL DEFAULT 0,
    kaynak          stok_kaynak NOT NULL,
    kaynak_id       bigint,
    aciklama        text,
    kullanici_id    bigint REFERENCES kullanicilar(id)
);
CREATE INDEX ON stok_hareketleri (urun_id, zaman);
CREATE INDEX ON stok_hareketleri (kaynak, kaynak_id);

-- ---------- İşler (servis) ----------
CREATE TABLE isler (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cari_id         bigint REFERENCES cariler(id),   -- hızlı kayıtta boş olabilir, fiş öncesi zorunlu
    ham_mesaj       text,                            -- telefondan yazılan ilk not, olduğu gibi saklanır
    baslik          text NOT NULL,
    aciklama        text,
    iletisim_ad     text,
    iletisim_tel    text,
    adres           text,
    oncelik         smallint NOT NULL DEFAULT 2 CHECK (oncelik BETWEEN 1 AND 3), -- 1 acil, 2 normal, 3 düşük
    durum           is_durum NOT NULL DEFAULT 'havuz',
    ekip_id         bigint REFERENCES ekipler(id),
    plan_baslangic  timestamptz,
    plan_bitis      timestamptz,
    baslama_zamani  timestamptz,
    bitis_zamani    timestamptz,
    teknisyen_notu  text,
    iptal_nedeni    text,
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now(),
    guncelleme      timestamptz NOT NULL DEFAULT now(),
    CHECK (plan_bitis IS NULL OR plan_baslangic IS NULL OR plan_bitis > plan_baslangic),
    CHECK (durum IN ('havuz', 'iptal') OR plan_baslangic IS NOT NULL)
);
CREATE INDEX ON isler (durum);
CREATE INDEX ON isler (plan_baslangic);
CREATE INDEX ON isler (ekip_id, plan_baslangic);
CREATE INDEX ON isler (cari_id);

CREATE TABLE is_gecmisi (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    is_id           bigint NOT NULL REFERENCES isler(id),
    zaman           timestamptz NOT NULL DEFAULT now(),
    eski_durum      is_durum,
    yeni_durum      is_durum,
    aciklama        text,
    kullanici_id    bigint REFERENCES kullanicilar(id)
);
CREATE INDEX ON is_gecmisi (is_id, zaman);

CREATE TABLE is_malzemeleri (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    is_id               bigint NOT NULL REFERENCES isler(id),
    urun_id             bigint NOT NULL REFERENCES urunler(id),
    miktar              numeric(14,3) NOT NULL CHECK (miktar > 0),
    birim_maliyet       numeric(14,4) NOT NULL DEFAULT 0,   -- kullanıldığı andaki ortalama maliyet
    sahada_eklendi      boolean NOT NULL DEFAULT true,      -- planlanmadan sahada eklendi mi
    barkodla_eklendi    boolean NOT NULL DEFAULT false,
    stok_hareket_id     bigint REFERENCES stok_hareketleri(id),
    ekleyen_id          bigint REFERENCES kullanicilar(id),
    zaman               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON is_malzemeleri (is_id);

CREATE TABLE is_fotograflari (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    is_id           bigint NOT NULL REFERENCES isler(id),
    dosya_yolu      text NOT NULL,
    aciklama        text,
    ekleyen_id      bigint REFERENCES kullanicilar(id),
    zaman           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON is_fotograflari (is_id);

-- Müşterinin mobilde attığı imza ile teslim onayı
CREATE TABLE teslim_onaylari (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    is_id               bigint NOT NULL UNIQUE REFERENCES isler(id),
    teslim_alan_ad      text NOT NULL,
    teslim_alan_tel     text,
    imza_dosya          text NOT NULL,        -- PNG dosya yolu
    musteri_notu        text,
    enlem               numeric(9,6),
    boylam              numeric(9,6),
    teknisyen_id        bigint REFERENCES kullanicilar(id),
    zaman               timestamptz NOT NULL DEFAULT now(),
    pdf_dosya           text
);

-- Takvimde iş olmayan hatırlatma notları
CREATE TABLE takvim_notlari (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    baslik          text NOT NULL,
    aciklama        text,
    baslangic       timestamptz NOT NULL,
    bitis           timestamptz,
    tum_gun         boolean NOT NULL DEFAULT true,
    renk            text NOT NULL DEFAULT '#f59e0b',
    tamamlandi      boolean NOT NULL DEFAULT false,
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON takvim_notlari (baslangic);

-- ---------- Satış fişleri ----------
CREATE SEQUENCE satis_fis_no_seq;

CREATE TABLE satis_fisleri (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fis_no          text NOT NULL UNIQUE
                    DEFAULT 'SF-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('satis_fis_no_seq')::text, 6, '0'),
    cari_id         bigint NOT NULL REFERENCES cariler(id),
    is_id           bigint REFERENCES isler(id),
    tarih           date NOT NULL DEFAULT current_date,
    vade            date,
    durum           belge_durum NOT NULL DEFAULT 'taslak',
    ara_toplam      numeric(14,2) NOT NULL DEFAULT 0,   -- KDV hariç, iskonto sonrası
    kdv_toplam      numeric(14,2) NOT NULL DEFAULT 0,
    genel_toplam    numeric(14,2) NOT NULL DEFAULT 0,
    maliyet_toplam  numeric(14,2) NOT NULL DEFAULT 0,
    aciklama        text,
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now(),
    onay_zamani     timestamptz,
    iptal_zamani    timestamptz
);
-- Bir işe ait en fazla bir geçerli (iptal olmayan) fiş olabilir
CREATE UNIQUE INDEX satis_fisleri_is_tekil ON satis_fisleri (is_id) WHERE is_id IS NOT NULL AND durum <> 'iptal';
CREATE INDEX ON satis_fisleri (cari_id, tarih);

CREATE TABLE satis_fisi_satirlari (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fis_id          bigint NOT NULL REFERENCES satis_fisleri(id),
    sira            int NOT NULL DEFAULT 0,
    tip             satir_tip NOT NULL DEFAULT 'urun',
    urun_id         bigint REFERENCES urunler(id),
    aciklama        text NOT NULL,
    miktar          numeric(14,3) NOT NULL DEFAULT 1 CHECK (miktar > 0),
    birim           text NOT NULL DEFAULT 'adet',
    birim_fiyat     numeric(14,2) NOT NULL DEFAULT 0 CHECK (birim_fiyat >= 0), -- KDV hariç
    iskonto_orani   numeric(5,2) NOT NULL DEFAULT 0 CHECK (iskonto_orani BETWEEN 0 AND 100),
    kdv_orani       numeric(5,2) NOT NULL DEFAULT 20,
    birim_maliyet   numeric(14,4) NOT NULL DEFAULT 0,
    stoktan_dus     boolean NOT NULL DEFAULT true,  -- işten gelen satırlarda false (stok zaten düştü)
    is_malzeme_id   bigint REFERENCES is_malzemeleri(id),
    CHECK (tip <> 'urun' OR urun_id IS NOT NULL)
);
CREATE INDEX ON satis_fisi_satirlari (fis_id);

-- ---------- Alış faturaları ----------
CREATE TABLE alis_faturalari (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    belge_no        text NOT NULL,
    cari_id         bigint NOT NULL REFERENCES cariler(id),
    tarih           date NOT NULL DEFAULT current_date,
    vade            date,
    durum           belge_durum NOT NULL DEFAULT 'taslak',
    ara_toplam      numeric(14,2) NOT NULL DEFAULT 0,
    kdv_toplam      numeric(14,2) NOT NULL DEFAULT 0,
    genel_toplam    numeric(14,2) NOT NULL DEFAULT 0,
    aciklama        text,
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now(),
    onay_zamani     timestamptz,
    iptal_zamani    timestamptz,
    UNIQUE (cari_id, belge_no)
);

CREATE TABLE alis_faturasi_satirlari (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fatura_id       bigint NOT NULL REFERENCES alis_faturalari(id),
    urun_id         bigint NOT NULL REFERENCES urunler(id),
    miktar          numeric(14,3) NOT NULL CHECK (miktar > 0),
    birim_fiyat     numeric(14,4) NOT NULL CHECK (birim_fiyat >= 0),  -- KDV hariç, iskonto sonrası
    kdv_orani       numeric(5,2) NOT NULL DEFAULT 20
);
CREATE INDEX ON alis_faturasi_satirlari (fatura_id);

-- ---------- Kasa / Banka ----------
CREATE TABLE hesaplar (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad      text NOT NULL UNIQUE,
    tip     hesap_tip NOT NULL DEFAULT 'kasa',
    aktif   boolean NOT NULL DEFAULT true
);

CREATE TABLE finans_hareketleri (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hesap_id        bigint NOT NULL REFERENCES hesaplar(id),
    tarih           date NOT NULL DEFAULT current_date,
    tip             finans_tip NOT NULL,
    tutar           numeric(14,2) NOT NULL CHECK (tutar > 0),
    cari_id         bigint REFERENCES cariler(id),
    belge_no        text,
    aciklama        text,
    iptal           boolean NOT NULL DEFAULT false,
    iptal_zamani    timestamptz,
    olusturan_id    bigint REFERENCES kullanicilar(id),
    olusturma       timestamptz NOT NULL DEFAULT now(),
    CHECK (tip NOT IN ('tahsilat', 'odeme') OR cari_id IS NOT NULL)
);
CREATE INDEX ON finans_hareketleri (hesap_id, tarih);
CREATE INDEX ON finans_hareketleri (cari_id);

-- ---------- Denetim kaydı (kim, neyi, ne zaman değiştirdi) ----------
CREATE TABLE denetim_kaydi (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    zaman           timestamptz NOT NULL DEFAULT now(),
    tablo           text NOT NULL,
    kayit_id        bigint,
    islem           text NOT NULL,
    eski            jsonb,
    yeni            jsonb,
    kullanici_id    bigint
);
CREATE INDEX ON denetim_kaydi (tablo, kayit_id);
CREATE INDEX ON denetim_kaydi (zaman);
