# MH-2A — Arazi kot ve eğim analizi: görselleştirme, eğim analizi, kot profili

Durum: **teknik plan ve tasarım önizlemesi — onay bekliyor (18.11.2026). Kodlama yok.** MH-2'nin
ilk alt aşamasıdır: yalnız görselleştirme ve analiz. **Hesap motoruna kot/eğim etkisi eklenmez**;
hidrolik entegrasyon MH-3'tür ve ayrı doğrulama + onay ister.

Tasarım önizlemeleri: https://claude.ai/artifact/SDtmx5JGHPUJJpXPnMj17g (özel; yalnız proje sahibi açabilir; bütün değerler ÖRNEK).

## 1. Amaç

Arazi çizildiğinde ya da KML/KMZ ile yüklendiğinde kullanıcı arazinin eğimini ve kot dağılımını
görebilsin; ölçüm ve boyuna profil alabilsin. Android ve masaüstünde aynı analiz sonuçları.

## 2. Bugünkü durum (kod incelemesi)

| Konu | Durum |
|---|---|
| Kot kaynağı | Open-Meteo Elevation API (`app.js` `measureSlope`): parselin en çok 40 köşesi + sınır kutusundaki 6×6 ızgaranın parsel içindeki noktaları (en çok ≈ 76 nokta, tek istek) |
| Kullanım | Noktalara düzlem oturtulur (`geom.js` `planeFit`); uzun/kısa kenar eğimi **motor girdisine** yazılır (`inp.slopeLong`, `inp.slopeShort`, `inp.grad`) ve `cur.elev = { zmin, zmax, total, src }` saklanır |
| Önemli | Bu düzlem eğimi **bugün de** hidrolik hesapta kullanılıyor (motorun mevcut, onaylı eğim girdisi). MH-2A bu yolu **değiştirmez**; yeni analizler yalnız gösterim içindir |
| Atıf | Open-Meteo, Copernicus'a ve Open-Meteo'ya açık atıf ister; uygulamada ekranda gösterilmiyor (teknik inceleme **T-08**) |
| Düşey referans | Kaydedilmiyor (`cur.elev.src` yalnız metin) |

## 3. Kot verisinin doğruluğu (araştırma)

| Özellik | Değer | Kaynak |
|---|---|---|
| Veri seti | Copernicus DEM 2021, **GLO-90** | Open-Meteo Elevation API belgesi |
| Yatay çözünürlük | **90 m** (3 yay saniyesi); daha ince ayrıntı yoktur | Open-Meteo; Copernicus |
| İstek sınırı | İstek başına **en çok 100 koordinat** | Open-Meteo Elevation API belgesi |
| Model türü | **Yüzey modeli (DSM)**: bina, sera, ağaç ve altyapı yüksekliğini içerir | Copernicus DEM ürün açıklamaları |
| Düşey referans | **EGM2008 jeoidi** (EPSG:3855) — ortometrik kot | Copernicus DEM ürün açıklamaları |
| Mutlak düşey doğruluk | ≈ **< 4 m** (LE90) | Copernicus DEM ürün el kitabı (özetler; el kitabıyla teyit edilmeli) |
| Göreli düşey doğruluk | ≈ **< 2 m** (eğim ≤ %20), **< 4 m** (eğim > %20) | Aynı |
| Ara değer | Open-Meteo'nun ara değer yöntemi belgede bulunamadı (en yakın hücre / doğrusal bilinmiyor) | — |
| GLO-30 | 30 m sürüm var; Open-Meteo yalnız 90 m sunuyor | Copernicus; Open-Meteo blog |
| Lisans | Ücretsiz, atıf zorunlu | Open-Meteo; Copernicus |

**Mühendislik sonucu (hesap):** Göreli hata ≈ 2 m olan 90 m'lik iki komşu hücreden hesaplanan
eğimin belirsizliği ≈ 2·√2 / 90 ≈ **±%3**'tür. Damla sulama arazilerinin çoğu %0–3 eğimlidir;
bu nedenle **hücre bazında eğim haritası düz arazilerde gürültüden ibarettir**. Tüm parsele oturtulan
düzlem (çok noktanın ortalaması, uzun taban) çok daha güvenilirdir: 500 m tabanda belirsizlik
≈ 2,8 / 500 ≈ ±%0,6. Plan bu farkı ekranda açıkça gösterir.

## 4. Doğruluk kuralları (yanıltıcı hassasiyet yok)

| No | Kural |
|---|---|
| D2-1 | Örnekleme aralığı **DEM hücresinden ince olamaz** (≥ 90 m). Daha sık örnek, yeni bilgi değil aynı hücrenin tekrarıdır |
| D2-2 | Hücre bazında eğim haritası yalnız sınıflı (ör. 0–3 / 3–6 / 6–10 / 10–15 / >15 %) ve "±%3 belirsizlik" notuyla gösterilir; 0–3 sınıfının altı ayrıştırılmaz |
| D2-3 | Parselin içinde en az **3 × 3 hücre** (≈ 8 ha) yoksa eğim haritası, eğim yönü ve eşyükselti için **"Hesaplanamadı — daha yüksek çözünürlüklü kot verisi gerekli"**; yalnız min/maks/ortalama kot ve düzlem eğimi (belirsizliğiyle) gösterilir |
| D2-4 | Eşyükselti aralığı **en az 5 m** (göreli doğruluğun ~2,5 katı); daha sık aralık seçilemez. Etiketler tam metre, ondalık yok |
| D2-5 | Kotlar tam metre; eğimler en çok bir ondalık (%), derece en çok bir ondalık. Belirsizlik her istatistiğin yanında |
| D2-6 | Eğim yönü yalnız düzlem eğimi belirsizliğinin 2 katından büyükse gösterilir; değilse "düz — yön belirsiz" |
| D2-7 | DSM uyarısı: sera, bina, ağaç sıraları kotu yükseltir; "yüzey modeli — bitki/yapı yüksekliği dahil" notu her zaman görünür |
| D2-8 | İki nokta ölçümü: yatay mesafe geodezik (WGS84); kot farkı DEM'den, "±2–4 m" belirsizlikle; ortalama hat eğimi = kot farkı / mesafe ve belirsizliği. Mesafe < 180 m ise eğim "Hesaplanamadı" |
| D2-9 | Boyuna profil 90 m aralıkla örneklenir; çizgi basamaklı/düzgünleştirilmemiş gösterilir ve "DEM hücre aralığı" notu taşır |
| D2-10 | Atıf: "Kot verisi: Copernicus DEM GLO-90 (© ESA/Copernicus), Open-Meteo üzerinden" her kot ekranında ve raporda (T-08 kapanır) |

## 5. Veri modeli (genişlemeye uygun)

```js
// Projede (şema 3 ile uyumlu; MH-MANUEL-1A STATE_FIELDS'e eklenir)
project.kot = {
  kaynaklar: [{                       // her kot kaynağı ayrı; birleştirilmez
    id: 'dem-om-glo90', tur: 'dem',   // 'dem' | 'kml' | 'geotiff' | 'nokta' | 'olcum'
    ad: 'Copernicus DEM GLO-90 (Open-Meteo)', cozunurluk_m: 90,
    dusey: 'EGM2008',                 // 'EGM2008' | 'EGM96' | 'WGS84-elipsoit' | 'TUDKA-99' | 'bilinmiyor'
    yuzey: 'DSM',                     // 'DSM' | 'DTM' | 'olcum'
    dogruluk: { mutlak_m: 4, goreli_m: 2 }, lisans: 'serbest, atıf zorunlu', atif: '…', tarih: '…',
  }],
  ornekler: { 'dem-om-glo90': { aralik_m: 90, noktalar: [[lat, lng, z], …], tarih } },  // çevrimdışı görüntü için önbellek
  secili: 'dem-om-glo90',
};
// Değişmez: cur.elev (bugünkü DEM özeti) ve geoKaynak.yukseklikler (KML köşe yükseklikleri).
```

Kurallar:
- Farklı `dusey` değerli kaynaklar **doğrudan birleştirilmez** ve aynı haritada karşılaştırılmaz;
  dönüşüm yoksa ekranda yan yana ama ayrı gösterilir ("referanslar farklı — karşılaştırılamaz").
- KML yükseklikleri: `altitudeMode` `clampToGround` (varsayılan) ise yükseklikler anlamsızdır ve
  kot kaynağı sayılmaz; `absolute` ise "deniz seviyesine göre" (KML belgesi), düşey referans
  `bilinmiyor` olarak kaydedilir (EGM96 varsayılmaz), DEM ile birleştirilmez.
- İleride: GeoTIFF (yerel dosya, kendi çözünürlük/referansıyla), nokta kot ölçüleri (GNSS/total
  station; `WGS84-elipsoit` ise jeoit ayrımı gerekir), arazi ölçüm raporu. Her biri yeni bir
  `kaynaklar` girdisi; analiz modülü kaynaktan bağımsızdır.

## 6. Hesaplar (motor dışı modül)

Yeni `www/js/terrain.js` (DOM'a dokunmaz; Node'da test edilir):

| İşlev | Yöntem |
|---|---|
| Örnekleme | Parsel sınır kutusunda 90 m ızgara (parsel içi + 1 hücre tampon); 100'lük istek parçaları; sonuç `kot.ornekler`'e |
| İstatistik | Parsel içi min / maks / ortalama kot; düzlem eğimi (mevcut `planeFit`) ve belirsizliği; hücre eğimlerinin ortalaması ve en büyüğü (sınıflı) |
| Eğim ve yön | Merkezî fark (Horn) — hücre eğimi %, °; yön 8 sınıf (K, KD, D, …) |
| Eşyükselti | Kare yürütme (marching squares), aralık ≥ 5 m; etiketler çizgi üzerinde, kalabalıkta seyreltme |
| İki nokta | Geodezik mesafe; ızgaradan ara değer; kot farkı ve eğim + belirsizlik |
| Profil | Ana hat güzergâhı (`cur.route`) ve temsilî lateral(ler) boyunca 90 m aralıkla kot; en düşük/en yüksek nokta, toplam iniş/çıkış |

Hepsi gösterim içindir; `engine.js`'e hiçbir değer verilmez. Bugünkü düzlem eğimi → motor girdisi
yolu aynen kalır.

## 7. Ekranlar

- **Harita katmanları** (Arazi ekranı, katman menüsü): `Eğim haritası`, `Eşyükselti eğrileri`,
  `Eğim yönü` — her biri bağımsız aç/kapa; birim `%` / `°`; lejant ve renk skalası (renk + desen;
  yalnız renge dayanmaz).
- **Arazi kot özeti** kartı: min / maks / ortalama kot, düzlem eğimi ± belirsizlik, hücre eğimi
  ortalama/en büyük (sınıflı), baskın yön, kaynak + çözünürlük + düşey referans + DSM notu + atıf.
- **Ölç** aracı: iki nokta → mesafe, kot farkı, ortalama eğim (belirsizlikle).
- **Kot profili**: masaüstünde alt panelde, Android'de alt sayfada; ana hat ve seçilen lateral.
- Yetersiz veri: "Hesaplanamadı — daha yüksek çözünürlüklü kot verisi gerekli".

## 8. Uyumluluk

| Modül | Uyum |
|---|---|
| MH-KML | KML yükseklikleri ayrı kaynak; `clampToGround` ise kot kaynağı değil. İçe aktarılan parselde analiz DEM ile yapılır |
| MH-SHIFT | Etkisi yok; ileride shift etiketleriyle aynı katman yöneticisi |
| MH-AKIL-3 | Eğim sınıfları, arazi bölme ölçütü olarak ileride kullanılabilir (ayrı karar) |
| MH-3 | Hidrolik entegrasyon (lateral boyunca kot, alt ünite giriş basıncı) yalnız MH-3'te, bağımsız doğrulama ve onayla |
| Teknik inceleme T-01 | Profil uzunlukları geodezik; motorun küresel yerel düzlem farkı (±%0,2) ayrıca belirtilir |

## 9. Testler

| Kod | Test |
|---|---|
| E-01 | Sentetik düzlem DEM (bilinen eğim/yön) → eğim ve yön birebir |
| E-02 | Koni / eyer DEM → yön sınıfları ve eşyükselti topolojisi |
| E-03 | Küçük parsel (< 3×3 hücre) → "Hesaplanamadı" |
| E-04 | Eşyükselti aralığı 5 m altına inmez; etiketler tam metre |
| E-05 | % ↔ ° dönüşümü; yuvarlama kuralları (D2-5) |
| E-06 | İstek bölme: ≤ 100 koordinat; ağ hatasında kısmi sonuç gösterilmez |
| E-07 | Farklı düşey referanslı kaynaklar birleştirilmez |
| E-08 | KML `clampToGround` yükseklikleri kot kaynağı olarak kullanılmaz |
| E-09 | İki nokta ölçümü: bilinen geodezik mesafe; < 180 m'de eğim "Hesaplanamadı" |
| E-10 | Profil: 90 m aralık, uç noktalar, toplam iniş/çıkış |
| E-11 | Atıf her kot ekranında ve raporda |
| E-12 | Android (390 px) ve masaüstü aynı sayılar |
| E-13 | Motor ve altın kayıtlar değişmez; mevcut düzlem eğimi → motor girdisi aynen |
| E-14 | Çevrimdışı: önbellekteki örneklerle aynı görüntü; önbellek yoksa açık mesaj |

## 10. Yol haritası

MH-2A, MH-2'nin ilk alt aşamasıdır. Öneri (onay bekliyor): **MH-KML'den sonra**, çünkü
(1) içe aktarılan parsellerde de çalışmalı, (2) `kot` alanı MH-MANUEL-1A şema 3'e eklenir,
(3) hesap motoruna dokunmaz. Onaylı sıra korunursa MH-MANUEL-4'ten sonra gelir. T-08 (atıf
eksikliği) küçük bir metin düzeltmesidir; MH-MANUEL-1A veya MH-KML PR'ına eklenebilir (onayla).
MH-3 (hidrolik entegrasyon) MH-2A'dan sonra, ayrı plan ve doğrulamayla.

## Kaynaklar

- Open-Meteo Elevation API: https://open-meteo.com/en/docs/elevation-api
- Open-Meteo blog (yalnız 90 m model): https://openmeteo.substack.com/p/improving-weather-forecasts-with
- Copernicus DEM koleksiyonu: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- Copernicus DEM ürün el kitabı: https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf
- Copernicus DEM özeti (DSM, EGM2008, doğruluk): https://help.emd.dk/mediawiki/index.php/Copernicus_DEM
- KML yükseklik modları: https://developers.google.com/kml/documentation/altitudemode
