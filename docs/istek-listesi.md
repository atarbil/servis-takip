# İstek listesi

Kullanım sırasında gelen istekler. "Derle" denince öncelik sırasına konup birlikte uygulanır.

## Bekleyen istekler

### 1. Programdan "Güncelle" düğmesi (22.11.2026)
Sunucu güncellemesi telefondan, SSH'ye girmeden yapılabilsin.
- **Yer:** sağ üstteki kişisel menü → "Programı güncelle". Yalnız **yönetici** görür.
- **Ekranda:** kurulu sürüm (tarih + kısa kod), GitHub'da yeni sürüm olup olmadığı ve yeni sürümdeki değişiklikler
  (commit başlıkları). Son güncellemenin tarihi ve sonucu da görünür.
- **"Şimdi güncelle":** önce şifre tekrar sorulur. Ardından yedek alınır, yeni sürüm indirilir ve program yeniden başlatılır.
  İlerleme ekranda adım adım görünür. Program 1–2 dakika kapanıp açılır; sayfa beklemede kalır, program açılınca kendini yeniler.
  Önbellek yenileme (Ctrl+F5) gerekmez.
- **Güvenlik:** programa sunucu yönetim yetkisi (Docker erişimi) **verilmez**. Program yalnızca ortak bir klasöre "güncelleme
  istendi" notu bırakır. Sunucudaki küçük bir sistem servisi (systemd) bu notu görünce `guncelle.sh`'yi çalıştırır ve
  sonucu/kaydı aynı klasöre yazar. Böylece programa girilse bile sunucuda komut çalıştırılamaz; yalnızca güncelleme
  tetiklenebilir. Aynı anda iki güncelleme başlatılamaz.
- **Kurulum:** bu servis bir kez SSH'den kurulur (tek komut, `scripts/` içine eklenecek). Sonraki güncellemeler düğmeyle yapılır.
- Güncelleme başarısız olursa hata kaydı ekranda görünür ve program eski sürümle çalışmaya devam eder.

## İsteğe bağlı fikirler
- Excel'den toplu ürün ve cari (açılış bakiyesi) aktarımı.
- Teklif / proforma / teslim formunu WhatsApp'tan link olarak gönderme; vadesi geçenlere hatırlatma mesajı.
- Yedeklerin ikinci bir konuma (ör. Google Drive) otomatik kopyalanması.
- Logonun yüksek çözünürlüklü orijinal dosyası gelirse Ayarlar'dan değiştirilmesi (şu anki logo e-posta imzasından kırpıldı, ~300 px).

## Tamamlananlar

### 22.11.2026 — 10. derleme
- **Kameradan barkod okuma yeniden yazıldı (iPhone ve Android):**
  - **Yerleşik okuyucu:** internet ya da dış kütüphane gerekmez, her telefonda çalışır. EAN-13, EAN-8, UPC-A ve Code 128 okur
    (ürün barkodları ve kamera/kayıt cihazı seri numaraları). Odak tam değilken bulanık görüntüyü de okuyacak şekilde ayarlandı.
    Barkod yatay, dikey, ters ya da biraz eğik tutulabilir.
  - Android'in kendi okuyucusu ve ZXing (QR vb. için) yardımcı olarak çalışmaya devam eder. ZXing artık kendi sunucumuzdan gelir
    (Docker kurulumunda indirilir), CDN yalnızca yedek.
  - Kamera 1920×1080 ve sürekli odakla açılır. Sadece çerçevenin içi alınıp büyütülerek taranır; ara sıra tüm görüntüye de bakılır.
  - **Ekrana dokununca odaklanır.** Destekleyen telefonda **🔦 fener**, **yakınlaştırma çubuğu** ve **🔄 kamera değiştir**
    (iPhone Pro'larda geniş/ultra geniş/tele) düğmeleri çıkar. Seçilen kamera hatırlanır.
  - Yanlış okumaya karşı: sağlama hanesi kontrolü, aynı kodun birden çok tarama çizgisinde ya da iki karede görülmesi.
    Okununca çerçeve sararır, bip sesi ve (Android'de) titreşim.
  - Ekranın üstünde küçük tanı yazısı: çalışan okuyucular, kamera çözünürlüğü, taranan kare sayısı.
- **Barkod arama:** UPC-A (12 hane) ile başında 0 olan EAN-13 aynı ürünü bulur. Okuyucu hangisini verirse versin ürün bulunur.
- Test: üretilen barkod görüntüleriyle (bulanık, gürültülü, küçük, eğik, dikey) ve sahte kamera görüntüsüyle uçtan uca test.
  Rastgele desenlerde yanlış okuma görülmedi.

### 22.11.2026 — 9. derleme
- **"✓ Teslim et / Tamamla":** havuz sayfasında, paneldeki havuz kartında ve iş detayında (havuz, planlı, sahada). Sahaya gitmeyen
  işi ofisten kapatır: sadece malzeme teslimi ya da hizmet + işçilik + malzeme. İşin carisi yoksa pencerede seçilir; isteğe bağlı
  teslim alan adı ve imza (teslim tutanağı). Sahada daha önce eklenen malzemeler de fişe gelir. Kaydedince iş tamamlanır, cariye
  taslak satış fişi açılır ve fişe gidilir; onaylanınca müşteri borçlanır, malzeme stoktan düşer.
- **Düzeltme:** imza ve barkod ekranları bir pencerenin içinden açılınca pencerenin arkasında kalıyordu; artık üstte açılıyor.

### 22.11.2026 — 8. derleme
- **"+ İş ekle" penceresi:** "İşi ben yaptım" seçilince ekranın büyük kısmını kaplayan iki sütunlu pencere (solda mesaj, cari,
  öncelik; sağda hizmet/malzeme satırları). Pencere ekrana sığar, sayfa kaymaz; satırlar çoğalınca sadece sağdaki liste kendi
  içinde kayar, Kaydet/Vazgeç hep görünür. Ürün öneri listesi kesilmez. Telefonda tam ekran, düğmeler altta.

### 22.11.2026 — 7. derleme
- **Üst menü:** sol kenar çubuğu kalktı; ekranın üstünde koyu çubukta gruplu açılır menü:
  Panel · İşler (İş Havuzu, Takvim, Tüm İşler, Dış Servis) · Satış (Fiyatlandırma, Satış Fişleri, Teklif/Proforma) ·
  Cariler (Cariler, Envanter) · Stok (Ürünler/Stok, Alış Faturaları) · Finans (Kasa/Banka, Raporlar) · sağda kullanıcı
  (Ayarlar, Silinenler, Şifre değiştir, Çıkış). Biri açıkken diğerinin üzerine gelince ona geçer; dışarı tıklama ve Esc kapatır;
  ← → ↓ ile klavyeden kullanılır. Sayaçlar grup başlığında da. Dar ekranda simgeler ve kur kutusu gizlenir;
  telefonda ☰ ile soldan çekmece (gruplar akordeon), alt kısayol çubuğu yerinde.
- **Menü adları:** Ayarlar → Menü sekmesinden grup ve sayfa adları değiştirilir (ör. Cariler → Müşteriler); sayfa başlıkları da
  yeni adı kullanır; "Varsayılana dön". Tüm kullanıcılar için ortak.
- **Panel düzeni:** "⚙ Paneli düzenle" → kartlar başlığından sürüklenip sütunlar arasında taşınır (telefonda ↑ ↓), ✕ ile kaldırılır,
  "Gizlenen kartlar"dan geri eklenir, "Varsayılan düzen". Düzen kullanıcıya özel, sunucuda saklanır (her cihazda aynı).
- **+ İş ekle:** Cari alanı (ara/seç/yeni cari; boşsa telefondan bulunur). "İşi ben yaptım" işaretlenince hizmet, işçilik ve
  malzeme satırları (ürün arama, barkod, isteğe bağlı fiyat) girilir; kaydedince iş tamamlanmış olarak açılır, o cariye taslak
  satış fişi kesilir ve fiş ekranı açılır. Fiş onaylanınca müşteri borçlanır, malzeme stoktan düşer.

### 22.11.2026 — 6. derleme
- **Dış servis:** müşteriden alınıp tamire gönderilen cihazlar. Menüde "Dış Servis" (sayaçlı), cari kartında "Dış servis" sekmesi.
  Alanlar: müşteri, cihaz, marka/model, seri no, arıza, yanında verilenler, gönderilen servis, gönderim tarihi, ücret (bilgi), not.
  Durum: Dış serviste → Geldi (bizde) → Müşteriye teslim edildi; tarihler kendiliğinden yazılır, geri adım alınabilir.
  Kaç gündür dışarıda / kaç gündür bizde bekliyor; 14 günü geçen kırmızı. Arama, durum sekmeleri, Excel.
  İki nüsha "cihaz teslim alındı" fişi (müşteri + firma). Silinenler'e gider, cari silinince birlikte silinir.
- **Ana panoda "Dış servis" kartı:** en uzun süredir açık olan 5 kayıt, toplam sayı ve "+ Gönder" düğmesi.
- **Düzeltme:** gece 00:00–03:00 arası girilen tahsilat/ödeme/devir/envanter tarihleri bir önceki güne yazılabiliyordu
  (sunucu UTC saatine bakıyordu); artık İstanbul saatine göre.
- **Düzeltme:** pencere açıkken başka sayfaya geçince pencere kapanıyor.

### 21.11.2026 — 5. derleme
- **Silme yetkisi (yönetici):** iş, cari, ürün, satış fişi, alış faturası, teklif/proforma, kasa/banka hareketi, envanter, takvim notu ve
  kullanıcı ekranlarında **🗑 Sil** düğmesi. Silmeden önce ne olacağı tek tek gösterilir (sunucuda deneme silmesi yapılıp geri sarılır;
  yazan etki birebir doğrudur). Etkiler otomatik geri alınır: cari borç/alacak, stok, kasa/banka; işte kullanılan malzeme stoğa döner;
  cari silinince işleri, fişleri, tahsilatları, teklifleri, envanteri ve devir bakiyesi birlikte silinir; virmanın iki bacağı birlikte gider;
  ürün silinince barkodu boşa çıkar; kullanıcı silinince oturumu kapanır. Kendi hesabınızı ve son yöneticiyi silemezsiniz.
- **Silinenler:** menüde ayrı bölüm. Silinen kayıtlar 30 gün durur, kalan gün görünür; **Geri al** ile etkileriyle birlikte geri gelir
  (onaylı fiş/fatura yeniden onaylanır). Carisi silinmiş bir belgeyi geri almak isterseniz önce cariyi geri almanız söylenir.
  **Kalıcı olarak sil** veya 30 gün dolunca geri alınamaz hale gelir. Silme ve geri almalar İşlem kayıtlarında da görünür.
- **İşler menüsü:** İş Havuzu · Takvim · Tüm İşler tek başlık altında, açılır/kapanır (durum hatırlanır); kapalıyken havuz sayısı başlıkta.
  Fiyatlandırma ayrı menüde kaldı.

### 21.11.2026 — 4. derleme
- **Fatura tarzı satış fişi:** üstte cari bloğu (unvan, adres, VD/VN, telefon, güncel bakiye) ve belge bloğu (fiş no, tarih, vade, iş, açıklama).
  Ortada sıra no ve kod sütunlu, ince çizgili kalem tablosu. Altta brüt toplam, iskonto, ara toplam, KDV ve genel toplam; KDV oranı dökümü,
  yazıyla tutar, maliyet/kâr (gizlenebilir). Masaüstünde toplamlar ekranın altında sabit duruyor. Telefonda etiketli kart görünümü.
- **Excel gibi klavye:** ↑ ↓ ← → ile hücreler arası gezinme, Enter/Tab sonraki hücre (son hücrede yeni satır), F2 düzenle, Esc geri al,
  Ctrl+Insert araya satır, Ctrl+Delete satır sil, F4 stok listesi, Ctrl+B barkod, Ctrl+S kaydet, F9 kurları güncelle.
  Ürün seçilince imleç miktara geçiyor. Aynı klavye düzeni alış faturası ve teklif/proforma kalemlerinde de var.
- **Ürün önerisi düzeltmesi:** hızlı yazıp hemen Enter'a basınca, eski listedeki ilk ürün yerine güncel arama sonucu seçiliyor.
- **Giriş ekranı sahnesi:** merdivendeki usta duvara kamera takıyor (tornavida ve kıvılcım), ağ kablosu duvardan PoE switch'e döşeniyor,
  kamera ışığı yeşile dönüp taramaya başlıyor, kablodan veri akıyor ve ikinci kablo giriş kutusuna bağlanıyor.

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
