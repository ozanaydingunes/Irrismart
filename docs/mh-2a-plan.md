# MH-2A — Arazi kot ve eğim analizi: eğim, izohips, kot profili

Durum: **tasarım yönü ve mühendislik yaklaşımı onaylandı (18.11.2026). Kodlama yok.** MH-2'nin
ilk alt aşamasıdır: yalnız görselleştirme ve analiz. **Hesap motorunun bugünkü davranışı
değişmez**; gerçek boru güzergâhı ve shift kotlarının hidrolik hesaba girmesi MH-3'tür (ayrı
plan, bağımsız mühendislik doğrulaması, ayrı onay).

Sıra (onaylı): PR #8 → MH-MANUEL-1A → MH-KML → **MH-2A** → MH-MANUEL-1B → MH-SHIFT-1 → MH-MANUEL-2 →
MH-SHIFT-2 → MH-MANUEL-3 → MH-SHIFT-3.

Tasarım önizlemeleri: https://claude.ai/artifact/SDtmx5JGHPUJJpXPnMj17g (özel; yalnız proje sahibi
açabilir; bütün değerler ÖRNEK — ölçülmedi).

## 1. Amaç ve katmanlar

Haritada çizilen **ve** KML/KMZ ile yüklenen parseller **aynı** kot analiz ekranını kullanır.
Android ve masaüstünde aynı analiz sonuçları.

| Katman | İçerik | Bağımsız aç/kapa |
|---|---|---|
| Uydu görüntüsü | Bugünkü Esri katmanı | ✓ |
| Eğim haritası | Sınıflı eğim, % veya ° | ✓ |
| İzohips (eşyükselti eğrileri) | Ana eğriler kalın, ara eğriler ince; tam metre etiketli; ana haritada **ve** ölçüm/profil ekranında | ✓ |
| Eğim yönü | 8 yön sınıfı, oklar | ✓ |
| Kot noktaları | Kotun gerçekten bilindiği noktalar (DEM örnek noktası, KML köşesi, ileride ölçüm noktası); her biri kaynağıyla | ✓ |
| Ana boru boyuna kot profili | Ana hat güzergâhı (ve seçilen temsilî lateral) boyunca profil | ✓ (alt panel / alt sayfa) |

İzohipsler ve eğim yalnız gerçek kot verisinden üretilir; ara değerle üretilen bir yüzey hesap
sonucu gibi sunulmaz (§4 D2-12).

## 2. Bugünkü durum (kod incelemesi)

### 2.1 Kot verisinin alınması (`www/js/app.js` `measureSlope`)

Parsel "Uygula" ile aktarılınca en çok 40 köşe + sınır kutusundaki 6×6 ızgaranın parsel içi
noktaları (≈ 76 nokta, tek istek) Open-Meteo Elevation API'ye gönderilir; gelen kotlara düzlem
oturtulur (`geom.js` `planeFit`). Sonuç: `inp.slopeLong`, `inp.slopeShort`, `inp.grad = { gx, gy }`
ve `cur.elev = { zmin, zmax, total, src }`.

### 2.2 Motorun bugünkü kot/eğim hesabı (`www/js/engine.js`) — MH-2A'da **değişmez**

| Yer | Davranış |
|---|---|
| 61–69 | Parsel modunda `inp.grad` varsa tek bir **eğik düzlem** `z = gx·x + gy·y`; lateral ve manifold eğimleri bu düzlemden (mutlak değer). Yoksa elle girilen uzun/kısa kenar eğimi; yön bilinmediği için yukarı yönlü en kötü durum |
| 144–147 | `dZ` (kaynak–arazi kot farkı) ve kuyu derinliği statik yüksekliğe girer |
| 157 | Her alt ünitenin kaynağa göre kot farkı (`u.rise`) düzlemden ya da eğimden |
| 186, 248–249, 292 | En alçak nokta (`zMin`) işletme ve kapama basıncı (PN denetimi) için |
| `hydraulics.js` 23–45 | Lateral basınç değişimi eğimi (mutlak) kullanır |

Yani kot verisi **bugün de** hidrolik hesaba girer, ama yalnız tek düzlem olarak. MH-2A'nın
ızgara/izohips/profil sonuçları motora verilmez. Düzlem yerine gerçek profilin kullanılması MH-3'tür.

## 3. Kot verisi: kaynak, doğruluk ve sınırlamalar

### 3.1 Kaynak

| Özellik | Değer | Kaynak |
|---|---|---|
| Servis | Open-Meteo Elevation API; istek başına en çok 100 koordinat | Open-Meteo belgesi |
| Veri seti | Copernicus DEM **GLO-90** (2021 sürümü) | Open-Meteo belgesi |
| Yatay çözünürlük | **90 m** (3 yay saniyesi) | Copernicus |
| Model türü | **Yüzey modeli (DSM)**: bina, sera, ağaç ve altyapı yüksekliği dahil | Copernicus ürün açıklamaları |
| Düşey referans | **EGM2008 jeoidi** (EPSG:3855) | Copernicus ürün açıklamaları |
| Veri dönemi | TanDEM-X/WorldDEM tabanlı; lisans metnindeki telif yılları 2010–2014 (DLR) ve 2014–2018 (Airbus). Hücre bazında ölçüm tarihi servisçe verilmez | Copernicus lisans metni (el kitabıyla teyit edilecek) |
| Ara değer | **Open-Meteo belgesinde belirtilmemiş** (en yakın hücre mi, doğrusal mı bilinmiyor). Ekranda "belirtilmemiş" yazar. IrriGrow'un kendi ızgara ara değeri (izohips, profil) **çift doğrusal** olarak ayrıca belirtilir | Open-Meteo belgesi |

### 3.2 Doğruluk — ölçütler karıştırılmadan

| Ölçüt | GLO-90 değeri | Anlamı | Kaynak |
|---|---|---|---|
| Mutlak düşey doğruluk | **< 4 m, LE90** | Hücre kotunun gerçek kota göre hatası, %90 olasılıkla 4 m'nin altında | Copernicus DEM Ürün El Kitabı (v5.0 ve v6.1) |
| Göreli düşey doğruluk | **< 2 m (eğim ≤ %20), < 4 m (eğim > %20), LE90** | 1° × 1° pafta içinde iki nokta arasındaki kot farkının hatası (noktadan noktaya) | El kitabı v6.1 (> %20 değeri); ≤ %20 değeri CEOS sunumu ve kalite değerlendirme özetinden — **el kitabı metninden ayrıca teyit edilecek** |
| Mutlak yatay doğruluk | **< 6 m, CE90** | Yatay konum hatası (düşey değil) | Copernicus ürün açıklamaları |

Notlar: (1) Bir kaynak sayfasında "< 6 m" değeri düşey doğruluk olarak etiketlenmiş; bu yatay
doğruluk (CE90) değeridir, düşeyle karıştırılmaz. (2) LE90 değerleri **küresel** ölçütlerdir;
yerel hata (ör. sera ve ağaçlık alanlarda DSM etkisi) daha büyük olabilir. (3) Kodlamadan önce
el kitabı PDF'i doğrudan okunacak; bu çalışma ortamından erişilemedi, değerler arama sonuçlarındaki
el kitabı alıntılarından alındı.

### 3.3 Hassas tarımsal sulama için sınırlamalar (ekranda açıkça yazılır)

- 90 m hücre, tipik bir damla sulama alt ünitesinden (ör. 40–100 m) büyüktür: alt ünite içi kot
  farkları **görülemez**.
- Komşu iki hücreden hesaplanan eğimin belirsizliği ≈ 2·√2 / 90 ≈ **±%3** (göreli hata 2 m ile).
  Çoğu damla sulama arazisi %0–3 eğimlidir: **hücre bazında eğim haritası düz arazide gürültüdür.**
- Tüm parsele oturtulan düzlem eğimi daha güvenilirdir (500 m tabanda ≈ ±%0,6), ama yerel çukur
  ve tümsekleri göstermez.
- DSM: seralar, binalar, ağaç sıraları kotu yükseltir; tarla yüzeyi değildir.
- **Sonuç:** MH-2A görselleri ön inceleme içindir; proje kesinleştirme, drenaj ve hassas tesviye
  için arazi ölçümü (RTK-GNSS, total station) veya yüksek çözünürlüklü DTM gerekir. Ekranda
  "Ön inceleme — 90 m çözünürlüklü yüzey modeli; hassas proje için arazi ölçümü gerekli" yazar.

## 4. Doğruluk kuralları

| No | Kural |
|---|---|
| D2-1 | Örnekleme aralığı kaynağın çözünürlüğünden ince olamaz (GLO-90: ≥ 90 m) |
| D2-2 | Eğim haritası sınıflı (0–3 / 3–6 / 6–10 / 10–15 / > 15 %; ° karşılıkları) ve "hücre belirsizliği ≈ ±%3" notuyla |
| D2-3 | Parselde en az 3 × 3 hücre (≈ 8 ha) yoksa eğim haritası, eğim yönü ve izohips: **"Hesaplanamadı — daha hassas kot verisi gerekli"** |
| D2-4 | **İzohips aralığı seçimi koşullu** (§4.1). Kaynağın kaldıramadığı aralık devre dışı ve gerekçesi yazılı |
| D2-5 | Kotlar tam metre; eğim en çok bir ondalık; her istatistiğin yanında belirsizlik |
| D2-6 | Eğim yönü yalnız eğim belirsizliğinin 2 katından büyükse; değilse "düz — yön belirsiz" |
| D2-7 | DSM uyarısı her kot ekranında |
| D2-8 | İki nokta ölçümü: geodezik mesafe; kot farkı ± göreli hata; mesafe < 2 hücre (180 m) ise eğim "Hesaplanamadı" |
| D2-9 | Profil kaynağın aralığıyla örneklenir; basamaklı/düzgünleştirilmemiş çizilir |
| D2-10 | Kaynak ve atıf her kot ekranında ve raporda (T-08) |
| D2-11 | **Tek kaynak kuralı:** eğim haritası, izohips, eğim yönü, profil ve kot noktaları aynı seçili ve doğrulanmış kaynaktan üretilir; ekranda hangi kaynak olduğu yazar. Farklı kaynaklar aynı katmanda karıştırılmaz |
| D2-12 | Gerçek kot verisinden üretilmeyen (ör. yalnız KML `clampToGround` köşelerinden ya da elle girilmiş eğimden türetilmiş) izohips/eğim **gösterilmez** |

### 4.1 İzohips aralığı seçim kuralı

Kullanıcı 1, 2, 5, 10 m aralıklarından seçer; bir aralık **yalnız** şu iki koşul sağlanırsa
etkindir:

1. **Düşey koşul:** aralık ≥ 2,5 × kaynağın göreli düşey hatası (LE90).
2. **Yatay koşul:** parseldeki tipik eğimde komşu iki izohips arasındaki yatay uzaklık
   (aralık ÷ eğim) ≥ kaynağın yatay çözünürlüğü. Aksi hâlde çizgiler hücre içinde üretilmiş
   ara değer olur.

| Kaynak | Göreli düşey hata | 1 m | 2 m | 5 m | 10 m |
|---|---|---|---|---|---|
| Copernicus GLO-90 (bugün) | ≈ 2 m | Kapalı | Kapalı | Etkin (eğim ≥ %5,6 ise kapalı: 5 m ÷ 90 m) | Etkin |
| Copernicus GLO-30 (ileride) | ≈ 2 m | Kapalı | Kapalı | Etkin | Etkin |
| Fotogrametrik DTM / LiDAR (ileride, ör. 1 m, ±0,15 m) | ≈ 0,15–0,3 m | Etkin | Etkin | Etkin | Etkin |
| RTK-GNSS / total station nokta ölçümü (ileride) | ≈ 0,02–0,05 m (nokta) | Nokta sıklığına bağlı (yatay koşul) | Etkin | Etkin | Etkin |

Kapalı aralıkta gerekçe: "1 m aralık için kot verisi yeterince hassas değil (göreli hata ≈ 2 m).
Daha hassas kot verisi gerekli." Gelecekteki kaynakların değerleri örnek aralıklardır; her kaynak
kendi doğruluk bilgisiyle kaydedilir ve kural o değerlerle çalışır.

## 5. Veri modeli (genişlemeye uygun)

```js
// Projede (şema 3 ile uyumlu; STATE_FIELDS'e 'kot' eklenir)
project.kot = {
  kaynaklar: [{
    id: 'dem-om-glo90',
    tur: 'dem',                 // 'dem' | 'kml' | 'geotiff' | 'nokta' | 'rtk' | 'olcum'
    ad: 'Copernicus DEM GLO-90 (Open-Meteo)',
    cozunurluk_m: 90, araDeger: 'belirtilmemiş',
    dusey: 'EGM2008',           // 'EGM2008' | 'EGM96' | 'WGS84-elipsoit' | 'TUDKA-99' | 'bilinmiyor'
    yuzey: 'DSM',               // 'DSM' | 'DTM' | 'olcum'
    dogruluk: { mutlak_m: 4, mutlakOlcut: 'LE90', goreli_m: 2, goreliOlcut: 'LE90 noktadan noktaya', yatay_m: 6, yatayOlcut: 'CE90' },
    donem: 'TanDEM-X / WorldDEM (lisans telif yılları 2010–2018)', alinma: '2026-…',
    lisans: 'Copernicus DEM lisansı; Open-Meteo CC BY 4.0', atif: '…',
  }],
  ornekler: { 'dem-om-glo90': { aralik_m: 90, noktalar: [[lat, lng, z], …] } },   // çevrimdışı görüntü
  secili: 'dem-om-glo90',
};
// Değişmez: cur.elev (bugünkü DEM özeti) ve geoKaynak.yukseklikler (KML köşe yükseklikleri).
```

Kurallar:
- Farklı `dusey` değerli kaynaklar dönüşüm ve doğrulama olmadan **birleştirilmez**; ekranda ayrı
  gösterilir ("düşey referanslar farklı — karşılaştırılamaz").
- KML: `clampToGround` (varsayılan) ve `relativeToGround` yükseklikleri **ölçülmüş kot değildir**;
  kot kaynağı sayılmaz. `absolute` ise "deniz seviyesine göre" (KML belgesi); düşey referans
  `bilinmiyor` kaydedilir, DEM ile birleştirilmez.
- İleride: **GeoTIFF** (kendi CRS'i, çözünürlüğü ve düşey referansıyla; yerel dosya), **RTK-GNSS**
  (genellikle WGS84 elipsoit yüksekliği → jeoit ayrımı gerekir; dönüşüm modeli kaydedilir),
  **topoğrafik ölçüm** (TUDKA-99 ortometrik kot). Her biri yeni bir `kaynaklar` girdisi; analiz modülü
  kaynaktan bağımsızdır.

## 6. Hesaplar (motor dışı `www/js/terrain.js`)

| İşlev | Yöntem |
|---|---|
| Örnekleme | Seçili kaynağın aralığında ızgara; 100'lük istek parçaları; `kot.ornekler`'de önbellek |
| İstatistik | Min / maks / ortalama kot; düzlem eğimi ve belirsizliği; hücre eğimi ortalama ve en büyük (sınıflı) |
| Eğim ve yön | Merkezî fark (Horn) — %, °; 8 yön |
| İzohips | Kare yürütme (marching squares); §4.1 aralık kuralı; ana/ara eğri ayrımı; etiketler çizgi üzerinde |
| Kot noktaları | Kaynağın gerçek örnek noktaları ve KML köşeleri (ayrı simge, ayrı kaynak) |
| İki nokta | Geodezik mesafe; çift doğrusal ara değer; kot farkı ve eğim ± belirsizlik |
| Profil | Ana hat güzergâhı ve temsilî lateral boyunca kaynağın aralığıyla |

Hiçbir sonuç `engine.js`'e verilmez. Bugünkü düzlem eğimi → motor girdisi yolu aynen kalır.

## 7. Ekranlar

- Katman menüsü (§1); birim %/°; lejant ve renk skalası (renk + desen).
- Kot özeti kartı: istatistikler ± belirsizlik, kaynak + çözünürlük + düşey referans + ölçüt adlarıyla
  doğruluk + ara değer + DSM notu + "ön inceleme" notu + atıf.
- İzohips aralığı seçici: 1 / 2 / 5 / 10 m; kapalı olanlar gerekçesiyle.
- Ölç aracı; kot profili (masaüstünde alt panel, Android'de alt sayfa).
- Yetersiz veri: "Hesaplanamadı — daha hassas kot verisi gerekli".

## 8. Uyumluluk

| Modül | Uyum |
|---|---|
| MH-KML | Çizilmiş ve içe aktarılmış parseller aynı ekran; KML yükseklikleri `geoKaynak.yukseklikler`'de, ayrı kaynak |
| MH-MANUEL-1A | `kot` alanı `STATE_FIELDS`'e girer; revizyon ve yedekle taşınır |
| MH-SHIFT | Etkisi yok; ortak katman yöneticisi |
| MH-AKIL-3 | Eğim sınıfları ileride bölme ölçütü olabilir (ayrı karar) |
| MH-3 | Gerçek güzergâh ve shift kotlarının hidroliğe girmesi; bağımsız doğrulama + ayrı onay |
| T-01 | Profil uzunlukları geodezik; motorun küresel yerel düzlem farkı (±%0,2) belirtilir |
| T-08 / T-09 | Atıf ve servis kullanım şartları (§10) |

## 9. Testler

| Kod | Test |
|---|---|
| E-01 | Sentetik düzlem → eğim ve yön birebir |
| E-02 | Koni / eyer → yön sınıfları ve izohips topolojisi |
| E-03 | Küçük parsel → "Hesaplanamadı" |
| E-04 | İzohips aralık kuralı: GLO-90'da 1 ve 2 m kapalı (gerekçeli); %6 eğimde 5 m kapalı; sentetik hassas kaynakta 1 m açık |
| E-05 | % ↔ °; yuvarlama |
| E-06 | ≤ 100 koordinat/istek; ağ hatasında kısmi sonuç gösterilmez |
| E-07 | Farklı düşey referanslar birleştirilmez |
| E-08 | KML `clampToGround`/`relativeToGround` yükseklikleri kot kaynağı değildir |
| E-09 | İki nokta: bilinen geodezik mesafe; < 180 m'de eğim "Hesaplanamadı" |
| E-10 | Profil aralığı ve uç noktalar |
| E-11 | Atıf ve "ön inceleme" notu her kot ekranında ve raporda |
| E-12 | Android ve masaüstü aynı sayılar |
| E-13 | Motor ve altın kayıtlar değişmez; düzlem eğimi → motor girdisi aynen |
| E-14 | Çevrimdışı: önbellekle aynı görüntü |
| E-15 | Tek kaynak: bütün katmanlar seçili kaynaktan; kaynak değişince hepsi birlikte yenilenir |
| E-16 | Gerçek kot verisi olmadan izohips/eğim çizilmez |

## 10. Veri kaynağı atfı ve kullanım şartları (T-08, T-09)

**T-08 — atıf eksikliği:** küçük, **bağımsız** bir PR olarak planlandı (MH-MANUEL-1A koduna
karıştırılmaz). Ayrıntı: `docs/t08-atif-plan.md`.

**T-09 — Open-Meteo ücretsiz API'nin kullanım şartı (yeni bulgu):** Open-Meteo kullanım şartlarına
göre ücretsiz API yalnız **ticari olmayan** kullanım içindir ve günlük/saatlik çağrı sınırları vardır;
ticari kullanım abonelik gerektirir. Veriler CC BY 4.0 lisanslıdır (atıf zorunlu). IrriGrow'un ticari
kullanılıp kullanılmayacağı proje sahibinin kararıdır. Seçenekler: (a) ticari olmayan kullanımda
mevcut durum + atıf; (b) Open-Meteo aboneliği; (c) Open-Meteo'yu kendi sunucuda çalıştırmak
(sunucu AGPLv3); (d) Copernicus DEM paftalarını doğrudan kullanmak (lisans ve atıf şartlarıyla).
Bu bir hukuki değerlendirme değildir; şartlar resmî sayfadan teyit edilmelidir.

## Kaynaklar

- Open-Meteo Elevation API: https://open-meteo.com/en/docs/elevation-api
- Open-Meteo kullanım şartları: https://open-meteo.com/en/terms
- Open-Meteo fiyatlandırma ve lisans: https://open-meteo.com/en/pricing
- Copernicus DEM Ürün El Kitabı v5.0: https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf
- Copernicus DEM Ürün El Kitabı v6.1: https://dataspace.copernicus.eu/sites/default/files/media/files/2026-10/geo1988-copernicusdem-spe-002_producthandbook_i6.1.pdf
- Copernicus DEM koleksiyonu: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- Copernicus DEM lisansı (GLO-30 örneği): https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf
- Copernicus DEM kalite değerlendirme özeti: http://www-igm.univ-mlv.fr/~riazano/publications/EDAP.REP.039_1.2_Copernicus_DEMs_Quality_Assessment_Summary.pdf
- CEOS sunumu (WorldDEM tabanlı Copernicus DEM): https://calvalportal.ceos.org/html/portal/sarc/documents/documents/3%20Leister%202.pdf
- KML yükseklik kipleri: https://developers.google.com/kml/documentation/altitudemode
