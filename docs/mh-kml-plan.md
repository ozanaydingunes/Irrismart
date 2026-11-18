# MH-KML — Harita oluştururken KML/KMZ yükleme

Durum: **mimari ve teknik yaklaşım onaylandı (18.11.2026); sıra: MH-MANUEL-1A'dan hemen sonra. Kodlama henüz başlamadı.** Onaylanmış gereksinim:
`docs/yol-haritasi.md` → "MH-KML". Ayrı dal, ayrı PR; proje sahibinin onayı olmadan `main`'e
birleştirilmez. Hesap motoru değişmez.

## 1. Amaç

Yeni arazi oluştururken iki eşit seçenek:

1. **Haritada çiz** (bugünkü akış, aynen korunur),
2. **KML/KMZ yükle** — Google Earth, QGIS, tapu/kadastro çıktısı gibi dosyalardan parsel sınırı.

Android'de dosya seçici, masaüstü web'de dosya seçici **ve** haritaya sürükle-bırak. İki platformda
aynı ayrıştırıcı, aynı geometri, aynı proje alanları.

## 2. Bugünkü durum (kod incelemesi)

| Konu | Durum |
|---|---|
| Parsel modeli | `cur.poly`: tek dış halka, `[lat, lng]` köşeleri. Motor (`geom.js` `fieldFromPolygon`) yalnız tek halka kabul eder; **boşluk (iç halka) desteği yok**. |
| Geçerlilik | Kendini kesen sınır motor ve ekran tarafından reddediliyor (`selfIntersects`). |
| Dosya seçimi | Android WebView'de `<input type="file">` çalışıyor (yedekten yükleme aynı yöntemi kullanıyor). |
| Zip (KMZ) | Ek kitaplık gerekmez: mevcut `vendor/xlsx.full.min.js` içindeki zip okuyucu (`XLSX.CFB`) sıkıştırılmış zip'i açıyor (bu oturumda Türkçe karakterli `doc.kml` ile denendi). |
| XML | Tarayıcının `DOMParser`'ı (dış varlık çözümlemesi yapmaz; ağa çıkmaz). |
| Koordinat | KML: WGS84, `boylam,enlem[,yükseklik]` sırası. Uygulama `[enlem, boylam]` kullanır; dönüşüm zorunlu. |
| Yerel düzlem | Motor küresel yerel düzlem kullanır (teknik inceleme T-01: yöne bağlı ±%0,2). KML alanı ayrıca elipsoit üzerinde hesaplanıp karşılaştırma için gösterilir. |

## 3. Kullanım akışı

**Arazi ekranı → "Yeni arazi"**: `Haritada çiz` | `KML/KMZ yükle`.

1. Dosya seçilir (Android: dosya seçici; masaüstü: seçici veya haritaya sürükle-bırak).
2. **İçe aktarma önizlemesi** (projeye henüz yazılmaz):
   - dosyadaki parseller listesi: ad, köşe sayısı, alan (da), çevre (m), uyarılar;
   - haritada bütün parseller soluk, seçili olan vurgulu; harita parsellere yaklaşır;
   - her parselde: alan, çevre, sınır (haritada), iç boşluk sayısı ve alanı, kendini kesme,
     kapanmamış halka (otomatik kapatıldı), yinelenen nokta (temizlendi), yükseklik bilgisi
     (saklanacak, hesapta **kullanılmayacak**);
   - boşluklu veya geçersiz parsel listede kalır ama "hesaplanamaz" işaretlidir ve seçilemez.
3. Kullanıcı parsel(ler)i seçer:
   - **tek parsel** → yeni proje (varsayılan) **veya** mevcut projenin sınırını değiştir
     (yalnız açık onayla; önce revizyon; elle shift atamaları MH-SHIFT'teki koru/uyarla/ayrı
     taslak/onayla sıfırla akışına girer);
   - **birden fazla parsel** → her biri ayrı proje (aynı kaynak kullanılıyorsa uyarı: kaynak
     debisi paylaşılır, kendiliğinden artmaz) **veya** MH-AKIL-3 tamamlandığında alt projeler.
4. Proje oluşur; sınır haritada elle düzeltilebilir (köşe taşı/ekle/sil — bugünkü araçlar).
5. Kaynak, istasyon ve ana hat güzergâhı her zamanki gibi haritada işaretlenir.

## 4. Desteklenen ve desteklenmeyen içerik

| İçerik | Davranış |
|---|---|
| `Placemark` + `Polygon` (`outerBoundaryIs`) | Parsel |
| `MultiGeometry` içinde birden çok `Polygon` | Her biri ayrı parsel olarak listelenir |
| `Folder` / `Document` iç içe | Hepsi taranır; klasör adı listede gösterilir |
| `innerBoundaryIs` (boşluk) | Önizlemede boşluklar haritada gösterilir; dış alan, boşluk alanı ve net alan ayrı yazılır. Motor boşluk desteklemediği için **bu parsel hesaplamaya gönderilmez**: "Hesaplanamaz — parsel içinde N boşluk var; motor henüz desteklemiyor" yazar ve proje oluşturma düğmesi bu parsel için kapalıdır. Yalnız dış sınırla proje oluşturma seçeneği **yoktur** (yanlış alan ve yanlış sulama projesi üretilmez). Motor desteği ayrı motor işidir (MH-MOTOR, E-7; teknik inceleme T-07). |
| `LineString`, `Point` | Parsel olarak alınmaz; "yol çizgisi / nokta, alınmadı" notu (ileride ana hat güzergâhı veya kaynak noktası önerisi olabilir — ayrı karar) |
| Yükseklik (3. bileşen) | Ayrıştırılır ve **saklanır** (`geoKaynak.yukseklikler`, köşe başına; JSON yedekte taşınır; mevcut `elev` alanındaki DEM özetinden ayrı tutulur). MH-2 tamamlanana kadar hesapta **kullanılmaz** ve ekranda "Yükseklik bilgisi saklandı — hidrolik hesapta kullanılmıyor (MH-2)" yazar |
| `NetworkLink`, uzak görseller, `<Style>` | Yok sayılır; ağa hiçbir istek yapılmaz |
| KMZ | Zip içindeki `doc.kml`; yoksa ilk `.kml` dosyası (adı gösterilir) |
| GeoJSON, SHP | Bu aşamada yok (MH-KML-2, MH-KML-3) |

## 5. Doğrulama kuralları

| No | Kural |
|---|---|
| G-1 | Dosya boyutu ≤ 10 MB, parsel başına ≤ 5 000 köşe; aşılırsa açık hata (sessiz basitleştirme yok) |
| G-2 | Koordinat sırası `boylam,enlem`; enlem −90…90, boylam −180…180 dışı → hata |
| G-3 | Kapanmamış halka kapatılır; yinelenen ardışık köşeler temizlenir; en az 3 farklı köşe |
| G-4 | Kendini kesen sınır alınmaz (motorla aynı denetim); hangi kenarların kesiştiği haritada gösterilir |
| G-5 | Alan: yerel düzlem (motorun kullandığı) **ve** elipsoit üzerinde; farkı gösterilir (T-01) |
| G-6 | Dosyadaki ad/açıklamada alan varsa (ör. "12,5 da") hesaplanan alanla karşılaştırılır; %2'den büyük farkta uyarı |
| G-7 | Proje kaydına kaynak bilgisi: `geoKaynak: { tur: 'kml'|'kmz', dosya, parsel, iceAktarma: tarih, yukseklikler: [m…] | null }`; köşe yükseklikleri yalnız burada (MH-MANUEL-1A §14.0) |
| G-7b | Boşluklu parsel hesaplamaya gönderilmez; yalnız dış sınırla proje oluşturma yolu bulunmaz (test K-03) |
| G-8 | İçe aktarma projeye yazılmadan önce önizlenir; iptal hiçbir şeyi değiştirmez |
| G-9 | Mevcut sınırın değiştirilmesi onay ister; önce tam revizyon (MH-MANUEL-1A); elle shift atamaları sessizce silinmez |
| G-10 | JSON yedek kaynak bilgisini taşır; Android ↔ web aynı sonuç |

## 6. Dosyalar

| Dosya | Değişiklik |
|---|---|
| `www/js/kml.js` (yeni) | Ayrıştırıcı ve doğrulayıcı: KML/KMZ → parsel listesi + uyarılar. DOM'a dokunmaz; Node'da test edilir. |
| `www/js/app.js` | "Yeni arazi" seçenekleri, önizleme, sürükle-bırak (masaüstü), proje oluşturma |
| `www/js/desk.js` | Masaüstü: haritaya bırakma alanı ve sağ panelde parsel listesi |
| `www/js/store.js` | `geoKaynak` alanı (şema 3 ile; MH-MANUEL-1A) |
| `www/js/i18n-dict.js`, `www/css/app.css` | Metinler (8 dil), bileşenler |
| `test/kml.test.js`, `test-ui/kml.ui.js`, `test/fixtures/kml/` | Testler ve örnek dosyalar |
| `www/js/engine.js` | **Değişmez** |

## 7. Testler

| Kod | Test |
|---|---|
| K-01 | Google Earth KML (tek parsel), QGIS KML, KMZ: alan ve çevre bilinen değerlerle (±%0,1) |
| K-02 | Çoklu parsel (`MultiGeometry`, iç içe klasörler): doğru sayı ve adlar |
| K-03 | Boşluklu parsel: önizlemede boşluk sayısı, dış/boşluk/net alan; proje oluşturulamaz; hiçbir yoldan yalnız dış sınırla hesaplanamaz |
| K-04 | Bozuk zip, `doc.kml` olmayan KMZ, geçersiz XML, boş dosya, yalnız `LineString` |
| K-05 | Kendini kesen, kapanmamış, yinelenen noktalı, 3'ten az köşeli halka |
| K-06 | Yükseklikli koordinatlar: yükseklik `geoKaynak.yukseklikler`'de saklanır ve yedekte taşınır; hesap yüksekliksiz dosyayla bit bit aynı; ekranda "hesapta kullanılmıyor" notu |
| K-07 | Koordinat sırası: enlem/boylam ters yazılmış dosya yakalanır |
| K-08 | Türkçe karakterli adlar (UTF-8) ve büyük dosya sınırı |
| K-09 | Ağ isteği yok (`NetworkLink` içeren dosya); dış varlık yok |
| K-10 | İptal → hiçbir proje değişmez; mevcut sınırı değiştirme → revizyon + onay |
| K-11 | İçe aktarılan parsel motorda elle çizilmiş aynı köşelerle birebir aynı sonucu verir |
| K-12 | Android (Capacitor, 390 px, dosya seçici) ve masaüstü (sürükle-bırak, 1280/1440/1920) |
| K-13 | JSON yedek gidiş-dönüş `geoKaynak` dahil; eski projeler etkilenmez |
| K-14 | MH-0 altın kayıtları ve bütün mevcut testler değişmez |

## 8. Yol haritası

Onaylanan sıra (18.11.2026): PR #8 → MH-MANUEL-1A → **MH-KML** → MH-MANUEL-1B → MH-SHIFT-1 →
MH-MANUEL-2 → MH-SHIFT-2 → MH-MANUEL-3 → MH-SHIFT-3 → MH-MANUEL-4.

MH-KML, 1A'nın sağladığı `geoKaynak` alanını (köşe yükseklikleri dahil), güvenli geometri değişimini ve "yeni proje"
yolunu kullanır (MH-MANUEL §14.0). MH-KML'de ayrıca motor değişikliği yoktur. MH-AKIL-3 (arazi
bölme) ve MH-2 (kot/eğim) içe aktarılan parselleri ve saklanan yükseklikleri ileride kullanır.
