# IrriGrow hesap doğrulama altyapısı (MH-0)

Bu klasör, IrriGrow hesap motorunun nasıl doğrulandığını, hangi varsayımların kullanıldığını ve hangi toleransların neden seçildiğini anlatır. MH-0 **hesapların hiçbirini değiştirmez**: mevcut sonuçları kayıt altına alır ve onları bağımsız referanslarla karşılaştırır.

Doğrulama üç katmandan oluşur:

| Katman | Dosyalar | Ne yapar |
|---|---|---|
| 1. Altın referans kaydı | `test/golden/`, `test/golden.test.js`, `tools/golden.js` | Bugünkü motorun bütün sonuçlarını dondurur. Herhangi bir sayı değişirse test durur. |
| 2. Bağımsız hidrolik doğrulama | `test/dogrulama.test.js`, `test/ref/epanet.js`, `tools/dogrulama-ozet.js` | Motor sonuçlarını analitik çözümlerle ve EPANET 2.3 ile karşılaştırır. |
| 3. Mevcut testler ve denetim | `test/*.test.js` (94 test), `tools/audit.js` (38 denetim) | Değişmeden korunur. |

Hepsi `npm test` ile çalışır ve CI'da her PR'da otomatik koşar.

---

## 1. Altın referans kaydı

### Kapsam
`test/golden/scenarios.js` içinde 18 tasarım senaryosu ve bir Hidrolik Hesap Tablosu örneği var. Her senaryo için kaydedilenler:

- **Tasarım:** alan, damlatıcı, lateral (Lmax, sayı, metraj, ΔH, hf, v, gerekli basınçlar), bütün alt üniteler (debi, manifold çapı, hf, basınç değişimi, giriş basıncı, kot, yol uzunluğu).
- **Ana hat:** segmentler (kod, uzunluk, çap, PN, shift başına debi, hız, hf) ve çap alternatifleri.
- **Shift alternatifleri:** gruplar, debiler, H, pompa ve enerji; seçilen ve önerilen düzen; pompa, filtre ve vana; sulama programı (aylık tablo dahil); su darbesi; malzeme listesi ve maliyet.
- **Uyarı ve varsayım metinleri.**
- **Çıktılar:**
  - Excel raporunun 11 sayfası, hücre hücre.
  - Hidrolik Excel'in formül, önbellek değeri ve sayı biçimi.
  - A3 pafta çiziminin SHA-256 özeti.
  - DXF dosyasının SHA-256 özeti.
- **Yerleşim alternatifleri:** S01 ve S17 senaryoları için.

Tarih alanları (`Tarih`, paftadaki proje tarihi) `<TARİH>` ile değiştirilir; böylece kayıt güne bağlı olmaz.

### Senaryolar
| Kod | Talep edilen durum | Not |
|---|---|---|
| S01 | Düz arazi | |
| S02 | Yukarı eğimli lateral | Eğim yönü bilinmiyor; motor yukarı yönlü en kötü durumu alır |
| S03 | Aşağı eğimli lateral | **Bilinen sınırlama:** motor bugün laterali yine \|eğim\| ile yukarı yönlü hesaplar. Kayıt bu davranışı dondurur; MH-3'teki değişiklik bu kayıt üzerinden gerekçelendirilecek. |
| S05 | Birden fazla shift | 14 shift |
| S06 | Düşük kaynak debisi | Tur süresi sığmaz uyarısı |
| S07 | Uzun ana hat | 2000 m |
| S08 / S09 | Yüksek kot farkı | +40 m / −40 m (cazibe) |
| S10 | Yetersiz pompa (şebeke) basıncı | Hidrant 1,5 bar → booster pompa |
| S11 | Yeterli şebeke basıncı | Pompa yok, regülatör |
| S12 / S13 | Farklı boru çapları | Lateral Ø20; ana hat zorunlu Ø160, kademesiz |
| S14 | Eksik veri | Boyut, eğim ve derinlik kabul edilir |
| S15 | Kullanıcının girdiği eğim (kot düzeltmesi) | Parsel, DEM yok, eğim elle |
| S16 | Basınç ayarlı damlatıcı | %5 eğim |
| S17 | Ağaç, yüzey suyu | Kum + disk filtre |
| S18 | Elle düzenlenmiş shift | Parsel, güzergâh |
| S19 | Büyük hidrant ağı | 300 da, 32 alt ünite |
| H01 | Hidrolik Hesap Tablosu | SİSTEM ve IRRIFRICT değerleri, Excel formülleri |

**Henüz modellenemeyen talepler** (`scenarios.bekleyen`):

| Kod | Durum | Ne zaman |
|---|---|---|
| S04 | Değişken eğimli güzergâh | Motor tek eğim düzlemi kullanıyor; arazi yüzeyiyle MH-3'te |
| S20 | Ölçülmüş kot noktaları | MH-2'de |

### Karşılaştırma kuralı
- Sayılar `|a − b| ≤ max(1e-9, 1e-9·|a|)` ile karşılaştırılır; yani yalnız kayan nokta yuvarlamasına izin verilir.
- Metinler ve yapı birebir aynı olmalıdır.

### Bilinçli bir hesap değişikliği nasıl yapılır
1. Değişiklik yapılır; `npm test` hangi sayıların değiştiğini listeler.
2. Farklar mühendislik açısından incelenir. Doğrulama testleri (bölüm 2) yine geçmelidir.
3. `node tools/golden.js` ile kayıt yenilenir; araç yeni **parmak izini** yazar.
4. `docs/hesap-degisiklik-kaydi.md` dosyasına yeni parmak izi, değişen büyüklükler, eski/yeni örnek değerler ve mühendislik gerekçesi eklenir.
5. Bu yapılmadan `golden.test.js` geçmez: kayıt parmak izi, değişiklik kaydında aranır.

---

## 2. Bağımsız hidrolik doğrulama

### 2.1 Analitik referanslar (motordan bağımsız kod)
| Kontrol | Referans | Tolerans | Gerekçe |
|---|---|---|---|
| Birim dönüşümleri | v = Q/A; Watters-Keller debi üssü 1,75 (Ø<125) ve 1,83 (Ø≥125); Hazen-Williams SI katsayısı 10,67, uzunlukla doğrusal | 1e-12 | Saf dönüşüm |
| Christiansen F | Tam toplam F = Σ iᵐ / N^(m+1), m = 1,75, ilk çıkış tam aralıkta | ±%0,5 | Formül, tam toplamın kapalı biçimli yaklaşığıdır |
| Watters-Keller | Colebrook-White, pürüzsüz boru (ε = 0), ν = 1,003·10⁻⁶ m²/s (20 °C), Re ≥ 4000, Ø 13,6–160 mm, v 0,3–2 m/s | −%6 … +%5 | WK, pürüzsüz plastik boru için bir üstel yaklaşımdır; geniş Re aralığında Colebrook'tan birkaç yüzde sapması beklenir (Keller & Bliesner 1990) |

### 2.2 EPANET karşılaştırmaları
EPANET 2.3, `epanet-js` 0.9.0 paketi (MIT lisanslı, WebAssembly) ile kullanılır. Aynı geometri EPANET'te ayrıca kurulur ve çözülür.

#### EPANET modelleme varsayımları
| Konu | Varsayım | Neden |
|---|---|---|
| Kaynak | Sabit yüklü rezervuar, H₀ = 1000 m | Mutlak değer sonucu etkilemez. Kayıp = H₀ − düğüm yükü. |
| Talepler | Sabit (basınçtan bağımsız) düğüm talebi = motorun nominal debisi | Motor da nominal debi kullanır. Basınca bağlı debi MH-4'ün konusudur. |
| Lateral | Her damlatıcı bir düğüm; damlatıcılar arası boru = damlatıcı aralığı; ilk damlatıcı dışındaki her damlatıcıya giden boruya, motordaki gibi bağlantı eşdeğer uzunluğu **fe** eklenir | Motorun yerel kayıp yaklaşımıyla aynı |
| Manifold | Her lateral çıkışı bir düğüm; motorla aynı çıkış uzaklıkları | |
| Kot | Düğüm kotu = eğim × konum (lateral ve manifold) | Aynı en kötü durum yönü |
| Sürtünme (lateral, manifold) | Darcy-Weisbach, mutlak pürüzlülük **ε = 0,0015 mm** (PE/PVC) | EPANET ε = 0 kabul etmez. 0,0015 mm, plastik boru için yaygın alt değerdir. |
| Ana hat ağı | Motorun ağaç topolojisi aynen: segment uç noktaları düğüm, ebeveyn-çocuk bağlantıları boru | |
| Ana hat sürtünmesi | Hazen-Williams, C = 150 | Motorla aynı formül; ağ çözümünün bağımsız kontrolü |
| Ana hat yerel kayıpları | Boru uzunluğu × 1,10 | Motorun %10 yerel kayıp payının eşdeğer uzunluk karşılığı. Hazen-Williams uzunlukla doğrusal olduğu için birebir aynıdır. |
| Kapalı kollar | O shift'te su taşımayan kollar modele konmaz | Motor da yalnız açık kolları hesaplar. Sıfır debili ölü uçlar basıncı etkilemez ama EPANET yakınsamasını bozar. |
| Sabit kayıplar | Filtre, gübreleme+sayaç+çekvalf (2 m), shift vanası ve alt ünite giriş basıncı motordan alınıp EPANET ağ kaybına eklenir | Bunlar ağ dışı ekipman kayıplarıdır; doğrulanan, ağın kendisidir |
| Yakınsama | ACCURACY = 1·10⁻⁷ (varsayılan 0,001), en çok 500 iterasyon | Kök debi tam eşleşmeli. "Dengelenemedi" uyarısı test hatasına çevrilir (`test/ref/epanet.js`). |
| HW çap üssü | EPANET 4,871, motor 4,87 | Ø100 mm'de ~%0,2 fark; ağ toleransının içinde |

#### Toleranslar ve ölçülen farklar
Ölçülen değerler `node tools/dogrulama-ozet.js` çıktısından alınmıştır.

| Karşılaştırma | Ölçülen (motor / referans − 1) | Tolerans | Gerekçe |
|---|---|---|---|
| Christiansen formülü / tam toplam | 0,00 … +0,16 % | ±%0,5 | Kapalı biçimli yaklaşık |
| Watters-Keller / Colebrook-White (pürüzsüz) | −5,17 … +4,18 % | −%6 … +%5 | Üstel yaklaşım farkı |
| **Lateral** hf ve ΔH / EPANET-DW | +2,74 … +4,90 % | −%1 … **+%6** | WK/CW bandı (+%4,2) artı lateral ucundaki laminer/geçiş bölgesi (EPANET laminer formül kullanır, WK türbülans varsayar). Motor güvenli (fazla kayıp) yönde; −%1 alt sınırı motorun EPANET'ten belirgin biçimde *az* kayıp hesaplamasını yakalar. |
| **Manifold** hf ve basınç değişimi / EPANET-DW, v ≤ 1,5 m/s | +0,96 … +3,16 % | −%1 … +%5 | Motorun manifold hız sınırı 1,5 m/s; bu aralıkta motor güvenli yönde |
| Manifold, v > 1,5 m/s (bilgi) | −2,21 % (v = 2,26 m/s) | ±%5 | Bkz. Bulgu 1 |
| **Ana hat ağı**, shift basma yüksekliği H / EPANET-HW (6 senaryo, 38 shift) | en büyük \|ΔH\| 0,033 m (%0,06) | max(0,10 m; %0,2) | Aynı formül; fark yalnız çap üssünden (4,87 / 4,871) |
| Ana hat kök debisi / EPANET | 0,00000 m³/h | 0,01 m³/h | Ağaçta süreklilik |
| Hazen-Williams C=150 / Darcy-Weisbach ε 0,0015 mm (bilgi), PVC Ø63–200, v 0,5–1,5 m/s | −6,68 … +5,64 % | −%8 … +%7 | İki yöntemin bilinen farkı. MH-4'te kullanıcıya karşılaştırma olarak gösterilecek. |

**Tolerans değiştirmek bir hesap değişikliğidir.** Gerekçesi `docs/hesap-degisiklik-kaydi.md` dosyasına yazılmadan yapılmaz.

### 2.3 Bulgular (hesaplar değiştirilmedi)
1. **Watters-Keller yüksek hızda güvenli yönden çıkar.** Manifoldda v > ~2 m/s'de motor sürtünmeyi Darcy-Weisbach'tan %2–6 *az* hesaplıyor; bu güvenli olmayan yön. Motor manifold hızını zaten ≤ 1,5 m/s ile sınırladığı için mevcut tasarımlar etkilenmiyor. MH-4'te Darcy-Weisbach karşılaştırması ekranda gösterilecek ve uyarı olarak eklenecek.
2. **Laterallerde motor %3–5 güvenli yönde.** Lateral uzunlukları bu kadar kısa (temkinli) seçiliyor. MH-4'te Darcy-Weisbach seçeneği bu payı görünür kılacak; değişiklik kayıt kuralına tabi olacak.
3. **Ana hat ağı çözümü, EPANET ile pratikte aynı** (≤ 3 cm).
4. **Aşağı eğimli laterallerde** motor bugün yukarı eğim varsayıyor (S03). Kayıt altına alındı; MH-3'ün ilk gerekçelendirilecek değişikliği olacak.

### 2.4 Sınırlar
- EPANET karşılaştırması **aynı modelleme varsayımlarıyla iki ayrı çözücünün** tutarlılığını gösterir. Saha ölçümünün yerini tutmaz.
- PDF'in görsel düzeni (jsPDF) ve telefona özgü işlemler (dosya kaydetme, paylaşma) Node testleriyle kapsanmaz. PDF içeriğindeki tablolar, Excel ile aynı veri katmanından (`report-data.js`) üretildiği için dolaylı olarak kayıttadır. Görsel ve cihaz kontrolleri elle yapılır.
- Ders kitabı örnekleri (Keller & Bliesner, FAO) MH-4 kapsamında, kaynağı ve sayfası belirtilerek eklenecek. Sayılar ezberden yazılmaz.
