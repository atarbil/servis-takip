# İstek listesi

Kullanım sırasında gelen istekler. "Derle" denince öncelik sırasına konup birlikte uygulanır.

## Bekleyen istekler

### 1. Sahadaki ekiplerin konumu (24.11.2026)
- Kullanıcı: "sahadaki ekiplerin konumu" (yöneticiye açılan konum bilgisi).
- Önerilen tasarım: **İşler → Ekip konumları** haritası (OpenStreetMap; ek ücret yok): her ekip / teknisyen için son konum
  işareti, ne zaman alındığı ("3 dk önce"), üzerinde olduğu iş ve müşteri adresi; işe tıklayınca iş kartı. Konum geçmişi
  (o günün rotası) isteğe bağlı.
- Konumun alınma yolları (karar bekliyor):
  1. **İş adımlarında konum:** teknisyen "Yola çıktım / Vardım / Tamamladım" dediğinde telefon konumu kaydedilir. En güvenilir,
     pil dostu; arada canlı takip yok.
  2. **Uygulama açıkken canlı:** teknisyen ekranı açıkken 1–2 dakikada bir konum gönderilir (web uygulaması kapalıyken /
     arka planda konum alınamaz — özellikle iPhone).
  3. **Telegram canlı konum:** teknisyen sabah bota "canlı konum paylaş"ı açar (8 saate kadar); telefon kilitliyken de güncellenir.
     Bot zaten kurulu olduğu için ek uygulama gerekmez.
- **Karar (kullanıcı 22:15): "uygulamayı açtığı yerden son görülme olarak".** → Teknisyen programı (telefonda) açtığında ve
  açık tuttuğu sürece birkaç dakikada bir konumu alınır; haritada her teknisyen için **son görülme** yeri ve zamanı
  ("Ali Usta · 14:32'de · 12 dk önce"). İş adımı / Telegram yok. Varsayım (cevaplanmadı): **yalnız son konum**, geçmiş/rota tutulmaz.
  Telefon konum izni vermezse "konum izni yok" görünür. Haritada son görülme 1 saatten eskiyse soluk.
- **Karar (kullanıcı 22:16):** teknisyen ekranında **onay penceresi ya da "konum paylaşılıyor" işareti olmayacak.** (Telefonun /
  tarayıcının kendi konum izni sorusu programdan bağımsızdır, bir kez çıkar.) Yasal not kullanıcıya iletildi: çalışan konumu
  kişisel veri; KVKK aydınlatması program dışında (ör. yazılı bildirim / iş sözleşmesi eki) yapılmalı. Konumları yalnız yönetici
  görür; yalnız son konum tutulur, eskisinin üzerine yazılır.


### 2. Resmi fatura yüklemede işlenen faturalar üstteki listeden düşsün (24.11.2026)
- Kullanıcı: "Resmi fatura yüklemede onaylanan faturalar yukarıdaki listeden düşsün".
- Üstteki alış faturası kartlarından (sekme şeridi) **taslak alış faturası oluşturulanlar** ve **yalnız KDV (gider) olarak
  kaydedilenler** kaldırılır; sıradaki bekleyen fatura kendiliğinden açılır. "Daha önce girilmiş" (işlem yapılamayan) faturalar da
  listede durmaz, yalnız özet satırında sayıları yazar. "Atla" denilenler listede kalır (sonra dönülebilsin).
- Özet satırında: "x fatura işlendi (y taslak alış, z gider)" — tıklanınca işlenenlerin bağlantıları açılır.
- Satış görünümünde cariye bağlanan faturalar da "eşleşmeyen" sayısından düşer (bağlananlar listenin altına iner, soluk).
- Hepsi bitince: "Tüm faturalar işlendi" kutusu + Alış faturaları / Resmi faturalar / KDV durumu bağlantıları.

### 3. KDV durumu: devreden kutusu siyah yazı, alttaki toplamlar yukarı (24.11.2026)
- Kullanıcı: "Önceki aydan devreden KDV yazı rengi beyaz, onu siyah yapalım; en alttaki toplamları yukarı alalım".
- Devreden KDV kutusuna yazılan rakam şeritten beyaz renk alıyordu → kutu içi yazı siyah (kalın, okunur).
- Alttaki denklem satırı (Satış KDV − Alış KDV − Devreden = Ödenecek / Devreden) sonuç şeridinin hemen altına, iki sütunun üstüne
  taşınır; altta tekrar edilmez.

## İsteğe bağlı fikirler
- **Mysoft entegrasyonu (beklemede — kullanıcı 24.11.2026: "şimdilik dursun"):** gelen e-Faturaları Mysoft API'den otomatik
  çekip "Fatura yükle" akışına düşürme; onaylı satış fişinden e-Fatura / e-Arşiv kesme. Gerekenler: Mysoft'tan API kullanıcısı
  + test hesabı + API dokümanı; şifre sunucuda gizli girilir.
- Excel'den toplu ürün ve cari (açılış bakiyesi) aktarımı.
- Teklif / proforma / teslim formunu WhatsApp'tan link olarak gönderme; vadesi geçenlere hatırlatma mesajı.
- Yedeklerin ikinci bir konuma (ör. Google Drive) otomatik kopyalanması.
- Logonun yüksek çözünürlüklü orijinal dosyası gelirse Ayarlar'dan değiştirilmesi (şu anki logo e-posta imzasından kırpıldı, ~300 px).

## Tamamlananlar

### 24.11.2026 — 23. derleme: Resmi faturalar, tek yükleme ekranı, gider faturaları, iki sütunlu KDV
- **Finans → Resmi fatura yükleme** (tek menü; Stok altındaki "e-Fatura aktar" kalktı): alış ve satış XML'leri / zip karışık
  yüklenir, yönü program **vergi numarasından** ayırır (satıcı = firma → satış, alıcı = firma → alış, ikisi de değil → alınmaz).
  Firma vergi no yoksa ekran önce onu sorar. Dosyalar saklanmaz. Yükleme özeti + "Alış faturaları" / "Satış faturaları" görünümleri.
- **Satış faturaları = resmi faturalar:** fatura bilgileri kaydedilir (dosya değil), müşteriyle vergi no / ünvandan eşleşir;
  eşleşmeyenler listede cari ara-bağla ya da "Yeni cari aç" (aynı vergi no'lu diğer faturalar da bağlanır). Tekrar yüklenen
  sayılmaz. Cari bakiyesini, ekstreyi, stoğu, satış fişlerini, kasayı **etkilemez** — yalnız KDV durumunda kullanılır.
- **Alış faturası için seçim (renkli):** **📦 Stoklu alış (yeşil)** → ürün eşleştirme → taslak alış faturası;
  **🧾 Yalnız KDV – gider (açık mavi)** → stok / cari olmadan gider kaydı, gider türü (Akaryakıt, Telefon / internet, Kira,
  Kargo, Yemek, Elektrik / su / doğalgaz, Kırtasiye, Diğer). Seçim tedarikçinin vergi no'suna göre hatırlanır. Aynı fatura
  iki tarafta da kaydedilemez. Gider kaydı "Stoklu alışa çevir" ile silinip tedarikçi stoklu olarak işaretlenir (XML yeniden yüklenir).
- **Elle KDV kaydı:** e-Fatura olmayan belge için (alış / satış, tarih, firma, tutar, oran → KDV ve toplam hesaplanır).
- **Finans → Resmi faturalar:** Kesilen (satış) / Gider (yalnız KDV alış) sekmeleri, ay filtresi, arama, "yalnız eşleşmeyenler",
  toplam satırı; satıra tıklayınca ayrıntı (kalemler, KDV dökümü, tevkifat, cari bağla / değiştir / yeni cari, sil).
- **Cari ekranı → Resmi faturalar** sekmesi: yıl seçimi, o cariye kesilen faturalar (fatura tutarı, KDV, toplam), elle kayıt.
- **KDV durumu iki sütun:** üstte ay ve sonuç şeridi (ÇIKIYOR kırmızı / ÇIKMIYOR yeşil, devreden kutusu); **solda ALIŞ**
  (onaylı stoklu alışlar yeşil + gider kayıtları açık mavi, taslaklar soluk "sayılmadı"), **sağda SATIŞ** (resmi satış faturaları);
  her satırda fatura no + tarih, **cari adı** (bağlantılı) + vergi no, **Fatura tutarı · KDV tutarı · Toplam tutar**, alt toplam;
  "Fatura fatura / Cariye göre" görünümü (cariye tıklayınca o carinin faturaları). Altta denklem: Satış KDV − Alış KDV − Devreden
  = Ödenecek / Devreden. Telefonda kart görünümü.
- Renk açıklaması ekranlarda: ■ Stoklu ■ Stoksuz / gider.
- Test: kdv_testi.js yeniden yazıldı (yön ayrımı, eşleştirme, gider, tercih hafızası, mükerrer, elle kayıt, cari sekmesi, iki sütun).

### 24.11.2026 — 22. derleme: KDV durumu ("bu ay KDV çıkıyor mu?")
- Finans → **KDV durumu**. Dönem (ay) seçilir; büyük sonuç kartı: **"Bu ay KDV ÇIKIYOR — ödenecek ≈ X ₺"** (kırmızı) ya da
  **"Bu ay KDV ÇIKMIYOR — sonraki aya devreden ≈ Y ₺"** (yeşil).
- **Hesaplanan KDV:** kestiğiniz faturaların e-Fatura / e-Arşiv XML'leri (ya da zip) yüklenir. **Hiçbir şey kaydedilmez** —
  sunucu yalnız okuyup KDV özetini döner; özetler yalnız o sekmede bellekte durur (Temizle ile silinir, sekme kapanınca gider).
  Aynı fatura iki kez sayılmaz (ETTN); seçilen ayın dışındakiler, satıcısı firma olmayanlar (yanlışlıkla yüklenen alış XML'i)
  ve kursuz dövizli faturalar sayılmaz ve uyarılır. Tevkifatta alıcının ödeyeceği kısım düşülür; iade faturaları ayrıca belirtilir.
  Dövizli faturalar faturadaki kurla TL'ye çevrilir. Büyük yüklemeler parça parça gönderilir.
- **İndirilecek KDV:** programdaki o ayın **onaylı alış faturalarından** (fatura tarihi); taslak bekleyenler "sayılmadı" uyarısında,
  bağlantılı.
- **Önceki aydan devreden KDV** kutusu (yalnız bu tarayıcıda hatırlanır). KDV oranlarına göre açılır döküm.
- Ay değiştirilince yüklenenler yeniden yüklenmeden o aya göre hesaplanır.
- Test: yeni kdv_testi.js.

### 24.11.2026 — 21. derleme: Program içi sekmeler
- Üst çubuğun altında **sekme şeridi**: menüden ya da bağlantıdan açılan her sayfa (fiş, teklif, alış, cari, iş, ürün, listeler…)
  bir sekme olur; aynı sayfa zaten açıksa o sekmeye geçilir.
- Sekmeler arasında geçişte sayfa **yeniden yüklenmez**: yazılan ama kaydedilmeyen satırlar, arama kutuları, kaydırma yeri kalır.
- Kaydedilmemiş değişikliği olan sekmede turuncu nokta; böyle bir sekmeyi kapatırken "Kaydetmeden kapatılsın mı?" sorulur.
  Kapatınca en son kullanılan sekmeye dönülür.
- ✕ ya da **orta tık** kapatır; **Ctrl+Alt+→ / ←** sekmeler arasında gezer, **Ctrl+Alt+W** kapatır; "Diğerlerini kapat".
- Arkadaki sekme, bu bilgisayarda bir kayıt değiştiyse ya da 2 dakikadan uzun arkada kaldıysa ve içine bir şey yazılmadıysa,
  açılınca kendini yeniler (güncel bakiye / liste). Yazılmış bir şey varsa dokunulmaz.
- Yeni belge kaydedilince sekme adresi ve adı güncellenir (ör. "Yeni teklif" → "TK-2026-0003"); silinen kaydın sekmesi kapanır.
- En fazla 12 sekme; fazlası açılınca en uzun süredir kullanılmayan (değişikliği olmayan) sekme kapanır.
- Açık sekmeler hatırlanır: sayfa yenilenince / ertesi gün aynı sekmeler gelir (içerik sunucudan yeniden okunur).
- Telefonda şerit yerine üst çubukta sayaçlı **"Açık sayfalar"** düğmesi (listeden geç / kapat). Teknisyen ekranında sekme yok.
- Test: yeni sekme_testi.js.

### 24.11.2026 — 20. derleme: Alış faturası fiş düzeninde, e-Fatura XML'den alış faturası
- **Alış faturası ekranı satış fişinin düzeninde:** solda tedarikçi kutusu (adres, VD/VN, telefon, cari bakiye, cari kartı
  bağlantısı), sağda fatura no / tarih / vade / para birimi + kur / açıklama; fişteki kalem tablosu (# / Kod / Ürün / Miktar /
  Birim / Birim fiyat / KDV % / Tutar — sabit sütunlar, kayma yok), tablonun üstünde + Satır, Stok listesi, Barkod,
  "Enter ile yeni satır aç", "Fiyatlar KDV dahil"; altta "Yalnız: …", KDV dökümü ve toplam bloğu. Telefonda kart görünümü.
  Ürün seçilince doğrudan miktara geçer; "değiştir" ile satırın kartı değiştirilir.
- **e-Fatura aktar (XML)** — Stok menüsünde ve Alış faturaları listesinde:
  - .xml ya da .zip (GİB / entegratör paketi) sürükle-bırak; birden çok fatura bir kerede. **Dosya saklanmaz**, yalnız okunur.
  - Okunanlar: tedarikçi (ünvan, VKN/TCKN, vergi dairesi, adres, telefon, e-posta), fatura no, ETTN, tarih, vade, tür,
    para birimi ve kur, kalemler (ad, tedarikçi kodu, barkod, miktar, birim, liste fiyatı, iskonto, net fiyat, KDV), toplamlar.
  - Tedarikçi eşleşmesi önce vergi no, sonra ünvan; yoksa fatura bilgileriyle **yeni tedarikçi** açılır (istenirse başka cari seçilir).
    Müşteri tipindeki cari tedarikçi olarak kullanılınca "her ikisi" olur.
  - Ürün eşleşmesi: barkod → **hatırlanan eşleşme** (tedarikçinin ürün kodu / adı) → ürün kodu → ad benzerliği (%). Zayıf
    benzerlik turuncu işaretlenir. Her kalemde "değiştir" / "yeni kart aç" (ürün ya da hizmet; faturadaki barkod karta yazılır).
    Onaylanan eşleşme saklanır; aynı tedarikçinin sonraki faturasında kendiliğinden gelir.
  - Uyarılar: daha önce girilmiş fatura (ETTN ya da tedarikçi + no; aktarılamaz), İADE faturası, tevkifat, belge altı iskonto,
    alıcı vergi no'su firmanınki değil (Ayarlar → Vergi no), satır toplamı / KDV faturadaki toplamla tutmuyor.
  - "Taslak alış faturası oluştur" → taslak açılır; kontrol edip **Onayla** ile stok ve maliyet girer (otomatik onay yok).
    Birden çok faturada sıradakine geçilir, "Bu faturayı atla" var.
- Silinen alış faturasının numarası yeniden kullanılabilir (fatura no tekilliği yalnız silinmemiş kayıtlarda).
- Telefonda onaylı fiş / teklif / alış satırları düzgün kart görünümünde (etiketli).
- Testler: yeni efatura_testi.js (XML/zip okuma, eşleştirme, hafıza, USD, uyarılar, mükerrer, silinen fatura, onay → stok;
  alış ekranı düzeni, e-Fatura sayfası akışı, telefon görünümü).

### 24.11.2026 — 19. derleme: Stoksuz işçilik / eğitim / hizmet satırları, fiş düzeninde teklif
- Satış fişinde **"Tür" sütunu kaldırıldı.** "+ Satır"ın yanında **"+ İşçilik", "+ Eğitim", "+ Hizmet"** düğmeleri: basılınca
  fişe doğrudan **stok kartı gerektirmeyen** satır eklenir (açıklama hazır gelir ve seçili olur, üzerine yazılır; işçilik / eğitim
  birimi "saat"). Bu satırlar stoktan düşmez, maliyeti 0; satırda renkli küçük etiketle (İşçilik / Eğitim / Hizmet) görünür.
  Açıklaması boş stoksuz satır kaydedilmez.
- **Ürün satırları için kural aynı:** stokta olmayan ürün yazılırsa yeni stok kartı açmanız istenir; kartsız ürün satırı kaydedilmez.
- Aynı düğmeler **"Teslim et / İşi ben yaptım"** penceresinde de ("+ Ürün / + İşçilik / + Eğitim / + Hizmet"); bu pencerenin
  kalem tablosunun sütun genişlikleri düzeltildi.
- **Teklif / proforma ekranı satış fişinin düzeninde:** üstte "Sayın" cari kutusu (adres, VD/VN, telefon, **cari bakiye**) ve sağda
  belge bilgileri (no, tarih, geçerlilik / son ödeme, para birimi + kur, iç not); altında durum düğmeleri; fişteki kalem tablosu ve
  düğmeler (+ Satır, + İşçilik, + Eğitim, + Hizmet, Stok listesi, Barkod, Enter ile yeni satır, **Maliyet / kâr**, KDV dahil);
  en altta "Yalnız: …", KDV dökümü, TL karşılığı, maliyet/kâr ve toplam bloğu. Giriş / kapanış metni, kaşe-imza ve TL karşılığı
  açılır-kapanır **"Teklif metinleri ve çıktı seçenekleri"** bölümünde. Üst düğmeler: Kaydet, Satış fişine dönüştür, Yazdır,
  Kopyala, İptal, Sil.
- Teklif satırları türünü (işçilik / eğitim / hizmet) saklar; kopyalanınca ve **satış fişine dönüştürülünce korunur**.
- Düzeltme: kalem tablosunda açılan ürün listesinde Esc artık yalnız listeyi kapatıyor (bazı durumlarda pencereyi kapatıyordu).
- Testler: API (stoksuz fiş / teklif satırı, açıklamasız reddi, kartsız ürün reddi, fişe dönüşte tür korunur), yeni
  stoksuz_testi.js (fiş, teklif, İşi ben yaptım ekranları).

### 24.11.2026 — 18. derleme: Üst çubukta "+ Satış fişi"
- Sağ üstte "+ İş ekle"nin yanında aynı görünümde **"+ Satış fişi"** (yönetici). Pencere: cari (açılır liste, "+ Yeni cari") ve tarih;
  **Fişi aç** → taslak fiş açılır, ilk kalem satırı hazır, imleç ürün kutusunda. Cari kartındayken o cari seçili gelir.
  Dar ekranda düğme 🧾 simgesine dönüşür. Fiş listesindeki "+ Yeni fiş" de aynı pencereyi kullanır.
- Açılır listeler: pencere açılınca kendiliğinden odaklanan kutuda liste hemen açılır (son kullanılanlar); **Esc yalnız listeyi
  kapatır**, pencereyi kapatmaz.

### 24.11.2026 — 17. derleme: Cari / ürün açılır listeleri
- Liste artık **üst katmanda** açılıyor: kalem tablosunun ya da pencerenin içinde kesilmiyor; kutunun hemen altında (yer yoksa
  üstünde), ekrana sığan yükseklikte; sayfa / tablo kayınca kutuyla birlikte gidiyor. Tüm cari ve ürün seçimlerinde geçerli.
- **Satırlar:** cari — ünvan büyük/kalın, altında telefon · il/ilçe · kod, sağda bakiye (borç kırmızı / alacak yeşil);
  ürün — ad büyük/kalın, altında marka · model · kod · barkod, sağda stok rozeti (var yeşil / az turuncu / yok kırmızı) ve fiyat;
  hizmet kartında "hizmet" rozeti. Aranan kelime **sarı vurgulu**, seçili satır mavi şeritli; liste en az 440–520 px genişlik,
  uzun adlar kesilmeden alt satıra iner.
- Altta "↑↓ seç · Enter ekle · Esc kapat" ve sonuç sayısı; en altta sabit **"+ Yeni cari: '…'"** / **"+ Yeni stok kartı aç: '…'"**
  (↓ ile gelinip Enter ya da tıklama).
- Kutu boşken **son kullanılan 5** cari / ürün en üstte ("Son kullanılanlar").
- **Telefonda** ekranın altından açılan tam genişlik panel; yazılan kutu panelin üstünde kalacak şekilde sayfa kaydırılır.

### 24.11.2026 — 16. derleme: Kartlı kalemler, yeni satır onayı
- **Her kalem stok kartlı:** satış fişi, teklif / proforma, alış faturası, "Teslim et / Tamamla" ve "İşi ben yaptım" satırlarında
  serbest açıklama satırı kalktı. Kartsız satır ekranda kaydedilmez; sunucu ve veritabanı da reddeder (KART_YOK). Eski kayıtlara dokunulmadı.
- **Bulunamayan ürün:** yazılan ad listede yoksa Enter'da ya da kutudan çıkınca **"… stokta bulunamadı. Yeni stok kartı açılsın mı?"**
  sorulur; benzer kartlar düğme olarak gösterilir (tıklayınca o seçilir). "+ Yeni stok kartı aç" yazılan adla kart formunu açar,
  kaydedince satıra bağlanır. Vazgeç: yazı silinir. Açılır listede de en altta **"+ '…' için yeni stok kartı aç"** seçeneği var
  (↓ ile gelinip Enter). Barkod bulunamazsa aynı soru, barkod kartta hazır.
- **Hizmet kartı:** ürün kartında **Tür: Ürün (stoklu) / Hizmet - işçilik (stok tutulmaz)**. Hizmet kartı stok miktarı tutmaz,
  stok hareketi oluşmaz; alışta son alış fiyatı maliyet olur; fişte satır türü karttan gelir. Ürün listesinde "hizmet" rozeti.
  Fişteki satır türü seçimi ve "+ İşçilik / + Hizmet" düğmeleri kalktı (Tür sütunu karttan).
- **Satır notu** (seri no, garanti…) kalemin altında kalmaya devam ediyor.
- **"Enter ile yeni satır aç"** onay kutusu (satış fişi, teklif, alış — kalem tablosunun sağ üstünde). Varsayılan **kapalı**:
  son hücrede Enter yeni satır açmaz, imleç hücrede kalır; yeni satır "+ Satır" / Ctrl+Insert ile. İşaretlenirse eski davranış.
  Seçim tarayıcıda hatırlanır.
- Testler güncellendi: API (kartsız satır reddi, hizmet kartı stok tutmaz), tarayıcı (stokta olmayan ad → kart aç → hizmet kartı),
  klavye (kutu kapalı/açık Enter davranışı).

### 23.11.2026 — 15. derleme: Form tasarımında sabit yazılar
- **Belge başlığı önizlemede tıklanıp yazılır** (PROFORMA FATURA, TAHSİLAT MAKBUZU…); Enter ile biter, boş bırakılırsa varsayılana döner.
- **Sabit yazılar** ayar grubu: o belge türündeki tüm sabit yazılar listede (Sayın, Tarih, No, Vade, Geçerlilik, Tel, VD/VN, Cari bakiye,
  (B)/(A), Brüt, İndirim, Net, KDV, Toplam, TL karşılığı, Yalnız, Teslim eden/alan, Ödeme yapan / Tahsil eden, Ödeme şekli adları
  (Nakit, Havale / EFT, Kredi kartı), Belge / dekont no, Tahsilat sonrası bakiye cümlesi, (Borç)/(Alacak), ASIL/SURET,
  MÜŞTERİ/FİRMA NÜSHASI, Cihaz, Seri no, Arıza, Aksesuar, Yapılan iş, Ekip, Süre, Teknisyen notu, Malzemeler, Müşteri notu,
  Dönem, Belge, Borç/Alacak/Bakiye, ekstre bakiye cümleleri ({tutar} ile), TASLAK/İPTAL, Belge doğrulama, Sayfa).
  Boş = varsayılan (dil İngilizceyse İngilizce varsayılan). Değişkenler kullanılabilir.
- Önizlemede bu yazılar kesik altı çizili; **tıklanıp doğrudan yazılır**, panel ile eşlenir. "↺ Tümünü varsayılana döndür".
- Test: form_testi.js'e sabit yazı kontrolleri (önizlemede yazma, panelden yazma, kayıt, yazdırma çıktısı).

### 22.11.2026 — 14. derleme: Form tasarımı
- **Menü:** kişisel menüde Ayarlar'ın altında "Form tasarımı" (ve Ayarlar'da sekme). Yalnız yönetici.
- **Liste:** 7 belge türü sekmesi (sayılarıyla): Teklif, Proforma, Satış fişi, Tahsilat makbuzu, Servis teslim formu, Dış servis fişi,
  Cari ekstre. Şablon kartları küçük önizlemeli; Düzenle · Kopyala · Varsayılan yap · Sil. İçe aktar / Tümünü dışa aktar (görseller dahil).
  Her türün **Standart** şablonu var: değiştirilemez, silinemez; kopyalanıp düzenlenir. Varsayılan silinirse Standart'a dönülür.
- **Yeni şablon:** 4 hazır tema önizlemeli: Klasik, Modern (renkli şerit), Sade, Kurumsal.
- **Düzenleme ekranı:** solda A4 önizleme, sağda katlanır ayar grupları.
  - Önizlemede **doğrudan yazma**: firma adı, firma bilgileri, giriş metni, notlar/şartlar, banka bilgileri, alt bilgi. Biçim çubuğu:
    kalın/eğik/altı çizili, hizalama, yazı büyüt/küçült, **alan ekle** ({musteri} {tarih} {belge_no} {toplam} {gecerlilik} {vade} {firma}),
    "otomatiğe dön".
  - **Logo:** köşesinden sürükleyerek büyüt, sürükleyerek sol/orta/sağa taşı; şablona özel logo; antet şeridi (firma / özel / yok).
  - Şablon adı, dil (Türkçe / İngilizce), başlık, sayfa boyu (A4, A4 yatay, A5), nüsha (makbuz / dış servis), tema.
  - Ana renk (+ **logodan renk öner**), yazı tipi, yazı boyu, kenar boşluğu.
  - **Bölümler:** aç/kapa + yukarı/aşağı sıralama. **Genel ayarlar:** aç/kapa düğmeleri (logo, müşteri adresi/telefon/vergi, tarih,
    vade, geçerlilik, güncel bakiye, satır notları, açıklama, kaşe, imza kutuları, filigran, sayfa no…).
  - **Kolon ayarları:** sıra no, ürün resmi, kod, barkod, raf yeri, açıklama, miktar, liste fiyatı, birim fiyat (KDV hariç/dahil),
    indirim, KDV oranı, tutar (KDV hariç/dahil) — aç/kapa, sırala, başlığını değiştir. **Dip toplam:** brüt, indirim, net, KDV, toplam, TL karşılığı.
  - **QR kod** (belge bilgisi ya da kendi metniniz, ör. IBAN). **Filigran:** taslak satış fişinde "TASLAK", iptalde "İPTAL".
    **Sayfa numarası** (Chrome/Edge).
  - **Geri al / ileri al** (Ctrl+Z / Ctrl+Y), Ctrl+S kaydet, kaydetmeden çıkarken uyarı. **Sürümler:** her kayıtta önceki hal saklanır
    (son 10), geri yüklenebilir. **Önizleme verisi:** örnek veri ya da gerçek bir teklif / proforma / fiş / dış servis kaydı.
    **Deneme yazdır.** Telefonda Ayarlar / Önizleme sekmeleri.
- **Yazdırma:** tüm belgeler artık şablon motoruyla basılıyor (önizleme = kâğıt). Bir türde birden fazla şablon varsa yazdırırken
  seçilir (varsayılan seçili gelir).
- **Ürün kartı:** ürün resmi yükleme ve raf yeri (şablonda "ürün resmi" / "raf yeri" kolonları için).
- Güvenlik: metin kutuları hem sunucuda hem tarayıcıda temizlenir (yalnız biçim etiketleri). QR üretici standart kütüphane çıktısıyla
  birebir karşılaştırılarak doğrulandı.
- Test: form_testi.js (32 kontrol) + tüm paketler.

### 22.11.2026 — 13. derleme
- **Giriş ekranı animasyonu yenilendi:** akşam gökyüzü (yıldızlar, ay), ışıkları yanıp sönen bina cephesi. Usta merdivene
  tırmanır → kamerayı takar → vidalar (kıvılcım, kırmızı ışık) → kablo cephe boyunca switch'e iner → kamera yeşil yanar, görüş
  ışığı açılır → kablo giriş kutusuna ulaşır, kutu mavi parlar ve üstünde **"● CANLI"** kamera önizlemesi (saatli) açılır →
  usta aşağı iner. Sonra kamera yavaşça tarar, kabloda veri akar.
- **Telefonda:** sahne ekranın üst yarısında tam renkli, telefona göre kadrajlı; giriş kutusu altta kart; kablo switch'ten kutuya
  iner. Klavye açılınca sahne küçülür. Telefonda kutu kendiliğinden odaklanmaz (klavye sahneyi kapatmasın).
- Aynı gün ikinci girişte gösteri baştan oynamaz (son hali görünür). "Hareketi azalt" açıksa durağan son kare.
- Logo yüklenmemişse kutuda görünen küçük nokta kaldırıldı.

### 22.11.2026 — 12. derleme
- **Telefonda uygulama gibi görünüm** (yalnız telefon genişliğinde; bilgisayar görünümü aynı):
  - **Listeler sıkı satır:** solda ad + küçük bilgiler, sağda tutar/bakiye/stok. Cariler, fişler, işler, ürünler, teklifler, alışlar,
    kasa, envanter, dış servis… Ekrana 2–3 yerine 8–10 kayıt sığıyor. Fiş/teklif/alış listesinde KDV hariç ve maliyet telefonda gizli.
  - **Filtre:** üstte arama kutusu + "⚙ Filtre" düğmesi; diğer seçimler düğmeye basınca açılır, seçili filtre sayısı düğmede yazar.
  - **+ düğmesi:** "+ Yeni cari / satış fişi / ürün / teklif / iş…" sağ altta yuvarlak düğme.
  - **⋯ menüsü:** üst çubukta; Excel'e aktar, Yazdır, Sil, İptal gibi ikincil işler burada.
  - **Başlık tekrarı** kalktı (sayfa adı üst çubukta).
  - **Fiş / alış / teklif:** altta sabit çubuk — genel toplam, Kaydet, ✓ Onayla. Satır ekleme düğmeleri yana kayan tek satır.
  - **Pencereler tam ekran**, Kaydet/Vazgeç altta büyük düğmeler. **Geri tuşu** açık pencereyi kapatır (sayfadan çıkmaz).
  - **Aşağı çekince yenileme.** Yazı kutularında iPhone yakınlaştırması ve çift dokunma büyütmesi kapalı; düğmeler parmağa uygun boyda.
  - Kişisel menüde **"📱 Telefona uygulama olarak ekle"**: Android'de doğrudan yükleme penceresi, iPhone'da adım adım anlatım.
    Ana ekrandan açılınca tam ekran; çentik boşlukları ayarlı.
- Test: mobil_testi.js (+ düğmesi, ⋯ menüsü, filtre, tam ekran pencere, geri tuşu, fiş alt çubuğu, bilgisayarda değişiklik olmaması).

### 22.11.2026 — 11. derleme
- **Programı güncelle** (sağ üstteki kişisel menü, yalnız yönetici): kurulu sürüm, GitHub'daki yeni değişiklikler, son kontrol zamanı.
  Ekran açılınca yeni sürüm kendiliğinden kontrol edilir. **Şimdi güncelle** denince şifre tekrar sorulur; ardından yedek alınır,
  yeni sürüm indirilir ve program yeniden başlatılır. Adımlar ve ayrıntılı kayıt ekranda canlı izlenir. Program kapanıp açılırken
  sayfa bekler, bitince kendini yeniler (Ctrl+F5 gerekmez). Başarısız olursa hata kaydı görünür, program eski sürümle çalışmaya devam eder.
- **Güvenlik:** programa sunucu yetkisi verilmedi. Program yalnızca `guncelleme/` klasörüne istek dosyası bırakır; güncellemeyi
  sunucudaki `servis-takip-guncelleme` systemd servisi yapar. Bir kez `bash scripts/guncelleme_servisi_kur.sh` ile kurulur.
- Test: sahte git deposu + servis benzetimi ile uçtan uca (yanlış şifre, ilerleme, başarı sonrası "Program güncel").

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
