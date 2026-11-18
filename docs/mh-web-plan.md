# MH-WEB — IrriGrow masaüstü web sürümü (GitHub Pages test ortamı)

Durum: **onaylandı (18.11.2026).** WEB-1 ayrı PR olarak hazırlandı; birleştirme proje sahibinin onayına bağlı.
Temel ilke: masaüstü sürümü Android uygulamasının **bütün özelliklerine** sahiptir; fark yalnız ekran düzeni ve
kullanım ergonomisidir. Özellik eşitliği: `docs/ozellik-esitligi.md`.
Dağıtım ayrı dal ve ayrı PR ile hazırlanır; proje sahibinin onayı olmadan `main`'e birleştirilmez.

## 1. Mevcut web sürümünün dağıtıma uygunluğu (inceleme sonucu)

| Konu | Durum | Not |
|---|---|---|
| Uygulama yapısı | **Uygun** | `www/` saf statik dosya (HTML + JS + CSS, 4,0 MB). Derleme adımı yok; Android APK da aynı klasörü paketliyor. |
| Hesap motoru | **Aynı** | Web ve Android aynı `www/js/engine.js` ve modülleri kullanır; ayrı kopya yoktur. |
| Bağımlılıklar | **Uygun** | Leaflet, jsPDF, SheetJS ve fontlar `www/vendor/` içinde yerel; dış CDN yok. |
| Göreli yollar | **Uygun** | Bütün betik ve stiller göreli yol kullanır; `/<depo>/` alt yolunda çalışır. |
| Dosya kaydetme (PDF, Excel, DXF, JSON yedek) | **Uygun** | `report.js` Capacitor yoksa tarayıcı indirmesine düşer; Playwright testlerinde PDF ve Excel indirmesi doğrulandı. |
| Yedekten yükleme | **Uygun** | `<input type=file>` ile çalışır; `IrriStore.readBackup` aynı. |
| Konum (GPS) | **Uygun** | Capacitor yoksa `navigator.geolocation`; GitHub Pages HTTPS olduğu için tarayıcı izin verir. |
| Gizli anahtar | **Yok** | Kodda API anahtarı, jeton veya parola bulunmuyor. |
| Veri saklama | **Dikkat** | Tarayıcı `localStorage`; telefondaki veriden **ayrıdır**. Bulut senkronizasyonu yoktur (§5). |
| Ekran düzeni | **Geliştirme gerekli** | Mevcut arayüz telefon odaklı sekmeli düzen; masaüstünde çalışıyor ama "geniş harita + yan panel" düzeni yok (§3, MH-WEB-2). |
| Harita/kot servisleri | **Koşullu** | Ücretsiz kullanım koşulları ticari kullanımı kısıtlıyor (§4). |

Sonuç: Mevcut sürüm **değiştirilmeden** GitHub Pages'e test ortamı olarak yayımlanabilir. Masaüstü
düzeni ve harita düzenleme istekleri ayrı alt aşamalar gerektirir.

## 2. Yayın adresi ve dağıtım

- **Adres:** `https://ozanaydingunes.github.io/Irrismart/`
  - Pages etkinleştirildiğinde GitHub bu adresi verir; kesin adres ilk dağıtımda doğrulanır.
- **Kaynak:** GitHub Actions ile dağıtım (`actions/upload-pages-artifact` + `actions/deploy-pages`).
  `www/` klasörü olduğu gibi yayımlanır.
- **Tetikleyici:** Yalnız `main` dalına birleştirme ve elle başlatma (`workflow_dispatch`).
  - PR dalları yayımlanmaz.
  - Dağıtımdan önce mevcut testler (`npm test`, arayüz testleri) çalışır; biri kırmızıysa yayın
    yapılmaz.
- **Proje sahibinin yapması gereken tek ayar:** Settings → Pages → Source: **GitHub Actions**.
  - Bu bir depo ayarıdır; ben değiştiremem ve değiştirmem.
- **Android'e etkisi yok.** Yeni iş akışı ayrı bir dosyadır (`.github/workflows/pages.yml`). `apk.yml`,
  Capacitor 8, API 36 ve Node 22 yapılandırması değişmez.

### Dosya yapısı (MH-WEB-1)

```
.github/workflows/pages.yml     yeni: test → www/ yükle → Pages'e dağıt
www/                            değişmez (aynı uygulama)
www/js/platform.js              yeni, küçük: web/Android ayrımı ve web bilgilendirme notu
docs/mh-web-plan.md             bu belge
test-ui/web.ui.js               yeni: alt yol (/Irrismart/) altında açılış, indirme, yedek testleri
```

`platform.js` yalnız web'de şunu gösterir: "Bu tarayıcıdaki projeler yalnız bu cihazda saklanır.
Telefonla otomatik eşitleme yoktur; projeleri JSON yedekle taşıyın." Android'de hiçbir şey
değişmez.

## 3. Alt aşamalar

| Aşama | Kapsam | Hesap motoru |
|---|---|---|
| **MH-WEB-1** | Pages test ortamı: mevcut uygulamanın yayımlanması, web notu, dağıtım iş akışı, alt yol testleri. Sekiz hidrolik bölüm, sonuçlar, uyarılar, PDF/Excel/DXF, JSON yedek/geri yükleme ilk günden çalışır (aynı kod). | Değişmez |
| **MH-WEB-2** | Profesyonel masaüstü düzeni (yalnız web, ≥ 1200 px): üst araç çubuğu, sol modül çubuğu (daraltılabilir), orta çalışma alanı, sağ mühendislik paneli (seçili nesnenin gerçek motor değerleri), alt panel (Shift'ler, ana hat kesitleri, malzeme, uyarılar; açılır/kapanır, boyutlandırılır). Bütün modüller masaüstü genişliğine uyarlandı. Android ve telefon düzeni aynen kalır. Kod: `www/js/desk.js`; test: `test-ui/desk.ui.js`. | Değişmez |
| **MH-WEB-3** | Fare/klavye ile hassas düzenleme — **ortak (Android + web)**: geri al/yinele geçmişi, klavye kısayolları, sağ tık (Android'de uzun basma) menüsü, koordinatla köşe/kaynak girişi, köşe ve güzergâh düzenleme; ayrıca lateral ve manifold düzenleme. Geometri ve motor girdisini değiştirdiği için önce **veri modeli** (düzenleme geçmişi, kullanıcı müdahalesinin projede saklanması, eski projelerle uyum) ve **test planı** hazırlanır; lateral/manifold düzenleme için hesap değişiklik kaydı ve altın kayıt etkisi ayrıca onaylanır. | Değişebilir — ayrı onay |
| **MH-WEB-4** | MH-KML tamamlandığında KML/KMZ yükleme web'de de etkin (aynı kod; masaüstünde sürükle-bırak eklenir). | Değişmez |

Önerilen sıra: MH-WEB-1, MH-AKIL-2'den hemen sonra yapılabilir; küçüktür ve uygulama kodunu
değiştirmez. MH-WEB-2 ve MH-WEB-3 yol haritasındaki sıraya proje sahibinin kararıyla yerleşir.

## 4. Harita, kot ve barındırma servislerinin koşulları

| Servis | Kullanım | Bugünkü durum | Kısıt / risk | Öneri |
|---|---|---|---|---|
| Esri World Imagery (`server.arcgisonline.com`) | Uydu görüntüsü + yer adları katmanı | Anahtarsız kullanılıyor; atıf "Esri, Maxar" var | Anahtarsız uç noktanın ticari kullanım koşulları açık değil. Esri konum servisleri için API anahtarı zorunluluğu getirdi; World Imagery öğesinin kendi kullanım şartları ayrıca geçerli. | Test ortamında atıfla kullanım. Ticari yayından önce Esri şartlarının yazılı olarak teyidi ya da ArcGIS Location Platform hesabı ve **alan adına kısıtlı** anahtar. |
| Open-Meteo Elevation API | Arazi kotu / eğim (DEM, 90 m) | Anahtarsız | Ücretsiz kullanım yalnız **ticari olmayan** amaçlar için; günde 10.000, saatte 5.000, dakikada 600 çağrı sınırı. Ticari kullanım ücretli abonelik gerektirir. | Test ortamında kullanılabilir. Ticari kullanımdan önce abonelik ya da başka bir DEM kaynağı (MH-2 kapsamında değerlendirilecek). |
| GitHub Pages | Barındırma | — | Herkese açık site. Ticari işletme, e-ticaret ve ticari hizmet (SaaS) barındırma amacıyla kullanılamaz. 1 GB site boyutu, ayda yaklaşık 100 GB yumuşak bant genişliği sınırı. | **Test ortamı için uygun.** Ticari kalıcı web sürümü için ileride başka bir barındırma (ör. kendi alan adı + statik barındırma hizmeti) planlanmalı. |

**Gizli anahtar kuralı:**
- Herkese açık web dosyalarına hiçbir gizli anahtar konmaz.
- Tarayıcı tarafında anahtar gerekirse yalnız sağlayıcının **istemci için tasarladığı, alan adına
  (referrer) kısıtlı** anahtar kullanılır.
- Kısıtlanamayan anahtarlar için küçük bir sunucu tarafı ara katman (proxy) gerekir. Bu,
  GitHub Pages'te yapılamaz; ayrı karar konusudur.
- Bu aşamada hiçbir anahtar eklenmez.

## 5. Veri ve gizlilik

- Web sürümündeki projeler tarayıcının `localStorage` alanında, **yalnız o tarayıcıda** saklanır.
  - Telefonla ya da başka bilgisayarla **eşitleme yoktur**. Arayüzde bulut eşitlemesi varmış gibi
    hiçbir ifade, simge veya düğme bulunmaz.
  - Taşıma yalnız JSON yedekle yapılır ("Yedekle" / "Yedekten yükle").
- GitHub Pages adresinin kökeni `ozanaydingunes.github.io`'dur. Aynı hesabın başka Pages siteleri
  aynı tarayıcı depolama alanını paylaşabilir. Bu test ortamı için kabul edilebilir; ticari
  sürümde ayrı alan adı önerilir.
- Site herkese açıktır. Proje verileri sunucuya gönderilmez. Kot sorgusu için yalnız koordinatlar
  Open-Meteo'ya, harita döşemesi için görüntü alanı Esri'ye gider (bugünkü Android davranışıyla
  aynı).

## 6. Testler (MH-WEB-1)

| No | Test |
|---|---|
| W-1 | Uygulama `/Irrismart/` alt yolunda açılır; bütün betik, stil ve fontlar yüklenir (404 yok). |
| W-2 | Sekiz hidrolik sekme, Sonuç ve uyarılar çalışır (mevcut 226 + 54 kontrol alt yolda da). |
| W-3 | PDF, Excel ve DXF tarayıcı indirmesi olarak iner ve açılır. |
| W-4 | JSON yedek indirilir, yeni bir tarayıcı profiline geri yüklenir; hesap ve uyarılar aynıdır. |
| W-5 | Web notu yalnız web'de görünür; "eşitleme / bulut" ifadesi hiçbir yerde yoktur. |
| W-6 | Depoda ve yayımlanan dosyalarda anahtar/jeton kalıbı taraması temiz. |
| W-7 | Android derlemesi (apk.yml) ve altın kayıtlar değişmez. |

## 7. Kabul ölçütleri

1. GitHub Pages adresinde uygulama açılır ve W-1…W-7 geçer.
2. Android APK, hesap motoru ve altın kayıtlar değişmez.
3. Gizli anahtar yoktur; harita servislerinin atıfları görünür.
4. Bulut eşitlemesi ima eden bir ifade yoktur.
5. Pages dağıtım PR'ı onaysız birleştirilmez. Pages ayarını proje sahibi açar.

## Kaynaklar

- GitHub Pages sınırları: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Open-Meteo kullanım şartları: https://open-meteo.com/en/terms, fiyatlandırma: https://open-meteo.com/en/pricing,
  Elevation API: https://open-meteo.com/en/docs/elevation-api
- Esri World Imagery kullanım şartları (servis bilgisinde gösterilen adres): https://goto.arcgisonline.com/maps/World_Imagery
- Esri konum servisleri ve API anahtarı değişikliği (2021): https://esri.com/content/dam/esrisites/en-us/media/legal/ma-and-prod-spec-scope-of-use-changes/term-changes-web-notice-e300-1-27-21.pdf
- Esri topluluk tartışması (anahtarsız World Imagery kullanımı): https://community.esri.com/t5/arcgis-online-questions/current-terms-of-use-for-http-services/td-p/173432

## 8. WEB-1 uygulama notları

- `.github/workflows/pages.yml`: yalnız `main` ve elle başlatma; yayın öncesi `npm test`, hidrolik denetim,
  arayüz testleri, `npm run test:web` ve gizli anahtar taraması; biri başarısızsa dağıtım yapılmaz.
- `www/js/platform.js`: yalnız tarayıcıda Projeler ekranına bilgi notu (yalnız bu tarayıcıda saklama,
  otomatik bulut eşitlemesi yok, JSON yedekle taşıma, depolama kullanımı ve ~5 MB sınırı). Android'de
  (Capacitor) hiçbir şey eklenmez.
- `www/js/store.js`: JSON yedeğe her proje sürüm bilgisiyle (`schema`) yazılır; kayıtlı liste değişmez
  (iki platformda ortak düzeltme).
- `tools/secret-scan.js`: yayımlanacak dosyalarda anahtar/jeton kalıbı taraması.
- `test-ui/web.ui.js`: `/Irrismart/` alt yolunda 110 kontrol (bütün ekranlar, harita, indirmeler, yedek,
  hesap eşitliği, 1280/1440/1920 px). `test/web.test.js`: iş akışı ve platform ayrımı denetimleri.
- Hesap eşitliği: tarayıcı ile Node motoru 19/19 senaryoda 1e-9 bağıl tolerans içinde aynı; 10 senaryo bit
  düzeyinde birebir, en büyük fark 6,2 × 10⁻¹⁵ (JS motorlarının `Math.pow` son biti; gösterilen değerler aynı).
- Mevcut arayüz geniş ekranda ortalanmış tek sütun olarak çalışır (taşma yok); profesyonel masaüstü düzeni
  WEB-2'dedir.
