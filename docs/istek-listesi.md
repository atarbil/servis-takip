# İstek listesi

Kullanım sırasında gelen istekler. "Derle" denince öncelik sırasına konup birlikte uygulanır.

## Bekleyen istekler

### 1. Müşteri envanteri (21.11.2026)
- Menüde ayrı bölüm + cari kartında "Envanter" sekmesi: kurumda hangi cihaz var, kayıt eklenebilsin.
- Alanlar: tür (kamera, DVR/NVR, bilgisayar, yazıcı, POS…), marka, model, seri no, konum, IP adresi, kurulum tarihi, garanti bitiş, notlar.
- Hassas bilgiler (kullanıcı adı/şifre) ayrı alanda, sadece yönetici görür.
- Teknisyen saha ekranında müşterinin envanterini görür; iş bir cihaza bağlanabilir.
- Arama/filtre, "garantisi bu ay bitenler", Excel'e aktarma.

### 2. Telegram bildirimleri (21.11.2026)
- Bağlı yöneticilere: iş tamamlandı (fiyatlandırma bekliyor), sahada tanımsız ürün eklendi.
- Sabah 08:30 günün planı; akşam 19:00 günün özeti (tamamlanan işler, tahsilatlar, fiyatlandırma bekleyenler).
- Hangi bildirimlerin alınacağı Ayarlar'dan açılıp kapatılır.

### 3. Dolar bazlı fiyat (21.11.2026)
- Stok kartında satış fiyatı (ve son alış fiyatı) için para birimi: TL / USD / EUR.
- Fiş, teklif ve proformaya eklenirken günün TCMB döviz satış kuruyla TL'ye çevrilir; satırda kaynak fiyat ve kullanılan kur görünür ("120 USD × 41,9578").
- Belgede kur elle değiştirilebilir ve "kurları güncelle" ile tüm dövizli satırlar yeniden hesaplanır.
- Alış faturası dövizli girilebilir (fatura kuru ile TL maliyete çevrilir).
- Ürünler listesinde dövizli fiyat ve güncel TL karşılığı birlikte görünür.
- **Belge para birimi seçimi (kullanıcıya bırakılır):** teklif ve proforma her belgede ayrı ayrı **TL, USD veya EUR** olarak hazırlanabilir;
  dövizli belgede fiyatlar, toplamlar ve çıktı o para biriminde olur (çıktıda bilgi amaçlı TL karşılığı ve kur gösterilebilir).
- Satış fişi ve cari hesap **TL** kalır: dövizli teklif/proforma satış fişine dönüştürülürken seçilen kurla (varsayılan günün TCMB kuru) TL'ye çevrilir.

### 4. Ana ekranda döviz çevirici (21.11.2026)
- Panelde küçük bir çevirici kart: tutar yaz, USD ⇄ TL ve EUR ⇄ TL anında hesaplansın (TCMB günlük kuru).
- Kuru elle değiştirme imkânı (piyasa kuru ile hesaplamak için); KDV dahil/hariç hesap kolaylığı.
- Üst çubuktaki kur kutusuna tıklayınca da açılabilsin (her sayfadan erişim).

## İsteğe bağlı fikirler
- Excel'den toplu ürün ve cari (açılış bakiyesi) aktarımı.
- Seri no ve garanti takibi (envanterle birleştirilebilir).
- Teklif / proforma / teslim formunu WhatsApp'tan link olarak gönderme; vadesi geçenlere hatırlatma mesajı.
- Yedeklerin ikinci bir konuma (ör. Google Drive) otomatik kopyalanması.
- Logonun yüksek çözünürlüklü orijinal dosyası gelirse Ayarlar'dan değiştirilmesi (şu anki logo e-posta imzasından kırpıldı, ~300 px).

## Tamamlananlar

### 21.11.2026 — 2. derleme
- **Canlı giriş ekranı:** hareketli renk geçişli arka plan, süzülen ışık efektleri ve parçacıklar, logo, kutunun ve alanların sırayla belirmesi,
  hatalı şifrede sallanma. Hareket azaltma tercihi olan cihazlarda efektler kapanır.
- **Stok kartı:** marka, model, ana grup, alt grup alanları (eski kategori ana gruba taşındı).
- **"Stok listesi" düğmesi:** satış fişi, teklif/proforma ve alış faturasında "+ Kalem" yanında. Arama + marka / ana grup / alt grup
  filtreleri, "sadece stokta olanlar", çoklu seçim ve miktar ile topluca ekleme.
- **Ürün önerisi:** kalem açıklamasına yazınca ad, model, marka, kod ve gruplarda arar (Türkçe harf farkı yok sayılır, birden çok kelime
  farklı alanlarda olabilir); öneride marka/model/grup, stok ve satış fiyatı görünür.
- **Ürünler listesi:** marka / ana grup / alt grup filtreleri ve sütunları.
- **Teklif ekranı:** giriş ve kapanış metinleri yan yana, kompakt.

### 21.11.2026 — 1. derleme
- **Panel yenileme:** sağ üstte TCMB Dolar/Euro kuru (30 dk'da bir güncellenir); "+ İş ekle" düğmesi her sayfada;
  sol üstte firma logosu (giriş ekranında ve çıktılarda da); panel ekranın tamamını kullanıyor
  (bugün/yarın, sahadakiler, havuz, fiyatlandırma bekleyenler, kasa, son tahsilatlar, vadesi geçenler).
- **Fiyatlandırma menüsü:** tamamlanmış ama fişi onaylanmamış işler; menüde bekleyen sayısı rozeti; tek tıkla fiş.
- **Teklif ve proforma fatura:** örnek formatlara birebir şablonlar (TK-/PF- numaralı), isteğe bağlı kaşe/imza,
  teklif ↔ proforma kopyalama, kabul edilince satış fişine dönüştürme. Stoğu ve cariyi etkilemez.
- **Tahsilat makbuzu:** tutar yazıyla, ödeme şekli, tahsilat sonrası bakiye, isteğe bağlı kaşe/imza, tek A4'e 2 nüsha seçeneği.
  Tahsilat girerken otomatik, kasa listesinden sonradan yazdırılabilir.
- **Ayarlar → Firma bilgileri:** GSM, web, vergi dairesi/no ayrı alanlar; teklif giriş/kapanış metinleri;
  logo, kaşe/imza ve teklif başlık şeridi yükleme.

### 21.11.2026
- Telegram botu ile havuza iş ekleme.
