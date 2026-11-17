# PR-A — Eski APK üzerine yükseltmede yerel veri korunumu test planı

**Kapsam:** v0.6.0 (Capacitor 6, API 34, versionCode 8) → v0.6.1 (Capacitor 8, API 36, versionCode 9).
Paket adı (`com.irrigrow.app.dev`) ve debug imzası (SHA-256 `45:77:41:30…0B:2E`) **değişmez**.

## 1. Verinin nerede durduğu ve neden korunması beklenir

| Veri | Yer | Yükseltmede |
|---|---|---|
| Projeler | WebView `localStorage` → `irrismart.projects.v1` | Korunur |
| Fiyat ayarları | `irrismart.settings.v1` | Korunur |
| Kullanıcı kataloğu | `irrismart.catalog.v1` | Korunur |
| Kurtarma ve geçiş öncesi yedekler | `irrigrow.rescue.*`, `irrigrow.premigration.v1` | Korunur |
| Dışa aktarılan PDF/Excel/DXF | `Belgeler/IrriGrow` veya `Android/data/com.irrigrow.app.dev/files/IrriGrow` | Korunur |

`localStorage` iki şeye bağlıdır: uygulamanın veri klasörü (paket adı) ve WebView kökeni (`https://localhost`).

- Android, aynı paket adı ve aynı imzayla yapılan güncellemede veri klasörünü silmez.
- Capacitor 8'de varsayılan köken değişmedi. Ayrıca `capacitor.config.json` içinde `server.androidScheme = "https"` ve `server.hostname = "localhost"` olarak açıkça sabitlendi.

## 2. Otomatik doğrulamalar (CI'da her PR'da çalışır)

| Kontrol | Nerede |
|---|---|
| Gerçek v0.6.0 `localStorage` dökümü yeni kodla kayıpsız okunuyor; kimlik, girdi, harita, revizyon ve tarih alanları aynı; kurtarma alanına düşmüyor | `test/upgrade.test.js` |
| Şema geçişi tekrar çalıştırıldığında veri değişmiyor | `test/upgrade.test.js` |
| Depolama anahtar adları değişmedi | `test/upgrade.test.js` |
| Kullanıcı fiyat ayarı korunuyor ve hesapta kullanılıyor | `test/upgrade.test.js` |
| APK paket adı, versionCode, minSdk/targetSdk ve imza sertifikası beklenen değerlerde | `.github/workflows/apk.yml` |

**Ek olarak tarayıcıda yapılan elle test (PR-A geliştirmesi sırasında):**
1. v0.6.0 arayüzünde proje oluşturuldu ve elektrik fiyatı değiştirildi.
2. Aynı köken altında v0.6.1 açıldı.
3. Proje, ayarlar ve hesap sonucu aynen geldi; sayfa hatası olmadı.

**Sınır:** Bu testler Android sistemini değil, WebView'daki veri okuma katmanını doğrular. Gerçek cihaz testi aşağıda.

## 3. Gerçek cihaz testi (elle yapılacak)

**Hazırlık**
- Tercihen iki cihaz: biri Android 16 (API 36), biri Android 10 veya altı (eski depolama davranışı için). Emülatör kullanılabilir.
- v0.6.0 APK: `main` dalındaki son derlemenin (çalıştırma #15) Artifacts bölümünden alınır.
- v0.6.1 APK: PR-A'nın Actions çalıştırmasından alınır.
- Telefonda **Bilinmeyen kaynaklardan yükleme** izni açık olmalı.

**Adımlar**

| # | Adım | Beklenen sonuç |
|---|---|---|
| 1 | v0.6.0'ı kurun. Varsa önce **Projeler → Yedekle** ile JSON yedeği alın. | Yedek dosyası oluşur. |
| 2 | En az 2 proje oluşturun: biri dikdörtgen, biri haritada çizilmiş parsel (kaynak, istasyon, ana hat, elle düzenlenmiş shift). Ayarlar'da elektrik fiyatını değiştirin. Hidrolik Hesap Tablosu'na bir satır girin. | — |
| 3 | Her proje için Sonuç ekranının ekran görüntüsünü alın (shift sayısı, en büyük debi, pompa). Bir PDF ve bir Excel dışa aktarın. | — |
| 4 | Uygulamayı kaldırmadan v0.6.1 APK'yı açıp **Güncelle**'ye basın. | "Uygulama yüklenmedi" hatası çıkmaz. Hata çıkarsa imza uyuşmuyordur, 7. maddeye bakın. |
| 5 | Uygulamayı açın. Ayarlar'da **IrriGrow v0.6.1** yazmalı. | Projeler listesi aynı; adlar ve tarihler aynı. |
| 6 | Her projeyi açın. | Sonuç değerleri 3. adımdaki ekran görüntüleriyle aynı. Parsel, kaynak, ana hat ve elle düzenlenen shift'ler yerinde. Elektrik fiyatı korunmuş. Hidrolik tablo satırı yerinde. |
| 7 | PDF, Excel, hidrolik Excel, pafta PDF ve DXF dışa aktarın; **Aç** ve **Paylaş** düğmelerini deneyin. | Dosyalar `Belgeler/IrriGrow` klasörüne kaydedilir; açılır ve paylaşılır. 3. adımda alınan eski dosyalar da yerinde durur. |
| 8 | Arazi ekranında ◎ (konum) düğmesine basın. | Konum izni istenir ve harita konuma gider. |
| 9 | Android 16'da üst başlık ve alt sekmelere bakın. | Durum çubuğu veya gezinme çubuğuyla çakışma yok; dikey ve yatay ekranda düzgün. |
| 10 | Uygulamayı kapatıp açın, telefonu yeniden başlatın. | Veriler duruyor. |

**Başarısızlık durumları**
- **4. adımda "paket çakışıyor" hatası:** Telefondaki APK 4 Kasım 2026'dan önce, farklı bir debug anahtarıyla derlenmiş olabilir. Bu durumda uygulamayı **kaldırmayın**:
  1. 1. adımdaki yedeğin alındığından emin olun.
  2. Ancak ondan sonra kaldırıp yeni APK'yı kurun.
  3. **Projeler → Yedekten yükle** ile verileri geri yükleyin.
- **Projeler görünmüyorsa:**
  1. Uygulamayı kaldırmayın, yeniden kurmayın.
  2. Ekran görüntüsü alın.
  3. Chrome'da `chrome://inspect` ile WebView'a bağlanıp `localStorage` anahtarlarını kontrol edin.
  4. Sorunu bildirin.

## 4. Sonuç kaydı

| Cihaz / Android | 1–10 sonuç | Not |
|---|---|---|
| | | |

> Gerçek cihazda yapılmamış hiçbir adım "başarılı" sayılmaz.
