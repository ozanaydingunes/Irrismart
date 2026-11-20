# Harita ve kot verisi — ticari kullanım değerlendirmesi (kaynak bazında)

Okuma tarihi: **20.11.2026**. Alıntılar ilgili sayfalardan doğrudan alındı. Bu belge hukuki görüş değildir; son karar
ve sözleşme proje sahibine aittir. **Sonuç: iki servis için de ticari dağıtım izni bugünkü kullanım biçimiyle
doğrulanamadı → üretim yayını engeli sürüyor.**

## 1. Open-Meteo Elevation API

| Konu | Kaynakta yazan | Kaynak |
|---|---|---|
| Ücretsiz API kimin için | "You may only use the free API services for non-commercial purposes." | https://open-meteo.com/en/terms |
| Ücretsiz sınırlar | "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute." (aylık 300.000) | https://open-meteo.com/en/terms |
| Ticari olmayan örnek | "Private or non-profit websites or apps that do not have subscriptions or advertising." | https://open-meteo.com/en/terms |
| Ticari sayılan | "Websites or apps that have subscriptions or display advertisements." · "Commercial products or promotional activities." | https://open-meteo.com/en/terms |
| Ticari plan | "A subscription grants a commercial use licence and an API key for the dedicated customer endpoint at customer-api.open-meteo.com" · "Standard: 1M calls/month. Professional: 5M calls/month. Enterprise: 50M+ calls/month." | https://open-meteo.com/en/pricing |
| Veri lisansı | "API data are offered under Attribution 4.0 International (CC BY 4.0)" | https://open-meteo.com/en/licence |
| Atıf zorunluluğu | "You must include a link next to any location Open-Meteo data are displayed" (örnek: `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`) | https://open-meteo.com/en/licence |
| Kot verisi | "Data is based on the Copernicus DEM 2021 release GLO-90 with 90 meters resolution." · "All users of Open-Meteo data must provide a clear attribution to the Copernicus program as well as a reference to Open-Meteo." | https://open-meteo.com/en/docs/elevation-api |

**Değerlendirme**
- IrriGrow ücretli satılırsa, abonelikli olursa, reklam içerirse veya bir şirketin ticari ürünü olarak dağıtılırsa
  **ücretsiz uç kullanılamaz**; Standard veya üstü abonelik ve `customer-api.open-meteo.com` + API anahtarı gerekir.
  Fiyatlar sayfada betikle gösterildiği için bu okumada alınamadı; abonelikten önce sayfada doğrulanmalıdır.
- Ücretsiz, reklamsız, aboneliksiz bir dağıtım "non-commercial" örneğine benziyor; ancak geliştiricinin ticari
  bir kuruluş olup olmadığı ve uygulamanın tanıtım amacı taşıyıp taşımadığı da belirleyicidir. **Proje sahibi karar vermeli.**
- **Atıf (her durumda zorunlu):** RC3'te harita atfına `Open-Meteo.com` ve `CC BY 4.0` bağlantıları, Ayarlar'a bağlantılar,
  raporlara "Elevation data by Open-Meteo.com (https://open-meteo.com/), CC BY 4.0 (https://open-meteo.com/en/licence)"
  satırı eklendi. Copernicus atfı K-5'ten beri var.
- **API anahtarı gerekirse:** anahtar uygulamaya gömülmemeli (APK'dan okunabilir). Sunucu tarafı küçük bir vekil veya
  sağlayıcının kısıtlı anahtar seçeneği gerekir — 1.1 işi.

## 2. Esri World Imagery

| Konu | Kaynakta yazan | Kaynak |
|---|---|---|
| Atıf (güncel) | "Esri, Vantor, Earthstar Geographics, and the GIS User Community" | https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json (`accessInformation`) |
| Lisans | "This work is licensed under the Esri Master License Agreement." | aynı öğe (`licenseInfo`) |
| Çevrimdışı kullanım | "This layer is not intended to be used to export tiles for offline." | aynı öğe |
| Hesaplı ticari erişim | ArcGIS Location Platform: "Basemap tiles … 2M free then $0.15 per 1,000 tiles" — faturalandırma `basemaps-api.arcgis.com` istekleriyle | https://location.arcgis.com/pricing/ |

**Değerlendirme**
- Uygulama bugün karoları **anahtarsız** `server.arcgisonline.com` ucundan alıyor. Öğe sayfası yalnız Esri Master
  License Agreement'a atıf yapıyor; anahtarsız ucun **ticari mobil uygulamada** kullanımına açıkça izin veren bir metin
  bu okumada **bulunamadı**. → **Doğrulanmadı; engel.**
- Belgelenmiş yol: **ArcGIS Location Platform** hesabı, `basemaps-api.arcgis.com` (uydu stili) ve API anahtarı;
  ayda 2 milyon karo ücretsiz, sonrası 1.000 karo başına 0,15 $. Anahtar, istemci uygulamasında kısıtlanmış
  (izin verilen kaynak/uygulama) olmalıdır. Bu bir kod değişikliğidir → 1.1 (lisans kararından sonra).
- **Atıf:** RC3'te güncel metne ("Vantor") geçildi.

## 3. Yayın engeli durumu

| Konu | Durum | Gerekli karar/işlem |
|---|---|---|
| Open-Meteo — ticari kullanım | **Açık** | Dağıtım modeli (ücretsiz/ücretli, kuruluş) → gerekiyorsa abonelik + anahtarın güvenli kullanımı |
| Open-Meteo — atıf/bağlantı | RC3 ile karşılandı | — |
| Esri — anahtarsız uçta ticari kullanım | **Açık (doğrulanamadı)** | Esri'den yazılı teyit **veya** ArcGIS Location Platform'a geçiş |
| Esri — atıf | RC3 ile güncellendi | — |
| Copernicus DEM — atıf | K-5'ten beri var | — |
