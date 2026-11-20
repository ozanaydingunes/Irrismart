# K-5 — Kot verisi kaynakları, atıflar ve sınırlamalar

Durum: **kod PR'ı; proje sahibinin onayı olmadan birleştirilmez (19.11.2026).** 1.0 Kapanış Planı K-5.
Hesap motoru, altın kayıtlar ve hidrolik denetimler değişmedi (hesap değişikliği yok).

## Tek kaynak: `www/js/sources.js` (`IrriKaynak`)

Harita, Ayarlar, PDF ve Excel aynı metni bu saf modülden alır (DOM/ağ/depolama yok).

| Veri | Sağlayıcı | Atıf (özgün metin, çevrilmez) |
|---|---|---|
| Uydu görüntüsü | Esri World Imagery | Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community |
| Kot ve eğim | Open-Meteo Elevation API — Copernicus DEM GLO-90 (≈ 90 m) | © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved |

**Kot verisinin sınırları** (Ayarlar ve raporlarda aynı sırayla):
1. Çözünürlük ≈ 90 m: küçük parsellerde yalnız birkaç model hücresi düşer.
2. Yüzey modelidir: ağaç, sera ve yapı yükseklikleri kota karışabilir.
3. Düşey hata birkaç metreyi bulabilir; düz arazide eğim yönü bile yanılabilir.
4. Eğim, örnek noktalara düzlem uydurularak ortalama olarak bulunur; teras, kanal, yerel çukur/tümsek yakalanmaz.
5. Doğrulanmış hidrolik kot değildir: uygulama projesinden önce arazide ölçüm (GNSS veya nivelman) gerekir.

Ek olarak: KML/KMZ yükseklikleri saklanır, hesapta kullanılmaz. Gizlilik notu: projeler cihazda kalır; görüntü için
Esri'ye görüntülenen bölge, eğim için Open-Meteo'ya parsel noktalarının koordinatları gider.

## Nerede görünür

- **Harita:** sağ alt atıf `Esri, Vantor, Earthstar Geographics | Kot: Open-Meteo.com (CC BY 4.0) · Copernicus DEM GLO-90` (Open-Meteo ve lisans bağlantılı). Kot ölçülmüş
  parselde harita bilgisinde "Kot: Copernicus DEM (≈ 90 m) — ön inceleme, ölçülmüş kot değil · ayrıntı".
- **Ayarlar:** "Veri kaynakları ve sınırlamalar" kartı (ayrıntı bağlantısı bu kartı açar).
- **PDF:** "Varsayımlar"dan sonra "Veri kaynakları ve sınırlamalar" bölümü.
- **Excel:** "Varsayımlar" sayfasında "Veri kaynağı" satırları.
- Rapor bölümü yalnız **haritadan kot alınmış veya KML/KMZ ile içe aktarılmış** projelerde eklenir; diğer projelerin
  raporları birebir aynı kalır (altın kayıtlar değişmedi).

## Lisans ve yayın notu (K-7'de karara bağlanacak, uygulamada gösterilmez)

- Open-Meteo'nun ücretsiz API'si ticari olmayan kullanım içindir; Play Store'daki ticari bir sürüm için Open-Meteo
  ticari aboneliği veya başka bir kot kaynağı gerekir.
- Esri World Imagery karolarının ticari uygulamada kullanım koşulları (ArcGIS hesabı/lisansı) ayrıca doğrulanmalıdır.
- Gizlilik politikası yukarıdaki iki dış isteği (Esri, Open-Meteo) belirtmelidir.

## Testler

- `test/k5.test.js` (K5-01…06): atıf ve sınır metinleri, kaynaksız projede rapor değişmezliği, kotlu projede Excel
  satırları, KML parsel kaynağı ve elle eğim notu, çeviri, tek kaynak.
- `test-ui/k5.ui.js` (390 ve 1280 px, 48 kontrol): sahte Open-Meteo yanıtıyla gerçek akış, harita atfı ve kot notu,
  "ayrıntı" → Ayarlar kartı, Excel Varsayımlar içeriği, PDF, KML'deki 999 m yüksekliğin kullanılmadığı, taşma yok.
