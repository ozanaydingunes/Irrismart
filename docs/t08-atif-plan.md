# T-08 — Kot verisi kaynak atfı (küçük, bağımsız PR planı)

Durum: **plan — onay bekliyor (18.11.2026). Kodlama yok.** MH-MANUEL-1A veri güvenliği koduna
karıştırılmaz; ayrı dal ve ayrı PR. Hesap motoru, veri modeli ve proje kayıtları değişmez.

## 1. Sorun

Uygulama arazi eğimini Open-Meteo Elevation API'den (Copernicus DEM GLO-90) alıyor
(`www/js/app.js` `measureSlope`, satır 316–325). Kaynak adı yalnız projeye kaydedilen metinde
(`cur.elev.src`) duruyor; **ekranda ve raporlarda atıf yok.** Harita köşesinde yalnız "Esri, Maxar"
uydu atfı var (satır 104).

## 2. Resmî şartlar (kodlamadan önce resmî sayfalardan son kez teyit edilecek)

| Kaynak | Şart (özet) | Resmî kaynak |
|---|---|---|
| Open-Meteo | Veriler CC BY 4.0: Open-Meteo'ya atıf ve değişiklik bildirimi. Elevation API sayfası Copernicus'a ve Open-Meteo'ya açık atıf ister. **Ücretsiz API yalnız ticari olmayan kullanım için** ve çağrı sınırları var (T-09) | https://open-meteo.com/en/terms · https://open-meteo.com/en/docs/elevation-api · https://open-meteo.com/en/pricing |
| Copernicus DEM | Değiştirilmiş veri/türetilmiş ürün için "produced using" bildirimi: *"produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"* (eğim/izohips türetilmiş üründür) | Copernicus DEM lisans metni ve COP-DEM koleksiyon sayfası |

Kesin metin, kodlamada lisans PDF'inden birebir alınır; ekrandaki kısa form ile rapordaki uzun
form ayrı tutulur.

## 3. Değişiklikler (yalnız metin ve bağlantı)

| Yer | Değişiklik |
|---|---|
| Arazi haritası atıf alanı (Leaflet) | Kot verisi kullanılmış projede: "Kot: Copernicus DEM GLO-90 · Open-Meteo (CC BY 4.0)" — iki bağlantılı |
| Eğim ölçüm bildirimi ve Veriler ekranındaki "Eğim yönü harita yükseklik verisinden alındı" notu | Aynı kısa atıf + "ayrıntı" bağlantısı |
| Ayarlar → Hakkında / Veri kaynakları (yeni küçük bölüm) | Uzun form: Copernicus "produced using" metni, Open-Meteo CC BY 4.0, Esri/Maxar, lisans bağlantıları |
| PDF ve Excel raporu | Varsayımlar/kaynaklar bölümüne uzun form (kot verisi kullanılmışsa) |
| Masaüstü (WEB-2) | Aynı metinler; sağ panelde kaynak satırı |
| Android | Aynı metinler; bağlantılar sistem tarayıcısında açılır |
| `i18n-dict.js` | Yeni metinler 8 dilde; lisans metni (özel isim ve telif satırı) çevrilmez |

Değişmeyenler: `engine.js`, `store.js`, proje alanları, kot verisi alma yöntemi.

## 4. Testler

| Kod | Test |
|---|---|
| A-01 | Kot verisi kullanılmış projede harita atfında Copernicus ve Open-Meteo görünür; kullanılmamışta görünmez |
| A-02 | Veriler ekranındaki eğim notunda atıf var |
| A-03 | Ayarlar → Veri kaynakları: uzun form ve bağlantılar |
| A-04 | PDF ve Excel raporunda uzun form (kot verisi kullanılmışsa) |
| A-05 | Android (Capacitor) ve masaüstü web aynı metinler; bağlantılar dış tarayıcıda |
| A-06 | 8 dil çevirisi (i18n testi) |
| A-07 | Bütün mevcut takımlar ve altın kayıtlar değişmez |

## 5. Ayrı karar: T-09 (Open-Meteo ücretsiz API şartı)

T-08 yalnız atfı ekler. Ücretsiz API'nin ticari olmayan kullanım şartı (T-09) ayrı bir karardır:
IrriGrow ticari kullanılacaksa abonelik, kendi sunucuda Open-Meteo ya da Copernicus DEM'in doğrudan
kullanımı gerekir. Bu karar proje sahibinindir; hukuki değerlendirme değildir.

## 6. Yerleşim

Küçük ve bağımsız olduğu için PR #8'den sonra herhangi bir noktada, MH-MANUEL-1A'dan ayrı PR olarak
yapılabilir. Öneri: MH-MANUEL-1A'dan hemen önce veya hemen sonra (proje sahibinin kararı).
