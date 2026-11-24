-- 24. derleme
-- * Sahadaki ekiplerin son görülme konumu (yalnız son konum; geçmiş tutulmaz)
-- * Gider (yalnız KDV) faturaları vergi numarasından cariyle eşleşir (bakiye oluşmaz)

CREATE TABLE IF NOT EXISTS kullanici_konum (
    kullanici_id  bigint PRIMARY KEY REFERENCES kullanicilar(id),
    enlem         double precision,
    boylam        double precision,
    dogruluk      integer,                 -- metre
    izin          text NOT NULL DEFAULT 'var' CHECK (izin IN ('var', 'yok', 'desteklenmiyor')),
    zaman         timestamptz NOT NULL DEFAULT now()
);

UPDATE resmi_faturalar r SET cari_id = c.id
FROM cariler c
WHERE r.yon = 'alis' AND r.cari_id IS NULL AND r.karsi_vkn IS NOT NULL
  AND regexp_replace(coalesce(c.vergi_no, ''), '\D', '', 'g') = r.karsi_vkn
  AND c.id = (SELECT min(c2.id) FROM cariler c2 WHERE regexp_replace(coalesce(c2.vergi_no, ''), '\D', '', 'g') = r.karsi_vkn);
