# IrriGrow 1.0.7 — kararlı sürüm notları

IrriGrow hem Android telefonda (APK) hem masaüstü bilgisayarda (web) çalışır. İki platform **aynı uygulama kodunu, aynı hesap motorunu, aynı ürün şemasını ve aynı öneri algoritmasını** kullanır; yalnız dosya depolama yeri farklıdır.

## Kapsam
1. **Otomatik / Manuel Shift modu** (PR #40, gerçek telefonda 8/8 kabul): mod geçişi, shift sayısı (1 … alt ünite sayısı, gerçek atamayla), alt ünite taşıma, harita fırçası, debi / basınç / süre / kaynak kapasitesi ve uygunluk, Önizle / Uygula / İptal / Geri Al. Uygun olmayan düzen kaydedilse de "uygun değil" sonucu proje ve raporda kalır.
2. **Teknik ürün veritabanı** (PR #41): firma ve katalog kaydı; ürün ekle / düzenle / sil; teknik değer ve performans eğrisi (katalog + sayfa zorunlu, özgün değer ve birim saklanır); kullanıcı incelemesi ve ayrı mühendislik doğrulaması (tamlık, tutarlılık, EN 12201 / EN ISO 1452 serileri, işletme koşulu, doğrulayan kişi); arama ve filtre; PDF sayfa referansı.
3. **Akıllı ekipman seçimi** (PR #42): pompa, filtre, vana, PE/PVC boru, bağlantı elemanları; uygun / verisi eksik / uygun değil ve gerekçeleri; malzeme listesine ekleme (PDF/Excel raporunda görünür); hidroliği etkileyen seçimde taslak hesap → önce/sonra → Uygula / İptal / Geri Al.

## İki seviyeli ekipman önerisi
Malzeme → Ekipman önerileri ekranında her kategori (pompa, filtre, vana, boru, bağlantı elemanı) iki bölümden oluşur:

**A. Projem İçin Gereken Teknik Özellikler** — katalog gerekmez, her hesaplanmış projede görünür. Değerler motorun hidrolik sonucundan gelir; her satırın kaynağı yazılır (hesap / proje verisi / varsayım / jenerik motor verisi). Marka veya model önermez.
- Pompa: tasarım debisi, TDH, kritik shift, her shift'in Q–H çalışma noktası, kaynağa göre pompa tipleri, hidrolik güç, yaklaşık mil gücü aralığı (%60–75 verim varsayımı açıkça yazılır), emme koşulu; hesapta kullanılan jenerik pompa eğrisi "gerçek ürün değil" diye işaretlenir. Kuyuda dinamik su seviyesi / daldırma derinliği eksik veri olarak yazılır.
- Filtre: işletme debisi ve aynı anda çalışan shift (1), gerekli kapasite, su kaynağı, filtrasyon aşamaları, istasyon çıkışı işletme ve kapama basıncı, PN sınıfı, bağlantı hat çapı, hesapta kullanılan filtre kaybı ve kaynağı. Su kalitesi ve damlatıcı üreticisinin filtrasyon şartı eksik veri olarak yazılır.
- Vana: alt ünite ve shift debileri, ana hat debisi, PN sınıfı (ana hat / manifold ayrı), hat çapları, en küçük Kv (0,2 bar izin verilen kayıp varsayımıyla); açma-kapama, ana kesme, çekvalf, hava tahliye, yıkama, basınç düzenleme ve emniyet işlevleri ayrı ayrı (adetler malzeme listesinden).
- Boru: her ana hat segmenti için uzunluk, debi, malzeme/çap/PN, gerçek iç çap, hız, sürtünme kaybı; alternatif ana hat çapları; manifold ve lateral; hesap varsayımları.
- Bağlantı elemanı: malzeme uyumu (PVC-U ↔ PE geçiş), PN sınıfı, gerekli bağlantı elemanları. Güzergâh parsel çizilmeden yaklaşık ise adetlerin kesin olmadığı yazılır.

"Teknik şartnameyi malzeme listesine ekle" ile kategori şartnamesi malzeme listesine ve PDF/Excel raporuna "Teknik şartname" satırı olarak girer; rapor metni her seferinde güncel proje hesabından üretilir.

**B. Uygun Üretici ve Modeller** — doğrulanmış ürünlerle otomatik eşleştirme (uygun / verisi eksik / uygun değil, gerekçe, katalog sayfası). Eşleşme yoksa "Kayıtlı kataloglarda doğrulanmış eşleşme bulunamadı." yazılır; A bölümü yine görünür.

## Sonradan eklenen katalog ve ürünler
Öneri motoru hiçbir üreticiye sabitlenmemiştir. Yeni firma/katalog eklenip ürünün teknik bilgileri girildiğinde ve ürün **mühendislik doğrulamasından geçtiğinde**, ürün kod değişikliği veya yeni sürüm gerekmeden önerilere otomatik dahil olur. Yalnız PDF'i yüklenmiş ya da yalnız kullanıcı incelemesinden geçmiş ürün "doğrulanmış" sayılmaz ve uygun listesine girmez.

## Kullanım kılavuzu (kısa)
1. **Proje** — Projeler → Yeni proje; Veriler sekmesinde ürün, alan, su kaynağı (kuyu / yüzey / şebeke), debi ve derinlik girilir; isteğe bağlı olarak Arazi sekmesinde parsel çizilir veya KML içe aktarılır.
2. **Hesap** — Sonuç ve Hidrolik sekmeleri motorun hesabını gösterir (lateral, manifold, ana hat, pompa, enerji, uyarılar).
3. **Shift düzeni** — Hidrolik → Shift Yönetimi: *Otomatik* modda motorun önerisi; *Manuel* modda shift sayısı, alt ünite taşıma veya harita fırçası → Önizle → Uygula / İptal / Geri Al. Debi, basınç, süre ve kaynak kapasitesi uygunluğu her shift için gösterilir; uygun olmayan düzen kaydedilirse "uygun değil" sonucu raporda kalır.
4. **Firma katalogları ve ürünler** — üst çubuktaki katalog simgesi → Kataloglar: firma ve PDF katalog ekleme. Ürünler sekmesi: ürün, teknik değer ve eğri girişi (katalog sayfası zorunlu) → kullanıcı incelemesi → mühendislik doğrulaması. Yalnız doğrulanmış ürünler öneride "uygun" olabilir.
5. **Ekipman önerisi** — Malzeme sekmesi → Ekipman önerileri: kategori seçin (Pompa, Filtre, Vana, Boru, Bağlantı elemanı).
   - *A. Projem İçin Gereken Teknik Özellikler*: katalog gerekmeden hesaplanan şartname; "Teknik şartnameyi malzeme listesine ekle".
   - *B. Uygun Üretici ve Modeller*: doğrulanmış ürünlerle eşleşme; "Malzeme listesine ekle" veya hidroliği etkileyen ürünlerde "Hesaba uygula" → önce/sonra → Uygula / İptal; "Hesaptan kaldır (Geri Al)".
6. **Rapor** — Proje sekmesinden PDF ve Excel; malzeme listesi teknik şartname ve katalog kalemlerini içerir.
7. **Yedek** — aşağıdaki "Yedekleme ve geri yükleme" bölümü.

## Veriler nerede saklanır
| | Android | Masaüstü web |
|---|---|---|
| Projeler | Uygulama verisi (WebView yerel depolaması) | Bu tarayıcının yerel depolaması |
| Katalog ve ürün kayıtları | Uygulama verisi (IndexedDB) | Bu tarayıcının IndexedDB'si |
| Katalog PDF'leri | Uygulamanın özel dosya alanı | Bu tarayıcının IndexedDB'si |

Uygulamayı kaldırmak / uygulama verilerini temizlemek (Android) veya tarayıcı verilerini temizlemek / gizli pencere (web) bu verileri siler. **Otomatik bulut eşitlemesi yoktur**; telefon ile bilgisayar arasındaki taşıma aşağıdaki yedeklerle yapılır.

## Yedekleme ve geri yükleme (telefon ↔ bilgisayar)
1. **Proje yedeği** — Projeler → *Yedekle* (JSON). Bütün projeleri; manuel shift düzenini, kullanıcı kararlarını, katalog kalemlerini ve hesaba uygulanan ekipmanın hesap verisini içerir. Diğer cihazda Projeler → *Yedekten yükle*. Mevcut projelerin üzerine yazılmaz (aynı kimlik, farklı içerik → kopya olarak eklenir).
2. **Katalog ve ürün bilgi yedeği** — Firma katalogları → *Bilgileri dışa aktar (JSON)*. Firma, katalog bilgileri (ad, tarih, ürün grubu, kaynak, SHA-256) ve teknik ürün veritabanını (ürünler, değerler, eğriler, inceleme ve doğrulama durumu) içerir. **PDF dosyalarını İÇERMEZ** — dosyada `"pdfIcerir": false` ve açıklama yazar.
3. **PDF dosyaları** — kataloğun aslını (PDF) diğer cihaza kendiniz kopyalayın. Bilgi yedeğini geri yükledikten sonra kayıtlar "PDF bekleniyor" görünür; ilgili kataloğa aynı PDF'i seçin, SHA-256 ile eşleştirilir (farklı PDF reddedilir).

## Bilinen sınırlamalar
- PDF'ten otomatik teknik veri çıkarımı (metin/OCR) yoktur; değerler katalogdan elle girilir. Uygulama içi PDF görüntüleyici yoktur: PDF Android'de cihazın görüntüleyicisinde (sayfaya otomatik gidilmez, sayfa numarası gösterilir), web'de tarayıcıda ilgili sayfada açılır.
- Pompa NPSH denetimi proje verisinde emme koşulu olmadığı için uyarı olarak gösterilir; sahada denetlenmelidir.
- Katalog borusu hesaba yalnız motorun doğrulanmış boru kütüphanesinde aynı malzeme/çap/PN/et kalınlığıyla karşılığı varsa aktarılır; yoksa yalnız malzeme listesine eklenir.
- Bağlantı elemanları hidrolik hesaba girmez (uyumluluk denetimi ve malzeme listesi).
- Teknik şartname satır başlıkları ve değer metinleri Türkçe üretilir; diğer arayüz dillerinde bu satırlar Türkçe görünebilir.
- Kv gereksinimi 0,2 bar izin verilen vana kaybı, mil gücü aralığı %60–75 pompa verimi varsayımına dayanır (ekranda ve raporda yazılır).
- Filtrasyon µm ↔ mesh dönüşümü yapılmaz; proje gereksinimi mesh ise µm verili ürün "verisi eksik" görünür.
- 300 MB PDF Android 11'de gerçek dosya seçicisiyle denenmedi (emülatörde bellekte üretilen test dosyası okunamadı; Android 14'te geçti).
- Masaüstü testleri Chromium ile yapıldı; Firefox ve Safari bu ortamda test edilmedi.
- Bulut eşitlemesi yoktur; taşıma JSON yedekleri ve PDF kopyalarıyla yapılır.

## Test raporu (sürüm dalı claude/surum-1-0-7)
**Android ↔ masaüstü eşdeğerliği** (çalışma 45037226757): aynı proje, aynı ürün veritabanı ve aynı manuel düzenle hesaplanan parmak izi — hidrolik sonuçlar, otomatik ve 5 shift'lik manuel düzen, ürün kayıtları, uygun / verisi eksik / uygun değil önerileri (pompa, filtre, vana, boru, bağlantı), pompanın hesaba uygulanmış hâli, malzeme listesi (katalog kalemi dahil), PDF rapor verisi ve Excel çalışma kitabının bütün sayfaları:
- Masaüstü Chromium 1280 px = 390 px = Android 11 (WebView 83) = Android 14 (WebView 113): SHA-256 `d585676c…fb48`, **birebir aynı**.
- İlk çalıştırmada (45036439765) Excel sayfa özetlerinde bir fark raporlandı; karşılaştırma sayfaların tam içeriğine genişletildiğinde fark çıkmadı. İlk farkın nedeni belirlenemedi.

**Güncelleme (Android emülatörü, API 30 ve 34):** telefondaki 1.0.6-test.20 (versionCode 20) üzerine 1.0.7 (versionCode 21) kaldırmadan kuruldu; proje verisi bayt bayt korundu; katalog PDF'i ve SHA-256 korundu; ürün veritabanı geçişi (IndexedDB sürüm 2) yapıldı. İmza sertifikası SHA-256: `457741305275221a657c6594ff0e489316e2b1eef2c184bc4434c4e06bb20b2e`.

**Otomatik testler:** birim 282/282; arayüz (Chromium, telefon 320/390 px, tablet, masaüstü 1280 px): Manuel Shift 160, Shift düzenleme 156, görünürlük 79, seçici 105, cihaz 26, temel Shift 76, katalog 147, ürün veritabanı geçişi 7, ürün ekranı 66, ekipman önerileri 28, panel 226, uçtan uca 36, JSON taşıma 17, masaüstü 132, web 118 — hepsi geçti.

**Gerçek telefon:** 1.0.7 versionCode 21'de katalogsuz ekipman sekmeleri boş kalıyordu (düzeltildi). 1.0.7 versionCode 22 gerçek telefonda **6/6 geçti** — `docs/cihaz-kabul-1-0-7-vc22.md`. PR #40 (Manuel Shift) gerçek telefonda 8/8 geçmişti.

## Kararlı sürüm (main, versionCode 23)
versionCode 23, telefonda kabul edilen versionCode 22 ile aynı uygulama kodudur (www/ içinde yalnız sürüm numarası farklı); telefondaki 22'nin üzerine kaldırmadan kurulabilmesi için yükseltildi. Paket kimliği (`com.irrigrow.app.dev`) ve debug imzası değişmedi.
