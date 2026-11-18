# MH-AKIL-2 (PR #8) — Android telefon kabul testi

Amaç: PR #8'deki **Kapasite alternatifleri** özelliğini gerçek Android telefonda denemek. Test
sırasında telefondaki mevcut projeler korunur; hiçbir proje silinmez, üzerine yazılmaz ve veri
şeması değişmez (PR #8 `store.js`'e dokunmaz; şema 2 olarak kalır).

Test APK'sı (PR #8, commit 9ad8cdf, CI başarılı):
https://github.com/ozanaydingunes/Irrismart/actions/runs/44366956383/artifacts/14457895694

## 1. Veri güvenliği adımları (testten önce)

1. Telefondaki uygulamada **Yedekle (JSON)** ile bir yedek alın ve dosyayı telefonda/bilgisayarda
   saklayın.
2. Yeni APK'yı **eski uygulamanın üzerine kurun. Uygulamayı kaldırmayın** (kaldırma bütün
   projeleri siler). APK'lar depodaki aynı imza anahtarıyla derlenir ve CI bunu her derlemede
   doğrular; bu yüzden üzerine kurulum veriyi korur.
3. Telefon "Uygulama yüklenmedi" derse kaldırmayın; durumu bildirin.
4. Testi **yeni bir test projesinde** yapın; mevcut projelerinizi açmanız gerekmez.

## 2. test2 test projesini oluşturma (elle — önerilen)

Projeler → **Yeni proje** → ad: `test2 (AKIL-2 testi)` → Veriler ekranında yalnız şunları girin
(diğerleri varsayılan kalsın):

| Alan | Değer |
|---|---|
| Bitki | Domates (açık tarla) |
| Alan (dekar) | 288,9 |
| Bölge | Akdeniz |
| Kaynak | Kuyu |
| Debi (m³/h) | 86,3 |
| Dinamik seviye / emme (m) | 40 |

Sonra **Hesapla**. Uygulamanın varsayılanlarıyla (tınlı toprak, uzun kenara paralel sıra, normal
damlatıcı, dikdörtgen) sonuçların aynı olduğu motorla doğrulandı.

Not: Yedekten yükleme ile test projesi eklemek de mümkündür, ama aynı kimlikli proje varsa üzerine
yazma uyarısı çıkar. Elle oluşturma bu riski tamamen ortadan kaldırır.

## 3. Beklenen sonuçlar (motor, PR #8 dalı)

### Sonuç ekranı (hesap sonrası)

| Değer | Beklenen |
|---|---|
| Shift sayısı | 16 |
| Sulama turu / kullanılabilir | 30,7 h / 20 h |
| En büyük shift debisi | 77,8 m³/h |
| Ana hat | Ø160 PN6 |
| Pompa | 30 kW |
| Uyarılar | W-KAP-01 Uygunsuz, W-PN-02 Uygunsuz, W-SD-01 Uygunsuz, W-POM-02 Uyarı |

### Kapasite alternatifleri (Sonuç → "Kapasite alternatiflerini hesapla")

"8 motor çalıştırmasıyla hesaplandı." yazmalı.

Hacimler (günlük): bitkinin brüt ihtiyacı **2.399 m³**, damlatıcıların uyguladığı **2.379 m³**,
kapsama **%99,16**, mevcut kaynak kapasitesi **1.726 m³**.

Yalnız shift sayısı: "kaynakla her gruplamada en az **15** shift gerekir; tur ≥ **28,78** h > 20 h".

| Alternatif | Durum | Kaynak m³/h | Süre h/gün | Aralık | Shift | Tur / sınır h | En büyük shift | Gerekli H m | Motor kW | Ana hat | Açık kritik uyarı |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Mevcut durum | Uygunsuz | 86,3 | 20,0 | 1 | 16 | 30,70 / 20,0 | 77,8 | 73,9 | 30,0 | Ø160 PN6 | W-PN-02, W-SD-01 |
| Kaynak debisi (mevcut süre) | Kapasite uygun, kritik uyarı açık | **155,1** | 20,0 | 1 | **8** | **15,35 / 20,0** | 155,0 | 75,8 | 75,0 | Ø200 PN6 | W-PN-02, W-SD-01 |
| Günlük çalışma süresi | Uygunsuz | 86,3 | **24,0** | 1 | 16 | 30,70 / 24,0 | 77,8 | 73,9 | 30,0 | Ø160 PN6 | W-PN-02, W-SD-01 |
| Kaynak debisi + süre (22 h) | Kapasite uygun, kritik uyarı açık | **116,7** | **22,0** | 1 | **11** | **21,10 / 22,0** | 116,7 | 76,9 | 45,0 | Ø160 PN6 | W-PN-02, W-SD-01 |
| Kaynak debisi + süre (24 h) | Kapasite uygun, kritik uyarı açık | **116,2** | **24,0** | 1 | **12** | **23,02 / 24,0** | 116,1 | 68,0 | 37,0 | Ø200 PN6 | **yalnız W-SD-01** (W-PN-02 çözüldü) |
| Sulama aralığı (2 gün) | Uygunsuz | 86,3 | 20,0 | 2 | 16 | 61,39 / 40,0 | 77,8 | 73,9 | 30,0 | Ø160 PN6 | W-PN-02, W-SD-01 |

Kartın sonunda: **"Bütün zorunlu kontrolleri sağlayan alternatif bulunamadı."** Hiçbir satır
"Uygun" olmamalı: kapasite sorunu çözülen satırlarda bile su darbesi (W-SD-01) açık kalıyor.
"2 günden uzun aralıklar…" notu da görünmeli (bu toprak/bitki için en uzun aralık 2 gün).

**Performans:** 8 motor çalıştırması geliştirme sunucusunda 0,68 s sürdü. Telefonda birkaç kat
uzun sürmesi beklenir (yaklaşık 2–5 s). Kabul önerisi: **10 saniyenin altında**, hesap sırasında
ilerleme çubuğu görünür ve ekran donmaz.

## 4. Kontrol listesi (10 madde)

| No | Adım | Beklenen |
|---|---|---|
| T-01 | Yedek alın, APK'yı üzerine kurun, uygulamayı açın. | Bütün eski projeler listede, adları ve sayıları aynı. |
| T-02 | test2 projesini oluşturup Hesapla deyin. | §3 Sonuç ekranı değerleri; W-KAP-01 kartında "Kapasite alternatifleri bölümünden motorla hesaplanabilir" notu. |
| T-03 | Sonuç ekranında "Kapasite alternatifleri" kartını bulun. | Kart görünür; mobilde kartlar hâlinde (tablo değil), yatay kaydırma yok. |
| T-04 | "Kapasite alternatiflerini hesapla"ya basın; kronometreyle süreyi ölçün. | İlerleme çubuğu görünür; ekran kaydırılabilir; **< 10 s**; "8 motor çalıştırmasıyla hesaplandı." |
| T-05 | Kaynak debisi satırlarını kontrol edin. | 155,1 · 116,7 · 116,2 m³/h ve "en küçük değer… mutlak teorik minimum değildir" notu. |
| T-06 | Shift sayısı ve tur sürelerini kontrol edin. | 8 · 11 · 12 shift; 15,35/20 · 21,10/22 · 23,02/24 h; mevcut 16 shift 30,70/20 h. |
| T-07 | Günlük sulama süresi satırlarını kontrol edin. | "Günlük çalışma süresi" (24 h) Uygunsuz; 22 h ve 24 h'lik birleşik satırlar "Kapasite uygun, kritik uyarı açık". |
| T-08 | Kritik uyarıları kontrol edin. | 24 h satırında yalnız W-SD-01 (W-PN-02 çözüldü); diğer kapasite-uygun satırlarda W-PN-02 + W-SD-01; hiçbir satır "Uygun" değil ve "alternatif bulunamadı" mesajı var. |
| T-09 | Uygulamayı kapatıp açın; test2'yi açın. Sonra Veriler'de debiyi 90 yapıp Hesapla deyin. | Kayıtlı alternatifler geri gelir (yeniden hesap gerekmez); girdi değişince "kayıtlı alternatifler geçersiz; yeniden hesaplayın" uyarısı çıkar. Debiyi 86,3'e geri alın. |
| T-10 | PDF ve Excel raporu alın; diğer projelerinizden birini açın. | Raporlarda W-KAP-01 çözüm durumları ekranla aynı; eski projeniz değişmemiş, sonuçları önceki gibi. |

İsteğe bağlı: test bitince test2 projesini silebilirsiniz (yalnız o proje silinir).

## 5. Sonuç bildirimi

Her madde için ✓/✗, T-04'teki süre, telefon modeli ve Android sürümü. Sorun varsa ekran görüntüsü.
Test başarılıysa PR #8 için ayrıca birleştirme onayı istenecek.
