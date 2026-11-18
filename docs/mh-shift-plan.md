# MH-SHIFT — Manuel shift sayısı ve haritadan shift düzenleme

Durum: **uygulanabilirlik raporu ve teknik plan — onay bekliyor (18.11.2026). Kodlama yok.**
Hesap motoru değiştirilmedi; aşağıdaki bütün sayılar bugünkü `IrriEngine.design` +
`IrriAssess.evaluate` ile hesaplandı (**Motor**). MH-SHIFT, MH-MANUEL'in (taslak, yeniden hesaplama,
karşılaştırma, revizyon) ilk somut "kaldıracı"dır ve MH-AKIL-3 (akıllı arazi bölme) ile ortak veri
modelini kullanır. Android ve masaüstünde aynı modül, aynı motor.

Tasarım önizlemeleri: https://claude.ai/artifact/RegV9ZUDyX1i3y2c9CDfB5 (özel; yalnız proje sahibi açabilir).

## 1. Kısa sonuç

1. **Yapılabilir, hesap motoru değişmeden.** Motor zaten "elle shift ataması" girdisini
   (`opt.manual` / projede `shiftEdit`) kabul ediyor ve **herhangi bir** alt ünite → shift
   gruplamasını gerçek hidrolikle hesaplıyor (shift debileri, ana hat kesit debileri ve çapları,
   hızlar, kayıplar, gerekli basınç, pompa, enerji, malzeme, uyarılar). Eksik olan: istenen sayıda
   gruplama **üreten** bir modül, taslak/karşılaştırma/uygulama akışı, harita araçları ve fiziksel
   sınırların açıklanması.
2. **Motorun yalnız belirli shift sayılarını üretmesinin nedeni** gruplama kuralıdır (§3), fizik
   değildir. Bu yüzden "istenen" ile "uygulanan" ayrı gösterilecek.
3. **Fiziksel sınır ayrıdır ve aşılamaz:** her shift'in debisi kaynak debisini aşamaz; shift sayısı
   azaldıkça shift debisi büyür. Örnek senaryoda 18 shift bu kaynakla **hiçbir gruplamada mümkün
   değil** (§5).

## 2. Mevcut altyapı (kod incelemesi)

| Yer | Ne yapıyor | Not |
|---|---|---|
| `engine.js` shift adayları | `NsMin` (sıralı, kaynak sınırlı en az shift) ile `NsMin+7` arası + kullanıcının `inp.Ns`'i (≤ alt ünite sayısı) | Her aday `Ly.partition(Qu, k)` ile gruplanır; grup sayısı tam `k` çıkmazsa aday atılır |
| `layout.js` `partition(Q, n)` | Alt üniteleri **sıralarına göre ardışık bloklara** böler; en büyük grup debisini en küçük yapan kapasiteyi ikili aramayla bulur | Sonuç `n`'den **az** grup olabilir → o `n` üretilemez |
| `layout.js` `minSectors(Q, cap)` | Sıralı açgözlü dolum: kaynak sınırında en az shift | Fiziksel alt sınırdan (⌈ΣQ/Qs⌉) büyük olabilir |
| `engine.js` `opt.manual` | `{ sig, assign[] }`: her alt ünitenin shift numarası. İmza (alt ünite sayısı, toplam debi, manifold hattı sayısı) tutarsa gruplar aynen hesaplanır; kaynak aşılırsa `overSource` ve uyarı | **Herhangi bir gruplama, gerçek hidrolik** |
| `app.js` harita "Shift" modu (fırça) | Bir shift seçilir, alt üniteye dokunulur → `shiftEdit` güncellenir, **hemen projeye yazılır ve hesaplanır** | Taslak yok, revizyon yok; çoklu seçim, birleştirme, ayırma, numaralama yok |
| `app.js` Sonuç ekranı | Shift alternatifleri tablosu (yalnız motorun ürettiği sayılar seçilebilir); alt ünite başına shift seçim kutusu; "Otomatiğe dön" | "Otomatiğe dön" elle atamayı onaysız siler |
| `app.js:406` | Yerleşim imzası değişince `shiftEdit` **sorulmadan silinir** | Veri kaybı → MH-MANUEL-1A'da düzeltilecek |
| `assess.js` W-KAP-03 | En büyük shift debisi > kaynak → "Uygunsuz — bu düzen uygulanamaz" | Elle ve `inp.Ns` yollarının ikisini de yakalar |
| Harita shift etiketleri | Her shift için büyük kutu ("FIELD 1 — SHIFT n · Debi") | Yakınlaştırmaya göre seyrelmiyor; üst üste biniyor (ekran görüntüsü) |

**Ek bulgu (motor):** `inp.Ns` kaynak sınırının altında bir sayıysa ve `partition` tam o sayıda grup
üretebiliyorsa motor bu düzeni **seçiyor**; shift debisi kaynağı aşsa da motorun kendi uyarı
listesinde bunu söyleyen bir satır yok (yalnız elle atama yolunda var). Durum `assess.js` W-KAP-03
ile "Uygunsuz" olarak yakalanıyor. Motor metninin eklenmesi motor değişikliğidir → MH-MOTOR-1 (M-1).

## 3. Manuel shift sayısı ile manuel alt ünite ataması — teknik fark

| | Manuel shift **sayısı** | Manuel alt ünite **ataması** |
|---|---|---|
| Kullanıcı ne verir | Bir sayı (ör. 18) | Her alt ünitenin hangi shift'e gideceği |
| Gruplamayı kim yapar | Bir **gruplama üretici** (bugün motorun sıralı kuralı) | Kullanıcı (haritada) |
| Bugün motor ne yapar | `inp.Ns`: yalnız sıralı kural tam o sayıda grup üretebiliyorsa uygular; yoksa önerilen düzene döner | `opt.manual`: verilen gruplamayı **aynen** hesaplar |
| Sınırlama | Sıralı kural yalnız belirli sayılar üretir (§3.1) | Her gruplama hesaplanır; kaynak aşımı işaretlenir |
| Sonuç | Sayı → gruplama → motor | Gruplama → motor |

Önerilen mimaride **ikisi aynı yolda birleşir**: shift sayısı isteği bir gruplama üreticiyle alt ünite
atamasına çevrilir ve motorun elle atama yolundan hesaplanır. Harita düzenlemesi de aynı atamayı
değiştirir. Tek veri: `assign[]`.

### 3.1 Neden yalnız belirli sayılar?

`partition` alt üniteleri sıralı bloklara böler ve en büyük bloğu küçültmeye çalışır. Alt ünite
debileri eşitse blok başına ünite sayısı tam sayı olduğundan üretilebilen shift sayıları
⌈n/m⌉ biçimindedir: 32 eşit ünitede yalnız 32, 16, 11, 8, 7, 6, 5, 4… (bu yüzden test2'de
`Ns = 20` uygulanamıyor). Düzensiz parsellerde liste daha sık ama yine boşluklu
(senaryo B'de: 14…19, 21 — **20 yok**).

## 4. Fiziksel ve mühendislik kısıtları

| Kısıt | Formül / kural | Uygulama |
|---|---|---|
| Kaynak debisi | Her shift: ΣQ(alt üniteler) ≤ Qkaynak | Aşan düzen "Uygulanamaz" (W-KAP-03); kaynak debisi **asla** kendiliğinden artırılmaz |
| Fiziksel alt sınır | Ns ≥ ⌈ΣQ / Qkaynak⌉ | Bundan az shift hiçbir gruplamada mümkün değil; sayı girişinde engellenir ve kanıtla açıklanır |
| Sulama turu | Tur = Σ shift süreleri ≈ Ns × t (her shift aynı uygulama süresi t) | Az shift → kısa tur ama büyük shift debisi; tur ≤ kullanılabilir süre için Ns ≤ ⌊süre / t⌋ |
| Basınç ve hız | Ana hat çapı/PN, hız (≤ 1,5/2,0 m/s), lateral/manifold değişimi, pompa görev noktası | Motor her gruplamada yeniden hesaplar; uyarılar (W-HIZ, W-PN, W-POM, W-LAT, W-MAN) karşılaştırmada |
| Damlatıcı/lateral basıncı | Alt ünite tasarımı (lateral, manifold) shift düzeninden bağımsızdır | Shift değişikliği alt ünite içini değiştirmez; giriş basıncı yeterliliği motorca denetlenir |
| Aynı kaynak | Bütün shift'ler tek kaynağı sırayla kullanır | Arazi bölmede (MH-AKIL-3) kaynak grubu payları toplamı kaynağı aşamaz (MH-MANUEL K7) |

## 5. Örnek senaryo: ekran görüntüsündeki duruma yakın proje (22 → 18 shift)

Ekran görüntünüzdeki projeye benzer bir proje (gerçek proje dosyası olmadığı için motorla
oluşturuldu): düzensiz parsel **513,7 da**, kuyu **120 m³/h**, domates, Akdeniz, **58 alt ünite**
(25,8–42,6 m³/h), toplam alt ünite debisi **ΣQ = 2 217,0 m³/h**, shift başına uygulama süresi
**1,919 h**, kullanılabilir süre 20 h.

- Fiziksel alt sınır: ⌈2 217,0 / 120⌉ = **19 shift**.
- Motorun sıralı kuralıyla en az: **22 shift** (motor alternatifleri 22–29; önerilen 22).
- 20 saate sığmak için en çok ⌊20 / 1,919⌋ = **10 shift** → yaklaşık **222 m³/h** kaynak gerekir.

| Düzen (hepsi Motor) | Shift | En büyük / en küçük shift m³/h | Tur / sınır h | Ana hat | Hız m/s | Gerekli H m | Pompa kW | Enerji kWh/yıl | Malzeme ara toplamı ₺* | Uygunsuz |
|---|---|---|---|---|---|---|---|---|---|---|
| Otomatik (bugün) | 22 | 118,7 / 80,0 | 42,21 / 20 | Ø160 PN6 | 1,85 | 68,8 | 37 | 147 619 | 4 735 637 | W-KAP-01, W-PN-02, W-SD-01 |
| **İstek 18** — `Ns = 18` (motor kabul ediyor) | 18 | **149,4** / 113,3 | 34,53 / 20 | Ø200 PN6 | 1,49 | 64,6 | 55 | 143 979 | 5 298 077 | W-KAP-01, **W-KAP-03**, W-SD-01 |
| 18 — dengeli (sıralı olmayan) | 18 | **152,2** / 116,5 | 34,53 / 20 | Ø200 PN6 | 1,52 | 65,5 | 55 | 143 836 | 4 233 442 | W-KAP-01, **W-KAP-03**, W-SD-01 |
| 19 — sıralı | 19 | 127,1 / 107,8 | 36,45 / 20 | Ø200 PN6 | 1,27 | 60,0 | 37 | 127 337 | 5 383 087 | W-KAP-01, **W-KAP-03**, W-SD-01 |
| 19 — dengeli | 19 | 132,3 / 106,6 | 36,45 / 20 | Ø200 PN6 | 1,32 | 63,0 | 37 | 127 431 | 4 329 422 | W-KAP-01, **W-KAP-03**, W-SD-01 |
| 20 — sıralı | 20 | 122,3 / 84,6 | 38,37 / 20 | Ø200 PN6 | 1,22 | 59,4 | 37 | 124 412 | 5 483 997 | W-KAP-01, **W-KAP-03**, W-SD-01 |
| **20 — dengeli** | 20 | **116,5** / 80,3 | 38,37 / 20 | Ø160 PN6 | 1,82 | 67,2 | 37 | 131 958 | 4 109 377 | W-KAP-01, W-SD-01 |
| **21 — dengeli** | 21 | **115,4** / 80,1 | 40,29 / 20 | Ø160 PN6 | 1,80 | 67,8 | 37 | 136 427 | 4 128 267 | W-KAP-01, W-SD-01 |

\* Örnek birim fiyatlarla, fiyatı eksik kalemler hariç.
"Sıralı": motorun kuralı gibi ardışık bloklar. "Dengeli": büyük debili alt ünite önce, en az yüklü
shift'e (alt üniteler komşu olmayabilir; her alt ünitenin kendi shift vanası olduğu için sahada
uygulanabilir, ama vana programı karmaşıklaşır). Her iki gruplama da **motorun elle atama yolundan**
hesaplandı; oran veya bölme yok.

**Değerlendirme**

1. **18 shift bu kaynakla mümkün değil.** Fiziksel alt sınır 19; 18 shift'te en büyük shift
   149–152 m³/h olur. Motor `Ns = 18`'i kabul edip hesaplıyor ama düzen W-KAP-03 ile "uygulanamaz".
   Ekran 18'i **seçtirmeyecek**: "18 shift için kaynak en az 149,4 m³/h olmalı (sıralı düzen); bugün
   120 m³/h" diyecek ve seçilebilir aralığı gösterecek.
2. **19 shift** teorik sınırda (2 280 m³/h kapasite / 2 217 m³/h ihtiyaç); denenen iki gruplamada
   kaynak aşıldı. "Bulunamadı" denir, "imkânsız" denmez.
3. **20 ve 21 shift** motorun sıralı kuralıyla kaynağı aşıyor, **dengeli gruplamayla kaynak içinde
   kalıyor** ve W-KAP-03 kalkıyor. Yani bugün motorun 22 önermesinin nedeni kısmen gruplama
   kuralıdır.
4. **Hiçbiri sulama turu sorununu çözmüyor** (38–42 h > 20 h). Shift sayısını azaltmak turu
   kısaltır ama shift debisini büyütür; kaynak sabitken tur ≈ ΣQ × t / Qkaynak'ın altına inemez.
   Çözüm kaynak/süre/aralık tarafındadır (MH-AKIL-2) ya da arazi bölmededir (MH-AKIL-3).
5. Shift düzeni malzemeyi de değiştirir (ana hat kesitleri farklı debilerle boyutlanır). Örnekte
   dengeli 20 shift, otomatik 22'ye göre ara toplamı ≈ 626 000 ₺ düşürüyor ve enerjiyi
   ≈ 15 700 kWh/yıl azaltıyor. Bu fark motor sonucudur; kesit bazında bağımsız doğrulama test
   planındadır (§9, D-4).

## 6. Önerilen mimari

### 6.1 Motor değişmeden (önerilen): shift gruplama üretici + motorun elle atama yolu

Yeni modül `www/js/shift-groups.js` (motor değil; DOM'a dokunmaz; Node'da test edilir):

- `range(r, Qs)` → `{ fizikAlt: ⌈ΣQ/Qs⌉, motorAlt: NsMin, ust: n, tShift, turSiniriIcinEnCok }`
- `generate(r, k, yontem)` → `assign[]` veya gerekçeli `null`. Yöntemler:
  - **sıralı**: motorun `partition` kuralı (+ tam k için en büyük bloğu ikiye bölme),
  - **dengeli**: büyük debi önce, en az yüklü shift'e (komşuluk aranmaz),
  - **komşulu dengeli** (önerilen varsayılan): aynı manifold hattı/bant içinde komşu alt üniteleri
    tercih eden, kaynak sınırını kesin koşul alan yerel iyileştirme.
- Her `assign` `opt.manual` olarak motora verilir; **bütün sonuçlar motordandır**.
- Sayı girildiğinde ekran, bulunan en iyi gruplamanın sonuçlarını gösterir; bulunamazsa
  istenen/uygulanan/neden/seçilebilir değerler (MH-MANUEL §4.2).

Bu yolun hesap motoruna etkisi yoktur: MH-0 altın kayıtları ve otomatik öneriler değişmez. Yeni
gruplama üretici ise mühendislik kararı içerir; doğrulaması §9'dadır.

### 6.2 Motor değişikliği gerektiren seçenekler (ayrı plan, ayrı PR, onay)

| Kod | Değişiklik | Neden ayrı | Etki |
|---|---|---|---|
| M-1 | `inp.Ns` kaynak sınırının altındaysa motor uyarısı | Uyarı metni | Hesap değişmez |
| M-2 | Motorun aday üretimine tam-k gruplama | **Önerilen düzen değişebilir** (daha fazla aday) | Altın kayıtlar ve öneriler değişebilir; bağımsız doğrulama + hesap değişiklik kaydı |
| M-3 | Otomatik öneride "dengeli" gruplama | Örnekteki gibi 22 yerine 20/21 önerebilir | Aynı |

Öneri: önce 6.1 (motor değişmeden); M-1 MH-MOTOR-1 ile; M-2/M-3 yalnız saha verisiyle doğrulandıktan
sonra ve onayla.

## 7. Harita düzenleme

Bütün işlemler aynı `assign[]` taslağını değiştirir; hiçbiri projeye doğrudan yazmaz.

| İşlem | Masaüstü | Android | `assign[]` üzerindeki etkisi |
|---|---|---|---|
| Seç | Tıkla; Shift+tıkla ile ekle; sürükleyerek alan seçimi | "Seç" modu: dokunarak ekle/çıkar | — |
| Taşı | Seçim + hedef shift (liste veya numara tuşu) | Seçim + alttaki "Taşı → Shift n" | Seçilenlerin değeri = hedef |
| Birleştir | İki shift seç → Birleştir | Aynı | B'nin üniteleri A'ya; numaralar sıkıştırılır |
| Ayır | Bir shift'ten üniteleri seç → "Yeni shift" | Aynı | Seçilenler yeni numaraya |
| Numara düzenle | Shift listesinde sürükle-bırak / numara gir | Listede yukarı/aşağı | Numaraların yer değiştirmesi; **hidrolik değişmez** (testle) |
| Otomatiğe dön | Düğme (taslakta) | Aynı | Taslak otomatik gruplamayla değiştirilir; orijinal korunur |

**Anlık ön kontrol (hesap değil):** her işlemden sonra shift debileri alt ünite debilerinin toplamı
olarak hemen gösterilir ve kaynak aşımı kırmızı işaretlenir. Bu toplam motorun `Qj` değeriyle
aynıdır, ama ekranda "ön kontrol" diye etiketlenir. Basınç, çap, pompa, enerji, malzeme ve uyarılar
yalnız **Yeniden hesapla** ile gelir; o zamana kadar "Hesaplanmadı" yazar.

**Etiketler:** yakınlaştırmaya göre üç düzey — uzak: yalnız numara rozeti; orta: numara + debi;
yakın: tam kutu (alan, debi, süre, basınç). Çakışan etiketler yerleştirici ile kaydırılır ya da
gizlenir. "Shift etiketleri" aç/kapa düğmesi. Renkler ardışık shift'lerde ayırt edilebilir
(renk + numara; yalnız renge dayanılmaz). Etiketteki sabit "FIELD 1" metni Türkçeleştirilir.

## 8. Taslak, uygulama ve veri güvenliği

- Taslak MH-MANUEL veri modelindedir: `degisiklik.shiftEdit = { sig, assign, yontem:
  'sirali'|'dengeli'|'komsulu'|'harita', istenenNs }`.
- **Uygula** onay ister; önce tam durum revizyonu, sonra değişiklik kaydı (eski/yeni shift sayısı,
  en büyük shift, tur, pompa, enerji, malzeme, uyarı farkı). Önceki düzene revizyondan dönülür.
- İmza (yerleşim) değişirse taslak **silinmez**, "yerleşim değişti — atama geçersiz" olarak
  saklanır. Bugünkü sessiz silme (`app.js:406`) ve fırçanın doğrudan projeye yazması
  MH-MANUEL-1A'da kaldırılır.
- Kaynak debisi hiçbir işlemde değişmez; kaynak değişikliği ayrı bir girdi taslağıdır.

## 9. Doğrulama ve otomatik test planı

| Kod | Test |
|---|---|
| S-1 | Üretici: her alt ünite tam bir shift'te; tam k boş olmayan shift; "kaynak içinde" denen her düzende her shift ≤ Qs |
| S-2 | Fiziksel alt sınırın altındaki k için üretici `null` + kanıt (ΣQ/Qs) döner; ekran seçtirmez |
| S-3 | Motor eşitliği: üretilen `assign` ile ekrandaki her değer `IrriEngine.design(…, { manual })` ile birebir aynı |
| S-4 | Oran yok: shift debisi = alt ünite debileri toplamı; tur = Σ motor shift süreleri (oran formülü yasak, kod taraması) |
| S-5 | Numara değiştirme (permütasyon) hidrolik sonucu değiştirmez (Qj kümesi, Hmax, pompa, enerji, malzeme aynı) |
| S-6 | Birleştir/ayır/taşı işlemleri `assign[]`'ı beklenen biçimde değiştirir; boş shift kalmaz; numaralar sıkıştırılır |
| S-7 | Kaynak aşımı: ön kontrol kırmızı + motor W-KAP-03 + uygula kapalı |
| S-8 | Senaryo A'nın (§5) bütün satırları motorla aynı; 18 shift engellenir ve doğru gerekçe |
| S-9 | Senaryo B: 20 shift "motor listesinde yok" ama dengeli gruplamayla hesaplanır; istenen/uygulanan doğru |
| S-10 | test2 (32 neredeyse eşit ünite): 20 shift isteği → seçenekler, gerekçe, gerçek sonuç |
| S-11 | İptal → proje bayt bayt aynı; uygula → revizyon; geri dön → eski `shiftEdit` (MH-MANUEL V-03, V-07) |
| S-12 | İmza değişince taslak saklanır ve "geçersiz" görünür; sessiz silme yok |
| S-13 | Etiket yoğunluğu: üç yakınlaştırma düzeyinde etiket sayısı ve çakışma yok; aç/kapa |
| S-14 | Android (390 px, dokunmatik, Capacitor) ve masaüstü (1280/1440/1920) aynı değerler |
| S-15 | Performans: aralık taraması (ör. 19–29, 11 motor çalıştırması) parça parça, ilerleme göstergesiyle; telefonda < 10 s |
| S-16 | MH-0 altın kayıtları, 38 hidrolik denetim, EPANET doğrulamaları değişmez |

**Bağımsız mühendislik doğrulaması**

| Kod | Doğrulama |
|---|---|
| D-1 | Küçük bir örnekte (6 alt ünite, 2 shift, komşu olmayan atama) ana hat kesit debileri elle hesaplanır, motorla karşılaştırılır |
| D-2 | Komşu olmayan bir düzen EPANET modeline aktarılır; kesit debileri ve basınçlar karşılaştırılır (mevcut EPANET doğrulama yöntemi) |
| D-3 | 18 shift için kaynak gereksinimi ve tur sınırı (§4 formülleri) elle hesaplanır |
| D-4 | §5'teki malzeme/enerji farkı kesit kesit izlenir (hangi ana hat parçası küçüldü, neden) |
| D-5 | Saha uygulanabilirliği: komşu olmayan shift'lerin vana programı ve otomasyon kontrol listesi (mühendis onayı) |

## 10. Ekranlar

- **Masaüstü:** harita (orta) + "Shift yönetimi" paneli (sağ: otomatik/manuel, mevcut ve istenen
  shift, mümkün aralık çubuğu, yöntem, Yeni düzeni hesapla) + alt panelde eski/yeni karşılaştırma ve
  shift listesi.
- **Masaüstü düzenleme:** çoklu seçim, araç çubuğu (Taşı, Birleştir, Ayır, Numara, Otomatiğe dön),
  etiket yoğunluğu ve aç/kapa.
- **Android:** Sonuç/Arazi'den açılan tam ekran "Shift yönetimi"; haritada dokunmatik seçim ve alt
  işlem çubuğu; "Önce → Sonra" kartları.

## 11. MH-MANUEL ve MH-AKIL-3 ile bütünleşme

- MH-SHIFT, MH-MANUEL'in taslak/yeniden hesaplama/karşılaştırma/revizyon altyapısını kullanır;
  ayrı bir kayıt yapısı kurmaz.
- MH-AKIL-2: "shift sayısı" ailesi alternatifleri gruplama üreticiyle zenginleşir (motorun listesi
  dışındaki sayılar da hesaplanır).
- MH-AKIL-3 (arazi bölme): her alt proje kendi `assign[]`'ına sahiptir; ortak kaynak payları
  (`kaynakGrup`) toplamı kaynağı aşamaz. Shift sayısı sorunu kapasiteden geliyorsa (örnekteki gibi)
  ekran "Araziyi böl" ve kaynak/süre alternatiflerini önerir.

## 12. Yol haritası yerleşimi

| Aşama | Kapsam | Bağımlılık |
|---|---|---|
| MH-SHIFT-1 | Salt okunur analiz: mümkün aralık (fiziksel/motor), shift başına süre, tur sınırı, "neden 22?" açıklaması; etiket yoğunluğu ve aç/kapa | MH-MANUEL-1A (veri koruma) |
| MH-SHIFT-2 | Manuel shift sayısı: gruplama üretici + motorun elle atama yolu, taslak, karşılaştırma, uygula/iptal | MH-MANUEL-1B ve 2 |
| MH-SHIFT-3 | Haritadan düzenleme: çoklu seçim, taşı, birleştir, ayır, numara, otomatiğe dön (Android + masaüstü) | MH-SHIFT-2, MH-MANUEL-3 |
| MH-MOTOR-1 | M-0 ve M-1 (uyarı metinleri) | Ayrı onay |
| MH-MOTOR-x | M-2/M-3 (motor aday üretimi) | Saha doğrulaması + ayrı onay |
| MH-AKIL-3 | Arazi bölme ile ortak `assign[]` ve kaynak grubu | MH-SHIFT-2 |

Önerilen sıra: PR #8 → MH-MANUEL-1A → (MH-SHIFT-1) → MH-MANUEL-1B → MH-MANUEL-2 → **MH-SHIFT-2** →
MH-MANUEL-3 → **MH-SHIFT-3** → MH-KML → MH-MANUEL-4 → …
