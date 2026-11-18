# MH-MANUEL — Manuel Mühendislik Müdahalesi ve Senaryo Simülasyonu

Durum: **teknik plan — onay bekliyor (18.11.2026).** Kodlamaya bu plan ve tasarım önizlemeleri
onaylanmadan başlanmaz. Her alt aşama ayrı dal ve ayrı PR'dır; proje sahibinin açık onayı olmadan
`main`'e birleştirilmez. PR #10 (MH-WEB-2) ve PR #8 (MH-AKIL-2) bu plandan bağımsızdır; MH-MANUEL
bunlara eklenmez.

Tasarım önizlemeleri (masaüstü ve Android, üç örnek): https://claude.ai/artifact/1Nb5xGgWwvjbxDLsfJqLiT (özel; yalnız proje sahibi açabilir).
Bu belgede ve önizlemelerde sayıların kaynağı her yerde ayrıca belirtilmiştir:

- **Motor** — bugünkü `IrriEngine.design` + `IrriAssess.evaluate` ile, yalnız ilgili girdi
  değiştirilerek hesaplanmıştır (test2 örnek projesi: domates, 288,9 da, kuyu 40 m, Akdeniz,
  86,3 m³/h, eşdeğer dikdörtgen).
- **Örnek** — yalnız ekran düzenini göstermek için yazılmıştır; hesaplanmamıştır.

## 1. Amaç ve temel ayrım

Uyarının altında **"Değerleri düzenle ve yeniden hesapla"** seçeneği açılır. Kullanıcı uyarıya yol
açan **fiziksel girdileri** bir taslakta değiştirir, motor yeniden çalışır, eski ve yeni sonuç
yan yana karşılaştırılır; kullanıcı onaylarsa değişiklik revizyon kaydıyla projeye uygulanır.

| | Kullanıcı kararı (MH-AKIL-1, bugün var) | MH-MANUEL (yeni) |
|---|---|---|
| Neyi değiştirir | Yalnız uyarının değerlendirme durumunu ("bilinerek kabul edildi") | Proje **girdilerini** (debi, süre, çap, …) |
| Teknik uygunluk | Değişmez | Motor yeniden hesaplar; uygunluk yeni sonuca göre belirlenir |
| Hesap | Yok | Gerçek motor, aynı formüller |

**Hesap sonuçları hiçbir zaman elle yazılmaz.** İşletme basıncı, hız, tur süresi, ΔH gibi değerler
yalnız onları belirleyen girdiler değiştirilerek yeniden hesaplanır.

## 2. Bugünkü kodda bulunan ve plana yön veren gerçek davranışlar

test2 projesiyle motorda denendi (hepsi **Motor**):

| Deneme | Sonuç | Plan için anlamı |
|---|---|---|
| Kaynak debisi 86,3 → 110 m³/h | Hiçbir şey değişmedi: 16 shift, tur 30,7 h | Shift gruplaması basamaklıdır; "debiyi biraz artırmak" çözmeyebilir. Ekran bunu açıkça söylemeli. |
| 86,3 → 130 m³/h | 11 shift, tur 21,1 h (sınır 20 h) — hâlâ uygunsuz | — |
| 130 m³/h + günlük 22 h | Tur 21,1 ≤ 22 h → W-KAP-01 çözüldü; **yeni** W-HIZ-01 (1,82 m/s), W-POM-01, W-KAP-02; motor 30 → 45 kW; enerji 82 608 → 90 329 kWh | Bir uyarıyı çözen değişiklik başka uyarılar doğurabilir: "çözülen / devam eden / yeni" ayrımı şart. |
| 130 m³/h + 140 veya 150 m³/h | 130 ile aynı sonuç | Basamak etkisi tekrar görünür. |
| Günlük süre 20 → 24 h (debi aynı) | Tur 30,7 h > 24 h — çözülmez | "Shift sayısı/süre değişikliği toplam kapasiteyi çözmüyor" mesajı gerekli. |
| Shift sayısı `Ns = 20` | **Motor yok saydı**, 16 shift kullandı | `Ns` yalnız motorun alternatif listesindeki değerleri kabul eder. MH-MANUEL istenen ile uygulanan değeri karşılaştırmalı ve farkı göstermeli. |
| Ana hat `mainOd = 110, 125, 180` | **Motor yok saydı**, Ø160 kullandı | Çap yalnız motorun uygun bulduğu katalog adımlarından (130 m³/h için Ø160/200/225/250/315) seçilebilir. Seçim listesi `r.main.alts`'tan gelmeli; serbest sayı girişi olmamalı. |
| 130 m³/h + 22 h + Ø200 | Hız 1,82 → 1,17 m/s; gerekli H 76,9 → 67,5 m; pompa kapama 64 → 44,5 m (W-PN-02 **çözüldü**); enerji 90 329 → 73 394 kWh; malzeme ara toplamı 2 493 524 → 2 899 289 ₺ (örnek fiyatlar) | Karşılaştırma metni gerçek farklardan üretilebilir: "basınç kaybı azaldı, yatırım arttı". |
| Ø140 (motor PN10 seçti) | Dalga hızı 300 → 385 m/s, ΔH 37,1 → 67,4 m, tepe 113 m > PN10 sınırı 102 m — **hâlâ aşıyor** | PN yükseltmek su darbesini otomatik çözmez; daha rijit boru dalga hızını artırır. |
| Ø200 PN6 (debi 86,3) | Tepe 52 m < 61,2 m → W-SD-01 "uygunsuz"dan **"ön değerlendirme"ye** döner, "uygun" olmaz | Su darbesi hiçbir manuel değişiklikle "güvenli" olmaz (MH-AKIL-5'e kadar). |

Bir `design` çağrısı test2'de ortalama **~81 ms**, çizilmiş parselde uyarı değerlendirmesiyle
**~30 ms** sürdü (geliştirme sunucusu; telefonda birkaç kat yavaş olabilir). Bu nedenle hesap
**kullanıcının "Yeniden hesapla" demesiyle** çalışır (§8).

**Revizyon altyapısında eksik:** `IrriStore.snapshot` bugün yalnız `inp, poly, src, hydro`
saklıyor; `route`, `station`, `shiftEdit` (elle shift ataması), `akil` (uyarı kararları) ve
`techOpt` revizyona girmiyor. Geri dönüş bu alanları geri getirmez. MH-MANUEL-3'te düzeltilir
(şema 3, eski projeler göç ettirilir).

## 3. Değişecek dosyalar

| Dosya | Aşama | Değişiklik |
|---|---|---|
| `www/js/manual.js` (yeni) | 1–3 | `IrriManual`: kaldıraç kaydı (hangi uyarı → hangi girdi), taslak oluşturma/doğrulama, `run(taslak)`, istenen–uygulanan denetimi, karşılaştırma ve fark metinleri, uygulama/geri dönüş. DOM'a dokunmaz; Node'da test edilir. |
| `www/js/manual-view.js` (yeni) | 1–3 | Düzenleme ve karşılaştırma ekranının çizimi (Android ve masaüstü aynı bileşen, iki yerleşim). |
| `www/js/assess-view.js` | 1 | Uyarı kartına "Değerleri düzenle ve yeniden hesapla" düğmesi (yalnız kaldıracı olan kodlarda). |
| `www/js/desk.js` | 1 | Masaüstünde düzenleme çalışma alanı sağ panelde / geniş modda orta alanda. |
| `www/js/app.js` | 1–4 | Ekran yönlendirmesi, taslağın haritada önizlemesi (MH-MANUEL-4), uygulama sonrası yeniden çizim. |
| `www/js/store.js` | 1, 3 | `drafts` alanı, şema 3: revizyona `route, station, shiftEdit, akil, techOpt` ve değişiklik kaydı; göç. |
| `www/js/report.js`, `report-data.js` | 4 | Manuel müdahale bölümü (PDF/Excel). |
| `www/js/i18n-dict.js` | 1–4 | Yeni metinler (7 dil). |
| `www/css/app.css` | 1–3 | Düzenleme ve karşılaştırma bileşenleri. |
| `www/js/engine.js` | **yok** | MH-MANUEL-1…4 motoru değiştirmez. Motor girdisi gereken kaldıraçlar (§4.2) ayrı onaylı değişikliktir. |
| `test/manual.test.js`, `test-ui/manual.ui.js` (yeni) | 1–4 | §10. |
| `docs/hesap-degisiklik-kaydi.md` | — | Yalnız §4.2'deki motor girdileri onaylanırsa. |

## 4. Düzenlenebilir girdiler

### 4.1 Bugünkü motorun zaten kabul ettiği girdiler (motor değişmeden)

Sınırlar `IrriValidate` tanımlarından alınır; ekranda birimiyle gösterilir.

| Uyarı | Girdi | Anahtar | Birim / sınır | Not |
|---|---|---|---|---|
| Tur/kapasite (W-KAP-01/02/03, W-SHF-01/02) | Kaynak debisi | `Q` | m³/h, 0,1–3000 | Basamak etkisi gösterilir |
| | Günlük çalışma | `hours` | saat, 1–24 | |
| | Sulama aralığı | `interval` | gün, 1–30 (tam sayı) | Hacim de değişir; açıklanır |
| | Shift sayısı | `Ns` | Motorun alternatif listesinden seçim | Serbest sayı yok (§2) |
| | Elle shift ataması | `shiftEdit` (harita fırçası) | — | Bugünkü fırça; taslakta kopyası düzenlenir (MH-MANUEL-4) |
| | Damlatıcı debisi / aralığı | `q`, `Se` | l/h 0,3–30; m 0,1–3 | Lateral hidroliği de değişir |
| | Damlatıcı tipi, çalışma basıncı | `emitter`, `hNom`, `pcMin/pcMax` | | |
| | Sıra yönü, lateral çapı, manifold hattı sayısı | `rowDir`, `latD`, `nB` | | Yerleşim değişir |
| Hız / basınç (W-HIZ-01, W-PN-01/02, W-POM-03) | Ana hat dış çapı | `mainOd` | `r.main.alts` listesi (katalog OD; iç çap katalogdan) | Nominal ve iç çap ayrı gösterilir |
| | Kaynak–arazi mesafesi, kot farkı | `dSource`, `dZ` | m | Fiziksel ölçüm girdisi |
| | Ana hat güzergâhı, istasyon yeri | `route`, `station` | harita | MH-MANUEL-4 |
| Pompa (W-POM-01/02) | Dinamik su seviyesi | `depth` | m, 0–500 | |
| | Mevcut kaynak basıncı (şebeke) | `pAvail` | bar, 0–16 | |
| | Üretici pompa kataloğu | Ayarlar → katalog JSON | — | Gerçek eğri olmadan "temsili" etiketi kalır |
| Lateral/manifold (W-LAT-01/02, W-MAN-01, W-PN-03) | Lateral çapı, sıra yönü, `nB`, damlatıcı | yukarıdaki | | |

### 4.2 Bugünkü motorun **kabul etmediği** girdiler — ayrı onay gerekir

Bunlar ekranda **görünür ama pasiftir**: "Bu sürümde motor girdisi değil — Değerlendirilmedi"
yazar, değer girilse bile hesaba katılmaz ve sonuç gibi gösterilmez.

| Kod | Girdi | Neden motor değişikliği | Öneri |
|---|---|---|---|
| E-1 | Ana hat PN sınıfı (en az PN) | Motor her çap için uygun **en düşük** PN'i seçiyor | `mainPnMin` girdisi: yoksa bugünkü seçim aynen (altın kayıtlar değişmez). Ayrı PR + hesap değişiklik kaydı. |
| E-2 | Pompa modeli seçimi | Motor pompayı katalogdan kendisi seçiyor | `pumpId` girdisi; eğri katalogda olmalı. |
| E-3 | Ana hat malzemesi (PE100 vb.) | Ana hat yalnız PVC-U kataloğundan | Katalog + seçim kuralı; dalga hızı formülü zaten malzemeye bağlı. |
| E-4 | Vana kapanma süresi ve karakteristiği, pompa duruşu, koruma ekipmanı | Motor yalnız Joukowsky üst sınırı hesaplıyor | **MH-AKIL-5.** MH-MANUEL yalnız veri girişini saklar (§7). |
| E-5 | Basınç regülatörü ayar basıncı/kaybı | Modelde yok | Üretici verisiyle, ayrı aşama. |
| E-6 | Frekans kontrolü (değişken devir) | Modelde yok | Pompa benzerlik yasalarıyla, ayrı aşama ve doğrulama. |

## 5. Sonuçların hangi girdilerden türediği (bağımlılık haritası)

| Sonuç (`r`) | Belirleyen girdiler |
|---|---|
| Brüt ihtiyaç, uygulama hacmi | iklim (`region`, `et0`), `crop`/`kc`, `Gc`, `Ea`, `interval`, alan |
| Shift debileri, shift sayısı | yerleşim (`q`, `Se`, `Sr`, `rowDir`, `latD`, `nB`, geometri), `Q`, `Ns`, `shiftEdit` |
| Tur süresi, kapasite | yukarıdakiler + `hours`, `interval` |
| Ana hat çapı/PN, hız, kayıp | shift debileri, `mainOd`, güzergâh, `dSource`, katalog |
| Gerekli basınç, pompa görev noktası, güç, enerji | ana hat + manifold/lateral kayıpları, `hNom`, `dZ`, `depth`/`pAvail`, katalog pompaları, `srcType` |
| Pompa kapama basıncı | seçilen pompa (jenerik eğri: görev × 1,3) + statik kot |
| Su darbesi (Joukowsky) | ana hat iç çapı, et kalınlığı, malzeme (dalga hızı), hız, ana hat uzunluğu, işletme basıncı |
| Malzeme ve maliyet | yerleşim, ana hat kesitleri, birim fiyatlar |

Karşılaştırma ekranındaki "neden değişti" açıklamaları bu haritadan ve gerçek farklardan üretilir.

## 6. Taslak ve revizyon veri modeli

```js
// Projede (şema 3). Eski projelerde alan yoksa boş kabul edilir; hiçbir mevcut alan silinmez.
project.drafts = [{
  id: 'd_…', ad: 'Debi 130 + 22 saat', kaynak: 'manuel' | 'akil2',   // akil2: MH-AKIL-2 satırından
  uyari: 'W-KAP-01',                  // açıldığı uyarı (isteğe bağlı)
  tabanRev: 7, tabanImza: '…',        // hangi proje revizyonundan türedi
  degisiklik: { inp: { Q: 130, hours: 22 }, geo: null, shiftEdit: null },  // yalnız farklar
  veri: { gecici: null },             // §7: motorun kullanmadığı, saklanan teknik veri
  sonHesap: { imza: '…', motorSurum: '…', tarih: 1763…, ozet: {…}, kodlar: ['W-PN-02:uygunsuz', …],
              uygulanmayan: [{ k: 'Ns', istenen: 20, uygulanan: 16 }] },
  olusturma: 1763…, guncelleme: 1763…,
}];

// Revizyon kaydı genişler (şema 3): bugünkü alanlar + değişiklik açıklaması
project.revs[i] = { rev, t, note, data /* inp, poly, src, hydro + route, station, shiftEdit, akil, techOpt */,
  degisiklik: { kaynak: 'manuel', taslak: 'd_…', parametreler: [{ k: 'Q', eski: 86.3, yeni: 130, birim: 'm³/h' }],
                fark: { tur: [30.7, 21.1], H: [73.9, 76.9], kWh: [82608, 90329], uygunsuz: [3, 2] },
                uyarilar: { cozulen: ['W-KAP-01'], devam: ['W-PN-02', 'W-SD-01'], yeni: ['W-HIZ-01', 'W-POM-01', 'W-KAP-02'] } } };
```

Kurallar:
1. **Orijinal proje dokunulmaz.** Taslak yalnız farkları tutar; hesap `inp ⊕ degisiklik` ile yapılır.
2. **Sonuçlar kalıcı gerçek değildir.** `sonHesap` yalnız özet + imzadır. Taslak açıldığında imza
   (girdi + motor sürümü + katalog) değiştiyse sonuç **"Güncel değil — yeniden hesaplayın"** olur.
3. **Uygula** = önce bugünkü durumun revizyonu (`snapshot`), sonra farklar projeye yazılır, sonra
   değişiklik kaydıyla yeni revizyon. Açık onay penceresi olmadan yazılmaz.
4. **Geri dönüş** önceki revizyonu yeni bir revizyon olarak geri yükler (geçmiş silinmez).
   `MAX_REVS = 20` korunur; taslaklar için üst sınır 10 (en eski uyarıyla silinir).
5. **JSON yedek** taslakları ve revizyonları taşır; Android ↔ web aynı dosya.
6. Uyarı kararları (`akil`) taslağa kopyalanır; yeni çıkan uyarılar "karar yok" ile başlar.

## 7. Su darbesi: manuel veri altyapısı (MH-AKIL-5 uyumlu)

- Taslakta `veri.gecici = { kapanmaSuresi_s, kapanmaTipi: 'dogrusal'|'kademeli'|'bilinmiyor',
  pompaDurusu: { atalet_kgm2 }, koruma: ['tahliye', 'hava-vakum', 'hidrofor', …], profil: null }`.
- Bu alanlar **motor tarafından kullanılmaz**; ekranda "Veri girildi — MH-AKIL-5 ile
  değerlendirilecek" etiketi taşır. Kapanma süresi yalnız bugünkü motorun 2L/a değeriyle
  **metin olarak** karşılaştırılır ("2L/a'dan uzun olması gerekli, yeterli değil").
- W-SD-01 için ekrandaki başlık her durumda **"Ön değerlendirme — ayrıntılı geçici rejim analizi
  gerekli"** kalır. Negatif basınç, kolon ayrılması, vakum, pompa duruşu "Değerlendirilmedi"dir.
- Hiçbir taslak, W-SD-01 açıkken "Teknik olarak uygun" etiketini alamaz (§9-K6). Test edilir.

## 8. Yeniden hesaplama akışı ve performans

1. Girdi değiştiğinde **yalnız doğrulama** çalışır (sınır, tam sayı, birim; anında).
2. Sonuç alanı **"Hesaplanmadı — girdiler değişti"** durumuna geçer; eski sonuç soluk ve etiketli
   kalır, güncel gibi görünmez.
3. **"Yeniden hesapla"** düğmesi `IrriEngine.design` + `IrriAssess.evaluate` + `IrriHydroView.build`
   çalıştırır (aynı motor, aynı katalog, aynı fiyatlar).
4. Sonra **istenen–uygulanan denetimi**: `Ns`, `mainOd` vb. motor tarafından değiştirildiyse sarı
   satır: "İstenen 20 shift; motor 16 kullandı (alternatif listesinde yok)".
5. Karşılaştırma ve uyarı farkı (çözülen / devam eden / yeni) hesaplanır.
6. Masaüstünde hesap bitince harita taslağı önizler (MH-MANUEL-4); Android'de "Haritada gör".

Otomatik (gecikmeli) yeniden hesaplama ilk sürümde yoktur; ölçülen süreler telefonlarda
akıcılığı garanti etmediği için açık düğme kullanılır.

## 9. Mühendislik doğrulama kuralları

| No | Kural |
|---|---|
| K1 | Hesap sonucu olan hiçbir değer (H, P, v, tur, ΔH) girdi olarak düzenlenemez. |
| K2 | Bütün sayılar motordan gelir; oran/tahmin yöntemiyle sonuç üretilmez (MH-AKIL-2 kuralı). |
| K3 | Çap listesi katalog OD'lerinden; iç çap ve et kalınlığı katalogdan, ayrı gösterilir. |
| K4 | Motor bir isteği uygulamadıysa (Ns, mainOd) bu açıkça gösterilir; istenen değer uygulanmış gibi sunulmaz. |
| K5 | Temsili (doğrulanmamış) pompa/boru kayıtlarıyla yapılan sonuçlar "temsili" etiketini korur. |
| K6 | "Teknik olarak uygun" yalnız: hiçbir uygunsuz uyarı yok **ve** hiçbir zorunlu kontrol "değerlendirilmedi / ön değerlendirme / veri gerekli" değil. Bugün W-SD-01 her zaman ön değerlendirme olduğundan en iyi durum: **"Hesaplanan kontrollerde uygunsuzluk yok — su darbesi ön değerlendirmede"**. |
| K7 | Aynı kaynağı paylaşan alt projelerde kaynak debisi paylaştırılır; toplamı kaynağı aşamaz (§12). |
| K8 | Kullanıcı kararı teknik durumu değiştirmez; taslağa kopyalanır ama sayılmaz. |
| K9 | Karşılaştırma metinleri yalnız hesaplanmış farklardan üretilir; fiyatı eksik kalemlerde "maliyet kesin değil" yazılır. |
| K10 | Taslak uygulanmadan önce imza tazeliği denetlenir; güncel değilse uygulama kapalıdır. |

## 10. Ekranlar ve kullanım akışları

Tasarım önizlemesindeki üç örnek: (1) sulama süresi yetersizliği, (2) ana hatta hız/basınç,
(3) su darbesi ve PN ön değerlendirmesi.

Bileşenler (iki platformda aynı):
1. **Başlık:** uyarı kodu, seviyesi, taslak adı, "Orijinal proje değişmez" notu.
2. **Mevcut değerler ve sınır:** uyarının `durum` ve `sinir` değerleri (motor).
3. **Girdi alanları:** §4.1 kaldıraçları; mevcut değer, yeni değer, birim, geçerli aralık;
   pasif §4.2 satırları gerekçesiyle.
4. **Eksik teknik bilgiler:** uyarının `eksikGirdi` / `gerekenVeri` listesi.
5. **Yeniden hesapla** + hesap durumu.
6. **Karşılaştırma tablosu:** kaynak debisi, shift sayısı, tur, gerekli pompa basıncı, pompa gücü,
   ana hat çap/PN, kayıplar, enerji, yıllık enerji maliyeti, malzeme miktarı ve maliyeti, uygunsuzluk
   sayısı; her satırda olumlu/olumsuz işareti.
7. **Uyarı farkı:** çözülen / devam eden / yeni; ön değerlendirme ayrı.
8. **Harita etkisi** (MH-MANUEL-4).
9. **Taslağı kaydet · İptal · Projeye uygula** (onay penceresi).

**Masaüstü akışı:** uyarı (sağ panel, alt panel, Sonuç ekranı) → "Değerleri düzenle" → orta alanda
düzenleme çalışma alanı (solda girdiler, sağda karşılaştırma, altta uyarı farkı; harita sekmesi) →
klavyeyle alanlar arası Tab, Enter ile yeniden hesapla.

**Android akışı:** uyarı kartı → "Değerleri düzenle" → tam ekran sayfa: üstte girdiler, "Yeniden
hesapla" sabit alt düğme, sonra kaydırılabilir karşılaştırma kartları (iki sütunlu tablo yerine
"Önce → Sonra" kartları), alt menüde Taslağı kaydet / Uygula.

## 11. Testler

| Grup | Senaryo |
|---|---|
| Girdi | Sınır dışı / birim / tam sayı; `Ns` listede yok → uygulanmadı uyarısı; `mainOd` katalog dışı → uygulanmadı |
| Hesap | Debi değişikliği (86,3 → 110 aynı; → 130 değişir); süre; aralık; shift sayısı; çap (Ø200 → W-PN-02 çözülür); sonuçların `design` ile birebir eşitliği |
| Uyarı farkı | Çözülen, devam eden, yeni oluşan (130 + 22 h → W-HIZ-01 yeni) |
| Su darbesi | Ø140/PN10 → hâlâ aşar; Ø200 → "ön değerlendirme", asla "uygun" değil; `veri.gecici` girilse bile sonuç değişmez; K6 etiketi |
| Veri güvenliği | İptal → proje bayt bayt aynı; uygula → revizyon + değişiklik kaydı; geri dönüş; imza eskiyince uygulama kapalı |
| Kalıcılık | Taslak kaydet/aç; JSON yedek ↔ geri yükleme; şema 2 → 3 göçü; eski v0.6.0 projeler |
| Eşitlik | Android (390 px, Capacitor) ve web masaüstü aynı değerler; Node ile tarayıcı eşitliği (WEB-1 yöntemi) |
| Rapor | PDF/Excel'deki değişiklik bölümü ekrandakiyle aynı (MH-MANUEL-4) |
| Koruma | MH-0 altın kayıtları, 38 hidrolik denetim, EPANET doğrulamaları değişmez |

## 12. Kabul kriterleri

1. Kaldıracı olan her uyarıda düğme var; olmayanlarda yok.
2. İptal edilen taslak projeyi hiçbir alanda değiştirmez (test ile).
3. Gösterilen her sonuç değeri aynı girdilerle `IrriEngine.design` sonucuna birebir eşit.
4. Hesaplanmamış sonuç güncel gibi görünmez.
5. Motorun uygulamadığı istekler açıkça gösterilir.
6. Su darbesi için hiçbir taslak "uygun/güvenli" etiketi alamaz.
7. Uygulama revizyon ve değişiklik kaydı oluşturur; geri dönüş çalışır.
8. Android ve masaüstünde aynı özellikler; aynı JSON.
9. Bütün yeni metinler 7 dilde; açık/koyu temada karşıtlık ≥ 4,5.
10. Bütün eski test takımları ve altın kayıtlar geçer; hesap motoru değişmez.

## 13. Alt aşamalar ve yol haritasına yerleşim

| Aşama | Kapsam | Bağımlılık |
|---|---|---|
| **MH-MANUEL-1** | `manual.js` kaldıraç kaydı ve doğrulama, taslak modeli (`drafts`), düzenleme ekranı (iki platform), Taslağı kaydet / İptal. Hesap yok: sonuç alanı "Hesaplanmadı". | WEB-2 (PR #10) birleşmiş olmalı |
| **MH-MANUEL-2** | Yeniden hesaplama, istenen–uygulanan denetimi, uyarı farkı, K6 etiketi | 1 |
| **MH-MANUEL-3** | Karşılaştırma ekranı ve metinleri, Projeye uygula, şema 3 revizyonları ve geri dönüş | 2 |
| **MH-MANUEL-4** | Harita önizlemesi (taslak shift/ana hat), malzeme farkı, PDF/Excel bölümü | 3 |
| **MH-MANUEL-5** | MH-AKIL-2 satırından taslak, otomatik ↔ manuel karşılaştırma; MH-AKIL-5 veri bağlantısı; MH-KML ve arazi bölme | PR #8, MH-AKIL-5, MH-KML, MH-AKIL-3 |
| (ayrı onay) | §4.2 motor girdileri E-1…E-6 | Bağımsız mühendislik doğrulaması + hesap değişiklik kaydı |

Önerilen sıra: PR #10 → MH-MANUEL-1 → 2 → 3 → (PR #8) → MH-KML → MH-MANUEL-4 → 5.

## 14. MH-AKIL-2 ve MH-AKIL-5 bağımlılıkları

- **MH-AKIL-2 (PR #8, birleşmedi):** `IrriSolver` satırları (`row.inp`) ortak "alternatif" biçimine
  dönüştürülecek: `{ kaynak: 'akil2', degisiklik: { inp: farklar } }`. Böylece "Bu alternatifi
  taslak olarak aç" düğmesi MH-MANUEL-5'te eklenir. PR #8 birleşmeden MH-MANUEL kodu `IrriSolver`'a
  bağlanmaz; yalnız biçim uyumlu tutulur.
- **MH-AKIL-5:** `veri.gecici` alanları MH-AKIL-5'in girdisi olacak; o zamana kadar yalnız saklanır.

## 15. KML/KMZ ve akıllı arazi bölme

- Taslak `degisiklik.geo` alanı (`poly`, `route`, `station`, `src`) MH-KML'den gelen geometriyi aynı
  biçimde taşır; KML içe aktarma yeni bir taslak olarak da açılabilir ("İçe aktarılan sınırı dene").
- MH-AKIL-3 tamamlanınca düzenleme ekranından **"Araziyi böl"** çalışma alanına geçilir: bölme
  çizgileri, bölme sayısı, alt projeler. Her alt proje kendi taslağıdır; **kaynak grubu** kaydı
  (`kaynakGrup: { id, Q }`) alt projelerin debi paylarını tutar ve toplamın kaynağı aşmasını engeller
  (K7). Ortak kaynağı paylaşan iki alt proje, kaynak kendiliğinden büyümüş gibi değerlendirilmez.
- MH-2/MH-3 (kotlar) tamamlanınca `dZ` yerine profil kullanılır; taslakta kot kaynağı gösterilir.

## 16. Raporlama (MH-MANUEL-4)

PDF ve Excel'e "Manuel müdahale ve revizyonlar" bölümü: orijinal değerler, değişiklikler, yeni
sonuçlar, çözülen / devam eden / yeni uyarılar, hesaplanmamış kontroller, revizyon numarası ve
tarihi. "Teknik olarak uygun" ifadesi yalnız K6 sağlanırsa kullanılır.
