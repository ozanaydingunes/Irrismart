# IrriGrow — Play Store yayın kontrol listesi (K-7)

Ayrıntılar ve hazırlanan araçlar: `docs/k7-play-store.md` (kimlik, AAB, imza, lisanslar),
`docs/gizlilik-politikasi.md` (TR) ve `docs/privacy-policy.md` (EN), `docs/play-veri-guvenligi.md` (form yanıtları),
`docs/k7-aab-rehberi.md` (anahtar, GitHub Secrets, Play Console adım adım), `.github/workflows/aab.yml`.

**Yayın engeli (çözülmedi):** Open-Meteo ve Esri ticari kullanım koşulları — çözülene kadar üretim yayını yok.

Bu liste 1.0.0 sürüm adayından **ayrıdır**. K-7, gerçek cihaz testleri (`docs/k6-cihaz-test-listesi.md`) tamamlandıktan
ve proje sahibi onay verdikten sonra başlar. Hiçbir madde yapılmadan "yayına hazır" denmez.

## 1. Uygulama kimliği
- [ ] Kalıcı uygulama kimliği seçilmeli. Bugünkü `com.irrigrow.app.dev` bir geliştirme kimliğidir; Play Store'a bir kez
      yüklenen kimlik **değiştirilemez**.
- [ ] Kimlik değişirse cihazdaki 0.6.x/1.0.0 debug kurulumları ayrı uygulama olur: kullanıcıların projelerini
      **JSON yedekle** taşıması gerekir (yedekten yükleme mevcut projeleri korur, K-1).
- [ ] Uygulama adı, simge, kısa/uzun açıklama, ekran görüntüleri (telefon ve 7"/10" tablet), içerik derecelendirmesi.

## 2. AAB ve imza
- [ ] `bundleRelease` ile **AAB** üretimi (bugün yalnız debug APK üretiliyor).
- [ ] Play App Signing açık; **yükleme anahtarı** yeni üretilir. Anahtar ve şifreleri **depoya, kaynak koda veya sohbete
      yazılmaz**; yalnız GitHub Actions gizli değişkenlerinde (ör. `UPLOAD_KEYSTORE_B64`, `UPLOAD_KEY_PASSWORD`) tutulur.
- [ ] Depodaki `irrismart-debug.keystore` yalnız debug içindir; yayın derlemesinde kullanılmaz.
- [ ] `release` derleme türü: `minifyEnabled` kararı, sürüm kodu politikası (her yüklemede artar).
- [ ] targetSdk Play'in güncel şartını karşılıyor mu (bugün 36).

## 3. Gizlilik ve veri güvenliği
- [ ] Gizlilik politikası (herkese açık bağlantı). Belirtilmesi gerekenler:
  - Projeler yalnız cihazda saklanır; sunucuya gönderilmez, bulut eşitleme yoktur.
  - Harita görüntüsü için görüntülenen bölge **Esri** sunucularından istenir.
  - Eğim ölçümü için parsel noktalarının koordinatları **Open-Meteo**'ya gönderilir.
  - Konum (GPS) yalnız kullanıcı "◎" düğmesine bastığında, haritada göstermek için kullanılır.
- [ ] Play Console "Veri güvenliği" formu bu bilgilerle doldurulmalı (konum verisi üçüncü tarafa gider: Open-Meteo, Esri).
- [ ] İzinler gözden geçirilmeli (konum, dosya); gereksiz izin kalmamalı.

## 4. Harita ve kot verisi lisansları (ticari kullanım)
- [ ] **Open-Meteo**: ücretsiz API ticari olmayan kullanım içindir. Ticari bir Play Store sürümü için Open-Meteo ticari
      aboneliği (API anahtarı — gizli tutulur) veya başka bir kot kaynağı.
- [ ] **Copernicus DEM GLO-90**: atıf metni uygulamada ve raporlarda var (K-5); lisans koşulları yeniden okunmalı.
- [ ] **Esri World Imagery**: ticari mobil uygulamada kullanım koşulları (ArcGIS hesabı/lisansı, karo kullanım sınırları)
      doğrulanmalı; gerekirse ticari karo sağlayıcısı.
- [ ] Leaflet (BSD-2), jsPDF (MIT), SheetJS (Apache-2.0), DejaVu yazı tipi: lisans metinleri uygulama içinde
      ("Lisanslar" bölümü) gösterilmeli.

## 5. Yayın öncesi son denetim
- [ ] Bütün CI kontrolleri yeşil (testler, 38 hidrolik denetim, arayüz/web/masaüstü testleri, APK/AAB derlemesi).
- [ ] Gerçek cihaz test listesi A–E "Geçti".
- [ ] Önce **kapalı test** (internal testing) kanalı; geri bildirimden sonra üretim.
