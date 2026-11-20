# K-7 — Play Store hazırlığı

Durum: **hazırlık.** Hiçbir madde yayın anlamına gelmez. Ücretli/ticari yayın, §4'teki harita ve kot verisi lisansları
çözülmeden yapılmaz. Yayın kontrol listesi: `docs/yayin-kontrol-listesi.md`.

## 1. Kalıcı uygulama kimliği (karar: proje sahibi)

| | Bugün | Öneri |
|---|---|---|
| Uygulama kimliği | `com.irrigrow.app.dev` (geliştirme) | `com.irrigrow.app` |

- Kimlik Play'e bir kez yüklenince **değiştirilemez**. Ters alan adı biçimi önerilir; alan adına sahip olmak zorunlu değildir,
  ancak başka bir uygulamanın kullanmadığı bir ad olmalıdır.
- Kimlik değişince cihazdaki debug kurulumu (`.dev`) **ayrı bir uygulama** olur: kullanıcılar projelerini
  **Projeler → Yedekle** ile JSON'a alıp yeni uygulamada **Yedekten yükle** ile taşır (K-1: mevcut projeler korunur).
- Depodaki `applicationId` değişmez; yayın derlemesi kimliği yalnız AAB iş akışının girdisinden alır
  (`-PirrigrowAppId=...`). Böylece test APK'ları ile Play sürümü yan yana kurulabilir.

## 2. AAB üretimi ve imzalama

- **Play App Signing** kullanılır: Google uygulamayı kendi anahtarıyla imzalar; biz yalnız **yükleme anahtarıyla** imzalarız.
  Yükleme anahtarı kaybolursa Play Console'dan sıfırlanabilir (uygulama anahtarı Google'dadır).
- Yükleme anahtarı **proje sahibinin kendi bilgisayarında** üretilir; anahtar, şifre veya base64 içeriği sohbete, depoya
  veya kaynak koda yazılmaz:
  ```
  keytool -genkeypair -v -keystore irrigrow-upload.jks -alias irrigrow-upload -keyalg RSA -keysize 4096 -validity 9125
  base64 -w0 irrigrow-upload.jks   # çıktıyı yalnız GitHub gizli değişkenine yapıştırın
  ```
  Anahtar dosyasının ve şifrelerin bir kopyası çevrimdışı ve güvenli bir yerde saklanmalıdır.
- GitHub → Settings → Secrets and variables → Actions → **Repository secrets**:
  `IRRIGROW_UPLOAD_KEYSTORE_B64`, `IRRIGROW_UPLOAD_STORE_PASSWORD`, `IRRIGROW_UPLOAD_KEY_ALIAS`, `IRRIGROW_UPLOAD_KEY_PASSWORD`.
- **İş akışı `.github/workflows/aab.yml`:**
  - PR'larda (android/ değişince) **imzasız** AAB derlenir — yayın derlemesinin bozulmadığını denetler; Play'e yüklenemez.
  - **Actions → AAB (Play Store) → Run workflow** (main birleştirildikten sonra görünür): kalıcı kimlik girilir; `.dev`,
    `.debug`, `.test` kimlikleri reddedilir; gizli değişkenlerden biri eksikse iş durur. Çıktı:
    `IrriGrow-<sürüm>-imzali-aab` paketinde `IrriGrow-<sürüm>-release.aab` + `.sha256`.
  - Şifreler yalnız derleme adımına gizli değişkenden verilir (`GITHUB_ENV`'e yazılmaz); geçici anahtar dosyası iş sonunda silinir.
- `android/app/build.gradle`: `release` imza ayarı yalnız `IRRIGROW_UPLOAD_KEYSTORE` ortam değişkeni varsa etkin;
  debug derlemesi ve depodaki debug anahtarı değişmedi.
- `versionCode` her Play yüklemesinde artmalıdır (bugün 1.0.0 → 10/11).

## 3. Play Console gereksinimleri

- [ ] Geliştirici hesabı; uygulama adı **IrriGrow**; varsayılan dil Türkçe; kategori: İş/Verimlilik (öneri).
- [ ] Mağaza girişi: kısa (≤ 80) ve uzun açıklama (TR, EN), simge 512×512, öne çıkan görsel 1024×500, telefon ve
      7"/10" tablet ekran görüntüleri.
- [ ] **Gizlilik politikası URL'si** (`docs/gizlilik-politikasi.md` TR, `docs/privacy-policy.md` EN → ad, e-posta ve tarih doldurulup herkese açık sayfada yayımlanmalı).
- [ ] **Veri güvenliği formu** (`docs/play-veri-guvenligi.md`).
- [ ] İçerik derecelendirmesi anketi; hedef kitle (18+ / profesyonel); reklam yok beyanı.
- [ ] **Konum izni beyanı:** uygulama `ACCESS_FINE_LOCATION` istiyor (yalnız "◎ konumum" düğmesiyle, ön planda).
- [ ] targetSdk Play'in güncel şartını karşılıyor (bugün 36).
- [ ] Önce **dahili test** kanalı → kapalı test → üretim.

## 4. Harita ve kot verisi lisansları — **YAYIN ENGELİ: çözülmeden ücretli/ticari yayın yok**

> **Durum (20.11.2026): çözülmedi.** Open-Meteo ve Esri ticari kullanım koşulları çözülene kadar Play Store **üretim**
> kanalına yayın yapılmaz; yalnız dahili test kanalı kullanılabilir. Adım adım rehber: `docs/k7-aab-rehberi.md`.

| Servis | Bugünkü kullanım | Durum | Seçenekler |
|---|---|---|---|
| **Open-Meteo Elevation API** | Eğim ölçümü (parsel noktaları, anahtarsız ücretsiz uç) | Ücretsiz uç **ticari olmayan** kullanım içindir | (a) Open-Meteo ticari aboneliği (API anahtarı → gizli değişken/sunucu tarafı), (b) Copernicus DEM'i doğrudan kullanan başka bir kaynak, (c) eğimi yalnız elle girme |
| **Copernicus DEM GLO-90** | Open-Meteo üzerinden | Atıf metni uygulamada ve raporlarda (K-5) | Lisans koşulları yayın öncesi yeniden okunmalı |
| **Esri World Imagery** | Uydu karoları (anahtarsız uç) | Ticari mobil uygulamada kullanım koşulları **doğrulanmadı** | (a) ArcGIS Location Platform hesabı ve anahtarı, (b) ticari karo sağlayıcısı, (c) açık lisanslı altlık |
| Leaflet (BSD-2), jsPDF (MIT), SheetJS CE (Apache-2.0), DejaVu yazı tipi | Uygulama içinde | Lisans metinleri uygulamada gösterilmeli | Ayarlar'a "Lisanslar" bölümü (küçük iş) |

Bu kararlar proje sahibine aittir. Seçilen sağlayıcının API anahtarı gerekirse **istemciye gömülmez**; ya kullanım sınırı
alan-adı/paket kısıtlı anahtar ya da küçük bir sunucu vekili gerekir — bu, 1.0 kapsamı dışında ayrı bir iş olarak planlanmalıdır.

## 5. 1.1 / 2.0 yol haritası (değişmedi)

Gerçek kot hesapları (ölçülmüş kot, kot tabanlı hidrolik), gelişmiş otomatik tasarım (MH-AUTO-2…5) ve geçici rejim
analizi (MH-AKIL-5) 1.1/2.0 kapsamındadır; 1.0'a eklenmez.
