# İstek listesi

Kullanım sırasında gelen istekler. "Derle" denince öncelik sırasına konup birlikte uygulanır.

## Bekleyen istekler

_Şu an bekleyen istek yok._

## İsteğe bağlı fikirler
- Excel'den toplu ürün ve cari (açılış bakiyesi) aktarımı.
- Teklif / proforma / teslim formunu WhatsApp'tan link olarak gönderme; vadesi geçenlere hatırlatma mesajı.
- Yedeklerin ikinci bir konuma (ör. Google Drive) otomatik kopyalanması.
- Logonun yüksek çözünürlüklü orijinal dosyası gelirse Ayarlar'dan değiştirilmesi (şu anki logo e-posta imzasından kırpıldı, ~300 px).

## Tamamlananlar

### 21.11.2026 — 3. derleme
- **Müşteri envanteri:** menüde "Envanter" ve cari kartında "Envanter" sekmesi. Tür, marka, model, seri no, konum, IP, kurulum tarihi,
  garanti bitişi, durum (aktif/arızalı/kaldırıldı), notlar. 🔒 Erişim bilgisi (kullanıcı adı/şifre) sadece yöneticiye görünür.
  Arama, tür/durum/garanti filtreleri ("30 gün içinde bitecek", "bitmiş"), Excel. İş detayında "İlgili cihaz" seçilir;
  teknisyen saha ekranında müşterideki cihazları görür ve kurduğu cihazı envantere ekleyebilir (şifre giremez/göremez).
- **Telegram bildirimleri:** iş tamamlandı (fiyatlandırma bekliyor), sahada tanımsız ürün, sabah planı (varsayılan 08:30),
  akşam özeti (varsayılan 19:00). Ayarlar → Telegram'dan aç/kapat, saatleri değiştir, "şimdi gönder" ile dene.
- **Dolar / Euro fiyat (seçimli):** stok kartında satış fiyatının para birimi TL/USD/EUR. Fişe eklenince günün TCMB satış kuruyla TL'ye
  çevrilir, satırda "285,00 USD × 41,9578" görünür; "Kurları güncelle" düğmesi. Alış faturası dövizli girilebilir (kur ile TL maliyet).
  Teklif/proforma her belgede TL, USD veya EUR; çıktı o para biriminde, istenirse TL karşılığı da yazılır. Fişe dönüştürürken kur sorulur.
  Fiş ve cari her zaman TL.
- **Döviz çevirici:** panelde kart + üst çubuktaki kura tıklayınca pencere. Tutar ⇄ TL/USD/EUR, KDV dahil/hariç, kur elle değiştirilebilir.

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
