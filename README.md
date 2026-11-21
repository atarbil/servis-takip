# Servis Takip

Bilgisayar, güvenlik kamerası ve teknolojik ürün satış-servis işletmesi için iş takibi, cari ve maliyet programı.
Telefondan ve bilgisayardan tarayıcı ile kullanılır. Natro sunucusunda (Türkiye) çalışır, veriler sizin sunucunuzda durur.

## Neler var?

**Yönetici (bilgisayar ve telefon)**
- **Panel:** TCMB Dolar/Euro kuru, havuz, bugün/yarın ve sahadaki işler, fiyatlandırma bekleyenler, kasa, son tahsilatlar, vadesi geçenler, bu ayın satış ve kârı
- **İş havuzu:** telefonla gelen işi tek mesajla yazarsınız. Mesajda telefon numarası varsa müşteri otomatik bulunur.
- **Takvim:** gün, 3 gün, hafta ve ay görünümü; ekip renkleri
  - Havuzdan sürükle-bırak; işi sürükleyerek başka güne veya saate taşıma
  - Boş saate tıklayıp yeni iş açma, havuzdan iş seçme veya not ekleme
  - İptal olan işi **havuza geri alma**
- **İş detayı:** cari bağlama, malzemeler ve maliyetleri, fotoğraflar, müşteri imzası, kâr, iş geçmişi, teslim formu yazdırma
- **Satış fişi:** işten otomatik taslak oluşur. Malzemeler maliyetleriyle gelir, siz fiyatı yazarsınız (KDV dahil veya hariç), kâr anında görünür.
  Ürün satırlarında ad stok kartından gelir ve değiştirilemez; seri no, garanti gibi bilgiler satırın **not** alanına yazılır ve fişte adın altında çıkar.
- **Alış faturası:** stoğu artırır ve ortalama maliyeti günceller. Yeni ürün fatura girerken tanımlanabilir, barkodla satır eklenebilir.
- **Cariler:** bakiye listesi, cari kartı, tarih aralıklı **ekstre** (yazdırma/PDF, Excel), işler, fişler, yıllık özet, devir bakiyesi
- **Ürünler/stok:** barkodlar, stok hareketleri, sayım, sahadan gelen ürünü onaylama veya var olan ürünle birleştirme
- **Teklif / proforma fatura:** firma şablonlarıyla yazdırma (PDF), isteğe bağlı kaşe/imza, teklif ↔ proforma kopyalama, satış fişine dönüştürme
- **Fiyatlandırma:** tamamlanmış ama fiyatlandırılmamış işler ayrı menüde
- **Kasa/banka:** tahsilat (makbuz yazdırma, tutar yazıyla), ödeme, masraf, virman, iptal
- **Raporlar:** cari bakiyeler, vadesi geçenler, yıllık müşteri özeti, iş kârlılığı, aylık satış, ekip performansı, stok uyarıları. Hepsi yazdırılabilir ve Excel'e aktarılabilir.
- **Ayarlar:** firma bilgileri (çıktılarda görünür), kullanıcılar, ekipler, hesaplar, **işlem kayıtları** (kim, neyi, ne zaman değiştirdi)

**Teknisyen (telefon)**
- Sadece kendi ekibinin işlerini görür. **Fiyat, maliyet ve cari bakiyesi göremez.**
- İşe başla → **📷 barkod okut** / listeden seç / tanımsız ürün → fotoğraf → **müşteri imzası** → tamamla
- İmza alınmadan iş kapanmaz. İmza sonradan değiştirilemez.
- Ara ve yol tarifi (Google Haritalar) düğmeleri

**Telefona uygulama gibi ekleme:** iPhone'da Safari → Paylaş → "Ana Ekrana Ekle". Android'de Chrome → ⋮ → "Ana ekrana ekle".

**Barkod:** Android Chrome'da doğrudan çalışır. iPhone'da ilk kullanımda okuyucu kütüphane internetten bir kez yüklenir.
Kamera açılamazsa barkod elle yazılabilir. Bilgisayarda USB barkod okuyucu da kullanılabilir.

### Test edildi
- Veritabanı iş kuralları: 47 kontrol (`db/test/`)
- API: 70'e yakın kontrol, teknisyen kısıtları dahil (`app/test/api_testi.js`)
- Gerçek tarayıcıda uçtan uca senaryo: kurulum → alış faturası → havuz → takvime sürükle-bırak → teknisyen telefonda barkod, imza, tamamla → fiş → tahsilat → ekstre (`app/test/tarayici_testi.js`)

## Telegram botu (havuza iş ekleme)

Bota yazılan her mesaj havuza iş olarak eklenir. Telefon numarası varsa müşteri otomatik bulunur,
**acil** diye başlayan mesajlar acil olur, rehberden paylaşılan kişiyle de iş açılır.
Komutlar: `/havuz`, `/bugun`, `/yardim`. Sadece programa bağlanmış **yönetici** hesaplarından gelen mesajlar kabul edilir.

**Kurulum (bir kez):**
1. Telegram'da **@BotFather**'ı açın → `/newbot` → bota bir ad verin (örn. *Atar Servis*), sonra `_bot` ile biten bir kullanıcı adı (örn. `atarservis_bot`).
2. BotFather'ın verdiği **anahtarı** (`123456789:AA...`) kopyalayın. Bu anahtar gizlidir, kimseyle paylaşmayın.
3. Sunucuda:
   ```bash
   cd /opt/servis-takip
   grep -q '^TELEGRAM_TOKEN=' .env || echo 'TELEGRAM_TOKEN=' >> .env
   nano .env        # TELEGRAM_TOKEN= satırının sonuna anahtarı yapıştırın, Ctrl+O, Enter, Ctrl+X
   docker compose up -d
   ```
4. Programda **Ayarlar → Telegram** → **Telegram hesabımı bağla** → çıkan `/baglan KOD` mesajını bota gönderin.

### Bildirimler
Bağlı **yönetici** hesaplarına şu bildirimler gider (Ayarlar → Telegram → Bildirimler'den kişi bazında açılıp kapatılır):
- ✅ İş tamamlandı — fiyatlandırma bekliyor
- 🟠 Sahada tanımsız ürün eklendi — maliyet onayı bekliyor
- ☀️ Sabah planı (varsayılan 08:30) ve 🌙 akşam özeti (varsayılan 19:00) — saatler aynı ekrandan değiştirilir

## Natro'da kurulum

### 1. Sunucu
Natro'dan bir **XCloud / VPS** sunucu alın:
- İşletim sistemi: **Ubuntu 24.04**
- En az **2 GB RAM, 40 GB disk**
- Kontrol paneli (cPanel/Plesk) **gerekmez**

Natro size sunucunun **IP adresini** ve **root şifresini** verir.

### 2. Alan adı
Natro alan adı panelinde → DNS yönetimi → yeni kayıt:
- Tür: `A` · Ad: `servis` · Değer: sunucunun IP adresi

Böylece program `https://servis.firmaadiniz.com` adresinde açılır. DNS'in yayılması 5–30 dakika sürebilir.

### 3. Dosyaları sunucuya yükleyin
Windows'ta **WinSCP** (ücretsiz) ile sunucuya root olarak bağlanın ve `servis-takip` klasörünü `/opt/` altına yükleyin.
Sonuç: `/opt/servis-takip/docker-compose.yml` şeklinde olmalı.

### 4. Kurulumu çalıştırın
Windows'ta **PowerShell** açın:

```bash
ssh root@SUNUCU_IP
cd /opt/servis-takip
sed -i 's/\r$//' scripts/*.sh   # Windows'tan yüklemede oluşabilecek satır sonu sorununu temizler
bash scripts/kurulum.sh servis.firmaadiniz.com
```

Betik her şeyi kendisi yapar: Docker, güvenlik duvarı, otomatik güvenlik güncellemeleri, rastgele şifreler, HTTPS sertifikası, veritabanı ve gece yedeği.
5–10 dakika sonra adresi açtığınızda **ilk kurulum ekranı** gelir: firma adınızı ve yönetici hesabınızı oluşturun.
Ardından **Ayarlar → Kullanıcılar** bölümünden teknisyenleri ekleyip ekiplere atayın.
Eski programdaki müşteri bakiyelerini, cari açarken "Açılış bakiyesi" alanına girebilirsiniz.

> ⚠️ Kurulumdan sonra `/opt/servis-takip/.env` dosyasını WinSCP ile bilgisayarınıza indirip güvenli bir yerde saklayın.
> Veritabanı şifresi bu dosyadadır.

## Yedekler

- Her gece **03:15**'te otomatik yedek alınır: `/opt/servis-takip/yedekler/`
- Her yedekte: veritabanı + imzalar/fotoğraflar + ayar dosyası. 30 gün saklanır.
- Yedek alındıktan sonra bozuk olup olmadığı kontrol edilir.
- **Elle yedek:** `bash scripts/yedekle.sh`
- **Geri yükleme:** `bash scripts/geri_yukle.sh yedekler/veritabani_TARIH.dump yedekler/dosyalar_TARIH.tar.gz`
  (önce otomatik olarak mevcut durumun yedeğini alır, sonra "EVET" yazmanızı ister)

**İkinci konum (önerilir):** Sunucu tamamen kaybolursa yedekler de gider. `rclone config` ile Google Drive veya başka bir depolama tanımlayın,
`.env` içinde `UZAK_YEDEK_HEDEF=gdrive:servis-yedek` yazın. Bundan sonra her gece kopya oraya da gider.
Ayrıca Natro'nun sunucu yedekleme/snapshot hizmetini açmanız ek bir güvence olur.

## Güncelleme

Kod GitHub'da (`atarbil/servis-takip`, gizli depo) tutulur. Sunucu, depoyu sadece okuyabilen bir anahtarla (deploy key) bağlıdır.

```bash
cd /opt/servis-takip
bash scripts/guncelle.sh
```

Betik sırasıyla: yedek alır → GitHub'dan son sürümü çeker → programı yeniden başlatır → açıldığını kontrol eder.
Veritabanı değişiklikleri (`db/` altındaki yeni numaralı dosyalar) program açılırken kendiliğinden uygulanır.
`.env` ve `yedekler/` GitHub'da yoktur, güncellemeden etkilenmez.

## Muhasebe kuralları (bilmeniz gerekenler)

- **Cari bakiye** = borç − alacak. **Pozitif:** müşteri size borçlu. **Negatif:** siz cariye borçlusunuz (tedarikçi veya avans).
- **Maliyet:** Alış faturası girildikçe ürünün **ağırlıklı ortalama maliyeti** güncellenir. Teknisyen malzeme kullandığında o anki ortalama maliyet işe yazılır.
- **Sahada tanımsız ürün:** Teknisyen ekler, ürün "onay bekliyor" olur. Siz maliyetini girene kadar o işin fişi onaylanamaz.
- **İmza zorunlu:** Müşteri teslim onayı (imza) alınmadan iş "tamamlandı" yapılamaz. İmza sonradan değiştirilemez.
- **Hiçbir finansal kayıt silinmez.** Fiş, tahsilat ve faturalar iptal edilir. İptal, bakiyeleri ve stoku otomatik geri alır.
- **Eski programdan geçiş:** Müşteri açılış bakiyeleri "devir" kaydı olarak girilir.

## Teknik

- PostgreSQL 16, Node.js 22, Caddy 2 (otomatik HTTPS), Docker Compose
- Şema: `db/` klasörü. Uygulama her açılışta yeni şema dosyalarını kendisi uygular.
- Uygulama dış paket kullanmaz (sadece Node.js); bu sayede güncellemelerde bağımlılık sorunu çıkmaz.
- Test: `PGHOST=... PGUSER=... bash db/test/calistir.sh`
- Veritabanı dışarıya kapalıdır; sadece uygulama erişir. Dışarıya sadece 22 (SSH), 80 ve 443 açıktır.
