-- =====================================================================
-- Servis Takip (6): Telegram botu
-- =====================================================================

-- Kullanıcının bağlı Telegram hesabı (sadece bu hesaptan gelen mesajlar kabul edilir)
ALTER TABLE kullanicilar ADD COLUMN telegram_id bigint UNIQUE;
ALTER TABLE kullanicilar ADD COLUMN telegram_ad text;

-- İşin nereden geldiği: panel, telegram
ALTER TABLE isler ADD COLUMN kaynak text NOT NULL DEFAULT 'panel';

-- Hesap bağlamak için tek kullanımlık, kısa süreli kodlar
CREATE TABLE telegram_kodlari (
    kod             text PRIMARY KEY,
    kullanici_id    bigint NOT NULL REFERENCES kullanicilar(id),
    son_kullanma    timestamptz NOT NULL
);

-- Bot yeniden başladığında aynı mesajı ikinci kez işlemesin
INSERT INTO ayarlar (anahtar, deger) VALUES ('telegram_offset', '0') ON CONFLICT DO NOTHING;
