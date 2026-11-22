# Otomatik / Manuel Shift modu — teknik mimari

Durum: mimari ve aşama planı. Bağımsız PR. Hesap motoru (`engine.js`), `layout.js`, altın kayıtlar ve 38 hidrolik denetim değişmez.

## 1. Mevcut durumdan bulgular (main 6e1069e, Node ile doğrulandı)
- Motor shift sayısı adaylarını `NsMin … min(alt ünite sayısı, NsMin+7)` arasında üretir; kayıtlı `inp.Ns` aday listesine eklenir.
- `Ly.partition(Q, k)` her k için **tam k grup üretmez** (en büyük grup debisini küçülten bitişik bölme; daha az grup dönebilir). Bu durumda motor sessizce önerilen düzene döner ve uyarı yanlış neden söyler. Örnek: 12 alt ünite, Ns 5 → 6 shift hesaplanır, uyarı "5 shift uygulanamıyor (alt ünite sayısı 12)".
- Elle atama yolu (`opt.manual = { sig, assign }`) **her** atamayı hesaplar; kaynak debisini aşan elle düzeni `overSource` olarak işaretler ve uyarı yazar.
- Kaynak debisinin altına inen bir düzen (ör. 6 alt ünite, NsMin 3 iken 2 shift) motor tarafından hesaplanır; panel uygunluğu **"uygun değil"** gösterir (kaynak kapasitesi denetimi).

Sonuç: Manuel mod shift sayısını motora yalnız `Ns` olarak değil, **gerçek alt ünite ataması** (`opt.manual`) olarak gönderir. Böylece istenen sayı ya tam olarak hesaplanır ya da neden açıkça yazılır; sonuç uydurulmaz.

## 2. Modlar
| | Otomatik | Manuel |
|---|---|---|
| Shift sayısı | Motorun adayları (bugünkü davranış) | 1 … alt ünite sayısı |
| Atama | Motorun bölmesi | Açık atama: seçilen sayıya bitişik dengeli bölme, sonra kullanıcı taşımaları |
| Alt ünite taşıma / harita fırçası | Taşıma yapılınca kendiliğinden Manuel'e geçer (bugün "elle düzenlendi") | Doğrudan |
| Etiket | "Otomatik" | "Manuel tasarım"; otomatik aralık dışındaysa ayrıca "otomatik aralık dışı" |

Kayıt: proje alanı `shiftMod: 'otomatik' | 'manuel'` (yoksa otomatik). Manuel düzen mevcut `shiftEdit { sig, assign }` alanında saklanır; JSON yedeği ve revizyonlar (`REV_EXTRA`) bu alanları taşır. Eski projelerde alan olmadığından açılışta otomatik mod; hesap sonucu değişmez.

## 3. Manuel shift sayısı → atama
`SY.bolumle(Qu, k)`: `Ly.partition` sonucunu alır; grup sayısı k'dan azsa en büyük debili grubu ikiye böler (bitişiklik korunur) ve tam k gruba tamamlar. k > alt ünite sayısı veya bir alt ünitenin debisi kaynak debisini tek başına aşıyorsa atama üretilmez ve neden döner.

## 4. Uygula kuralları
1. **Hesaplanamayan** düzen (motor hatası, fiziksel olarak oluşturulamayan sayı, atama imzası uyuşmazlığı): Uygula pasif, neden yazılır.
2. **Hesaplanan ama uygun olmayan** düzen (kaynak debisi aşımı, tur süresi aşımı, resmî değerlendirmede uygunsuz bulgu): önizlenir, "Uygun değil" açıkça gösterilir. Uygula yalnız "Bu düzenin teknik olarak uygun olmadığını biliyorum" onay kutusuyla açılır. Kayıtta `shiftKullaniciKarari` (tarih + uygunsuzluk kodları) saklanır; **uygunsuzluk raporda ve panelde kalır** — kullanıcı kabulü teknik değerlendirmeyi değiştirmez.
3. Uygun / sınırda düzen: bugünkü gibi.
Önizle / Uygula / İptal / Geri Al akışı ve revizyon anlık görüntüsü aynen korunur.

## 5. Harita düzenleme
Mevcut taslak fırçası (Arazi Shift modu) Manuel modun parçası olur: her dokunuş atamayı değiştirir, aynı `yeniden()` önizlemesi motoru çalıştırır, uygunluk güncellenir.

## 6. Testler
- Birim: `bolumle` (tam k grup, bitişiklik, toplam debi korunur), motorla tutarlılık (aynı atama → aynı sonuç), altın senaryolar × 1…nU shift sayısı için "kaynak aşımı ⇒ uygun değil" özelliği, eski proje sonucu değişmez.
- Arayüz: mod geçişi, manuel − / + tüm aralıkta, "otomatik aralık dışı" etiketi, uygunsuz düzende onay kutusu olmadan Uygula pasif, hesaplanamayan düzende Uygula pasif + neden, JSON yedekle taşıma, Geri Al.
- Android emülatörü (API 30/34) ve **gerçek telefon kabul testi** ayrı raporlanır.

## 7. Aşamalar (bu PR içinde ayrı commit'ler)
1. `SY.bolumle`, mod alanı, kayıt/yedek uyumu + birim testleri.
2. Panelde mod seçimi, manuel − / +, etiketler, Uygula kuralları + arayüz testleri.
3. Harita fırçasının manuel moda bağlanması, emülatör testi, test APK'sı (versionCode ≥ 20).
