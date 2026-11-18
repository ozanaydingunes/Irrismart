# IrriGrow — Android / Web özellik eşitliği matrisi

Son güncelleme: 18.11.2026 (MH-WEB-1). Bu tablo her yeni modülde güncellenir (yol haritası, kalıcı ilke 12).

## Ortak kod

Android uygulaması ve web sürümü **aynı `www/` klasörünü** çalıştırır:
- APK, Capacitor ile bu klasörü paketler.
- GitHub Pages da aynı klasörü yayımlar.

Hesap motoru, geometri, shift, uyarı ve çözüm katmanı, malzeme, rapor, veri modeli ve kataloglar tek
kopyadır; platforma göre ayrı kod yoktur.

Platforma özgü kod yalnız şu dört yerdedir:

| Konu | Android (Capacitor) | Web (tarayıcı) | Dosya |
|---|---|---|---|
| Dosya kaydetme / açma / paylaşma | Filesystem + FileOpener + Share eklentileri (Belgeler/IrriGrow klasörü, "Aç / Paylaş" paneli) | Tarayıcı indirmesi (İndirilenler klasörü) | `www/js/report.js` (`saveFile`) |
| Konum (GPS) | Geolocation eklentisi | `navigator.geolocation` (HTTPS ve kullanıcı izni) | `www/js/app.js` (`#mGps`) |
| Veri saklama | WebView `localStorage` (uygulama verisi) | Tarayıcı `localStorage` (bu tarayıcı ve bu adres) | `www/js/app.js`, `www/js/store.js` |
| Web bilgilendirme notu | Yok (Android'de not eklenmez) | Projeler ekranında depolama ve "eşitleme yok" notu | `www/js/platform.js` |

## Matris

**Durum işaretleri:**
- ✅ çalışıyor
- ➖ iki platformda da yok
- 🔶 kısmi

**Test kaynakları:**
- **web.ui:** `test-ui/web.ui.js` (yayın yolu `/Irrismart/`, Chromium).
- **panel.ui / uyari.ui:** mevcut arayüz testleri.
- **Cihaz:** proje sahibinin gerçek Android cihaz testleri (MH-1 9/9, MH-AKIL-1 11/11).

### A. Proje yönetimi

| Kod | Özellik | Android | Web | Ortak kaynak | Platforma özel | Gerekli geliştirme | Test |
|---|---|---|---|---|---|---|---|
| P-1 | Yeni proje oluşturma | ✅ | ✅ | app.js `newProject` | — | — | web.ui ✅ |
| P-2 | Projeleri listeleme, açma | ✅ | ✅ | app.js `renderProjects` | — | — | web.ui ✅ |
| P-3 | Yeniden adlandırma | ✅ | ✅ | app.js | — | — | web.ui ✅ |
| P-4 | Çoğaltma | ✅ | ✅ | store.js `duplicate` | — | — | web.ui ✅ |
| P-5 | Silme (onaylı) | ✅ | ✅ | app.js | — | — | web.ui ✅ |
| P-6 | JSON yedek (tüm projeler + ayarlar + katalog, sürüm bilgisi) | ✅ | ✅ | store.js `backupPayload` | Kaydetme yolu | Her projeye sürüm (schema) yazılması bu PR'da eklendi (iki platform) | web.ui ✅, assess.test ✅ |
| P-7 | JSON yedekten geri yükleme (mevcutlar silinmez, aynı kimlik onayla üzerine yazılır) | ✅ | ✅ | store.js `readBackup` / `mergeBackup` | Dosya seçici | — | web.ui ✅ (yeni tarayıcı profili) |
| P-8 | Eski sürüm projeleri / yedekleri (IrriSmart, v0.6.0) | ✅ | ✅ | store.js `migrateProject` | — | — | upgrade.test ✅, assess.test ✅ |
| P-9 | Revizyon geçmişi (son 20 hesap anlık görüntüsü) | ✅ | ✅ | store.js `snapshot` | — | Geri dönme arayüzü yok (iki platformda da) | upgrade.test ✅ |
| P-10 | Tek proje dışa/içe aktarma | ➖ | ➖ | — | — | **Öneri (ortak):** tek projelik JSON dışa aktarma | — |
| P-11 | Bulut eşitlemesi | ➖ | ➖ | — | — | Yok; arayüzde ima edilmez | web.ui ✅ (W-5) |

### B. Arazi ve harita

| Kod | Özellik | Android | Web | Ortak kaynak | Platforma özel | Gerekli geliştirme | Test |
|---|---|---|---|---|---|---|---|
| A-1 | Uydu haritası (Esri World Imagery + yer adları), atıf | ✅ | ✅ | app.js `openMap`, Leaflet | — | Ticari kullanım için lisans (mh-web-plan §4) | web.ui ✅ |
| A-2 | Haritada sınır çizme | ✅ | ✅ | app.js | — | — | web.ui ✅ (fare) |
| A-3 | Köşe noktası taşıma | ✅ | ✅ | app.js `vtx` | — | — | web.ui ✅ (fare sürükleme) |
| A-4 | "Uygula": alan, uzun/kısa kenar, parsel modu | ✅ | ✅ | geom.js | — | — | web.ui ✅ |
| A-5 | Kot/eğim ölçümü (Open-Meteo DEM) | ✅ | ✅ | app.js `measureSlope`, geom.js | — | Ticari kullanım koşulu (mh-web-plan §4) | web.ui ✅ (servis taklidiyle) |
| A-6 | Konum belirleme (GPS) | ✅ | ✅ | app.js | Geolocation eklentisi / tarayıcı API | — | web.ui ✅ |
| A-7 | Yakınlaştırma, kaydırma, tam ekran harita | ✅ | ✅ | Leaflet, app.js | — | — | web.ui ✅ |
| A-8 | Su kaynağı konumu | ✅ | ✅ | app.js | — | — | web.ui ✅ |
| A-9 | Pompa istasyonu konumu | ✅ | ✅ | app.js | — | — | web.ui ✅ |
| A-10 | Alan bilgisi (dekar, hektar, köşe sayısı, kendini kesme uyarısı) | ✅ | ✅ | app.js, geom.js | — | — | web.ui ✅ |
| A-11 | Ana hat güzergâhı çizme | ✅ | ✅ | app.js | — | — | web.ui ✅ |
| A-12 | Haritada plan katmanı (lateral, manifold, ana hat, shift renkleri, açılır bilgi) | ✅ | ✅ | app.js `drawPoly` | — | — | web.ui ✅ (canvas pikseli; Plan aç/kapa) |
| A-13 | Shift sınırlarını haritada düzenleme (fırça) | ✅ | ✅ | app.js shift modu | — | — | web.ui ✅ (fare ile atama, otomatik'e dönme) |
| A-14 | Çevre uzunluğu gösterimi | ➖ | ➖ | — | — | **Öneri (ortak):** MH-KML ile birlikte | — |
| A-15 | Geri al (son nokta) | ✅ | ✅ | app.js `#mUndo` | — | Tam geri al / yinele yok (iki platform) | — |
| A-16 | KML/KMZ içe aktarma | ➖ | ➖ | — | — | **MH-KML** (ayrı PR; web'de sürükle-bırak dahil) | — |

### C. Girdi verileri (Veriler ekranı)

| Kod | Özellik | Android | Web | Test |
|---|---|---|---|---|
| V-1 | Arazi: tasarım geometrisi, alan, sıra yönü, uzun/kısa kenar, eğimler, manifold hattı sayısı, ana hat çap düzeni | ✅ | ✅ | web.ui ✅ (alan listesi) |
| V-2 | Bitki ve iklim: bitki, sıra arası, sıra üzeri, bölge, tepe ET₀, toprak, sulama aralığı | ✅ | ✅ | web.ui ✅ |
| V-3 | Damla sistemi: damlatıcı tipi, lateral çapı, damlatıcı debisi, aralığı, ağaç başına damlatıcı, PC basınçları | ✅ | ✅ | web.ui ✅ |
| V-4 | Su kaynağı: kaynak türü, debi, dinamik seviye, şebeke basıncı, su kalitesi, kaynak–arazi mesafesi, kot farkı, günlük çalışma | ✅ | ✅ | web.ui ✅ (koşullu alanlar tasarım gereği gizlenir) |
| V-5 | Proje ayarları: planlama oranı (%90) | ✅ | ✅ | web.ui ✅, uyari.ui ✅ |
| V-6 | Doğrulama ve hata iletileri | ✅ | ✅ | validate.test ✅ |
| V-7 | Pompa, filtre, vana seçimi | ✅ | ✅ | Ortak katalog ve motor tarafından otomatik seçilir; kullanıcı kataloğu Ayarlar'dan yüklenir |

### D. Hidrolik hesaplar (8 bölüm)

| Kod | Bölüm | Android | Web | Test |
|---|---|---|---|---|
| H-1…H-7 | Sistem Özeti, Lateral, Manifold, Ana Boru Şebekesi, Shift Analizi (her shift ayrı), Pompa ve Filtrasyon, Basınç ve Enerji | ✅ | ✅ | panel.ui 226 ✅, web.ui ✅ |
| H-8 | Hidrolik Hesap Tablosu (SİSTEM, IRRIFRICT; projeden doldurma, segment ekleme/kopyalama/silme) | ✅ | ✅ | web.ui ✅ |
| H-9 | Hidrolik Excel (formüllü) | ✅ | ✅ | web.ui ✅, report.test ✅ |

### E. Shift yönetimi

| Kod | Özellik | Android | Web | Test |
|---|---|---|---|---|
| E-1 | Otomatik shift | ✅ | ✅ | golden ✅ |
| E-2 | Shift sayısı seçimi (alternatif tablosundan) | ✅ | ✅ | web.ui ✅ |
| E-3 | Haritada shift görüntüleme | ✅ | ✅ | web.ui ✅ |
| E-4 | Shift atamasını elle değiştirme (liste ve harita fırçası) / otomatik'e dönme | ✅ | ✅ | web.ui ✅ |
| E-5 | Shift başına debi, basınç, alan, süre, hacim, enerji, açılan manifoldlar | ✅ | ✅ | panel.ui ✅ |
| E-6 | Shift alternatiflerinin değerlendirilmesi (motor) | ✅ | ✅ | web.ui ✅ |
| E-7 | Kapasite alternatifleri (MH-AKIL-2) | 🔶 PR #8'de | 🔶 PR #8'de | PR #8 birleşince aynı kodla iki platformda; kapasite.ui 29 kontrol (PR #8 dalında) |

### F. Akıllı mühendislik uyarıları (MH-AKIL-1)

| Kod | Özellik | Android | Web | Test |
|---|---|---|---|---|
| F-1 | Uyarı kartları, kodlar, seviyeler, neden, değer, sınır | ✅ | ✅ | uyari.ui 54 ✅, web.ui ✅ |
| F-2 | Çözüm önerileri ve teknik durumları | ✅ | ✅ | assess.test ✅ |
| F-3 | Eksik veri bildirimi | ✅ | ✅ | assess.test ✅ |
| F-4 | Kullanıcı kararı (teknik uygunluğu değiştirmez) | ✅ | ✅ | uyari.ui ✅ |
| F-5 | Hidrolik panelden "Çözümler" bağlantısı | ✅ | ✅ | uyari.ui ✅ |
| F-6 | %90 planlama oranı ayarı | ✅ | ✅ | uyari.ui ✅ |

### G. Sonuç ekranı

| Kod | Özellik | Android | Web | Test |
|---|---|---|---|---|
| S-1 | Özet kartları, yerleşim planı (SVG) | ✅ | ✅ | web.ui ✅ |
| S-2 | Shift planlaması alternatifleri | ✅ | ✅ | web.ui ✅ |
| S-3 | Ana hat çap alternatifleri | ✅ | ✅ | web.ui ✅ |
| S-4 | Yerleşim alternatifleri (sıra yönü × lateral çapı) | ✅ | ✅ | web.ui ✅ |
| S-5 | Sulama programı (aylık), varsayımlar | ✅ | ✅ | web.ui ✅ |

### H. Malzeme ve teknik proje

| Kod | Özellik | Android | Web | Test |
|---|---|---|---|---|
| M-1 | Malzeme listesi, fiyat girişi, eksik fiyat bildirimi | ✅ | ✅ | web.ui ✅ |
| M-2 | Malzeme ekranından PDF/Excel | ✅ | ✅ | web.ui ✅ |
| T-1 | Teknik pafta (A0–A4, ölçek, yön, renk, katmanlar, çoklu pafta, etiket taşıma) | ✅ | ✅ | web.ui ✅ (çizim, biçim değişikliği, A3 PDF), drawing.test ✅ (ölçek, katman, çoklu pafta) |
| T-2 | Yakınlaştır / uzaklaştır / sığdır | ✅ | ✅ | web.ui ✅ |

### I. Raporlar ve çıktılar

| Kod | Çıktı | Android | Web | Dosya adı (iki platformda aynı) | Test |
|---|---|---|---|---|---|
| R-1 | PDF proje raporu | ✅ | ✅ | `IrriGrow_<proje>_<tarih>.pdf` | web.ui ✅ |
| R-2 | Excel hesap raporu (Uyarılar sayfası dahil) | ✅ | ✅ | `IrriGrow_<proje>_<tarih>.xlsx` | web.ui ✅, golden ✅ |
| R-3 | Hidrolik Excel | ✅ | ✅ | `IrriGrow_<proje>_hidrolik_<tarih>.xlsx` | web.ui ✅ |
| R-4 | DXF | ✅ | ✅ | `IrriGrow_<proje>_<tarih>.dxf` | web.ui ✅, golden ✅ |
| R-5 | A3 (ve diğer) teknik pafta PDF | ✅ | ✅ | `IrriGrow_<proje>_pafta_<format>_<tarih>.pdf` | web.ui ✅ |
| R-6 | JSON yedek, katalog şablonu | ✅ | ✅ | `IrriGrow_yedek_<tarih>.json`, `irrigrow-katalog-sablon_<tarih>.json` | web.ui ✅ |
| R-7 | Kaydetme yeri | Belgeler/IrriGrow + Aç/Paylaş | Tarayıcının İndirilenler klasörü | — | Platforma özel (gerçek fark) |

### J. Ayarlar

| Kod | Özellik | Android | Web | Test |
|---|---|---|---|---|
| J-1 | Açık / koyu / sistem teması | ✅ | ✅ | web.ui ✅, panel.ui ✅ |
| J-2 | Dil (8 dil) | ✅ | ✅ | web.ui ✅, i18n.test ✅ |
| J-3 | Birim fiyatlar, elektrik, faiz, ömür | ✅ | ✅ | web.ui ✅ (değer kaydı) |
| J-4 | Ekipman kataloğu yükleme / şablon / kaldırma | ✅ | ✅ | web.ui ✅ |
| J-5 | Birim ayarları (metrik dışı) | ➖ | ➖ | **Öneri (ortak):** iki platformda da yok; uygulama yalnız metrik |

### K. Masaüstü ergonomisi (WEB-2 / WEB-3 kapsamı)

Aşağıdakiler **iki platformda da bugün yoktur**. Gerektiğinde ortak geliştirme olarak eklenir ve
Android'de dokunmatik karşılığıyla sunulur.

| Kod | Özellik | Durum | Aşama |
|---|---|---|---|
| K-1 | Geniş harita + sol modül çubuğu + sağ ayrıntı paneli + açılır alt panel | ➖ | WEB-2 (tasarım önizlemesi sunuldu) |
| K-2 | Panel boyutlandırma, panel kapatınca çalışma alanının genişlemesi | ➖ | WEB-2 |
| K-3 | Haritada nesne seçimi → sağ panelde ayrıntı (shift, ana hat, manifold, lateral, kaynak) | 🔶 Bugün açılır bilgi balonu var | WEB-2 |
| K-4 | Klavye kısayolları | ➖ | WEB-2 |
| K-5 | Geri al / yinele (bütün düzenlemeler) | ➖ (yalnız son nokta) | WEB-2 (ortak) |
| K-6 | Hassas koordinat girişi (köşe, kaynak) | ➖ | WEB-2 (ortak) |
| K-7 | Sağ tık menüsü | ➖ | WEB-2 (Android'de uzun basma) |
| K-8 | Lateral ve manifold düzenleme | ➖ | WEB-3 (motor girdisi; ayrı plan ve onay) |
| K-9 | KML/KMZ sürükle-bırak | ➖ | MH-KML / WEB-4 |

## Hesap eşitliği

`test-ui/web.ui.js`, 19 altın senaryo ve test2 için tarayıcıdaki motor sonucunu Node'daki sonuçla
karşılaştırır. Karşılaştırılan alanlar:
- shift, tur, ana hat ağı, pompa, filtre, vana,
- su ihtiyacı, lateral,
- malzeme miktarları ve tutarları,
- uyarılar, uyarı kodları ve çözüm durumları.

Sonuç (18.11.2026):
- **19/19 senaryoda aynı.**
- 10 senaryo bit düzeyinde birebir.
- Kalan 9 senaryoda en büyük bağıl fark 6,2 × 10⁻¹⁵ (son ondalık basamak).

**Bit düzeyindeki farkın nedeni:** ECMAScript standardı `Math.pow`, `Math.exp` gibi fonksiyonların son
bitini JavaScript motoruna bırakır. Node, Chromium ve Android WebView farklı V8 sürümleri kullanır.
- Bu fark ekranda ve raporlarda gösterilen yuvarlanmış değerleri değiştirmez.
- Altın kayıt testlerindeki 1 × 10⁻⁹ bağıl tolerans burada da kullanılır.
- Android WebView'ün kendisi bu ortamda çalıştırılamadığı için Android ile web karşılaştırması gerçek
  cihaz testinde yapılır. Kod aynı olduğu için aynı sonuç beklenir.

## Bilinen gerçek platform farkları

1. **Kaydetme yeri.** Android'de Belgeler/IrriGrow klasörü ve Aç/Paylaş paneli var; web'de dosya
   tarayıcı indirmesiyle İndirilenler klasörüne gider.
2. **Veri saklama.** Her platform kendi deposunu kullanır; eşitleme yoktur ve taşıma JSON yedekle
   yapılır. Web'de depolama yaklaşık 5 MB ile sınırlıdır ve tarayıcı verileri temizlenirse projeler
   silinir. Web notunda bu yazılıdır.
3. **PDF dili.** İbranice ve Çince seçiliyken PDF iki platformda da İngilizce üretilir (yazı tipi kısıtı;
   önceki davranış).
