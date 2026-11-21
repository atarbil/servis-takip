-- Panel kart düzeni (kullanıcıya özel) ve menü adları (ortak, ayarlar.menu_adlari JSON)
ALTER TABLE kullanicilar ADD COLUMN panel_duzeni jsonb;
INSERT INTO ayarlar (anahtar, deger) VALUES ('menu_adlari', '{}') ON CONFLICT (anahtar) DO NOTHING;
