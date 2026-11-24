# Çoklu parsel — teknik inceleme ve uygulanan çözüm (1.0.7 düzeltme)

## 1. İnceleme: mevcut durum
**Proje veri modeli (store.js, app.js).** Bir proje tek parsel taşır. Parsele ait alanlar doğrudan projededir:
`poly` (sınır), `src` (kaynak), `station`, `route` (ana hat güzergâhı), `inp` (girdiler: ürün, alan, kaynak debisi, derinlik …),
`hydro`, `elev`, `geoKaynak` (KML kaynak bilgisi ve yükseklikler), `shiftEdit…` / `shiftSira` / `shiftHedef…` (manuel shift),
`katalogKalemleri`, `ekipmanSecimi`, `drawPos`, `techOpt`, `akil`. Proje düzeyinde: `id`, `name`, `rev/revs`, `meta`.

**Hesap motoru (engine.js).** `E.design(inp, ayarlar, { poly, src, station, route, manual, catalog })` tek bir parsel ve tek bir
kaynak için yerleşim, shift, ana hat, pompa ve malzeme hesaplar. Birden çok parseli veya parseller arası bağlantıyı bilmez.

**KML (kml.js).** Bütün çokgenleri listeler (nokta ve çizgi parsel sayılmaz; yükseklikler saklanır, `kotDogrulanmis: false`).
Arayüzde tek seçim (radyo düğmesi) vardı; seçilen parsel projenin tek sınırının yerine geçiyordu.

**Sonuç.** Motor çoklu parseli doğrudan desteklemiyor. Parselleri tek çokgende birleştirmek veya motoru plansız değiştirmek
yanlış hidrolik (birbirine bağlı sayılan uzak parseller, ortak ana hat) üretir.

## 2. Seçilen mimari: aktif parsel + bağımsız hesap (motor değişmedi)
- **Geriye uyumlu model.** Projenin üst düzey alanları her zaman **aktif parseldir**. Tek parselli eski projelerde hiçbir alan
  değişmez ve hiçbir yeni alan eklenmez.
- Çok parselli projede ek alanlar:
  - `parselId` / `parselAd` (aktif parsel);
  - `parseller` (diğer parseller; her biri aktif parselle aynı alanlar: `{ id, ad, inp, poly, src, station, route, shift…, ekipman… }`);
  - `parselSira`.
- **Parsel değiştirme** veriyi kopyalamaz, yer değiştirir: aktif parselin alanları paketlenip listeye konur, seçilen parsel
  üst düzeye alınır (www/js/parsel.js). Bu sayede Sınır / Kaynak / İstasyon / Ana hat / Shift / Hidrolik / Malzeme / ekipman /
  rapor kodu değişmeden aktif parsel üzerinde çalışır.
- **Hidrolik:** her parsel kendi kaynağı (kuyu), kendi ana hattı ve kendi shift düzeniyle motorda **ayrı** hesaplanır.
  - Parseller birbirine bağlı sayılmaz.
  - Kaynağın hangi parseli beslediği, o parsel aktifken Kaynak modunda işaretlenerek belirlenir.
  - Shift'ler parsele aittir ("FIELD1 · Shift 3"); numaralar karışmaz.
- **Hesaplanamayan durumlar açıkça gösterilir:**
  - sınırı olmayan parsel → "Eksik veri";
  - debisi girilmemiş parsel → "Eksik veri";
  - motorun hesaplayamadığı parsel → "Hesaplanamadı" (gerekçesiyle);
  - parsel planı olmadan dikdörtgen yaklaşımı → "Yaklaşık".
  - Böyle bir parsel varsa proje toplamı "eksik" yazılır.
- **Ortak kaynak / pompa / ana hat hesaplanmaz.** Farklı parsellerin kaynakları aynı noktada (≤ 15 m) ise şu uyarı verilir ve toplam "eksik" sayılır:
  "ortak kaynak / pompa hesabı yapılmadı; aynı anda sulanırlarsa toplam debi kaynak kapasitesini aşabilir".
- **Alan:**
  - her parselin alanı ve çevresi ayrı hesaplanır;
  - proje toplamı parsel alanlarının toplamıdır (parseller arasındaki boşluk sayılmaz);
  - çakışan parsellerde ortak alan (yaklaşık, düzenli örnekleme) bir kez sayılır ve uyarı verilir.
- **Revizyon güvenliği:** çok parselli projede revizyonlar bütün parselleri içerir. Başka bir parsel aktifken alınmış bir
  revizyon, o parsel seçilmeden geri yüklenmez (parsel verisi karışmaz).

## 3. Arayüz
- **KML/KMZ:** onay kutularıyla çoklu seçim, *Tümünü seç / Seçimi temizle*. Seçilen bütün parseller haritada adlarıyla aynı anda önizlenir.
  - *Yeni parsel olarak ekle (N parseli ekle)*: seçilenler ayrı parseller olarak eklenir; birleştirilmez.
  - *Aktif parseli değiştir*: yalnız tek seçimde; önceki davranış, geri alma dahil.
  - Boş projede *Projeye aktar*. Önizleme projeyi değiştirmez; *İptal* hiçbir şeyi değiştirmez.
- **Arazi parsel şeridi:** parsel çipleri (renk, ad, alan), *＋ Parsel*, *yeniden adlandır*, *sil*, *bütün parselleri göster*.
  - Diğer parseller haritada renkli, kesik çizgili ve adlarıyla görünür.
  - Başka bir parsele dokununca (onayla) o parsele geçilir; dokunuş sınıra köşe eklemez.
  - Yalnız aktif parselin köşeleri düzenlenir.
- **Sonuç ekranı:** "Proje parselleri" kartı: parsel bazlı alan, kaynak debisi, shift sayısı, durum ve proje toplamı.
- **Masaüstü:** sağ panel başlığında aktif parselin adı görünür. KML paneli harita üzerinde daraltılabilir karttır (harita küçülmez).
- **Raporlar:**
  - PDF'te "Parseller ve proje toplamı" bölümü, Excel'de "Parseller" sayfası;
  - Özet bölümünde aktif parsel ve proje toplam alanı.
  - Ayrıntılı hidrolik bölümler aktif parsele aittir; bu raporda yazılıdır.

## 4. Bilinen sınırlamalar
- Ortak kaynak, ortak pompa ve parseller arası ana hat bağlantısı tanımlanamaz ve hesaplanmaz. Her parsel bağımsız şebeke sayılır.
- Ayrıntılı hidrolik ekranlar, Shift Yönetimi, malzeme listesi ve ayrıntılı rapor bölümleri aktif parsel içindir.
  Diğer parsellerin özeti proje parselleri tablosunda yer alır.
- Haritada yalnız aktif parselin sulama planı (lateral / manifold / ana hat) çizilir; diğer parseller sınır, ad ve kaynakla gösterilir.
- Eğim (kot) ölçümü o parsel aktifken *Uygula* ile yapılır. KML ile toplu eklenen parsellerde alan ve boyutlar sınırdan
  hesaplanır; eğim, parsel seçilip *Uygula* denene kadar girilmemiş sayılır.
- Uygulamada KML/KMZ dışa aktarma yoktur. Bütün parseller JSON proje yedeğinde saklanır.
- Çakışma alanı düzenli örneklemeyle yaklaşık hesaplanır (uyarı amaçlı).

## 5. Toplam değerlerin yöntemi (ekranda "Toplamlar nasıl hesaplandı?" ve raporda aynı metin)
- **Toplam alan:** parsel sınırlarının düzlem alanlarının toplamı; parseller arasındaki boşluk dahil değildir.
  - Sınırlar çakışıyorsa çakışan alan düzenli örneklemeyle tahmin edilip bir kez sayılır.
  - Bu durumda toplam alan ekranda "≈ … (yaklaşık)", raporda "Proje toplamı (alan yaklaşık)" olarak yazılır.
  - Sınırlar düzeltilmeden kesin alan olarak kullanılmamalıdır.
- **Debi:** parsel kaynak debileri **toplanmaz**; toplam satırında debi yoktur ve ortak pompa debisi olarak sunulmaz.
  Ortak pompa / kaynak / ana hat uygunluğu hesaplanmaz.
- **Proje durumu:** yalnız parsellerin ayrı hesaplarını özetler.
  - Hepsi ayrı ayrı hesaplandıysa "hesaplandı" yazılır; bu, ortak sistemin uygun olduğu anlamına gelmez.
  - Ortak kuyu algılanırsa ilgili parseller "Ortak kaynak: doğrulanmadı" olarak işaretlenir ve proje durumu "eksik" olur.
- **Kot:** KML yükseklikleri parsel kaydında `kotDogrulanmis: false` ile saklanır. Hidrolik kot, eğim veya yükseklik girdisi olarak kullanılmaz (PA-11 testi).

## 6. Veri kaybına karşı regresyon testleri
- **Birim testleri:**
  - PA-09: 40 parsel geçişi + kaydet/yükle sonrası bütün parsel alanları birebir aynı.
  - PA-10: aktif parselde değişiklik veya silme diğer parselleri etkilemez.
  - PA-11: KML'de her poligon ayrı parsel (çok parçalı yerleşim dahil); birleştirme yok; nokta parsel değil.
  - PA-12: yöntem notları, yaklaşık alan, ortak kaynak.
  - PA-13: yedekte aynı kimlikli proje üzerine yazılmaz; başka parselin revizyonu geri yüklenmez.
- **Arayüz testleri:**
  - katalog kalemi ve ekipman seçimi parsel geçişlerinde ve sayfa yeniden yüklenince korunur;
  - JSON yedek, PDF ve Excel bütün parselleri içerir.
