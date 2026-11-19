# MH-PN — Boru basınç sınıfı (PN) yönetimi ve MH-AKIL-5 bağlantısı

Durum: **teknik plan — proje sahibinin onayını bekliyor (19.11.2026). Kodlama yok.**
Her geliştirme ayrı dal ve ayrı PR; onay olmadan `main`'e birleştirilmez. MH-2A, MH-MANUEL-1A,
MH-KML, T-08 ve MH-AKIL-5 planları bu belgeyle değişmez; yalnız bağımlılıklar eklenir.
`docs/yol-haritasi.md` ve `docs/teknik-inceleme.md`, PR #14 ile çakışmamak için PR #14'ün
kararından sonra güncellenecek (bu belge yalnız yeni dosyadır).

## 1. Bugünkü durum (kod incelemesi, `main` ef28f45)

| Konu | Bugün | Yer |
|---|---|---|
| Boru kataloğu | PE100 (yalnız manifold): PN6/10/16 = SDR26/17/11, Ø32–160. PVC-U (yalnız ana hat): PN6/10/16, Ø63–315. Lateral: Ø16/Ø20, `maxH` 25 m (jenerik). PE80, PN4, PN8, PN12,5 **yok** | `www/js/catalog-data.js` 6–30 |
| Ana hat malzemesi | Her zaman PVC-U; PE ana hat seçilemez | `engine.js` 194–256 |
| Ana hat PN seçimi | Her çap için en düşük PN ki: `PN·10,2 ≥ max(1,25·Pop, Pshut)` (Pop: en alçak noktada, sürtünmesiz; Pshut: jenerik kapama 1,3·Hp + Havail − zMin) | `engine.js` 192, 245–256 |
| Kullanıcı seçimi | Yalnız ana hat dış çapı (`inp.mainOd`, uygun alternatifler içindeyse) ve lateral çapı (`latD`). PN, SDR ve malzeme seçilemez | `engine.js` 91, 262; `app.js` 521 |
| Manifold PN | Her çap için **en düşük PN** (PN6) alınır; yalnız sonradan uyarı: `1,25·hInMax > PN·10,2` | `engine.js` 97–100, 352–353 |
| Lateral | Katalog `maxH` ile uyarı (PN merdivenine girmez — istenen davranış zaten bu) | `engine.js` 133; `assess.js` 259 |
| İzin verilen basınç | `PN × 10,2 m`; **sıcaklık, kullanım ömrü ve tasarım katsayısı yok** | `engine.js` 250, 351; `hydro-view.js` 205 |
| Sürtünme | Hazen-Williams, **bütün malzemelerde C = 150**; ana hatta %10 yerel kayıp | `hydraulics.js` 11; `engine.js` 239 |
| Su darbesi | Joukowsky: `a = √(K/ρ / (1 + K·D/(E·e)))`, `ΔH = a·v/g`, `Tc = 2L/a`; E: PE 1,0 GPa, PVC 3,0 GPa (sabit); `tepe = Pop + ΔH`; `exceeds = tepe > PN·10,2` | `engine.js` 382–389 |
| Su darbesi sınıflandırması | `exceeds` ise **"uygunsuz"** (W-SD-01, `bad`) — yeni gereksinime (C) aykırı | `assess.js` 300–305; `hydro-view.js` 215 |
| Vana kapanma süresi | Girdi yok; yalnız `5 × 2L/a` pratik kuralı yazılıyor | `engine.js` 388; `hydro-view.js` 214 |
| Raporlar | PDF/Excel'de ana hat "PVC-U Øx PNy", iç çap, alternatifler; Excel kütüphane sayfası `pipelib.js` (kullanıcının Excel tablosu) | `report-data.js` 57–70, 164–196 |

### 1.1 Doğrulanması gereken bulgu: PVC-U kataloğunun SDR/PN eşleşmesi

Katalogdaki PVC-U et kalınlıkları bütün çaplarda **SDR ≈ 33 / 21 / 13,6** serisine karşılık geliyor
(ör. Ø110: 3,2 / 5,3 / 8,1 mm). Bu seri, PVC-U için **C = 2,5** (σs = 10 MPa) tasarım katsayısıyla
PN6/10/16 verir. EN 1452-2'nin bilinen sürümünde dn > 90 mm için C = 2,0 (σs = 12,5 MPa)
kullanılır; bu durumda aynı SDR'ler PN8/12,5/20'ye karşılık gelir ve PN10 için SDR26 yeterli olur.
Sonuç: bugünkü katalog büyük çaplarda **güvenli yönde** (daha kalın et, daha küçük iç çap), ama
PN–SDR ilişkisi açıkça tanımlı değil. Ø110 PN6 için 3,2 mm, SDR33'ün (3,4 mm) biraz altında kalıyor.
**Bu bulgu standart tablosundan (EN 1452-2, TS EN 1452-2) ve tedarikçi kataloğundan doğrulanmadan
katalog değiştirilmez.** Değişirse ana hat seçimi ve altın kayıtlar değişir; ayrı hesap değişikliği
kaydı ve onay gerekir.

### 1.2 Regresyon referansı: 66 da domates

Ekran görüntüsündeki değerler: işletme 31,1 m, teorik su darbesi ≈ 54 m, tepe ≈ 86 m.
Bugünkü formülle tutarlı: `tepe = Pop + ΔH` (31,1 + 54,x ≈ 85–86, yuvarlama). ΔH ≈ 54 m ve
a ≈ 300 m/s için ana hat hızı ≈ 1,75 m/s. Bu değerler **regresyon referansıdır, doğrulanmış
fiziksel sonuç değildir.** Testte kullanmak için projenin tam girdisi gerekir: Ayarlar → Yedek
(JSON) dışa aktarımı veya parsel, kaynak, güzergâh ve girdi değerleri (§12, K-1). Senaryo
`test/golden/scenarios.js`'e **yeni** senaryo olarak eklenir; mevcut senaryolar değişmez.

## 2. Eksik giriş verileri ve motorun sınırları

| Eksik | Etkisi | Plan |
|---|---|---|
| İşletme sıcaklığı | PE ve PVC'de izin verilen basınç sıcaklıkla düşer | Proje girdisi `suSicakligi` (°C), varsayılan 20 °C, "varsayılan" etiketiyle |
| Malzeme sınıfı (MRS) ve C katsayısı | PN ↔ SDR ↔ izin verilen basınç | Katalog kaydına `mrs`, `cTasarim`, `standart` |
| Kullanım ömrü | Standart PN değerleri 50 yıl, 20 °C esaslıdır | Bilgi olarak; farklı ömür yalnız üretici verisiyle |
| Üretici limiti | Ek parça, vana ve flanş sınıfı boru PN'inden düşük olabilir | Katalogda `pnBilesen` (isteğe bağlı); en düşüğü sınır olur |
| Malzemeye göre HW C | Sürtünme | Katalogda `hwC` (varsayılan 150 korunur; değişiklik ayrı onay) |
| Elastisite modülü E (kısa süreli), sıcaklığa bağlı | Dalga hızı | Katalog `eKisa` (GPa) + kaynak; yoksa bugünkü sabitler |
| Vana kapanma süresi ve karakteristiği | Kapanma ön değerlendirmesi | Girdi (§6) |
| Pompa ataleti, çekvalf, hava vanaları, hat kot profili | Ayrıntılı geçici rejim | MH-AKIL-5 (§7) |
| Ana hat boyunca kot | En yüksek ve en alçak nokta, negatif basınç | MH-2A profili (§8) |

Motor sınırları (bu planda değişmez): manifold için yalnız çap seçimi, ana hat yalnız PVC, tek düzlem
kot modeli, sürtünmesiz en alçak nokta basıncı (güvenli yön), su darbesi tek hız ve tek hat
uzunluğuyla.

## 3. PN veri modeli (A)

```js
// Katalog boru kaydı (geriye uyumlu: eski alanlar aynen kalır)
{ id: 'pe100-110-sdr17', malzeme: 'PE100', od: 110, sdr: 17, et: 6.6, ic: 96.8, pn: 10,
  mrs: 10, cTasarim: 1.25, standart: 'EN 12201-2', hwC: 150, eKisa: 1.0,
  hatTurleri: ['ana', 'manifold', 'dagitim'], uretici: null, katalogKodu: null,
  pnBilesen: null, kaynak: '…', dogrulandi: false }
```

- **Kombinasyon kuralı:** `PN = 20·MRS / (C·(SDR − 1))`, standart PN değerine aşağı yuvarlanır.
  Kayıtta yazan PN bu kuralla çelişirse katalog doğrulayıcısı (`catalog.js`) uyarı verir. Yalnız
  standart tablosunda bulunan çap–SDR çiftleri listelenir; ekranda geçersiz kombinasyon seçilemez.
- **Malzemeler:** PE100, PE80 ve PVC-U (ilk aşama). PE-RT, PP-R ve GRP yalnız katalog içe aktarımıyla,
  standart tablosu doğrulanınca.
- **PN merdiveni:** PN4, PN6, PN8, PN10, PN12,5 ve PN16 (PN20 yalnız katalogda varsa). Hangi
  malzemede hangi SDR'nin hangi PN'e denk geldiği **standart tablolarından** alınır ve
  `test/pn.test.js`'te tabloyla karşılaştırılır (P-01).
- **Hat türleri:** `ana` (kaynak → arazi), `dagitim` (ana hat kollarında teleskop), `manifold`,
  `lateral`. Lateral ve damla bantları PN merdivenine **girmez**: `maxH` (üretici maksimum işletme
  basıncı) ile kontrol edilir.
- **Proje alanı:** `inp.boruSecimi = { ana: {malzeme, od, sdr} | null, manifold: {malzeme, sdr} | null }`.
  `null` ise bugünkü otomatik seçim **aynen** çalışır (altın kayıtlar değişmez).
- **Varsayılan katalog:** yeni kombinasyonlar otomatik seçimde kullanılacak listeye **hemen
  eklenmez** (eklenirse ör. PVC PN8 otomatik seçilir ve altın kayıtlar değişir). Ayrı bir
  "seçilebilir borular" listesinde durur; otomatik seçime katılmaları ayrı karar ve hesap
  değişikliği kaydı ister (§12, K-3).

## 4. Seçim değişince yeniden hesap (B)

Kullanıcı malzeme, çap, SDR veya PN değiştirdiğinde motor **aynı `design()` çağrısıyla** baştan
çalışır. Ayrı bir kısayol hesabı yoktur, böylece ekran ile rapor ayrışmaz.

1. İç çap: `ic = od − 2·et` (katalog), et yoksa `od·(1 − 2/SDR)`.
2. Hız: `Hy.velocity(Q, ic)`, her segment ve shift için.
3. Sürtünme ve yerel kayıp: `Hy.hfHW(Q, ic, L, hwC) × 1,10`.
4. Shift sonuçları: `reqH` her shift için yeniden (`engine.js` 228–241).
5. Pompa: gerekli basma yüksekliği ve katalog pompa seçimi yeniden.
6. Malzeme listesi ve metraj: `bom()` anahtarları `pvc:od:pn` → `malzeme:od:sdr` olur
   (eski anahtarlar fiyat eşlemesi için okunmaya devam eder).
7. Su darbesi ön değerlendirmesi: yeni `ic`, `et`, `E` ve `v` ile.

Motor değişikliği (`opt.boruSecimi` yolu) **ekleme** niteliğindedir: seçim verilmezse kod yolu bugünkü
ile aynıdır. Yine de motor dosyasına dokunduğu için `docs/hesap-degisiklik-kaydi.md`'ye kayıt,
bağımsız doğrulama (EPANET karşılaştırması, `test/ref/epanet.js`) ve ayrı onay gerekir.

Kullanıcının seçtiği boru hız sınırını (2,0 m/s) veya PN kontrolünü geçmezse seçim **reddedilmez**:
hesap yapılır ve sonuç "uygunsuz" olarak işaretlenir. Kullanıcı yanlış seçimin sonucunu görür,
otomatik öneri yanında kalır.

## 5. PN güvenlik değerlendirmesi (C)

### 5.1 İzin verilen basınç

```
PFA (izin verilen sürekli işletme basıncı) = PN × fT × fUretici        [bar → m: × 10,197]
PMA (geçici dahil izin verilen en yüksek)  = kGecici × PFA
```

- `fT`: sıcaklık düşürme katsayısı (malzemeye göre tablo; 20 °C'de 1,0). Değerler kodlamadan
  önce EN 12201-1 (PE), EN 1452-2 (PVC-U) ve tedarikçi kataloğundan doğrulanır; doğrulanmayan
  değer ekranda "doğrulanmamış" etiketiyle gösterilir.
- `fUretici`: üretici veya bileşen sınırı (ek parça, vana PN'i); yoksa 1,0.
- `kGecici`: geçici basınç payı. Standartlara göre değişir (ör. EN 805'te bileşenler için
  PMA = 1,2 × PFA; bazı PE ürün standartlarında ara sıra oluşan darbe için daha yüksek paylar).
  **Varsayılan 1,0 (en temkinli)**; başka bir değer yalnız kullanıcı kaynağıyla seçilir (§12, K-4).

### 5.2 İki ayrı kontrol

| Kontrol | Karşılaştırma | Sonuç |
|---|---|---|
| **N — Normal işletme** | Hat türü boyunca en yüksek normal işletme basıncı (her shift; en alçak nokta, sürtünmesiz — bugünkü güvenli yaklaşım) ≤ PFA. Bugünkü 1,25 × Pop tasarım kuralı ve pompa kapama basıncı (Pshut ≤ PFA) ayrı satırlarda korunur | Uygun / Uygunsuz |
| **G — Geçici rejim ön değerlendirmesi** | Joukowsky üst sınırı: `Pop + ΔH` ile PMA; ayrıca `Pmin = Pdüşük − ΔH` ile buhar basıncı (≈ −10 m) | Sınır içinde (ön değerlendirme) / **Geçici rejim analizi gerekli** |

Sınıflandırma kuralı (yeni):

| N | G | Gösterilen durum |
|---|---|---|
| Uygun | Sınır içinde | Uygun — "su darbesi yalnız ön değerlendirme" notuyla |
| Uygun | Aşıyor | **Geçici rejim analizi gerekli** (`uygunsuz` **değil**). Uyarı: "Teorik su darbesi üst sınırı PN sınıfını aşabilir. Ayrıntılı geçici rejim analizi gereklidir." |
| Uygunsuz | — | Uygunsuz (normal işletme nedeniyle) |
| — | Pmin < buhar basıncı | Geçici rejim analizi gerekli + "negatif basınç / kolon ayrılması riski" notu |

Joukowsky değeri hiçbir ekranda "en yüksek basınç" olarak yazılmaz; etiket her yerde
"teorik ani kapanma üst sınırı" olur. Bugünkü `engine.js` `surge()` formülü değişmez. Değişen,
`assess.js`'teki W-SD-01 sınıflandırması ve `hydro-view.js`'teki durum rengidir. Bu yüzden
`test/fixtures/assess-kodlar.json` kaydı değişir; değişiklik kayıt belgesine yazılır.

### 5.3 Kontrolün yapıldığı hatlar

| Hat | Kontrol |
|---|---|
| Ana hat (ve teleskop kolları) | N + G, segment bazında (her segmentin kendi PN'i ve en yüksek basıncı) |
| Manifold | N (giriş basıncı, her shift); G yalnız bilgi (manifold vanası kapanması MH-AKIL-5) |
| Lateral / damla bandı | `maxH` ile N; PN uygulanmaz |

## 6. Vana kapanma süresi (D)

- Girdi: `vanaKapanma` (s), isteğe bağlı; karakteristik: `dogrusal`, `surgulu`, `kelebek`, `kuresel`,
  `bilinmiyor` (varsayılan).
- Gösterilen: `2L/a`, girilen süre ve ikisinin oranı.
  - `t ≤ 2L/a` → "ani kapanma: Joukowsky üst sınırı geçerli".
  - `t > 2L/a` → "kapanma kritik süreden uzun — **bu tek başına güvenlik garantisi değildir**".
    Akışın büyük kısmı kapanmanın son bölümünde kesilir (özellikle sürgülü ve kelebek vanada) ve
    pompa duruşu çoğu zaman daha kritik bir senaryodur.
- Kapanma süresine bağlı **sayısal basınç değeri üretilmez** (yavaş kapanma formülleri vana
  karakteristiğine çok duyarlıdır). Sayısal sonuç yalnız MH-AKIL-5 MOC çözümüyle verilir.
- Bütün metinler "ön değerlendirme" etiketlidir.

## 7. MH-AKIL-5 — ayrıntılı geçici rejim (ileri aşama, ayrı plan ve onay)

**Yöntem:** Karakteristikler Yöntemi (MOC), tek boyutlu, sabit zaman adımı `Δt = Δx / a`
(Courant = 1). Boru başına dalga hızı ayrı tutulur; dalga hızları ızgaraya uymazsa küçük ayarlama
yapılır ve ayarlama raporlanır. Sürtünme: kararlı-durum (quasi-steady) Darcy–Weisbach; kararsız
sürtünme modeli ileri sürüm. Kolon ayrılması: ayrık buhar boşluğu modeli (DVCM), başlangıçta
yalnız "risk var" göstergesi.

| Kapsam | Gerekli giriş | Veri yoksa |
|---|---|---|
| Vana kapanma eğrisine bağlı geçici basınç | Kapanma süresi, vana karakteristiği τ(t) (katalog veya tipik eğri), vana konumu | Sonuç üretilmez |
| Pompa duruşu / elektrik kesintisi | Pompa + motor eylemsizlik momenti (WR², kg·m²), devir, pompa eğrisi (dört bölge verisi veya özgül hıza göre tipik Suter eğrisi — tipikse etiketli), çekvalf tipi ve kapanma davranışı | Sonuç üretilmez |
| En yüksek / en düşük geçici basınç zarfı | Hat geometrisi, segment bazında boru (od, et, E, PN), başlangıç kararlı akış (motor çıktısı) | — |
| Negatif basınç ve kolon ayrılması | **Ana hat boyuna kot profili** (MH-2A), buhar basıncı (sıcaklığa göre) | "Kot profili yok — değerlendirilemedi" |
| Hava/vakum vanaları (konum ve kapasite) | Profil (yüksek noktalar, eğim kırılmaları), vana çapı ve üretici akış eğrisi | Yalnız konum önerisi, kapasite yok |
| Hat boyunca geçici basınç profili | Profil + MOC zarfı | — |
| PN / geçici dayanım doğrulaması | PMA (§5.1), boru ve bileşen sınırları | — |

- Eksik veride **sonuç üretilmez ve "güvenli" izlenimi verilmez**: "Hesaplanamadı — eksik veri: …".
- **Doğrulama:** analitik Joukowsky (ani kapanma, sürtünmesiz tek boru), yayımlanmış klasik
  vana kapanma test durumları (ders kitabı örnekleri) ve bağımsız açık kaynak bir MOC çözücüsüyle
  (ör. TSNet; yalnız geliştirme sırasında, uygulamaya eklenmez) karşılaştırma. Kabul ölçütleri
  plan aşamasında belirlenir.
- **Bağımlılıklar:** MH-PN-1/2 (boru verisi, PFA/PMA), MH-2A (profil), MH-3 (kotun hidrolik motora
  girmesi; en düşük ve en yüksek noktalar), pompa kataloğunda eylemsizlik ve dört bölge verisi
  (bugün jenerik pompa kayıtlarında yok).
- Çalışma yeri: `www/js/transient.js` (motor dışı, saf işlev); hem Android hem web aynı kod.
  Hesap süresi cihazda ölçülür; gerekirse Web Worker.

## 8. MH-2A ile bağlantı (F)

- MH-2A, ana hat güzergâhı boyunca kot profilini `kot` alanında **kaynak, düşey referans,
  doğruluk ve çözünürlükle** saklar (`docs/mh-2a-plan.md` §5). MH-PN bu alanı **yalnız okur**.
- Kullanım: (1) en alçak noktadaki işletme basıncı (bugün düzlemden), (2) en yüksek nokta (negatif
  basınç, hava vanası), (3) MOC profili. Hidrolik hesaba girmesi MH-3'tür; MH-PN'de girmez.
- Her sonuçta kot verisinin türü yazılır: "ölçülmüş", "DEM (GLO-90, ±2–4 m LE90)", "kullanıcı
  eğimi", "örnek/varsayılan". DEM ile negatif basınç değerlendirmesi yapılırsa doğruluk sınırı
  (MH-2A §3) yanında gösterilir. Kot verisi yoksa "Kot verisi yok — tek düzlem kabulü" yazılır.

## 9. Arayüz ve raporlar (G)

- **Boru seçimi:** Hidrolik → Ana hat ve Manifold kartlarında "Boru" satırı: malzeme · Ø · SDR ·
  PN · et · iç çap; "Otomatik (öneri)" / "Elle seçim". Seçici yalnız geçerli kombinasyonları
  listeler; seçim değişince hesap yenilenir ve önceki sonuçla fark (hız, kayıp, pompa H, maliyet)
  gösterilir.
- **Basınç kartı:** N ve G ayrı kartlar; PFA, PMA, sıcaklık katsayısı ve kaynağı.
- **Harita:** ana hat segmentlerinde "Ø110 PVC-U PN10" etiketi (açılıp kapanır katman);
  manifoldlarda çap/PN; renk segment PN'ine göre.
- **Shift:** her shift için basınç ve debi bugünkü gibi; N kontrolü shift bazında satır.
- **PDF ve Excel:** seçilen boruların teknik özellikleri (malzeme, standart, SDR, PN, et, iç çap,
  HW C, E), seçim türü (otomatik/elle), işletme basınçları, N/G sonuçları, uyarılar, varsayımlar
  (sıcaklık, katsayılar, kot kaynağı). Excel'de "Borular" sayfası.
- **Masaüstü (WEB-2) ve Android:** aynı görünüm modeli; masaüstünde sağ panel, Android'de kart.

## 10. Testler (H)

| Kod | Test |
|---|---|
| P-01 | PN/SDR/malzeme uyumu: PE100, PE80 ve PVC-U tablolarıyla birebir; geçersiz kombinasyon seçilemez; katalog doğrulayıcı çelişkiyi yakalar |
| P-02 | İç çap değişimi: aynı çapta PN6 → PN16 ile `ic` küçülür, `v` ve `hf` artar; değerler bağımsız hesapla (EPANET referansı) ±%1 |
| P-03 | PN6, PN10, PN16 karşılaştırması: shift H, pompa H, enerji, maliyet ve malzeme listesi tutarlı değişir |
| P-04 | N/G ayrımı: N uygunken yalnız G aşıyorsa durum "Geçici rejim analizi gerekli", **asla** "uygunsuz" değil; N aşıyorsa "uygunsuz" |
| P-05 | Sıcaklık katsayısı: 20 °C → 1,0; daha yüksek sıcaklıkta PFA düşer; doğrulanmamış katsayı etiketi |
| P-06 | Vana kapanma: süre yokken yalnız 2L/a; `t > 2L/a` metni "garanti değildir" içerir; sayısal yavaş kapanma basıncı üretilmez |
| P-07 | Eksik veri: E, et, sıcaklık, kot profili yokken açık "varsayılan/hesaplanamadı" etiketleri |
| P-08 | Geriye uyum: `boruSecimi` olmayan eski projeler bit bit aynı sonuç; **MH-0 altın kayıtları ve 38 denetim değişmez**; eski BOM fiyat anahtarları okunur |
| P-09 | 66 da domates regresyonu: 31,1 / ≈54 / ≈86 m (girdi alındıktan sonra; yalnız regresyon) |
| P-10 | Lateral PN merdivenine girmez; `maxH` kontrolü aynen |
| P-11 | Android (390 px, Capacitor) ve masaüstü web (1280/1440/1920): seçici, kartlar, harita etiketleri, rapor |
| P-12 | JSON yedek gidiş-dönüş `boruSecimi` dahil (MH-MANUEL-1A `STATE_FIELDS` mühendislik grubu) |

## 11. PR'lara bölme, bağımlılıklar ve çakışmalar

| PR | Kapsam | Motor | Bağımlılık | Çakışma riski |
|---|---|---|---|---|
| **PN-0** | Bu plan (yalnız belge) | — | — | Yok (yeni dosya) |
| **PN-1** | Boru veri modeli ve kütüphanesi (`www/js/pipes.js` yeni; PE100, PE80, PVC-U; PN4–PN16), katalog doğrulayıcı, P-01. Otomatik seçim listesi **değişmez** | Değişmez | PN-0 onayı; §1.1 bulgusunun doğrulanması | Düşük (`catalog.js`) |
| **PN-2** | N/G değerlendirmesi ve yeni sınıflandırma (§5): `www/js/pn-check.js` (motor dışı), `assess.js` W-SD-01, `hydro-view.js`, sıcaklık girdisi; P-04, P-05, P-07 | Değişmez (`surge()` aynı) | **PR #8 kararı** (`assess.js`, `assess-view.js` PR #8'de değişiyor) | PR #8 ile `assess.js` — PR #8 birleştikten sonra başlanır |
| **PN-3** | Kullanıcı boru seçimi ve yeniden hesap (§4): `opt.boruSecimi` yolu, BOM anahtarları; P-02, P-03, P-08 | **Ekleme** — hesap değişikliği kaydı + EPANET doğrulaması + ayrı onay | PN-1, PN-2, **MH-MANUEL-1A** (`boruSecimi` alanının revizyon ve yedekte korunması) | `engine.js`, `app.js` (1A ile) — 1A'dan sonra |
| **PN-4** | Arayüz, harita etiketleri, PDF/Excel (§9), vana kapanma girdisi (§6); P-06, P-11 | Değişmez | PN-3 | `app.js`, `desk.js`, `report*.js` — MH-SHIFT-1 harita etiketleriyle aynı katman yapısı kullanılır |
| **PN-5** | 66 da regresyon senaryosu (P-09), telefon testi listesi | Değişmez | Girdinin alınması (K-1) | Yok |
| **MH-AKIL-5** | §7, ayrı plan belgesi ve onay | Motor dışı yeni modül | PN-1…3, MH-2A, MH-3, pompa eylemsizlik verisi | — |

**Önerilen yerleşim** (onaylı sırayı bozmadan): PN-0 hemen (belge). PN-1, MH-KML ile paralel
yapılabilir; yeni dosya olduğu için çakışmaz. PN-2, PR #8'den hemen sonra ve küçük olduğu için
1A'dan önce de olabilir. PN-3 ve PN-4, MH-MANUEL-1A'dan sonra; tercihen MH-2A'dan sonra ve
MH-MANUEL-2 (gerçek yeniden hesaplama) ile birlikte planlanır. MH-AKIL-5, MH-2A ve MH-3'ten sonra.
Kesin yer proje sahibinin kararıdır (K-2).

Korunanlar: hesap motoru formülleri, MH-0 altın kayıtları, 38 hidrolik denetim, EPANET
doğrulamaları ve eski projeler. Bulut eşitlemesi ima edilmez. Çalışmayan özellik etkin gösterilmez.

## 12. Proje sahibinin kararı gereken konular

| No | Karar |
|---|---|
| K-1 | 66 da domates projesinin girdisi (JSON yedek veya parsel/kaynak/güzergâh/girdiler) |
| K-2 | PN-1…PN-4'ün onaylı sıradaki yeri (§11 önerisi) |
| K-3 | Yeni kombinasyonlar (PVC PN8, PN12,5; PE80; PE ana hat) otomatik seçime katılsın mı? Katılırsa altın kayıtlar değişir; ayrı hesap değişikliği |
| K-4 | Geçici basınç payı `kGecici` için hangi standart esas alınacak (varsayılan 1,0) |
| K-5 | §1.1 PVC-U SDR/PN bulgusu: hangi standart sürümü ve tedarikçi kataloğu esas alınacak |
| K-6 | Malzemeye göre HW C katsayısı (bugün hepsi 150): değiştirilsin mi? (hesap değişikliği) |

## Kaynaklar (kodlamadan önce asıl metinlerden doğrulanacak)

- EN 12201-1/-2 (PE su boruları: MRS, C = 1,25, SDR–PN tabloları, sıcaklık düşürme katsayıları)
- EN 1452-1/-2 (PVC-U su boruları: tasarım katsayısı, SDR–PN tabloları, sıcaklık katsayıları)
- ISO 4427 (PE su boruları), EN 805 (su temini: PFA/PMA/PEA tanımları)
- Wylie & Streeter, *Fluid Transients in Systems* (MOC); Chaudhry, *Applied Hydraulic Transients*
