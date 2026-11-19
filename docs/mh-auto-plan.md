# MH-AUTO — Akıllı Otomatik Tasarım Modu

Durum: **teknik plan onaylandı ve `main`'e alındı (PR #16, 19.11.2026); açık kararlar AK-1…AK-4 karara bağlandı (§0, A-9…A-14). Kodlama kontrollü aşamalarla.**
Aktif geliştirme kapsamındadır (proje sahibi kararı, 19.11.2026). Her aşama ayrı dal ve ayrı PR;
onay olmadan `main`'e birleştirilmez. Hesap motoru ve mühendislik doğrulaması tamamlanmadan
kullanıcıya tamamlanmış ya da güvenli olduğu izlenimi verilmez.

İlgili planlar: `docs/mh-pn-plan.md` (PN-0…PN-5), `docs/mh-2a-plan.md`, `docs/mh-manuel-plan.md`,
`docs/mh-shift-plan.md`, `docs/mh-manuel-1a-uygulama.md`. Bu belge yalnız yeni dosyadır;
`docs/yol-haritasi.md`, PR #14 ve PR #15 kararlarından sonra güncellenir.

## 0. Kararlar

| No | Karar |
|---|---|
| A-1 | İki çalışma modu: **Manuel Mühendislik** ve **Akıllı Otomatik Tasarım** (§2) |
| A-2 | Otomatik mod, arazi, bitki, su kaynağı ve sulama girdilerinden proje alternatifleri üretir; kullanıcı onaylar veya düzenler |
| A-3 | Mümkün olduğunda üç alternatif: **Ekonomik**, **Dengeli**, **Performans Odaklı**. Üçü de **aynı asgari mühendislik koşullarını** sağlar; maliyet için güvenlikten ödün verilmez (§4, §5) |
| A-4 | Elle yapılan değişiklik izinsiz olarak otomatik seçimle geri alınmaz (§3.2) |
| A-5 | Doğrulanmamış katalog, tahmini kot veya örnek maliyetle kesin uygunluk bildirilmez. Normal işletme, geçici rejim riski ve doğrulanmış hidrolik uygunluk ayrı gösterilir (§4.2) |
| A-6 | Yalnız Joukowsky üst sınırı aşılıyorsa sonuç "uygunsuz" değil, "Geçici rejim analizi gerekli" (`docs/mh-pn-plan.md` D-7) |
| A-7 | Gerçek kot hidrolik hesaba girene kadar (MH-3) topografik sınırlamalar açıkça yazılır |
| A-8 | Aşamalar MH-AUTO-1…7 (§6); PN ve MH-2A ile uyumlu sıra (§7) |
| A-9 | **AK-1 — sıra:** önce PN-1 ve PN-2 (boru veri modeli, basınç kontrolü), sonra PN-3 (elle boru seçimi). MH-AUTO-1 (veri modeli ve kurallar) bağımsız hazırlanabilir. Tam otomatik optimizasyon, gerekli hidrolik bileşenler tamamlandıkça etkinleştirilir. Çalışan hesap motoru gereksiz yere yeniden yazılmaz |
| A-10 | **AK-2 — Dengeli puan:** başlangıç ağırlıkları ilk yatırım %35, enerji %30, bakım %20, hidrolik performans %15; kullanıcı değiştirebilir. Teknik uygunluk ve güvenlik koşulları puanlamadan **önce zorunlu filtre** (§4.1) |
| A-11 | **AK-3 — bakım maliyeti:** kullanıcı girer; doğrulanmış katalog veya geçmiş işletme verisi varsa kullanılabilir. Veri yoksa tahmin uydurulmaz: **"Bakım maliyeti hesaplanmadı"**. Ekonomik karşılaştırmada maliyet kapsamı ve eksik veriler açıkça yazılır |
| A-12 | **AK-4 — güzergâh:** ilk aşamada parsel geometrisi, su kaynağı, mevcut bağlantı noktaları ve shift yerleşimine göre **taslak** güzergâh önerisi; MH-2A ve MH-3 sonrasında gerçek kot, boyuna profil ve hidrolik kayıplarla güzergâh optimizasyonu. Kullanıcı güzergâhı haritada elle değiştirebilir |
| A-13 | Uygun tasarım yoksa uygunsuz alternatif önerilmez: **"Uygun tasarım bulunamadı"** ve sağlanamayan koşullar. Üç alternatif aynı zorunlu kriterleri sağlar. MH-3 ve MH-AKIL-5 tamamlanmadan kesin mühendislik uygunluğu bildirilmez |
| A-14 | Mevcut otomatik tasarım davranışı ve kayıtlı projeler korunur; Akıllı Otomatik Tasarım **kullanıcının seçtiği ayrı bir mod**dur. Elle seçimler kilitlenebilir ve izinsiz değiştirilmez |

## 1. Bugün var olan otomatik tasarım yetenekleri (kod incelemesi, `main` ef28f45)

Uygulama zaten büyük ölçüde otomatik bir tasarım motoru. MH-AUTO bunları **yeniden yazmaz**: bir
araya getirir, eksiklerini tamamlar ve kullanıcı denetimini ekler.

| İstenen | Bugün | Yer | Eksik |
|---|---|---|---|
| Shift sayısı ve dağılımı | Aday shift sayıları sıralı min–maks bölmeyle (`Ly.partition`) gerçek hidrolikle hesaplanıyor; öneri, fiyatlar tamsa en düşük yıllık maliyete, değilse en az shift'e göre. Elle atama (`opt.manual`) destekli | `engine.js` 316–338; `layout.js` | Bölme yalnız debi dengesine bakıyor; kot, komşuluk ve işletme tercihi yok. Haritada düzenleme MH-SHIFT'te |
| Shift debi, süre, basınç | Her shift için Q, H, pompa H, tur süresi, `feasible` | `engine.js` 201–305 | — |
| Kaynak kapasitesi alternatifleri | MH-AKIL-2 `solver.js` | **PR #8 (birleştirilmedi)** | PR #8 kararı |
| Ana hat güzergâhı | Kullanıcı çiziyor (kaynak → istasyon → noktalar); çizilmezse başlık köşesi kabulü | `engine.js` 104–124 | **Otomatik güzergâh yok** (kot ve engel verisi gerekir) |
| Manifold yerleşimi | Otomatik: başlık kenarı, bant sayısı, alt üniteler | `layout.js` `buildLayout` | Kot yalnız tek düzlemden |
| Ana hat çapı | Her çap için en düşük uygun PN; öneri en düşük yıllık maliyet (boru × CRF + enerji); hız ≤ 2,0 m/s; teleskop | `engine.js` 243–262 | Yalnız PVC-U; PN/SDR/malzeme seçimi PN paketinde |
| Manifold çapı | Otomatik çap; her çapta en düşük PN | `engine.js` 97–100 | PN kontrolü yalnız uyarı (PN-2) |
| Pompa, filtre, vana | Katalogdan seçim | `catalog.js` 47–110 | Varsayılan kayıtlar **jenerik** (`dogrulandi: false`) |
| Malzeme listesi ve maliyet | BOM, fiyat kaynağı (örnek / kullanıcı) | `engine.js` 435–492 | — |
| Alternatifler | `layoutAlternatives`: sıra yönü × lateral çapı (4 varyant); seçimler: en düşük yatırım, en düşük enerji, dengeli | `engine.js` 496–521; `app.js` 445–453 | (1) Uygun alternatif yoksa havuz **uygunsuzlara geri düşüyor** (`engine.js` 507); A-3'e aykırı. (2) Arama alanı dar. (3) Ağırlıklar ekranda yazmıyor |
| Su darbesi | Joukowsky ön değerlendirmesi | `engine.js` 383–389 | Sınıflandırma PN-2'de düzeltilecek |

## 2. İki çalışma modu

| | Manuel Mühendislik | Akıllı Otomatik |
|---|---|---|
| Kim seçer | Kullanıcı: boru (malzeme, Ø, SDR, PN), shift sayısı ve dağılımı, pompa, filtre, vana | Sistem alternatifleri üretir; kullanıcı birini onaylar |
| Hesap | Her değişiklikte aynı `design()` ile bütün bağımlı hesaplar | Her aday aynı `design()` ile, gerçek hidrolikle |
| Geçiş | Otomatik → Manuel: onaylanan alternatif başlangıç olur. Manuel → Otomatik: kullanıcının kilitleri (§3.2) korunur; kilitsiz alanlar yeniden önerilir | |

Mod, tek bir hesap motoru üzerindeki iki **kullanım biçimidir**; ayrı bir motor yoktur. Ekran ve
raporlar aynı sonucu gösterir.

## 3. Veri modeli (MH-AUTO-1)

```js
project.tasarim = {
  mod: 'otomatik' | 'manuel',
  kilitler: {                 // kullanıcının elle sabitlediği kararlar; otomatik mod bunlara dokunmaz
    Ns: null | number, shiftAtama: null | {sig, assign},   // MH-SHIFT
    boru: { ana: null | {malzeme, od, sdr}, manifold: null | {...} },   // MH-PN PN-3
    pompa: null | id, filtre: null | id, vana: null | id, guzergah: null | true,
  },
  oneriler: null | { imza, uretildi: tarih, motorSurumu, liste: [ { tur: 'ekonomik'|'dengeli'|'performans', girdiFarki, ozet, durum } ] },
  secilen: null | 'ekonomik' | 'dengeli' | 'performans' | 'manuel',
}
```

- `STATE_FIELDS` mühendislik grubuna girer (MH-MANUEL-1A): revizyon, yedek ve geri yüklemede taşınır.
- `oneriler` girdiler değişince `imza` ile geçersizleşir; geçersiz öneri "güncel değil" etiketiyle
  gösterilir ve kendiliğinden uygulanmaz.

### 3.1 Seçim kuralları

- Her aday, kilitler sabit tutularak yalnız kilitsiz girdiler değiştirilip `design()` ile hesaplanır.
  Oran veya kestirim yöntemi kullanılmaz (MH-AKIL-2 ilkesi).
- Arama alanı (aşamalara göre büyür): shift sayısı ve dağılımı (AUTO-2), sıra yönü ve lateral çapı
  (bugün), ana hat ve manifold malzeme/Ø/SDR/PN (AUTO-3; yalnız doğrulanmış kombinasyonlar),
  pompa, filtre ve vana (AUTO-4).
- Hesap bütçesi: aday sayısı sınırlı; Android'de süre ölçülür, gerekirse Web Worker. Arama yarıda
  kalırsa "kısmi arama" yazılır.

### 3.2 Kullanıcı denetimi ve kilitler (A-4)

- Kullanıcının elle değiştirdiği her karar **kilit** olur. Otomatik yeniden öneri kilitleri korur.
- Bir kilit uygulanamaz hâle gelirse (ör. yerleşim değişti) **sessizce silinmez**: "Elle seçiminiz
  artık uygulanamıyor — koru / uyarla / kaldır" sorulur (MH-MANUEL V-20 ilkesi).
- "Otomatiğe dön" bütün kilitleri kaldırır; önce revizyon alınır (MH-MANUEL-1A V-21).

## 4. Asgari mühendislik koşulları ve durum gösterimi

### 4.1 Ortak uygunluk kapısı (üç alternatif için aynı)

| Kod | Koşul |
|---|---|
| U-01 | Damlatıcı debi değişimi izin verilen sınırda (lateral %55 + manifold %45 payı) |
| U-02 | Tepe dönem turu mevcut sulama süresine sığar (`feasible`) |
| U-03 | Shift debisi ≤ kaynak debisi |
| U-04 | Ana hat ve manifold hızları sınırda (bugünkü sınırlar) |
| U-05 | Normal işletme basıncı ≤ PFA, her hat türünde (PN-2); pompa kapama basıncı ≤ PFA |
| U-06 | Lateral giriş basıncı ≤ lateral `maxH` |
| U-07 | Pompa çalışma noktası eğri içinde |

Hiçbir aday kapıdan geçmezse **alternatif önerilmez**: "Bu girdilerle uygun tasarım bulunamadı"
yazılır ve hangi koşulların aşıldığı listelenir. Bugünkü "uygunsuzlara geri düşme" davranışı
(`engine.js` 507) otomatik modda kullanılmaz. Manuel modda uygunsuz sonuç gösterilir ama açıkça
işaretlenir.

### 4.2 Üç ayrı durum (A-5)

| Durum | Ne zaman |
|---|---|
| **Normal işletme** | U-01…U-07 sonucu: Uygun / Uygunsuz |
| **Geçici rejim riski** | Joukowsky ön değerlendirmesi: sınır içinde / "Geçici rejim analizi gerekli" (ayrıntı MH-AKIL-5) |
| **Doğrulanmış hidrolik uygunluk** | Ancak: katalog kayıtları doğrulanmış (`dogrulandi: true`), kot gerçek ve hidrolik hesaba dahil (MH-3), geçici rejim analizi yapılmış (MH-AKIL-5). Bunlardan biri eksikse: **"Ön tasarım — mühendislik doğrulaması gerekli"** ve eksik olanların listesi |

Bugün ve MH-3 / MH-AKIL-5 tamamlanana kadar otomatik modun en yüksek durumu "Ön tasarım"dır.
Kesin uygunluk yazan bir etiket yoktur.

### 4.3 Veri niteliği etiketleri

Her sonuçta: katalog (doğrulanmış / jenerik), fiyat (kullanıcı / örnek / eksik), kot (ölçülmüş /
DEM / kullanıcı eğimi / varsayılan), kot hidrolik hesapta mı ("Kot verisi hidrolik hesaba dahil
edilmedi"). Topografik sınırlama kutusu (A-7): tek düzlem kot modeli; otomatik shift ve güzergâh
kotu dikkate almıyor.

## 5. Üç alternatif (MH-AUTO-5)

Üçü de §4.1 kapısından geçen **aynı havuzdan** seçilir.

| Alternatif | Amaç | Ölçüt |
|---|---|---|
| **Ekonomik** | En düşük tahmini toplam maliyet | Yıllık toplam = yatırım × CRF + yıllık enerji (+ bakım payı varsa). Fiyatlar örnekse "tahmini (örnek fiyat)"; eksikse metraj vekil ölçüt ve "sıralama kesin değil" |
| **Dengeli** | Yatırım, enerji, bakım ve hidrolik performansı birlikte | Normalize çok ölçütlü puan (her ölçüt havuzdaki en iyiye bölünür): **ilk yatırım %35, enerji %30, bakım %20, hidrolik performans %15** (A-10); kullanıcı değiştirebilir, toplam %100. Hidrolik performans: tekdüzelik payı, en yüksek H ve hız payından birleşik gösterge (tanımı MH-AUTO-5'te belgelenir). Bakım verisi yoksa bakım ağırlığı **puana katılmaz**, kalan ağırlıklar oransal ölçeklenir ve kartta "Bakım maliyeti hesaplanmadı — puan bakım hariç" yazar. Bugünkü `layoutAlternatives` "dengeli" formülü değişmez; yeni puan yalnız Akıllı Otomatik modda |
| **Performans** | Kayıp, enerji ve işletme riskini azaltmak | Öncelik sırası: en düşük enerji, en düşük toplam kayıp, en geniş tekdüzelik payı, en düşük ana hat hızı (daha düşük Joukowsky ΔH). Maliyet yalnız eşitlik bozucu |

- Ağırlıklar ve öncelikler `docs/` ve ekranda açıkça yazılır; değişiklik ayrı karar.
- İki alternatif aynı tasarıma düşerse tek kart "Ekonomik ve Dengeli aynı tasarım" olarak gösterilir.
- Karşılaştırma tablosu: yatırım, yıllık enerji, 5/10/15 yıllık toplam, en yüksek H, pompa gücü,
  shift sayısı, boru metrajı, tekdüzelik payı, en yüksek hız, durumlar (§4.2).

## 6. Aşamalar

| Aşama | Kapsam | Motor | Bağımlılık |
|---|---|---|---|
| **MH-AUTO-0** | Bu plan (yalnız belge) | — | — |
| **MH-AUTO-1** | Veri modeli (`tasarim`), kilitler, uygunluk kapısı U-01…U-07, durum ve veri niteliği etiketleri; `www/js/auto.js` (motor dışı; mevcut `design()` ve `layoutAlternatives` sonuçlarını okur) | Değişmez | MH-MANUEL-1A (`STATE_FIELDS`, revizyon), PN-2 (U-05) |
| **MH-AUTO-2** | Otomatik shift: sayı ve dağılım; MH-AKIL-2 kapasite alternatifleriyle birleşik; kilitli elle atama korunur | Değişmez (bölme kuralı aynı; yeni bölme ölçütü gerekirse ayrı hesap değişikliği) | PR #8 (`solver.js`), MH-SHIFT-1/2 |
| **MH-AUTO-3** | Boru çapı, malzeme, SDR, PN optimizasyonu (gelişmiş otomatik seçim, kullanıcı açar; varsayılan kapalı) | **Değişir (isteğe bağlı yol)**: hesap değişikliği kaydı, EPANET doğrulaması, altın kayıt korunumu (mod kapalıyken bit bit aynı) | PN-1 (doğrulanmış katalog), PN-2, PN-3 |
| **MH-AUTO-4** | Pompa, filtre, kontrol vanası: tercihler (pompa tipi, marka, katalog), kilitler, jenerik kayıt uyarısı | Değişmez (seçim işlevleri aynı) | Katalog içe aktarma; MH-AUTO-1 |
| **MH-AUTO-5** | Üç alternatif (§5), karşılaştırma ekranı; "geri düşme" yerine "uygun tasarım yok" | Değişmez | AUTO-2…4, MH-MANUEL-3 (karşılaştırma) |
| **MH-AUTO-6** | Harita: shift renkleri, ana hat ve manifold güzergâhı, Ø/PN/uzunluk etiketleri, pompa/filtre/vana simgeleri; güzergâh veya shift değişince yeniden hesap; PDF/Excel'de alternatif ve durumlar | Değişmez | MH-SHIFT-1/3, PN-4, MH-MANUEL-2/4, MH-2A (katmanlar) |
| **MH-AUTO-7** | Testler, doğrulama, Android entegrasyonu ve telefon testi listesi | — | Her aşamada sürekli; son entegrasyon |

**Otomatik ana hat güzergâhı** (A-12): ilk aşamada (MH-AUTO-6) parsel geometrisi, su kaynağı,
mevcut bağlantı noktaları (istasyon, hidrant) ve shift yerleşimine göre **taslak** güzergâh
önerilir ve "taslak — kot ve engeller dikkate alınmadı" etiketiyle gösterilir. Kullanıcı haritada
düzeltebilir; elle düzeltilen güzergâh kilitlenir. MH-2A ve MH-3'ten sonra gerçek kot, boyuna
profil ve hidrolik kayıplarla güzergâh optimizasyonu ayrı aşama olarak eklenir.

## 7. Bağımlılıklar ve önerilen sıra

Onaylı sıra korunur (PR #8 → 1A → MH-KML → MH-2A → 1B → SHIFT-1 → MANUEL-2 → SHIFT-2 → MANUEL-3
→ SHIFT-3 → MANUEL-4). Önerilen yerleşim:

| Aşama | Önerilen yer | Neden |
|---|---|---|
| PN-0, MH-AUTO-0 | Şimdi | Yalnız belge |
| PN-1 | MH-KML ile paralel | Yeni dosya, çakışma yok |
| PN-2 | PR #8'den hemen sonra | `assess.js` |
| MH-AUTO-1 | 1A'dan sonra (MH-KML veya MH-2A ile paralel) | `tasarim` alanı ve kilitler 1A altyapısını kullanır |
| PN-3 | 1A'dan sonra | `boruSecimi` alanı |
| MH-AUTO-2 | MH-SHIFT-2'den sonra | Elle shift sayısı ve atama ile birlikte |
| PN-4, PN-5 | MH-SHIFT-1'den sonra | Harita etiket yapısı |
| MH-AUTO-3, MH-AUTO-4 | PN-3'ten sonra | Doğrulanmış katalog ve elle boru seçimi |
| MH-AUTO-5 | MH-MANUEL-3'ten sonra | Karşılaştırma ekranı |
| MH-AUTO-6 | MH-SHIFT-3, PN-4 ve MH-MANUEL-4'ten sonra | Harita düzenleme ve rapor |
| MH-AUTO-7 | Sürekli; son entegrasyon MH-AUTO-6'dan sonra | — |
| MH-3, MH-AKIL-5 | MH-2A'dan sonra (ayrı planlar) | "Doğrulanmış hidrolik uygunluk" durumu ancak bunlardan sonra |

Kesin yer proje sahibinin kararıdır. Çakışma notları: `engine.js` (PN-3, AUTO-3 aynı dosya —
sırayla), `app.js` (1A, 1B, SHIFT ve AUTO aynı dosya — her PR küçük ve sıralı), `assess.js`
(PR #8, PN-2, AUTO-1).

## 8. Testler (MH-AUTO-7)

| Kod | Test |
|---|---|
| T-A01 | Üç alternatif de U-01…U-07'yi sağlar; hiçbir girdide uygunsuz aday "öneri" olarak çıkmaz |
| T-A02 | Uygun aday yoksa öneri yok, aşılan koşullar listelenir |
| T-A03 | Kilitler: elle shift, boru, pompa seçimi otomatik yeniden öneride korunur; uygulanamayan kilit sorulur, sessizce silinmez |
| T-A04 | Her öneri, aynı girdiyle manuel `design()` çağrısıyla bit bit aynı sonucu verir |
| T-A05 | Fiyatlar örnek/eksikken "tahmini" / "sıralama kesin değil" etiketleri |
| T-A06 | Jenerik katalog, DEM kotu veya MH-3 öncesi kot: durum en fazla "Ön tasarım"; "Kot verisi hidrolik hesaba dahil edilmedi" görünür |
| T-A07 | Yalnız Joukowsky aşımında "Geçici rejim analizi gerekli", "uygunsuz" değil |
| T-A08 | Otomatik mod kapalıyken ve `tasarim` alanı olmayan eski projelerde sonuçlar değişmez; MH-0 altın kayıtları ve 38 denetim aynı |
| T-A09 | Harita: shift renkleri, boru etiketleri, simgeler; güzergâh/shift değişince yeniden hesap |
| T-A10 | PDF/Excel: alternatif tablosu, durumlar, varsayımlar |
| T-A11 | Android (390 px, Capacitor) ve masaüstü web (1280/1440/1920); Android'de arama süresi ölçümü |
| T-A12 | JSON yedek gidiş-dönüş `tasarim` dahil |

## 9. Proje sahibinin kararı gereken konular

| No | Karar |
|---|---|
| AK-1 | Karara bağlandı (A-9) |
| AK-2 | Karara bağlandı (A-10); Performans önceliği §5'teki gibi |
| AK-3 | Karara bağlandı (A-11) |
| AK-4 | Karara bağlandı (A-12) |
