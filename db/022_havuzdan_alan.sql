-- 31.3: Havuzdaki işi "ben alıyorum" ile alan teknisyen (yanlışlıkla aldıysa geri bırakabilir)
ALTER TABLE isler ADD COLUMN IF NOT EXISTS havuzdan_alan_id bigint REFERENCES kullanicilar(id);
