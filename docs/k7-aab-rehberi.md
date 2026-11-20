# IrriGrow — İmzalı AAB ve Play Console adım adım rehberi

Bu rehber, kalıcı uygulama kimliği **`com.irrigrow.app`** (öneri; son karar proje sahibinde) ile Play Store'a
yüklenecek imzalı AAB'nin nasıl üretileceğini anlatır. **Depodaki kimlik değiştirilmedi:** debug APK
`com.irrigrow.app.dev` olarak kalır; kalıcı kimlik yalnız AAB iş akışının girdisiyle verilir.

> **Yayın engeli:** Open-Meteo ve Esri'nin ticari kullanım koşulları çözülmeden (`docs/k7-play-store.md` §4) **üretim
> kanalına yayın yapılmaz.** Bu engel kalkana kadar yalnız *dahili test* kanalı kullanılabilir.

## 1. Yükleme anahtarını oluşturma (yalnız kendi bilgisayarınızda)
1. JDK yüklü bir bilgisayarda (Android Studio ile gelir) bir terminal açın.
2. Anahtar deposunu oluşturun:
   ```
   keytool -genkeypair -v -keystore irrigrow-upload.jks -alias irrigrow-upload -keyalg RSA -keysize 4096 -validity 9125
   ```
   - İstenen şifreler: *anahtar deposu şifresi* ve *anahtar şifresi* (güçlü ve farklı şifreler seçin).
   - Ad/kuruluş bilgileri sertifikada görünür; gerçek ad veya kuruluş adı yazılabilir.
3. Dosyanın parmak izini not edin (Play Console'da karşılaştırmak için):
   ```
   keytool -list -v -keystore irrigrow-upload.jks -alias irrigrow-upload
   ```
4. **Yedek:** `irrigrow-upload.jks` dosyasını ve şifreleri çevrimdışı iki ayrı güvenli yerde saklayın
   (ör. şifre yöneticisi + şifreli USB bellek).
5. **Asla:** dosyayı, şifreleri veya base64 içeriğini depoya, koda, sohbete, e-postaya ya da PR açıklamasına yazmayın.

## 2. GitHub Secrets
GitHub → depo → **Settings → Secrets and variables → Actions → New repository secret**:

| Gizli değişken adı | İçerik |
|---|---|
| `IRRIGROW_UPLOAD_KEYSTORE_B64` | `irrigrow-upload.jks` dosyasının base64 hâli (macOS/Linux: `base64 -i irrigrow-upload.jks` veya `base64 -w0 irrigrow-upload.jks`; Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("irrigrow-upload.jks"))`) |
| `IRRIGROW_UPLOAD_STORE_PASSWORD` | anahtar deposu şifresi |
| `IRRIGROW_UPLOAD_KEY_ALIAS` | `irrigrow-upload` |
| `IRRIGROW_UPLOAD_KEY_PASSWORD` | anahtar şifresi |

Gizli değişkenler GitHub günlüklerinde maskelenir. İş akışı şifreleri ortam dosyasına (`GITHUB_ENV`) yazmaz ve
geçici anahtar dosyasını iş sonunda siler.

## 3. İmzalı AAB'yi üretme
1. GitHub → **Actions → AAB (Play Store) → Run workflow** (dal: `main`).
2. **Kalıcı uygulama kimliği** alanına kararlaştırılan kimliği yazın (ör. `com.irrigrow.app`).
   `.dev`, `.debug` ve `.test` ile biten kimlikler reddedilir.
3. İş bitince *Artifacts* → **`IrriGrow-<sürüm>-imzali-aab`** → `IrriGrow-<sürüm>-release.aab` (+ `.sha256`).
4. Günlükte `AAB imzalı` satırı ve sertifika sahibi/SHA-256 parmak izi görünür; 1. adımdaki parmak iziyle karşılaştırın.

## 4. Play Console ayarları
1. **Uygulama oluştur:** ad *IrriGrow*, varsayılan dil Türkçe, tür *Uygulama*, *Ücretsiz* veya *Ücretli* (ücretli seçimi
   sonradan ücretsize çevrilebilir, tersi mümkün değildir — lisans kararından sonra seçin).
2. **Play App Signing:** "Google'ın oluşturduğu uygulama imzalama anahtarını kullan" (önerilen). İlk AAB yüklenince
   yükleme anahtarı (1. adım) otomatik kaydedilir. *Kurulum → Uygulama bütünlüğü* sayfasında yükleme anahtarı
   parmak izini 1. adımdakiyle karşılaştırın.
3. **Uygulama içeriği** (*Politika → Uygulama içeriği*):
   - Gizlilik politikası URL'si (`docs/gizlilik-politikasi.md` / `docs/privacy-policy.md` yayımlandıktan sonra);
   - Veri güvenliği formu (`docs/play-veri-guvenligi.md`);
   - Reklamlar: *Hayır*; Hedef kitle: 18+ (profesyonel); İçerik derecelendirmesi anketi;
   - Konum izinleri: yalnız ön planda, kullanıcı "◎" düğmesine bastığında; arka plan konumu yok.
4. **Mağaza girişi:** kısa açıklama (≤ 80 karakter), uzun açıklama (TR, EN), simge 512×512 PNG, öne çıkan görsel
   1024×500, en az 2 telefon ekran görüntüsü, 7" ve 10" tablet ekran görüntüleri.
5. **Test → Dahili test:** test kullanıcılarının e-posta listesi; imzalı AAB'yi yükleyin; sürüm notu ekleyin.
6. Dahili test olumluysa → kapalı test → (lisans engeli kalktıktan sonra) üretim.

## 5. `com.irrigrow.app` üretim planı (kimlik henüz değiştirilmedi)
| Adım | Kim | Ne zaman |
|---|---|---|
| Kimlik kararı (`com.irrigrow.app` veya başka) | proje sahibi | ilk AAB'den önce — sonra değiştirilemez |
| Yükleme anahtarı + 4 gizli değişken | proje sahibi | ilk AAB'den önce |
| Gizlilik politikası: ad, e-posta, tarih doldurulur ve herkese açık adreste yayımlanır | proje sahibi + Claude | dahili testten önce |
| İmzalı AAB (Actions, kimlik girdisiyle) | proje sahibi tetikler | yukarıdakilerden sonra |
| Dahili test kanalı | proje sahibi | AAB'den sonra |
| Open-Meteo ve Esri ticari lisans/sağlayıcı kararı | proje sahibi | **üretimden önce zorunlu** |
| Uygulama içinde açık kaynak lisansları bölümü | Claude (küçük iş, ayrı PR) | üretimden önce |

**Kullanıcı verisinin taşınması:** `com.irrigrow.app` ile kurulan uygulama, telefondaki `com.irrigrow.app.dev`
kurulumundan ayrı bir uygulamadır. Projeler **Projeler → Yedekle** (eski uygulama) ve **Yedekten yükle** (yeni uygulama)
ile taşınır; yedekten yükleme mevcut projeleri silmez (K-1).
