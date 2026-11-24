-- 23. derleme: Resmi faturalar
-- Kesilen satış faturaları ve "yalnız KDV" (gider) alış faturaları. Bilgi amaçlıdır: cari bakiyesini, stoğu, kasayı,
-- satış fişlerini ETKİLEMEZ; yalnız KDV durumu ekranında kullanılır. XML / PDF dosyası saklanmaz, yalnız fatura bilgileri.

CREATE TABLE IF NOT EXISTS resmi_faturalar (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    yon                 text NOT NULL CHECK (yon IN ('satis', 'alis')),
    kaynak              text NOT NULL DEFAULT 'xml' CHECK (kaynak IN ('xml', 'elle')),
    ettn                text,
    belge_no            text,
    tarih               date NOT NULL,
    tip                 text,                       -- SATIS, IADE, TEVKIFAT, ISTISNA…
    profil              text,                       -- TEMELFATURA, TICARIFATURA, EARSIVFATURA…
    karsi_unvan         text NOT NULL,              -- satışta müşteri, alışta tedarikçi
    karsi_vkn           text,
    karsi_vergi_dairesi text,
    karsi_adres         text,
    karsi_il            text,
    karsi_ilce          text,
    karsi_telefon       text,
    karsi_eposta        text,
    cari_id             bigint REFERENCES cariler(id),
    doviz               text NOT NULL DEFAULT 'TRY',
    kur                 numeric(14,6),
    matrah              numeric(14,2) NOT NULL DEFAULT 0,   -- TL, KDV hariç
    kdv                 numeric(14,2) NOT NULL DEFAULT 0,   -- TL
    tevkifat            numeric(14,2) NOT NULL DEFAULT 0,   -- TL, alıcının ödeyeceği kısım
    toplam              numeric(14,2) NOT NULL DEFAULT 0,   -- TL, matrah + kdv
    kdv_dokum           jsonb NOT NULL DEFAULT '[]',        -- [{oran, matrah, kdv}] TL
    kalemler            jsonb NOT NULL DEFAULT '[]',        -- yalnız görüntülemek için
    gider_turu          text,
    aciklama            text,
    olusturan_id        bigint REFERENCES kullanicilar(id),
    olusturma           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS resmi_fatura_ettn_tekil ON resmi_faturalar (lower(ettn)) WHERE ettn IS NOT NULL;
CREATE INDEX IF NOT EXISTS resmi_fatura_tarih ON resmi_faturalar (yon, tarih);
CREATE INDEX IF NOT EXISTS resmi_fatura_cari ON resmi_faturalar (cari_id);

-- Tedarikçi (vergi no) bazında alış seçimi hatırlanır: 'stoklu' ya da 'gider'
CREATE TABLE IF NOT EXISTS tedarikci_tercih (
    vkn         text PRIMARY KEY,
    secim       text NOT NULL CHECK (secim IN ('stoklu', 'gider')),
    gider_turu  text,
    guncelleme  timestamptz NOT NULL DEFAULT now()
);
