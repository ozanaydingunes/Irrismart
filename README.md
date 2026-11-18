# IrriGrow v0.6.1 — Damla sulama ön projelendirme (Android)

## Platform
Capacitor 8 · Android hedef API 36 (Android 16) · en düşük API 24 (Android 7.0) · Node 22 · JDK 21 · Gradle 8.14.3 / AGP 8.13.
Test paketi `com.irrigrow.app.dev` (sabit debug imzası; eski sürümlerin üzerine kurulur).
Görünüm: Ayarlar → Görünüm (Açık / Koyu / Sistem ayarı); varsayılan açık tema.

## Dosya yapısı
| Dosya | Görev |
|---|---|
| `www/js/validate.js` | Girdi doğrulama (aralık, negatif, virgüllü sayı, seçimler) |
| `www/js/hydraulics.js` | Watters-Keller, Hazen-Williams, Christiansen, adım adım lateral/manifold |
| `www/js/geom.js` | Yerel koordinat, döndürme, sıra-sınır kesişimi, kırpma, eğim düzlemi |
| `www/js/layout.js` | Parsel üzerinde sıra, lateral, manifold ve alt ünite yerleşimi; sektör bölme |
| `www/js/catalog-data.js` | Varsayılan katalog (boru: standart nominal ölçüler; pompa/filtre/vana: JENERİK) |
| `www/js/catalog.js` | Pompa (eğri), filtre, vana seçimi; katalog doğrulama/birleştirme; fiyat önceliği |
| `www/js/engine.js` | Tasarım akışı, sektör alternatifleri, sulama programı, malzeme ve maliyet |
| `www/js/report-data.js` | PDF/Excel ortak tabloları (değerler sayı, birim ayrı sütun) |
| `www/js/hydro-table.js` | Hidrolik Hesap Tablosu: kullanıcının Excel'indeki SİSTEM ve IRRIFRICT sayfalarının birebir karşılığı |
| `www/js/hydro-view.js` | Hidrolik paneli görünüm modeli: motor sonucunu 8 sekmeye düzenler, değer kaynağı (girdi/varsayılan/hesap/katalog/jenerik) ve mühendislik kontrolleri; hidrolik hesap yapmaz |
| `www/js/hydro-panel.js` | Hidrolik paneli çizimi: Sistem Özeti, Lateral, Manifold, Ana Boru Şebekesi, Shift Analizi (shift başına ayrıntı), Pompa ve Filtrasyon, Basınç ve Enerji, Hidrolik Hesap Tablosu; masaüstü ve mobilde aynı işaretleme |
| `www/js/pipelib.js` | Excel'deki ANA BORULAR kütüphanesi (395 kayıt) |
| `www/js/i18n.js`, `i18n-dict.js` | 8 dil: tr, en, de, es, ru, it, he (sağdan sola), zh |
| `www/js/drawing.js` | Ortak proje çizim modeli: kimlikli boru segmentleri (AH/MF), ekipman kodları, shift kutuları, etiket yerleşimi; Teknik Proje SVG, ölçekli vektörel PDF pafta (A1–A4), DXF R12 (UTM) |
| `www/js/store.js` | Proje şeması (v2), güvenli migrasyon, bozuk veri kurtarma, revizyon geçmişi, kopyalama |
| `tools/audit.js` | Faz 1 denetimi: motoru bağımsız Darcy-Weisbach ve denge hesaplarıyla karşılaştırır |
| `tools/verify-excel.js` | LibreOffice ile bağımsız Excel doğrulaması (CI dışında) |
| `test/*.test.js` | 130 otomatik test (`npm test`): 90 birim/entegrasyon + 4 sürüm yükseltme (`upgrade.test.js`) + 28 MH-0 altın kayıt ve bağımsız doğrulama + 8 hidrolik paneli (`hydropanel.test.js`) |
| `test-ui/panel.ui.js` | Tarayıcı testleri (`npm run test:ui`, Playwright): panel masaüstü/mobil aynı veri, görünürlük, taşma, dokunma hedefi, açık/koyu tema karşıtlığı |
| `test/golden/`, `tools/golden.js` | Altın referans kaydı: 18 senaryo + hidrolik tablo; sonuçlar habersizce değişemez |
| `test/dogrulama.test.js`, `test/ref/epanet.js` | Bağımsız doğrulama: analitik çözümler ve EPANET 2.3 (epanet-js) |
| `tools/dogrulama-ozet.js` | Doğrulamada ölçülen farkların özeti |
| `docs/dogrulama/README.md` | Doğrulama yöntemi, EPANET varsayımları, toleranslar |
| `docs/hesap-degisiklik-kaydi.md` | Her hesap değişikliğinin gerekçesi ve altın kayıt parmak izi |
| `ci/build-apk.sh` | APK derleme betiği (CI ve yerelde) |

## Katalog yükleme
Ayarlar → Ekipman kataloğu → **Şablon indir**, üretici verileriyle doldurun, **Katalog yükle**.
Pompa eğrisi `[Q m³/h, H m, verim %]` noktalarıdır. `"dogrulandi": true` kayıtlar raporda doğrulanmış görünür;
`"yalnizKullanici": {"pompa": true}` jenerik pompaları devre dışı bırakır. Kayıtlardaki `fiyat` malzeme listesine geçer.

## APK derleme (GitHub Actions)
Kaynak kod doğrudan depodadır; `irrismart-src.zip` yalnız arşiv olarak tutulur ve derlemede kullanılmaz.
1. `.github/workflows/apk.yml`: her pull request'te, `main`'e her push'ta ve elle (Actions → APK derle → Run workflow) çalışır.
2. Önce `Testler` işi (`npm ci`, `npm test`, `tools/audit.js`), başarılıysa `Debug APK` işi (`ci/build-apk.sh`) çalışır.
3. Çalıştırma sayfası → Artifacts → `IrriSmart-AI-debug-apk`.

Capacitor'ın ürettiği dosyalar (`android/app/src/main/assets/`, `android/capacitor-cordova-android-plugins/`,
`res/xml/config.xml`) depoda tutulmaz; `npx cap sync android` (derleme betiğinin içinde) bunları yeniden üretir.

## Yerelde
```
npm ci && npm test
bash ci/build-apk.sh     # JDK 21 + internet gerekir
```
