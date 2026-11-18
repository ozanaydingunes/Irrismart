# MH-AKIL-1 — Yapılandırılmış Mühendislik Uyarıları ve Çözüm Önerileri

Durum: **plan onaylandı, kodlama onaylandı (18.11.2026).** MH-1 (PR #4) gerçek cihazda test
edilip `main`'e birleştirildi. Kodlama `main` üzerinden açılan ayrı bir dalda yapılır.

## 1. Amaç

Hesap sonucundaki sorunları serbest metin uyarılar yerine **karar destek nesneleri** olarak
sunmak. Her uyarının altında şunlar bulunur:
- problemin nedeni,
- hesaplanan mevcut durum,
- ilgili sınır ve eksiklik,
- uygulanabilir çözüm alternatifleri ve her birinin teknik durumu,
- çözüm için gereken ek veriler,
- karşılaştırma ve haritada düzenleme bağlantıları (ilgili modül hazır olduğunda).

Uyarılar Sonuç ekranı, Hidrolik panel, PDF ve Excel'de **aynı nesneden** okunur.

## 2. Mevcut durum (kod incelemesi)

- Motor uyarıları `www/js/engine.js` içinde Türkçe serbest metin olarak `r.warn[]` dizisine
  yazılıyor (yaklaşık 25 farklı uyarı, ör. satır 339–353 ve 376).
- MH-1 Hidrolik panel (`www/js/hydro-view.js`) bunlardan bağımsız olarak kendi `checks[]`
  listesini üretiyor (satır 32–58).
- Sonuç ekranı (`www/js/app.js:438`), PDF (`www/js/report.js:159`) ve Excel
  (`www/js/report-data.js:97`) `r.warn` metinlerini olduğu gibi basıyor.
- Sonuç: aynı sorun için iki ayrı kaynak var. Metinler yalnız Türkçe ve sayılar metne gömülü.
- **Altın kayıtlar `r.warn` metinlerini de içeriyor** (`test/golden/snapshot.js:41`). Bu
  nedenle motorun ürettiği metinler değiştirilmeyecek.

## 3. Mimari

```
engine.design(inp)  ──►  r (değişmez; r.warn metinleri aynen kalır)
                          │
                          ▼
                 IrriAssess.evaluate(r, inp)   ← yeni, saf fonksiyon, hesap yapmaz
                          │   (yalnız r'deki sayısal alanları okur; metin ayrıştırmaz)
                          ▼
               { findings[], summary, version }
          ┌───────────┬───────────┬──────────┬──────────┐
       Sonuç ekranı  Hidrolik  PDF raporu  Excel  (MH-AKIL-2..5 ileride doldurur)
```

- **Yeni dosya `www/js/assess.js`:** `r` nesnesindeki yapılandırılmış alanlardan uyarı
  nesneleri üretir. Örnek alanlar: `r.sel.cycleHours`, `r.sel.avail`, `r.sectorAlts`,
  `r.schedule`, `r.main.sel`, `r.pump`, `r.surge`.
  - Motor metinleri ayrıştırılmaz; hesap tekrarlanmaz.
  - Yeni bir sınır değeri uydurulmaz; motorun kendi eşikleri kullanılır.
- `hydro-view.js` içindeki `checks[]`, `assess` çıktısından türetilecek. Panelde aynı kod
  ve değerler görünür.
- Motor metinleri (`r.warn`), eşleşen yapılandırılmış uyarı olmayanlar için "Diğer hesap
  notları" başlığı altında gösterilmeye devam eder. Böylece hiçbir uyarı kaybolmaz.
  Eşleştirme testle denetlenir (madde 8, T-6).

## 4. Uyarı nesnesi

```js
{
  kod: 'W-KAP-01',
  seviye: 'uygunsuz' | 'uyari' | 'bilgi' | 'on-degerlendirme',
  baslik: { t: 'Sulama turu kullanılabilir süreye sığmıyor' },     // çevrilebilir
  neden:  { t: '…', p: { … } },
  durum:  [{ ad, deger, birim, kaynak: 'hesap'|'girdi'|'varsayilan' }],
  sinir:  { ad, deger, birim, kaynak },
  eksikGirdi: [{ alan, aciklama }],
  cozumler: [ Cozum ],                  // §5
  ekran: { sekme: 'shift', odak: … },   // "ayrıntıya git" bağlantısı
  onay: 'yok' | 'bekliyor' | 'kabul' | 'red',   // kullanıcı kabulü, proje ile saklanır
  surum: 1
}
```

**Çözüm nesnesi:**

```js
{
  tur: 'shift' | 'kaynak' | 'sure' | 'aralik' | 'bolme' | 'boru' | 'pn' | 'ekipman' | 'veri',
  baslik,
  durum: 'hesaplandi-uygun'      // motorla hesaplandı, zorunlu kontroller geçti
       | 'hesaplandi-uygunsuz'   // motorla hesaplandı, en az bir kontrol kaldı
       | 'kanitla-uygunsuz'      // gerekli koşul matematiksel olarak sağlanmıyor
       | 'degerlendirilmedi'     // bu sürümde hesaplanmıyor → hangi aşamada (MH-AKIL-2…)
       | 'veri-gerekli',
  gerekce,        // neden uygun/uygunsuz: ölçülen değer ve sınır
  gerekenVeri: [],
  hedef: 'karsilastir' | 'harita' | null   // ilgili modül yoksa düğme gösterilmez
}
```

Kural: `hesaplandi-uygun` durumu yalnız motorun gerçekten hesapladığı bir sonuç için
verilir. MH-AKIL-1'de motorun zaten hesapladığı tek alternatif ailesi, shift sayısı
alternatifleridir (`r.sectorAlts`, NsMin…NsMin+7).

## 5. MH-AKIL-1'deki uyarı kodları

| Kod | Seviye | Koşul (motor alanı) | Çözüm türleri ve bu aşamadaki durumları |
|---|---|---|---|
| **W-KAP-01** | uygunsuz | Seçili düzende `sel.cycleHours > sel.avail` | **shift:** `r.sectorAlts` her Ns için gerçek değer (hesaplandı). **kaynak, süre:** kapasite koşuluyla kanıtla-uygunsuz ya da değerlendirilmedi (MH-AKIL-2). **aralık:** §6.3'teki ayrıntılı değerlendirme. **bölme:** aynı kaynakla kanıtla-uygunsuz; ek kaynakla veri gerekli (MH-AKIL-3) |
| **W-KAP-02** | işletme uyarısı | Seçili düzen uygun ama `cycleHours > k·avail` (k: proje ayarı, varsayılan %90) | İşletme esnekliği; teknik uygunluğu değiştirmez (§6.1) |
| **W-SHF-01** | uyarı | Shift debileri dengesiz (`Qmin < 0,7·Qmax`) — motor eşiği | shift: elle düzenleme ekranına yönlendirme |
| **W-SHF-02** | uyarı | Kaynak debisi kullanılmıyor (`Qs > 1,6·Qmax`) — motor eşiği | shift sayısını azaltma (`sectorAlts`'tan) |
| **W-HIZ-01** | uyarı/uygunsuz | Ana hat hızı > V_OK / > V_MAX (`hydro-view` eşikleri) | boru: bir üst çap (motorun `main.alts` listesinden) |
| **W-PN-01** | uygunsuz | Manifold/ana hat işletme basıncı PN sınırını aşıyor | pn: bir üst PN; ekipman: regülatör |
| **W-PN-02** | uygunsuz | Pompa kapama basıncı > PN × 10,2 m (`pump.Pshut`) | ekipman: emniyet (tahliye) vanası (veri gerekli: açma basıncı); pn: bir üst PN |
| **W-BAS-01** | uyarı | Fazla basınç > 5 m (`surplus`) | ekipman: shift vanasında regülatör |
| **W-POM-01** | uyarı | Pompa fazla basınç > %30 (`pump.over`) | ekipman: regülatör / frekans konvertörü |
| **W-POM-02** | bilgi | Temsili (doğrulanmamış) pompa | veri: gerçek üretici eğrisi |
| **W-LAT-01** | uyarı | Lateral giriş basıncı boru sınırını aşıyor | ekipman: regülatör; boru: daha dayanıklı lateral |
| **W-SD-01** | ön değerlendirme | Joukowsky tepe basıncı > PN (`surge.exceeds`) veya her zaman bilgi | Bu aşamada mevcut mesaj yapılandırılır. Ayrıntı MH-AKIL-5'te. "Ayrıntılı geçici rejim analizi gerekli" ibaresi zorunlu. |
| **W-VERI-01…** | bilgi | Fiyatı eksik kalemler, katalogda olmayan filtre/vana, şebeke basıncı bilinmiyor | veri: eksik girdi listesi |

Eşikler `engine.js` ve `hydro-view.js` içindeki mevcut değerlerdir. Tek yeni eşik, W-KAP-02'nin
kullanıcı tarafından ayarlanabilen planlama oranıdır (§6.1).

## 6. Kapasite koşulu ve işletme payı

### 6.1 W-KAP-02 — Planlama oranı (onaylandı)

- **Proje ayarı:** "Kullanılabilir çalışma süresinin planlamada kullanılacak oranı" (`k`).
  - Varsayılan %90.
  - Aralık %50–%100.
  - Proje ile saklanır. Eski projelerde alan yoksa %90 kabul edilir; mevcut veri değişmez.
- **İki kontrol birbirinden ayrıdır:**
  1. **Kritik kapasite kontrolü (W-KAP-01):** `cycleHours ≤ avail`. Motorun kendi
     kontrolüdür (`sel.feasible`). `k` ayarından etkilenmez.
  2. **İşletme güvenlik payı (W-KAP-02):** `cycleHours ≤ k · avail`. Yalnız işletme
     esnekliği hakkında uyarı verir. Seviyesi "uyarı"dır, hiçbir zaman "uygunsuz" olmaz.
- `k`, motorun girdilerine **gitmez**. Shift seçimini, `feasible` sonucunu, pompa ve boru
  seçimini, raporlardaki uygunluk durumunu değiştirmez. Bu, bir değişmezlik testiyle
  denetlenir (T-13).
- Mesaj örneği (sayılar temsilidir): "Tur 18,6 h; planlama sınırı 18,0 h (20 h'nin %90'ı). Sistem uygun, ancak
  arıza, bakım veya yağış sonrası telafi için 1,4 h pay kalıyor."

### 6.2 W-KAP-01 çözümleri

Kullanılan büyüklükler:
- V: bir sulama aralığında verilmesi gereken brüt hacim = `Qfield · t`.
- Qs: kaynak debisi.
- H: günlük çalışma süresi.
- I: sulama aralığı (gün).

Her shift en fazla Qs çekebildiği için tur süresi şu koşulu sağlar:

```
Ns · t ≥ V / Qs     ⇒     uygunluk için gerekli koşul:  V / Qs ≤ H · I
```

Bu koşul **yalnız gereklidir, yeterli değildir**. Bu nedenle:
- Koşul sağlanmıyorsa ilgili çözüm **kanıtla uygunsuz** olur. Gerekçe ekranda sayılarla
  yazılır, ör. test2: 2 401 m³ ÷ 86,3 m³/h = 27,8 h > 20 h.
- Günlük süre için gereken H = V / (Qs · I) ≥ 27,8 h > 24 h. Bu yüzden "günde 24 saate
  kadar çalışma" çözümü, diğer girdiler aynı kaldıkça kanıtla uygunsuzdur. Gerekçe sayısal
  olarak yazılır.
- Sulama aralığı ayrıca değerlendirilir (§6.3); otomatik olarak uygunsuz ilan edilmez.
- Koşul sağlansa bile çözüm **"değerlendirilmedi — MH-AKIL-2"** olarak kalır. Uygunluk
  ancak motor yeniden çalıştırılınca söylenir.
- Kaynak için gösterilen değer yalnızca **alt sınırdır**: "en az V/(H·I) ≈ 120 m³/h gerekir;
  gerçek değer ünite debilerine ve shift yerleşimine bağlıdır, MH-AKIL-2'de hesaplanır."
  Oran yöntemiyle bulunan değer (30,7/20 × 86,3) hiçbir yerde üretilmez.

### 6.3 Sulama aralığı değerlendirmesi

Aralık seçenekleri tek kalemde "uygunsuz" sayılmaz. Her aralık seçeneği I için şunlar
ayrı satırlarda gösterilir; değerler motorun `schedule()` sonucundan gelir:

| Unsur | Kaynak | Not |
|---|---|---|
| Günlük brüt su ihtiyacı (mm/gün, m³/gün) | `schedule.gross`, A | Tepe ay |
| Dönemlik toplam brüt ihtiyaç | `schedule.seasonM3`, `monthly[]` | Aylık tablo |
| Toprak kullanılabilir su kapasitesi | `soil.aw` (toprak sınıfı) | Girdi ya da varsayılan; kaynağı yazılır |
| Kök derinliği | `crop.Zr` | Bitki kaydı; kaynağı yazılır |
| İzin verilen tüketim oranı, RAW | `crop.p`, `schedule.RAW` | — |
| En büyük aralık | `schedule.Imax = ⌊RAW / net⌋` | Motorun mevcut sınırı |
| Bir uygulamadaki sulama süresi | `t = gross · I / AR` | Shift başına |
| Günlük kaynak kapasitesi | `Qs · H` | — |
| Günlük ortalama hacim açığı | `V/I − Qs · H` | — |
| Bitki su stresi riski | I > Imax ise var | Motor aralığı zaten Imax'e düşürür |

Karar kuralları:

1. **I > Imax:** Seçenek "uygunsuz — bitki su stresi riski" olur. Gerekçe RAW, günlük
   tüketim ve Imax sayılarıyla yazılır.
2. **I ≤ Imax:** Sabit ortalama ihtiyaç ve sabit kaynak kapasitesi altında günlük ortalama
   hacim açığı aralıktan bağımsızdır. Bu durumda seçenek şöyle gösterilir:
   - Etiket: "**bu varsayımlar altında açığı kapatmaz**".
   - Varsayımlar açıkça listelenir: aynı tepe ET0, aynı Kc, aynı günlük çalışma süresi,
     aynı kaynak debisi, depolama yok.
   - Gerekçe sayısal olarak yazılır. Örnek: "I = 2 gün: gereken 4 802 m³, verilebilen
     2 × 20 h × 86,3 m³/h = 3 452 m³; açık 1 350 m³ (günde 675 m³)."
3. Farklı bir işletme senaryosu açığı değiştirebilir; bunlar **"değerlendirilmedi"**
   olarak listelenir ve hangi verinin gerektiği yazılır:
   - depolama havuzu,
   - tepe dışı aylarda farklı aralık (motorun aylık `interval` değerleri),
   - açık süresi boyunca kısmi (deficit) sulama kabulü,
   - farklı günlük çalışma süresi.
4. **Veri gerekli:** Toprak sınıfı ya da kök derinliği kullanıcı tarafından girilmemiş ve
   varsayılan kullanılıyorsa aralık değerlendirmesi "Veri gerekli — toprak/kök derinliği
   varsayılan" notuyla gösterilir. Toprak sınıfı bilinmiyorsa uygunluk hakkında kesin ifade
   kullanılmaz.

## 7. Ekranlar

**Sonuç ekranı**
- Uyarı özeti şeridi: uygunsuz / uyarı / ön değerlendirme sayıları.
- Her uyarı bir karttır:
  - üstte seviye, kod ve başlık,
  - 2–4 durum kutucuğu (mevcut değer ve sınır),
  - tek satırlık neden.
- Kartın altındaki açılır paneller:
  - "Neden ve önemi"
  - "Çözüm seçenekleri": her seçenekte durum rozeti ve gerekçe
  - "Gereken veriler"
  - "Hesap ayrıntısı"
- Kritik (uygunsuz) uyarılar en üstte durur. Mobilde yalnız bunlar açık gelir; diğerleri
  kapalı başlık olarak görünür.

**Hidrolik panel:** Sistem Özeti'ndeki kontrol listesi aynı kodları gösterir.
"Çözümleri gör" bağlantısı Sonuç ekranındaki karta gider.

**Yönlendirme düğmeleri**
- "Alternatifleri karşılaştır" ve "Haritada düzenle" düğmeleri, ilgili modüller
  (MH-AKIL-4, MH-AKIL-3) yokken **gösterilmez**.
- Pasif düğme ya da "yakında" etiketi de kullanılmaz.

**Özet ve detay seviyeleri**
- Kartın kendisi özettir.
- Ayrıntılı mühendislik tabloları açılır panelde ve Hidrolik panelde kalır.

**PDF:** "Mühendislik değerlendirmesi" bölümü. Her uyarı için kod, seviye, mevcut durum,
sınır, çözüm seçenekleri ve durumları, gereken veriler. Ardından "Diğer hesap notları".

**Excel:** "Uyarılar" sayfası şu sütunlarla:
- Kod, Seviye, Başlık
- Mevcut değer, Sınır, Birim
- Çözüm türü, Çözüm durumu, Gerekçe
- Gereken veri

Sayılar sayısal hücre olarak yazılır. Mevcut "Varsayımlar" sayfası aynen kalır.

**Dil:** Başlık, neden ve gerekçe metinleri 8 dilde çevrilir. Sayılar parametre olarak
verilir ve yerel biçimde gösterilir.

## 8. Testler (`test/assess.test.js`, `test-ui/uyari.ui.js`)

| No | Test |
|---|---|
| T-1 | test2 senaryosunda W-KAP-01 üretilir. Durum değerleri motor alanlarıyla birebir aynıdır (cycleHours, avail, Qs). |
| T-2 | W-KAP-01 altında shift çözümü: `sectorAlts`'taki her Ns için durum `hesaplandi-uygunsuz`. Gerekçe değerleri motordan gelir ("yalnız shift değişimi çözmüyor"). |
| T-3 | Kapasite koşulu: test2'de aralık ve süre çözümleri `kanitla-uygunsuz`; kaynak çözümü `degerlendirilmedi` ve alt sınır ≈ V/(H·I). 132 (oran yöntemi) değeri üretilmez. |
| T-4 | Aynı kaynakla bölme çözümü `kanitla-uygunsuz`; ek kaynakla `veri-gerekli`. |
| T-5 | Yanlış alarm yok: bütün altın senaryolarda, motorun uygun bulduğu kontroller için uygunsuz uyarı çıkmaz. Her senaryonun uyarı kodu kümesi ayrıca kayda alınır. |
| T-6 | Kayıp uyarı yok: her `r.warn` metni ya bir yapılandırılmış uyarıyla eşleşir ya da "Diğer hesap notları"nda görünür. |
| T-7 | Tutarlılık: aynı proje için Sonuç ekranı, Hidrolik panel, PDF metni ve Excel "Uyarılar" sayfası aynı kodları, seviyeleri ve sayısal değerleri içerir. |
| T-8 | `hesaplandi-uygun` durumu yalnız motor sonucu olan çözümlerde bulunur (değişmezlik testi; bütün senaryolar). |
| T-9 | W-SD-01 metninde "Ön değerlendirme – mühendislik doğrulaması gerekli" ve "Ayrıntılı geçici rejim analizi gerekli" bulunur. "güvenli", "onaylı", "garanti" sözcükleri bulunmaz. |
| T-10 | Proje saklama: `onay` ve `k` alanları kaydedilip geri okunur. v0.6.0 ve MH-1 dönemi projeleri hatasız açılır, veri silinmez (`upgrade.test.js` genişletilir). |
| T-10b | **Gerçek JSON yedek → geri yükleme:** Uygulamanın "Yedekle" ve "Yedekten yükle" mekanizması (`www/js/app.js:75-92`, `IrriGrow_yedek` biçimi) kullanılır. Yeni alanlarla yedeklenen proje, geri yüklendikten sonra hesap sonucu ve uyarı kodlarıyla birebir aynı olur. Eski sürüm yedeği yeni sürümde açılır. Excel raporu yedek olarak **kullanılmaz** ve testlerde yedek yerine geçmez. |
| T-13 | İşletme payı ayrımı: `k` %50, %90 ve %100 iken motor sonucu (`sel`, `feasible`, pompa, boru, altın parmak izi) ve W-KAP-01 birebir aynı kalır; yalnız W-KAP-02 değişir. |
| T-14 | Sulama aralığı: I > Imax için "uygunsuz — su stresi"; I ≤ Imax için "bu varsayımlar altında açığı kapatmaz" etiketi, varsayım listesi ve sayısal açık gösterilir. Varsayılan toprak/kök derinliğinde "Veri gerekli" notu bulunur. |
| T-11 | i18n: yeni anahtarlar 8 dilde eksiksiz (`i18n.test.js`). |
| T-12 | Arayüz (Playwright, masaüstü 1440 ve mobil 390): kritik uyarı ilk sırada; açılır paneller çalışır; taşma yok; dokunma hedefleri ≥ 44 px; açık/koyu tema karşıtlığı. Hazır olmayan modüllere düğme gösterilmez. |

## 9. Kabul ölçütleri

1. `npm test`: mevcut 130 test (MH-1 birleştikten sonraki sayı) ve yeni testlerin tamamı geçer.
2. `tools/audit.js`: 38/38.
3. MH-0 altın kayıt parmak izi **değişmez**. `engine.js` formülleri ve `r.warn` metinleri
   değişmez. Mevcut projelerin hidrolik sonuçları değişmez.
3a. Planlama oranı `k` hiçbir teknik uygunluk sonucunu değiştirmez (T-13).
3b. JSON yedek → geri yükleme testi (T-10b) geçer.
4. Bütün Playwright arayüz testleri geçer (MH-1'deki 226 kontrol dahil).
5. T-7 tutarlılık testi yeşildir: Sonuç, Hidrolik, PDF ve Excel aynı veriyi gösterir.
6. test2 için ekranda "uygun" diye gösterilen hiçbir hesaplanmamış çözüm yoktur.
   Kaynak debisi yalnız "alt sınır" olarak ve gerekçesiyle görünür.
7. CI üç işte yeşildir (Testler, Arayüz testleri, Debug APK). APK eski projelerin üzerine
   veri kaybı olmadan kurulur.
8. Ekran görüntüleri (masaüstü ve mobil, açık ve koyu) PR açıklamasına eklenir.
9. Gerçek cihaz testi proje sahibi tarafından yapılmadan PR "cihazda doğrulandı" diye
   raporlanmaz ve onay olmadan birleştirilmez.

## 10. Kapsam dışı (sonraki aşamalar)

- Motoru farklı girdilerle yeniden çalıştıran alternatif arama: MH-AKIL-2.
- Su darbesinin ayrı ayrı değerlendirilmesi: vana kapanma süresi, PN, pompa duruşu, vakum
  riski, koruma ekipmanları (MH-AKIL-5).
- Harita üzerinde bölme: MH-AKIL-3.
- KML/KMZ içe aktarma: MH-KML.
- Alternatif karşılaştırma: MH-AKIL-4.
- Kot ve eğim verisine dayanan bütün öneriler: MH-2 ve MH-3.

## 10.1 Sonraki modüllerle veri uyumu

- Uyarı ve çözüm nesneleri proje kimliğine ve **revizyon kimliğine** bağlıdır
  (`projeId`, `revId`, ana proje için `revId: null`). MH-AKIL-3'te her alt proje ve her taslak
  kendi uyarı listesine sahip olur.
- `durum[]` öğelerinde `kapsam` alanı bulunur: `'proje' | 'bolum' | 'kaynak'`. Aynı kaynağı
  paylaşan bölümlerin toplam kapasite kontrolü (MH-AKIL-3) bu alanla yapılır.
- Geometri ile ilgili uyarılar `geoKaynak` alanını taşır: `'cizim' | 'kml' | 'kmz'`.
  MH-KML'de içe aktarılan parsellerdeki boşluk ve geometri uyarıları aynı modelle üretilir.
- `cozumler[].hedef` alanı, ilgili modül etkinleştiğinde dolar. Bunlar: `'karsilastir'`
  (MH-AKIL-4) ve `'harita'` (MH-AKIL-3 ve MH-KML). O zamana kadar düğme gösterilmez.

## 11. Tahmini değişecek dosyalar

| Dosya | Değişiklik |
|---|---|
| `www/js/assess.js` | yeni |
| `www/js/hydro-view.js` | `checks` üretimi assess çıktısından |
| `www/js/hydro-panel.js` | kod rozeti, "Çözümleri gör" bağlantısı |
| `www/js/app.js` | Sonuç ekranı uyarı kartları |
| `www/js/report.js`, `www/js/report-data.js` | PDF bölümü ve Excel sayfası |
| `www/js/store.js` | uyarı onay durumu, planlama oranı `k` (geriye dönük uyumlu) |
| `www/js/i18n-dict.js`, `www/css/app.css` | çeviriler ve kart stilleri |
| `www/index.html` | betik sırası |
| `test/assess.test.js`, `test-ui/uyari.ui.js` | yeni testler |
| `test/upgrade.test.js`, `test/report.test.js` | genişletme |
| `www/js/engine.js` | **değişmez** |


## 12. Uygulama notları (MH-AKIL-1 PR'ı)

- **Modüller:** `www/js/assess.js` (değerlendirme), `www/js/assess-view.js` (Sonuç ekranı kartları).
  Sonuç, Hidrolik, PDF ve Excel aynı çağrıyı kullanır: `IrriAssess.forProject(proje, sonuç)`.
- **Kodlar:** Plandaki listeye ek olarak motorun mevcut uyarıları için `W-KAP-03` (shift debisi >
  kaynak), `W-LAT-02` (lateral ΔH), `W-MAN-01` (manifold basınç değişimi), `W-PN-03` (manifold PN),
  `W-POM-03` (hidrant basıncı az farkla yetersiz), `W-FLT-01`, `W-VAN-01` kodları verildi. Eşikler
  motorun ve MH-1 panelinin eşikleridir.
- **Çözüm durumu `varsayimla-yetersiz`** (“Bu varsayımlarla yetersiz”) sulama aralığı için eklendi
  (§6.3 kural 2). Varsayımlar her seçeneğin altında yazılır.
- **Seviye uyumu:** Hidrolik paneldeki her uyarı kontrolü Sonuç ekranında aynı kod ve seviyede
  görünür (temsili pompa ve eksik filtre kaydı her iki yerde “uyarı”).
- **“Hesaplandı – uygun”** yalnız motorun hesapladığı shift ve ana hat çapı alternatiflerinde
  kullanılır ve her zaman “Kontrol edilenler: …” kapsam notuyla (ekran, PDF ve Excel) birlikte yazılır;
  su darbesi bu alternatifler için ayrıca hesaplanmadığı belirtilir.
- **Kullanıcı kararı:** Kullanıcı kararı yok / İnceleniyor / Bilinerek kabul edildi / Çözülmesi
  gerekiyor. `proje.akil.onay[kod]` alanında saklanır; uyarının seviyesini değiştirmez.
- **Planlama oranı:** Veriler → Proje ayarları; `proje.akil.planOrani` (motor girdisi `inp` dışında).
- **Yedekleme:** Uygulamanın JSON yedekleme/geri yükleme mantığı davranış değişmeden
  `IrriStore.backupPayload / readBackup / mergeBackup` fonksiyonlarına taşındı; testler bu
  fonksiyonları kullanır.
- **Altın kayıt:** Excel'e “Uyarılar” sayfası eklendiği için kayıt yenilendi. Motor sonuçları ve
  diğer çıktılar MH-0 ile aynı; ayrıntı `docs/hesap-degisiklik-kaydi.md`.
- **Kullanıcı kararı ve teknik uygunluk:** “Bilinerek kabul edildi” kararı uyarının seviyesini,
  sayımları, çözüm durumlarını ve `teknikUygun` sonucunu değiştirmez; ekranda ve PDF'te uyarı
  “Uygunsuz” olarak kalır, karar ayrıca yazılır (test T-15).

### 12.1 test2 günlük hacmi: 2.379 m³ ile 2.401 m³ farkı

Hesap senaryosu: `{ crop: 'domates', area_da: 288,9, srcType: 'kuyu', depth: 40, region: 'akdeniz', Q: 86,3 }`
(eşdeğer dikdörtgen). Bu, kullanıcının ekran görüntüsündeki test2 sonuçlarını (16 shift, 30,7 h,
86,3 m³/h) birebir veren yaklaşık modeldir; kullanıcının telefonundaki gerçek test2 projesinin
girdileri (parsel sınırı vb.) JSON yedeğiyle paylaşılırsa ayrıca doğrulanacaktır.

| Değer | Tanım | Kaynak |
|---|---|---|
| 2.401 m³ | 8,31 mm (yuvarlanmış brüt) × 288,9 da | Tasarım önizlemesinde elle yapılan hesap; **yuvarlama** |
| 2.399,5 m³ | 8,3056 mm × 288.900 m² | Brüt ihtiyaç × toplam alan; Hidrolik panel “Günlük hacim (tepe)” |
| 2.379,2 m³ | 1.240,10 m³/h (Σ damlatıcı debisi) × 1,9186 h (shift süresi) ÷ 1 gün | Motorun tur süresinde kullandığı hacim; uyarı katmanı “Günlük sulama hacmi” |

- 2.401 → 2.399,5: yalnız yuvarlama (+1,1 m³).
- 2.399,5 → 2.379,2: tanım farkı (−20,2 m³, %0,84). Damlatıcılar 620.048 adet × 0,33 m × 1,40 m =
  286.462 m² alanı kaplar (toplam alanın %99,16'sı); parsel kenarlarında tam sıra aralığı kalmadığı
  için bu şeritlerde damlatıcı yoktur.
- Tur süresi 16 × 1,9186 h = 30,70 h, 2.379,2 m³ ile tutarlıdır. Kapasite denetimi motorla aynı
  tanımı (2.379,2 m³) kullanır; **hesap değiştirilmedi.** Ekranda iki büyüklük ayrı adlarla
  (“Günlük sulama hacmi”, “Brüt ihtiyaç × toplam alan”) ve açıklamasıyla gösterilir.
