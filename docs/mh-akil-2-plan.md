# MH-AKIL-2 — Otomatik Shift ve Kaynak Kapasitesi Alternatifleri

Durum: **plan ve kodlama onaylandı (18.11.2026).** Ayrı dal (`claude/mh-akil-2-kapasite`) ve ayrı PR.
Proje sahibinin açık onayı olmadan `main`'e birleştirilmez.

## 1. Amaç

MH-AKIL-1'de "değerlendirilmedi — MH-AKIL-2" olarak bırakılan kapasite çözümlerini **gerçek hesap
motoruyla** hesaplamak:

- farklı shift sayıları,
- kaynak debisi artırma,
- günlük çalışma süresi,
- kaynak debisi ile çalışma süresinin birlikte değiştirilmesi,
- farklı sulama aralıkları.

Her alternatif için şunlar gösterilir: girdiler, kaynak kapasitesi, shift sayısı, en büyük shift
debisi, tur süresi ve sınırı, gerekli basınç, pompa gücü, enerji, ana hat, açık uyarılar ve teknik
durum.

## 2. Temel kurallar

1. **Hesap motoru değişmez.** Her alternatif `IrriEngine.design` ile, yalnız ilgili girdi
   değiştirilerek hesaplanır. Formül, katsayı ve seçim kuralları aynıdır; MH-0 altın kayıtları
   değişmez.
2. **Oran yöntemi yok.** Gerekli debi, tur süresinin oranlanmasıyla bulunmaz.
3. **Teknik durum** (her alternatif motorla ayrıca değerlendirilir; MH-AKIL-1 uyarı katmanı):
   - **Uygun:** Kapasite koşulları sağlanıyor ve hiçbir "uygunsuz" uyarı kalmıyor.
   - **Kapasite uygun, kritik uyarı açık:** Tur süresi ve kaynak sığıyor, ama başka uygunsuz
     uyarılar sürüyor (ör. W-PN-02, W-SD-01). Kesin çözüm olarak **önerilmez**; açık kodlar
     yazılır.
   - **Uygunsuz:** Kapasite koşulu sağlanmıyor. Gerekçe sayılarla yazılır.
   - **Veri gerekli:** Değerlendirme için eksik veri var.
4. "Önerilen" ya da "en iyi" etiketi yalnız **Uygun** alternatiflerden birine verilebilir. Uygun
   alternatif yoksa bu açıkça yazılır.
5. **Model sonucu, mutlak minimum değil.** Bulunan en küçük debi "motorun gruplama kuralı ve bu
   yerleşimle hesaplanan en küçük değer" olarak sunulur. 0,1 m³/h altının motorla uygunsuz olduğu
   ayrıca doğrulanır ve gösterilir.
6. **Kullanıcı kararı** ("Bilinerek kabul edildi") teknik durumu değiştirmez.
7. Proje verisi değişmez. Alternatifler yalnız gösterilir ve özet olarak projeye kaydedilir
   (`proje.akil.alternatifler`). Bir alternatifi projeye uygulamak bu aşamanın kapsamı dışındadır
   (MH-AKIL-4 / revizyon akışı).

## 3. Üç hacim ayrı değerlendirilir

| Büyüklük | Tanım | Kullanım |
|---|---|---|
| Bitkinin brüt ihtiyacı | brüt (mm/gün) × **sulanması hedeflenen net alan** | Kaynağın günlük karşılaması gereken su |
| Damlatıcıların uyguladığı hacim | Σ damlatıcı debisi × shift süresi ÷ aralık | Motorun tur süresi hesabı |
| Günlük kaynak kapasitesi | Q × günlük çalışma süresi | Karşılaştırma |

- Hedef net alan bu sürümde **arazi alanıdır** (girdi ya da harita).
- Damlatıcı kapsama oranı = uygulanan hacim ÷ brüt ihtiyaç (test2: %99,16).
- **Eksik yerleşim ihtiyacı azaltmaz.** Bir alternatifin kapasite açısından uygun sayılması için
  hem motorun tur denetimi (`cycleHours ≤ avail`) hem de **kaynak kapasitesi ≥ bitkinin brüt
  ihtiyacı** koşulu gerekir.
- Kapsama oranı %100'ün altındaysa alternatif kartında şu not gösterilir: "Damlatıcılar hedef
  alanın %x'ini kaplıyor; kalan alanın ihtiyacı ortadan kalkmaz."

## 4. Algoritma (`www/js/solver.js`)

Kullanılan büyüklükler:
- `t`: shift süresi
- `I`: aralık
- `H`: günlük çalışma
- `Qu`: alt ünite debileri
- `partition` / `minSectors`: motorun (`layout.js`) shift gruplama fonksiyonları

**A. Mevcut durum.** Projenin motor sonucu ve MH-AKIL-1 değerlendirmesi.

**B. Shift sayısı.** Motorun `sectorAlts` listesindeki her shift sayısı (NsMin…NsMin+7) gösterilir.
- Kanıt: Her gruplamada `Ns ≥ ⌈ΣQ/Qs⌉` olduğundan `tur ≥ ⌈ΣQ/Qs⌉ · t`.
- Bu alt sınır kullanılabilir süreyi aşıyorsa "yalnız shift değişimi" kanıtla uygunsuzdur.

**C. Kaynak debisi** (H ve I aynı):
1. Sığabilecek en çok shift sayısı: `Nmax = ⌊H·I / t⌋`.
2. `Qreq = max(grup debisi)`, burada gruplar `partition(Qu, Nmax)` ile bulunur. Bu, motorun kendi
   gruplama kuralıyla Nmax shift'e sığmak için gereken en küçük debidir.
3. Motor `Q = ⌈Qreq⌉₀,₁` ile çalıştırılır.
4. Motor alt ünite yerleşimini kaynak debisine göre kurduğu için (`Qcap = Q/2`) `Qu` değişebilir.
   Bu durumda yeni `Qu` ile 2–3. adımlar tekrarlanır (en çok 6 tur).
5. Motor uygun bulmazsa Q 0,1 m³/h adımlarla artırılır (en çok 30 adım).
6. **Doğrulama:** `Q − 0,1` ile motor yeniden çalıştırılır ve uygunsuz olduğu gösterilir.
7. Ayrıca brüt ihtiyaç koşulu denetlenir: `Q · H ≥ brüt günlük ihtiyaç`.

**D. Günlük çalışma süresi** (Q aynı):
- Shift sayısı kaynakla sınırlıdır; tur süresi değişmez.
- Gereken süre: `H ≥ tur / I`. 24 saati aşarsa kanıtla uygunsuzdur. Yine de H = 24 h ile motor
  çalıştırılır ve sonuç gösterilir.
- Aşmazsa H yukarı yuvarlanır (0,5 h adım) ve motorla doğrulanır.

**E. Kaynak + süre:** Mevcut H'den 24 saate kadar en çok 4 değer için (ör. 20, 22, 24) C adımı
uygulanır.

**F. Sulama aralığı:** 1…Imax arasındaki her aralık için motor çalıştırılır.
- Imax'ı aşan aralıklar motor tarafından düşürüldüğü için hesaplanmaz; MH-AKIL-1'deki "su stresi"
  değerlendirmesi gösterilir.
- Varsayımlar (aynı tepe ET₀ ve Kc, aynı H, aynı Q, depolama yok) yazılır.

**Hesap yükü:** Proje başına yaklaşık 10–25 motor çalıştırması (Node'da 0,1 s/çalıştırma).
- Arayüzü dondurmamak için hesap bir düğmeyle başlatılır ("Kapasite alternatiflerini hesapla").
- Hesap parça parça yürür ve ilerleme gösterilir.
- Sonuç projeye özet olarak kaydedilir; girdiler değişince geçersiz sayılır (imza).

## 5. Uyarı katmanıyla bağlantı

- Kayıtlı ve geçerli bir alternatif özeti varsa, W-KAP-01'in "kaynak", "süre", "kaynak + süre" ve
  "aralık" çözümleri `IrriAssess.forProject` içinde güncellenir:
  - motorla hesaplanan değer,
  - "Hesaplandı – uygun" ya da "Hesaplandı – uygunsuz" durumu,
  - kalan kritik uyarılar.
- Böylece Sonuç ekranı, Hidrolik panel, PDF ve Excel yine aynı değerlendirmeyi gösterir.
- Alternatif hesaplanmamış projelerde (bütün altın senaryolar dahil) çıktı MH-AKIL-1 ile aynıdır.
  Altın kayıt değişmez.

## 6. Ekran

Sonuç ekranında, "Mühendislik değerlendirmesi" bölümünün altında **"Kapasite alternatifleri"** kartı
bulunur:

- Başlangıç durumu: kısa açıklama ve **"Alternatifleri hesapla"** düğmesi. Hesap sürerken ilerleme
  çubuğu gösterilir.
- **Özet:** En küçük debi (mevcut H ile), en kısa süre ve aralık sonucu, tek satırlık durumlarla.
- **Alternatif listesi (kart / tablo):**
  - Sütunlar: ad, girdiler, Q, H, I, Ns, en büyük shift debisi, tur / sınır, gerekli H, motor kW,
    enerji, ana hat.
  - Hacim satırı: ihtiyaç, uygulanan hacim, kaynak kapasitesi.
  - Durum rozeti ve açık uyarı kodları; "neden" açılır panelde.
- Mobilde kart, masaüstünde tablo; veri aynıdır.
- "Önerilen" etiketi yalnız **Uygun** alternatifte görünür. Hiç uygun alternatif yoksa: "Bütün
  zorunlu kontrolleri sağlayan alternatif bulunamadı."

## 7. Testler (`test/solver.test.js`, `test-ui/kapasite.ui.js`)

| No | Test |
|---|---|
| S-1 | test2: mevcut H ile bulunan en küçük Q motorla uygun, Q − 0,1 motorla uygunsuz; oran yöntemi (132,5) üretilmez. |
| S-2 | Yalnız shift değişimi: bütün `sectorAlts` uygunsuz ve alt sınır kanıtı geçerli. |
| S-3 | Süre: test2'de 24 h kanıtla uygunsuz (gereken 30,7 h > 24); motor H = 24 sonucu gösteriliyor. |
| S-4 | Kaynak + süre: her H için bulunan Q'nun motor sonucu uygun, Q − 0,1 uygunsuz. |
| S-5 | Aralık: her I ≤ Imax için motor sonucu; I değişince tur ve sınır birlikte değişir (oran sabit). |
| S-6 | Kritik uyarısı açık alternatif "Uygun" sayılmaz ve önerilmez; "önerilen" yalnız uygun alternatifte. |
| S-7 | Üç hacim ayrı: kapsama < %100 iken brüt ihtiyaç koşulu uygulanır; yapay olarak düşük kapsamalı bir senaryoda motor turu sığsa bile kaynak < brüt ihtiyaçsa uygun sayılmaz. |
| S-8 | Motor değişmez: çözümleyici motor sonucunu değiştirmez; altın kayıt ve hesap parmak izi aynı. |
| S-9 | Kayıt: özet projeye yazılır, JSON yedekten geri gelir; girdi değişince geçersiz olur ve kullanılmaz. |
| S-10 | Tutarlılık: geçerli özet varken Sonuç, Hidrolik, PDF ve Excel aynı çözüm durumlarını gösterir. |
| S-11 | Uygun alternatifi olan bir senaryoda (kaynak yeterli) çözümleyici yanlış alarm üretmez. |
| S-12 | Arayüz: düğme → ilerleme → sonuç; mobil/masaüstü aynı sayılar; taşma yok; açık/koyu karşıtlık. |

## 8. Kabul ölçütleri

1. `engine.js` ve hesap modülleri değişmez; altın kayıt parmak izi ve hesap parmak izi aynı.
2. 147 mevcut test, yeni testler, 38 hidrolik denetim ve bütün arayüz testleri geçer.
3. test2'de gösterilen bütün sayılar motordan gelir. Kaynak debisi "motor ve yerleşim sonucu"
   olarak açıklanır.
4. Teknik olarak uygun olmayan hiçbir alternatif "önerilen" ya da "uygun" görünmez.
5. CI üç işte yeşildir ve APK üretilir. Gerçek cihaz testi proje sahibine aittir.

## 9. Kapsam dışı

- Alternatifi projeye uygulama ve revizyon olarak kaydetme: MH-AKIL-4 akışıyla.
- Teknik/ekonomik karşılaştırma tablosu ve "en düşük yatırım / enerji / dengeli" seçimleri:
  MH-AKIL-4.
- Arazi bölme ve ek kaynak: MH-AKIL-3.
- KML/KMZ: MH-KML.
- Depolama havuzu ve kısmi sulama hesapları: ileride ayrı aşama.
- Hedef net alanın kullanıcı tarafından ayrıca girilmesi: MH-KML veya MH-AKIL-3 ile.

## 10. Uygulama notları

- **Modüller:**
  - `www/js/solver.js`: çözümleyici. Üreteç yapısında; her adım bir motor çalıştırması.
  - `www/js/assess.js`: `applyAlternatives` ile W-KAP-01 çözümlerine işleme.
  - `www/js/assess-view.js`: `alternatives` (kart) ve `motorLine`.
  - `www/js/app.js`: düğme, ilerleme ve projeye kaydetme.
- **test2 sonuçları** (motor, 8 çalıştırma, Node'da ~0,5–0,7 s):
  - **Kaynak (20 h/gün):** 155,1 m³/h ile 8 shift, tur 15,35 h ≤ 20 h; 155,0 m³/h ile tur 21,10 h. Kapasite
    uygun, kritik uyarı açık: W-PN-02, W-SD-01.
  - **Kaynak + süre:** 22 h → 116,7 m³/h (tur 21,10 h); 24 h → 116,2 m³/h (tur 23,02 h). İkisinde de
    kritik uyarı açık; 24 h'de yalnız W-SD-01.
  - **Mevcut debiyle 24 h/gün:** kanıtla uygunsuz; gereken 30,7 h/gün.
  - **2 günlük aralık:** tur 61,39 h > 40 h.
  - **Hiçbir alternatif "Uygun" değil.** Ekranda "Bütün zorunlu kontrolleri sağlayan alternatif
    bulunamadı" yazıyor.
- **Önceki tahminle karşılaştırma:** MH-AKIL tasarım önizlemesindeki "≈ 155,6 m³/h" tahmini, motorun
  gruplama kuralıyla bulunan 155,01 m³/h değerinin 0,1 adımla üst yuvarlamasıyla (155,1 m³/h) yer
  değiştirdi.
- **Altın kayıt değişmedi:** Alternatif hesaplanmamış projelerde (bütün altın senaryolar) çıktı
  MH-AKIL-1 ile aynı.
- **Raporlar:** Alternatif hesaplanmış projede PDF ve Excel "Uyarılar" çözüm durumları ekranla aynı.
  Alternatif tablosunun kendisi rapora MH-AKIL-4 karşılaştırmasıyla eklenecek.
- **Bilinen sınırlama:** Çözümleyici arayüz iş parçacığında, her motor çalıştırması arasında ekrana
  söz vererek parça parça çalışır. Telefonda toplam süre birkaç saniye olabilir; cihaz testinde
  ölçülecek.
